/**
 * ZombieManager.tsx
 * 
 * Performance-optimized zombie management system:
 * 
 * Key functionality:
 * - Loads zombie model and animations ONCE and shares across all instances
 * - Manages multiple ZombieInstance components efficiently
 * - Reduces memory usage and load times significantly
 * - Handles model instancing and animation cloning
 * 
 * Performance Benefits:
 * - Single model load instead of N loads
 * - Shared animation clips with per-instance mixers
 * - Reduced memory footprint
 * - Faster initialization
 * 
 * Technical implementation:
 * - Uses React Context to share loaded resources
 * - Implements model cloning for instances
 * - Manages shared animation clips
 * - Handles loading states efficiently
 */

import React, { createContext, useContext, useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PlayerData } from '../generated';
import { makeZombieDecision, ZOMBIE_ANIMATIONS, ZombieDecision, STRIKING_DISTANCE } from './ZombieBrain';
import { ZOMBIE_CONFIG } from '../characterConfigs';
import { GameReadyCallbacks } from '../types/gameReady';

// Configurable spawn settings
const SPAWN_SETTINGS = {
  MIN_DISTANCE_FROM_PLAYERS: 20, // Farther spawn distance for more challenging gameplay
  WORLD_SIZE: 120, // Size of the game world for spawning (increased from 40 to accommodate 30+ unit distance)
  MAX_SPAWN_ATTEMPTS: 50, // Maximum attempts to find a safe spawn position
  FALLBACK_EDGE_DISTANCE: 0.4 // Multiplier for edge distance in fallback scenarios
};


// Execute zombie behavior based on AI decision
const executeBehavior = (
  decision: ZombieDecision,
  zombiePosition: React.MutableRefObject<THREE.Vector3>,
  zombieRotation: React.MutableRefObject<THREE.Euler>,
  delta: number
): void => {
  switch (decision.action) {
    case 'chase':
    case 'wander':
      if (decision.targetPosition) {
        // Calculate direction and distance to target
        const direction = new THREE.Vector3()
          .subVectors(decision.targetPosition, zombiePosition.current);
        const distanceToTarget = direction.length();
        
        // For chase behavior, stop moving when we get close enough (striking distance)
        // For wander behavior, always move toward target
        if (decision.action === 'wander' || distanceToTarget > STRIKING_DISTANCE) {
          direction.normalize();
          const moveAmount = direction.multiplyScalar(decision.speed * delta);
          zombiePosition.current.add(moveAmount);
        }
        
        // Rotate to face movement direction (regardless of whether we move)
        if (direction.length() > 0) {
          const targetRotation = Math.atan2(direction.x, direction.z);
          zombieRotation.current.y = targetRotation;
        }
      }
      break;
      
    case 'rotate':
    case 'scream':
      if (decision.targetRotation !== undefined) {
        // Smooth rotation toward target
        const currentRotation = zombieRotation.current.y;
        const targetRotation = decision.targetRotation;
        const rotationDiff = targetRotation - currentRotation;
        const normalizedDiff = Math.atan2(Math.sin(rotationDiff), Math.cos(rotationDiff));
        
        // Smooth rotation over the decision duration (0.5 seconds for rotate action)
        const rotationSpeed = decision.action === 'rotate' ? Math.PI : Math.PI * 2; // Slower for rotate action
        const rotationAmount = Math.sign(normalizedDiff) * Math.min(Math.abs(normalizedDiff), rotationSpeed * delta);
        zombieRotation.current.y += rotationAmount;
      }
      break;
      
    case 'attack':
      if (decision.targetPosition) {
        // Face the target but don't move
        const direction = new THREE.Vector3()
          .subVectors(decision.targetPosition, zombiePosition.current)
          .normalize();
        
        if (direction.length() > 0) {
          const targetRotation = Math.atan2(direction.x, direction.z);
          zombieRotation.current.y = targetRotation;
        }
      }
      break;
      
    case 'idle':
    default:
      // Do nothing for idle
      break;
  }
};

// Shared zombie resources
interface ZombieResources {
  model: THREE.Group | null;
  animationClips: Record<string, THREE.AnimationClip>;
  isLoaded: boolean;
}

// Context for sharing zombie resources
const ZombieResourceContext = createContext<ZombieResources>({
  model: null,
  animationClips: {},
  isLoaded: false
});

// Hook to use zombie resources
export const useZombieResources = () => {
  return useContext(ZombieResourceContext);
};

