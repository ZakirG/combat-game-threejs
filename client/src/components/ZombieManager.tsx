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
import { makeZombieDecision, ZOMBIE_ANIMATIONS, ZombieDecision } from './ZombieBrain';
import { ZOMBIE_CONFIG } from '../characterConfigs';

// Configurable spawn settings
const SPAWN_SETTINGS = {
  MIN_DISTANCE_FROM_PLAYERS: 15, // Increased minimum distance due to extended zombie perception range
  WORLD_SIZE: 40, // Size of the game world for spawning
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
        // Move toward target position
        const direction = new THREE.Vector3()
          .subVectors(decision.targetPosition, zombiePosition.current)
          .normalize();
        
        const moveAmount = direction.multiplyScalar(decision.speed * delta);
        const oldPos = zombiePosition.current.clone();
        zombiePosition.current.add(moveAmount);
        
        // Debug movement for first zombie
        if (Math.random() < 0.02) {
          console.log(`[Movement] ${decision.action}: moved from [${oldPos.x.toFixed(2)}, ${oldPos.z.toFixed(2)}] to [${zombiePosition.current.x.toFixed(2)}, ${zombiePosition.current.z.toFixed(2)}], distance: ${moveAmount.length().toFixed(3)}`);
        }
        
        // Rotate to face movement direction
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
      console.log(`[${zombieId}] Set initial group position to:`, zombiePosition.current.toArray());
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
    console.log(`[ZombieInstance ${zombieId}] Starting batched model load`);
    
    const loader = new GLTFLoader();
    loader.load(
      ZOMBIE_CONFIG.modelPath,
      (gltf) => {
        console.log(`[${zombieId}] Fresh model loaded`);
        
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
            // Initialize AI with the new system and persistent state
            const initialDecision = makeZombieDecision(zombiePosition.current, players, zombieStateRef.current);
            setCurrentDecision(initialDecision);
            setDecisionTimer(0);
            setLastDecisionTime(Date.now());
            console.log(`[${zombieId}] Initialized with fresh model - Decision: ${initialDecision.action}, Mode: ${zombieStateRef.current.mode}, Position: ${zombiePosition.current.toArray()}`);
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

  // Find nearest player
  const findNearestPlayer = useCallback((): PlayerData | null => {
    let nearestPlayer: PlayerData | null = null;
    let nearestDistance = Infinity;
    
    for (const player of players.values()) {
      const playerPos = new THREE.Vector3(player.position.x, player.position.y, player.position.z);
      const distance = zombiePosition.current.distanceTo(playerPos);
      
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
      
      console.log(`[${zombieId}] New AI Decision: ${newDecision.action} (mode: ${zombieStateRef.current.mode})`);
    }
    
    // Execute current decision with actual behavior
    if (currentDecision) {
      executeBehavior(currentDecision, zombiePosition, zombieRotation, delta);
      
      // Debug logging for first zombie to see what's happening
      if (zombieId === 'zombie-0' && Math.random() < 0.1) {
        console.log(`[${zombieId}] Executing ${currentDecision.action}, Position: [${zombiePosition.current.x.toFixed(2)}, ${zombiePosition.current.z.toFixed(2)}], Target: ${currentDecision.targetPosition ? `[${currentDecision.targetPosition.x.toFixed(2)}, ${currentDecision.targetPosition.z.toFixed(2)}]` : 'None'}, Speed: ${currentDecision.speed}`);
      }
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
}

// Main ZombieManager component
export const ZombieManager: React.FC<ZombieManagerProps> = ({
  zombieCount = 25,
  players,
  isDebugVisible = false,
  minSpawnDistance = SPAWN_SETTINGS.MIN_DISTANCE_FROM_PLAYERS
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
        
        console.log('[ZombieManager] Shared model after processing scale:', model.scale);
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
            console.log(`[ZombieManager] Animation "${name}" loaded`);
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
        console.log('[ZombieManager] All resources loaded, ready to spawn zombies');
        setResources({
          model: loadedModel,
          animationClips: loadedClips,
          isLoaded: true
        });
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
      
      // Check distance to all players
      let tooClose = false;
      for (const player of players.values()) {
        const playerPos = new THREE.Vector3(player.position.x, player.position.y, player.position.z);
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
      const playerPos = new THREE.Vector3(firstPlayer.position.x, firstPlayer.position.y, firstPlayer.position.z);
      
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

  // Generate zombie positions with safety checks (regenerate when players change)
  const zombiePositions = useMemo(() => {
    const minDistance = minSpawnDistance || SPAWN_SETTINGS.MIN_DISTANCE_FROM_PLAYERS;
    console.log(`[ZombieManager] Generating ${zombieCount} zombie positions with ${minDistance}u minimum distance`);
    
    return Array.from({ length: zombieCount }, (_, index) => {
      const position = generateSafeZombiePosition(players, minDistance);
      
      // Debug log for first few zombies
      if (index < 3) {
        const nearestPlayerDistance = Array.from(players.values()).reduce((minDist, player) => {
          const playerPos = new THREE.Vector3(player.position.x, player.position.y, player.position.z);
          const zombiePos = new THREE.Vector3(position[0], position[1], position[2]);
          const dist = zombiePos.distanceTo(playerPos);
          return Math.min(minDist, dist);
        }, Infinity);
      }
      
      return position;
    });
  }, [zombieCount, players, minSpawnDistance, generateSafeZombiePosition]);

  // Handle zombie loading completion
  const handleZombieLoadComplete = useCallback(() => {
    setLoadedZombieCount(prev => {
      const newCount = prev + 1;
      
      // Move to next zombie after delay
      if (newCount < zombieCount) {
        console.log(`[ZombieManager] Zombie ${newCount-1} loaded, starting zombie ${newCount} in ${LOADING_DELAY}ms`);
        setTimeout(() => {
          setCurrentLoadingIndex(newCount);
        }, LOADING_DELAY);
      } else {
        console.log(`[ZombieManager] All ${zombieCount} zombies loaded!`);
      }
      
      return newCount;
    });
  }, [zombieCount, LOADING_DELAY]);

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