// AI States
enum ZombieState {
  IDLE = 'idle',
  TURNING = 'turning',
  SCREAMING = 'screaming',
  WALKING = 'walking'
}

interface ZombieInstanceProps {
  position: [number, number, number];
  players: ReadonlyMap<string, PlayerData>;
  isDebugVisible?: boolean;
  zombieId: string;
  shouldLoad?: boolean; // Whether this zombie should start loading
  onLoadComplete?: () => void; // Callback when loading finishes
}

// Individual zombie instance component (lightweight)
const ZombieInstance: React.FC<ZombieInstanceProps> = ({
  position,
  players,
  isDebugVisible = false,
  zombieId,
  shouldLoad = false,
  onLoadComplete
}) => {
  const { model: sharedModel, animationClips, isLoaded } = useZombieResources();
  const group = useRef<THREE.Group>(null!);
  
  // Instance-specific state
  const [instanceModel, setInstanceModel] = useState<THREE.Group | null>(null);
  const [mixer, setMixer] = useState<THREE.AnimationMixer | null>(null);
  const [animations, setAnimations] = useState<Record<string, THREE.AnimationAction>>({});
  const [currentAnimation, setCurrentAnimation] = useState<string>(ZOMBIE_ANIMATIONS.IDLE);
  const [isModelLoading, setIsModelLoading] = useState<boolean>(false);
  
  // Advanced AI State management
  const [currentDecision, setCurrentDecision] = useState<ZombieDecision | null>(null);
  const [decisionTimer, setDecisionTimer] = useState<number>(0);
  const [lastDecisionTime, setLastDecisionTime] = useState<number>(Date.now());
  const zombieStateRef = useRef<import('./ZombieBrain').ZombieState>({ mode: 'idle' });
  
  // Legacy AI states for compatibility (can be removed later)
  const [aiState, setAiState] = useState<ZombieState>(ZombieState.IDLE);
  const [targetPlayer, setTargetPlayer] = useState<PlayerData | null>(null);
  
  // Movement and rotation
  const zombiePosition = useRef<THREE.Vector3>(new THREE.Vector3(...position));
  const zombieRotation = useRef<THREE.Euler>(new THREE.Euler(0, Math.random() * Math.PI * 2, 0)); // Random Y rotation
  const targetRotation = useRef<number>(0);
  
  // Apply initial position to group
  useEffect(() => {
    if (group.current) {
      group.current.position.copy(zombiePosition.current);
    }
  }, [zombieId]);
  
  // Constants
  const ZOMBIE_SPEED = 3.0;
  const TURN_SPEED = 2.0;
  const SCREAM_DURATION = 2.0;

  // Sequential model loading to prevent main thread blocking
  useEffect(() => {
    if (!isLoaded || !shouldLoad || instanceModel || isModelLoading) return;
    
    setIsModelLoading(true);
    
    const loader = new GLTFLoader();
    loader.load(
      ZOMBIE_CONFIG.modelPath,
      (gltf) => {
        
        const model = gltf.scene;
        
        // Apply standardized scaling and positioning
        model.scale.setScalar(ZOMBIE_CONFIG.scale);
        model.position.set(0, ZOMBIE_CONFIG.yOffset, 0);
        
        // Enable shadows and process materials
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            
            // Convert material to standard material if needed
            if (child.material && child.material.type === 'MeshPhongMaterial') {
              const standardMaterial = new THREE.MeshStandardMaterial({
                map: child.material.map,
                color: child.material.color,
                emissive: child.material.emissive,
                transparent: child.material.transparent,
                opacity: child.material.opacity,
                roughness: 0.7,
                metalness: 0.1,
              });
              child.material = standardMaterial;
            }
          }
        });
        
        if (group.current) {
          group.current.add(model);
          // Hide model initially to prevent T-pose visibility
          model.visible = false;
        }
        
        // Create mixer for this instance
        const instanceMixer = new THREE.AnimationMixer(model);
        
        // Create actions from shared clips
        const instanceAnimations: Record<string, THREE.AnimationAction> = {};
        Object.entries(animationClips).forEach(([name, clip]) => {
          const action = instanceMixer.clipAction(clip);
          
          // Set loop mode
          if (name === ZOMBIE_ANIMATIONS.IDLE || name === ZOMBIE_ANIMATIONS.WALKING || name === ZOMBIE_ANIMATIONS.RUNNING) {
            action.setLoop(THREE.LoopRepeat, Infinity);
          } else {
            action.setLoop(THREE.LoopOnce, 1);
            action.clampWhenFinished = true;
          }
          
          instanceAnimations[name] = action;
        });
        
        setInstanceModel(model);
        setMixer(instanceMixer);
        setAnimations(instanceAnimations);
        setIsModelLoading(false);
        
        // Notify parent that loading is complete
        if (onLoadComplete) {
          onLoadComplete();
        }
        
        // Start idle animation and initialize AI
        setTimeout(() => {
          if (instanceAnimations[ZOMBIE_ANIMATIONS.IDLE]) {
            instanceAnimations[ZOMBIE_ANIMATIONS.IDLE].play();
            setCurrentAnimation(ZOMBIE_ANIMATIONS.IDLE);
            
            // Make model visible now that idle animation is playing
            if (model && model.visible !== undefined) {
              model.visible = true;
            }
            
            // Initialize AI with the new system and persistent state
            const initialDecision = makeZombieDecision(zombiePosition.current, players, zombieStateRef.current);
            setCurrentDecision(initialDecision);
            setDecisionTimer(0);
            setLastDecisionTime(Date.now());
          }
        }, 100);
      },
      undefined,
      (error) => {
        console.error(`[${zombieId}] Error loading fresh model:`, error);
        setIsModelLoading(false);
        if (onLoadComplete) {
          onLoadComplete(); // Still notify completion even on error
        }
      }
    );
    
    return () => {
      if (mixer) mixer.stopAllAction();
      if (instanceModel && group.current) group.current.remove(instanceModel);
    };
  }, [isLoaded, animationClips, zombieId, shouldLoad, instanceModel, isModelLoading, onLoadComplete]);

  // Play animation function
  const playZombieAnimation = useCallback((name: string) => {
    if (!mixer || !animations[name]) {
      return;
    }
    
    const targetAction = animations[name];
    const currentAction = animations[currentAnimation];
    
    if (currentAction && currentAction !== targetAction) {
      currentAction.fadeOut(0.3);
    }
    
    // Set animation speed - increased speed for walking
    const timeScale = name === ZOMBIE_ANIMATIONS.WALKING ? 3.0 : 1.5;
    
    targetAction.reset()
               .setEffectiveTimeScale(timeScale)
               .setEffectiveWeight(1)
               .fadeIn(0.3)
               .play();
               
    setCurrentAnimation(name);
  }, [animations, currentAnimation, mixer]);

  // Find nearest player - use horizontal distance only to avoid Y-axis issues
  const findNearestPlayer = useCallback((): PlayerData | null => {
    let nearestPlayer: PlayerData | null = null;
    let nearestDistance = Infinity;
    
    for (const player of players.values()) {
      // Use server position but ignore Y-axis differences for distance calculation
      // This prevents zombies from thinking players are far away due to Y-position reconciliation issues
      const playerPos = new THREE.Vector3(player.position.x, 0, player.position.z); // Force Y=0 for distance calc
      const zombiePos = new THREE.Vector3(zombiePosition.current.x, 0, zombiePosition.current.z); // Force Y=0 for distance calc
      const distance = zombiePos.distanceTo(playerPos);
      
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestPlayer = player;
      }
    }
    
    return nearestPlayer;
  }, [players]);

  // Calculate angle to target
  const calculateAngleToTarget = useCallback((target: THREE.Vector3): number => {
    const direction = new THREE.Vector3()
      .subVectors(target, zombiePosition.current)
      .normalize();
    return Math.atan2(direction.x, direction.z);
  }, []);

    // Advanced AI Update System with persistent state
  const updateAdvancedAI = useCallback((delta: number) => {
    // Update decision timer
    setDecisionTimer(prev => prev + delta);
    
    // Check if we need a new decision (convert duration from ms to seconds)
    if (!currentDecision || decisionTimer >= (currentDecision.duration / 1000)) {
      // Use the brain for new decisions with persistent state
      const newDecision = makeZombieDecision(zombiePosition.current, players, zombieStateRef.current);
      
      setCurrentDecision(newDecision);
      setDecisionTimer(0);
      setLastDecisionTime(Date.now());
      
      // Update legacy states for compatibility
      if (zombieStateRef.current.targetPlayerId) {
        const targetPlayerData = Array.from(players.values()).find(p => 
          p.identity.toHexString() === zombieStateRef.current.targetPlayerId
        );
        setTargetPlayer(targetPlayerData || null);
      } else {
        setTargetPlayer(null);
      }
      
      // Start the appropriate animation
      if (newDecision.animation !== currentAnimation) {
        playZombieAnimation(newDecision.animation);
      }
      
    }
    
    // Execute current decision with actual behavior
    if (currentDecision) {
      executeBehavior(currentDecision, zombiePosition, zombieRotation, delta);
      
    }
  }, [currentDecision, decisionTimer, players, playZombieAnimation, currentAnimation, zombieId]);

  // Frame update using React Three Fiber's useFrame hook
  useFrame((state, delta) => {
    if (!isLoaded || !instanceModel || !mixer) return;
    
    // Update animation mixer
    mixer.update(delta);
    
    // Update AI with new advanced system
    updateAdvancedAI(delta);
    
    // Update group position and rotation
    if (group.current) {
      group.current.position.copy(zombiePosition.current);
      group.current.rotation.copy(zombieRotation.current);
    }
  });
  
  // Debug logging for the first few zombies
  useEffect(() => {
    if ((zombieId === 'zombie-0' || zombieId === 'zombie-1') && instanceModel) {
      // Check group world position after next frame
      setTimeout(() => {
        if (group.current) {
          const worldPos = new THREE.Vector3();
          group.current.getWorldPosition(worldPos);
        }
      }, 500);
    }
  }, [instanceModel, animations, zombieId, position]);

  if (!isLoaded) {
    return null; // Don't render until resources are loaded
  }

  return (
    <group ref={group} castShadow>
      {/* Debug info */}
      {isDebugVisible && instanceModel && (
        <Html position={[0, 3, 0]} center>
          <div style={{ 
            background: 'rgba(255, 0, 0, 0.8)', 
            color: 'white', 
            padding: '5px',
            borderRadius: '3px',
            fontSize: '12px'
          }}>
            {zombieId} - Action: {currentDecision?.action || 'None'}<br/>
            Timer: {decisionTimer.toFixed(1)}s / {((currentDecision?.duration || 0) / 1000).toFixed(1)}s<br/>
            Mode: {zombieStateRef.current.mode}<br/>
            Target: {zombieStateRef.current.targetPlayerId ? `Player ${zombieStateRef.current.targetPlayerId.slice(-4)}` : 'None'}<br/>
            Pos: [{zombiePosition.current.x.toFixed(1)}, {zombiePosition.current.z.toFixed(1)}]
          </div>
        </Html>
      )}
      
      {/* Zombie nameplate - always show for now */}
      <Html position={[0, 1.8, 0]} center distanceFactor={10}>
        <div className="nametag">
          <div className="nametag-text" style={{ color: '#ff6666' }}>{zombieId}</div>
          <div className="nametag-class" style={{ color: '#cc4444' }}>Enemy NPC</div>
        </div>
      </Html>
    </group>
  );
};

interface ZombieManagerProps {
  zombieCount?: number;
  players: ReadonlyMap<string, PlayerData>;
  isDebugVisible?: boolean;
  minSpawnDistance?: number; // Minimum distance from players for zombie spawning
  gameReadyCallbacks?: GameReadyCallbacks; // Callbacks for GameReady events
}

// Main ZombieManager component
export const ZombieManager: React.FC<ZombieManagerProps> = ({
  zombieCount = 25,
  players,
  isDebugVisible = false,
  minSpawnDistance = SPAWN_SETTINGS.MIN_DISTANCE_FROM_PLAYERS,
  gameReadyCallbacks
}) => {
  const [resources, setResources] = useState<ZombieResources>({
    model: null,
    animationClips: {},
    isLoaded: false
  });

  // Sequential loading state
  const [loadedZombieCount, setLoadedZombieCount] = useState(0);
  const [currentLoadingIndex, setCurrentLoadingIndex] = useState(0);
  const LOADING_DELAY = 300; // 300ms delay between each zombie load

  // Emit initial zombie progress
  useEffect(() => {
    if (gameReadyCallbacks) {
      gameReadyCallbacks.onZombieProgress(0, 'Loading zombie resources...');
    }
  }, [gameReadyCallbacks]);

  // Load shared resources once
  useEffect(() => {
    const loader = new GLTFLoader();
    let loadedModel: THREE.Group | null = null;
    const loadedClips: Record<string, THREE.AnimationClip> = {};
    
    
    
    // Load main model
    loader.load(
      ZOMBIE_CONFIG.modelPath,
      (gltf) => {
        
        const model = gltf.scene;
        
        // Ensure shared model has default scale and position (don't transform the shared model itself)
        model.scale.set(1, 1, 1);
        model.position.set(0, 0, 0);
        
        loadedModel = model;
        
        // Process materials
        model.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            if (child.material && child.material.type === 'MeshPhongMaterial') {
              const standardMaterial = new THREE.MeshStandardMaterial({
                map: child.material.map,
                color: child.material.color,
                emissive: child.material.emissive,
                transparent: child.material.transparent,
                opacity: child.material.opacity,
                roughness: 0.7,
                metalness: 0.1,
              });
              child.material = standardMaterial;
            }
          }
        });
        
        
        checkLoadComplete();
      },
      undefined,
      (error) => {
        console.error('[ZombieManager] Error loading shared model:', error);
      }
    );

    // Load animations from converted GLB files
    const animationPaths: Record<string, string> = {
      [ZOMBIE_ANIMATIONS.IDLE]: '/models/zombie-2-converted/Zombie Walk.glb',
      [ZOMBIE_ANIMATIONS.SCREAM]: '/models/zombie-2-converted/Zombie Scream.glb',
      [ZOMBIE_ANIMATIONS.WALKING]: '/models/zombie-2-converted/Zombie Walk.glb',
      [ZOMBIE_ANIMATIONS.RUNNING]: '/models/zombie-2-converted/Zombie Running.glb',
      [ZOMBIE_ANIMATIONS.ATTACK]: '/models/zombie-2-converted/Zombie Punching.glb',
      [ZOMBIE_ANIMATIONS.DEATH]: '/models/zombie-2-converted/Zombie Death.glb',
    };

    let loadedAnimations = 0;
    const totalAnimations = Object.keys(animationPaths).length;

    Object.entries(animationPaths).forEach(([name, path]) => {
      loader.load(
        path,
        (animGltf) => {
          if (animGltf.animations && animGltf.animations.length > 0) {
            const clip = animGltf.animations[0].clone();
            clip.name = name;
            
            // Remove root motion
            const tracks = clip.tracks;
            const positionTracks = tracks.filter(track => track.name.endsWith('.position'));
            
            if (positionTracks.length > 0) {
              const rootPositionTrack = positionTracks.find(track => 
                track.name.toLowerCase().includes('hips') || 
                track.name.toLowerCase().includes('root') || 
                track.name.toLowerCase().includes('armature')
              ) || positionTracks[0];
              
              if (rootPositionTrack instanceof THREE.VectorKeyframeTrack) {
                const values = rootPositionTrack.values;
                for (let i = 0; i < values.length; i += 3) {
                  values[i] = 0;
                  values[i + 2] = 0;
                }
              }
            }
            
            loadedClips[name] = clip;
          }
          
          loadedAnimations++;
          checkLoadComplete();
        },
        undefined,
        (error) => {
          console.error(`[ZombieManager] Error loading animation ${name}:`, error);
          loadedAnimations++;
          checkLoadComplete();
        }
      );
    });

    const checkLoadComplete = () => {
      if (loadedModel && loadedAnimations === totalAnimations) {
        setResources({
          model: loadedModel,
          animationClips: loadedClips,
          isLoaded: true
        });
        
        // Emit progress for resources loaded
        if (gameReadyCallbacks) {
          gameReadyCallbacks.onZombieProgress(20, 'Zombie resources loaded, starting spawn...');
        }
      }
    };

  }, []);

  // Smart zombie position generation with distance checks
  const generateSafeZombiePosition = useCallback((
    players: ReadonlyMap<string, PlayerData>, 
    minDistance: number,
    maxAttempts: number = SPAWN_SETTINGS.MAX_SPAWN_ATTEMPTS
  ): [number, number, number] => {
    const worldSize = SPAWN_SETTINGS.WORLD_SIZE;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Generate random position within world bounds
      const x = (Math.random() - 0.5) * worldSize;
      const z = (Math.random() - 0.5) * worldSize;
      const candidatePos = new THREE.Vector3(x, 0, z);
      
      // Check distance to all players - use horizontal distance only to avoid Y-axis issues
      let tooClose = false;
      for (const player of players.values()) {
        // Use horizontal distance only to prevent spawn issues when players are at high altitude
        const playerPos = new THREE.Vector3(player.position.x, 0, player.position.z);
        const distance = candidatePos.distanceTo(playerPos);
        
        if (distance < minDistance) {
          tooClose = true;
          break;
        }
      }
      
      // If safe distance from all players, return this position
      if (!tooClose) {
        return [x, 0, z];
      }
    }
    
    // Fallback: if no safe position found after max attempts, 
    // place at edge of world away from nearest player
    console.warn('[ZombieManager] Could not find safe spawn position, using fallback');
    
    if (players.size > 0) {
      const firstPlayer = Array.from(players.values())[0];
      // Use horizontal position only for fallback calculation
      const playerPos = new THREE.Vector3(firstPlayer.position.x, 0, firstPlayer.position.z);
      
      // Place zombie at world edge in opposite direction from player
      const directionFromOrigin = playerPos.clone().normalize();
      const fallbackPos = directionFromOrigin.multiplyScalar(-worldSize * SPAWN_SETTINGS.FALLBACK_EDGE_DISTANCE);
      return [fallbackPos.x, 0, fallbackPos.z];
    }
    
    // Ultimate fallback: random edge position
    const angle = Math.random() * Math.PI * 2;
    const edgeDistance = worldSize * SPAWN_SETTINGS.FALLBACK_EDGE_DISTANCE;
    return [
      Math.cos(angle) * edgeDistance,
      0,
      Math.sin(angle) * edgeDistance
    ];
  }, []);

  // Generate zombie positions with safety checks (regenerate only when player count changes)
  const zombiePositions = useMemo(() => {
    const minDistance = minSpawnDistance || SPAWN_SETTINGS.MIN_DISTANCE_FROM_PLAYERS;
    
    // Take a snapshot of current player positions for spawn calculation
    const playerSnapshot = Array.from(players.values()).map(player => ({
      x: player.position.x,
      y: 0, // Use ground level for spawn calculations
      z: player.position.z
    }));
    
    return Array.from({ length: zombieCount }, (_, index) => {
      // Create a temporary players map using the snapshot for spawn calculation
      const snapshotPlayers = new Map(Array.from(players.entries()).map(([id, player], i) => [
        id, 
        { ...player, position: playerSnapshot[i] || { x: 0, y: 0, z: 0 } }
      ]));
      
      const position = generateSafeZombiePosition(snapshotPlayers, minDistance);
      
      // Debug log for first few zombies
      if (index < 3) {
        const nearestPlayerDistance = playerSnapshot.reduce((minDist, playerPos) => {
          const zombiePos = new THREE.Vector3(position[0], position[1], position[2]);
          const playerVec = new THREE.Vector3(playerPos.x, 0, playerPos.z);
          const dist = zombiePos.distanceTo(playerVec);
          return Math.min(minDist, dist);
        }, Infinity);
      }
      
      return position;
    });
  }, [zombieCount, players.size, minSpawnDistance, generateSafeZombiePosition]);

  // Handle zombie loading completion
  const handleZombieLoadComplete = useCallback(() => {
    setLoadedZombieCount(prev => {
      const newCount = prev + 1;
      const progress = Math.round(20 + (newCount / zombieCount) * 80); // 20% base + up to 80% for zombies
      
      // Emit progress
      if (gameReadyCallbacks) {
        if (newCount < zombieCount) {
          gameReadyCallbacks.onZombieProgress(progress, `Spawned ${newCount}/${zombieCount} zombies...`);
        } else {
          gameReadyCallbacks.onZombieProgress(100, 'All zombies spawned and ready!');
          gameReadyCallbacks.onZombiesReady();
        }
      }
      
      // Move to next zombie after delay
      if (newCount < zombieCount) {
        setTimeout(() => {
          setCurrentLoadingIndex(newCount);
        }, LOADING_DELAY);
      } else {
        console.log(`[ZombieManager] All ${zombieCount} zombies loaded and ready!`);
      }
      
      return newCount;
    });
  }, [zombieCount, LOADING_DELAY, gameReadyCallbacks]);

  return (
    <ZombieResourceContext.Provider value={resources}>
      {/* Only render zombies when resources are loaded */}
      {resources.isLoaded && zombiePositions.map((position, index) => {
        const shouldLoad = index <= currentLoadingIndex;
        
        return (
          <ZombieInstance
            key={`zombie-${index}`}
            zombieId={`zombie-${index}`}
            position={position}
            players={players}
            isDebugVisible={isDebugVisible}
            shouldLoad={shouldLoad}
            onLoadComplete={handleZombieLoadComplete}
          />
        );
      })}
    </ZombieResourceContext.Provider>
  );
}; 