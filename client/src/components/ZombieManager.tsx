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
  MIN_DISTANCE_FROM_PLAYERS: 12, // Minimum distance from players (closer than before)
  MAX_DISTANCE_FROM_PLAYERS: 35, // Maximum distance from players (keeps farthest zombies closer)
  WORLD_SIZE: 60, // Smaller spawn area for tighter action (reduced from 120)
  MAX_SPAWN_ATTEMPTS: 50, // Maximum attempts to find a safe spawn position
  FALLBACK_EDGE_DISTANCE: 0.4 // Multiplier for edge distance in fallback scenarios
};

// Configurable knockback physics for player attacks
const KNOCKBACK_CONFIG = {
  ATTACK_RANGE: 4.0,      // How far the attack reaches (reduced from 15.0)
  FACING_LENIENCY: 0.3,   // Dot product, > 0 means "in front" (was -1.5)
  FORCE: 90.0,            // How far back the zombie flies (tripled from 30.0)
  HEIGHT: 24.0,           // How high the zombie flies (tripled from 8.0)
  GRAVITY: -60.0,         // Gravity applied to the falling zombie
  DECAY: 0.96,            // How quickly horizontal movement slows (closer to 1 is slower)
  MAX_KILLS_AT_A_TIME: 1, // Maximum number of zombies that can be killed in one attack
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
  onZombieDeath?: (zombieId: string) => void; // Callback when zombie dies (for scene cleanup)
  onZombieKilled?: (zombieId: string) => void; // Callback when zombie is killed (for kill counter)
  onRegisterInstance?: (zombieId: string, positionRef: React.MutableRefObject<THREE.Vector3>, triggerDeath: (direction: THREE.Vector3) => void) => void; // Register for attack detection
  onUnregisterInstance?: (zombieId: string) => void; // Unregister when cleanup
}

// Individual zombie instance component (lightweight)
const ZombieInstance: React.FC<ZombieInstanceProps> = ({
  position,
  players,
  isDebugVisible = false,
  zombieId,
  shouldLoad = false,
  onLoadComplete,
  onZombieDeath,
  onZombieKilled,
  onRegisterInstance,
  onUnregisterInstance
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
  
  // Death and knockback state
  const [isDead, setIsDead] = useState<boolean>(false);
  const [isDeathSequenceStarted, setIsDeathSequenceStarted] = useState<boolean>(false);
  const [deathTimer, setDeathTimer] = useState<number>(0);
  const [opacity, setOpacity] = useState<number>(1.0);
  const knockbackVelocity = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  
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

  // Death sequence function
  const triggerDeath = useCallback((knockbackDirection: THREE.Vector3) => {
    if (isDead || isDeathSequenceStarted) return; // Prevent multiple deaths
    
    console.log(`[${zombieId}] 💀 Death triggered with knockback direction:`, knockbackDirection);
    
    setIsDeathSequenceStarted(true);
    setIsDead(true);
    
    // Immediately notify kill for kill counter (responsive UI)
    if (onZombieKilled) {
      onZombieKilled(zombieId);
    }
    
    // Apply knockback velocity - ensure zombies fly away from player, not towards
    const normalizedDirection = knockbackDirection.clone().normalize();
    knockbackVelocity.current.set(
      normalizedDirection.x * KNOCKBACK_CONFIG.FORCE,
      KNOCKBACK_CONFIG.HEIGHT, // Simple upward force
      normalizedDirection.z * KNOCKBACK_CONFIG.FORCE
    );
    
    console.log(`[${zombieId}] 🚀 Applied knockback velocity: (${knockbackVelocity.current.x.toFixed(2)}, ${knockbackVelocity.current.y.toFixed(2)}, ${knockbackVelocity.current.z.toFixed(2)})`);
    
    // Play death animation
    if (animations[ZOMBIE_ANIMATIONS.DEATH]) {
      playZombieAnimation(ZOMBIE_ANIMATIONS.DEATH);
    }
    
    // Start death timer
    setDeathTimer(0);
  }, [isDead, isDeathSequenceStarted, zombieId, animations, playZombieAnimation, onZombieKilled]);

  // Register for attack detection when ready, unregister on cleanup
  useEffect(() => {
    if (instanceModel && onRegisterInstance && !isDead) {
      onRegisterInstance(zombieId, zombiePosition, triggerDeath);
    }
    
    return () => {
      if (onUnregisterInstance) {
        onUnregisterInstance(zombieId);
      }
    };
  }, [instanceModel, zombieId, triggerDeath, isDead, onRegisterInstance, onUnregisterInstance]);

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
    // Skip AI when dead
    if (isDead) return;
    
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
    
    // Handle death sequence
    if (isDead || isDeathSequenceStarted) {
      setDeathTimer(prev => prev + delta);
      
      // Apply knockback physics
      if (knockbackVelocity.current.length() > 0.1 || zombiePosition.current.y > ZOMBIE_CONFIG.yOffset) {
        // Apply gravity
        knockbackVelocity.current.y += KNOCKBACK_CONFIG.GRAVITY * delta;
        
        // Update position
        zombiePosition.current.add(knockbackVelocity.current.clone().multiplyScalar(delta));

        // Apply horizontal decay
        knockbackVelocity.current.x *= KNOCKBACK_CONFIG.DECAY;
        knockbackVelocity.current.z *= KNOCKBACK_CONFIG.DECAY;
        
        // Check for ground collision
        if (zombiePosition.current.y < ZOMBIE_CONFIG.yOffset) {
          zombiePosition.current.y = ZOMBIE_CONFIG.yOffset;
          knockbackVelocity.current.set(0, 0, 0); // Stop all movement
        }
      }
      
      // Start fading after 0.5 seconds
      if (deathTimer > 0.5) {
        const fadeStartTime = deathTimer - 0.5;
        const fadeDuration = 1.0; // 1 second fade
        const fadeProgress = Math.min(fadeStartTime / fadeDuration, 1.0);
        const newOpacity = 1.0 - fadeProgress;
        
        setOpacity(newOpacity);
        
        // Apply opacity to all materials
        if (instanceModel) {
          instanceModel.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(material => {
                  material.transparent = true;
                  material.opacity = newOpacity;
                });
              } else {
                child.material.transparent = true;
                child.material.opacity = newOpacity;
              }
            }
          });
        }
        
        // Complete cleanup after fade - notify scene cleanup
        if (fadeProgress >= 1.0 && onZombieDeath) {
          console.log(`[${zombieId}] Cleanup complete, removing from scene`);
          onZombieDeath(zombieId);
          return; // Skip further updates
        }
      }
    } else {
      // Update AI with new advanced system (only when alive)
      updateAdvancedAI(delta);
    }
    
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
      
      {/* Zombie nameplate - HIDDEN */}
      {false && (
        <Html position={[0, 1.8, 0]} center distanceFactor={10}>
          <div className="nametag">
            <div className="nametag-text" style={{ color: '#ff6666' }}>{zombieId}</div>
            <div className="nametag-class" style={{ color: '#cc4444' }}>Enemy NPC</div>
          </div>
        </Html>
      )}
    </group>
  );
};

interface ZombieManagerProps {
  zombieCount?: number;
  players: ReadonlyMap<string, PlayerData>;
  isDebugVisible?: boolean;
  minSpawnDistance?: number; // Minimum distance from players for zombie spawning
  gameReadyCallbacks?: GameReadyCallbacks; // Callbacks for GameReady events
  onKillCountChange?: (killCount: number) => void; // Callback for kill count changes
}

// Main ZombieManager component
export const ZombieManager: React.FC<ZombieManagerProps> = ({
  zombieCount = 25,
  players,
  isDebugVisible = false,
  minSpawnDistance = SPAWN_SETTINGS.MIN_DISTANCE_FROM_PLAYERS,
  gameReadyCallbacks,
  onKillCountChange
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
  
  // Death tracking
  const [deadZombies, setDeadZombies] = useState<Set<string>>(new Set());
  const [killCount, setKillCount] = useState<number>(0); // Internal counter for respawn triggers (resets)
  const [totalKillCount, setTotalKillCount] = useState<number>(0); // Total kills for UI (never resets)
  const [nextZombieId, setNextZombieId] = useState<number>(zombieCount); // Track next available ID
  
  // Registry for zombie instances (for attack collision detection)
  const zombieInstancesRef = useRef<Map<string, { positionRef: React.MutableRefObject<THREE.Vector3>; triggerDeath: (direction: THREE.Vector3) => void }>>(new Map());

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

  // Smart zombie position generation with circular spawning around players
  const generateSafeZombiePosition = useCallback((
    players: ReadonlyMap<string, PlayerData>, 
    minDistance: number,
    maxAttempts: number = SPAWN_SETTINGS.MAX_SPAWN_ATTEMPTS
  ): [number, number, number] => {
    const worldSize = SPAWN_SETTINGS.WORLD_SIZE;
    const maxDistance = SPAWN_SETTINGS.MAX_DISTANCE_FROM_PLAYERS;
    
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let x: number, z: number;
      
      // Use circular spawning around players (80% of the time)
      if (players.size > 0 && Math.random() < 0.8) { // 80% chance to spawn relative to nearest player
        const nearestPlayer = Array.from(players.values())[0];
        const playerPos = new THREE.Vector3(nearestPlayer.position.x, 0, nearestPlayer.position.z);
        
        // Full circular spawning - any angle around the player
        const angle = Math.random() * Math.PI * 2; // Full 360 degrees
        const distance = minDistance + Math.random() * (maxDistance - minDistance);
        
        // Add some noise to break perfect circles
        const noiseX = (Math.random() - 0.5) * 6; // ±3 units of noise
        const noiseZ = (Math.random() - 0.5) * 6;
        
        x = playerPos.x + Math.cos(angle) * distance + noiseX;
        z = playerPos.z + Math.sin(angle) * distance + noiseZ;
        
      } else {
        // 20% chance for completely random position within world bounds
        x = (Math.random() - 0.5) * worldSize;
        z = (Math.random() - 0.5) * worldSize;
      }
      
      const candidatePos = new THREE.Vector3(x, 0, z);
      
      // Check distance to all players - use horizontal distance only to avoid Y-axis issues
      let validPosition = true;
      for (const player of players.values()) {
        // Use horizontal distance only to prevent spawn issues when players are at high altitude
        const playerPos = new THREE.Vector3(player.position.x, 0, player.position.z);
        const distance = candidatePos.distanceTo(playerPos);
        
        // Check both minimum and maximum distance constraints
        if (distance < minDistance || distance > maxDistance) {
          validPosition = false;
          break;
        }
      }
      
      // If valid distance from all players, return this position
      if (validPosition) {
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

  // Dynamic zombie positions (can be updated during gameplay)
  const [zombiePositions, setZombiePositions] = useState<[number, number, number][]>(() => {
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
  });

  // Function to spawn additional zombies
  const spawnNewZombies = useCallback((count: number) => {
    const minDistance = minSpawnDistance || SPAWN_SETTINGS.MIN_DISTANCE_FROM_PLAYERS;
    const newPositions: [number, number, number][] = [];
    
    // Take snapshot of current player positions
    const playerSnapshot = Array.from(players.values()).map(player => ({
      x: player.position.x,
      y: 0,
      z: player.position.z
    }));
    
    for (let i = 0; i < count; i++) {
      const snapshotPlayers = new Map(Array.from(players.entries()).map(([id, player], j) => [
        id, 
        { ...player, position: playerSnapshot[j] || { x: 0, y: 0, z: 0 } }
      ]));
      
      const position = generateSafeZombiePosition(snapshotPlayers, minDistance);
      newPositions.push(position);
    }
    
    // Add new positions to existing ones
    setZombiePositions(prev => [...prev, ...newPositions]);
    setNextZombieId(prev => prev + count);
    
    console.log(`[ZombieManager] 🆕 Spawned ${count} new zombies! Total positions: ${zombiePositions.length + count}`);
  }, [players, minSpawnDistance, generateSafeZombiePosition, zombiePositions.length]);

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

  // Handle zombie death (scene cleanup)
  const handleZombieDeath = useCallback((zombieId: string) => {
    console.log(`[ZombieManager] Zombie ${zombieId} cleanup complete, removing from scene`);
    setDeadZombies(prev => new Set(prev).add(zombieId));
  }, []);
  
  // Handle zombie killed (immediate kill counter update)
  const handleZombieKilled = useCallback((zombieId: string) => {
    console.log(`[ZombieManager] Zombie ${zombieId} killed! Updating kill counter`);
    
    // Update total kill count (never resets)
    setTotalKillCount(prev => {
      const newTotalKills = prev + 1;
      
      // Notify parent component of total kill count change
      if (onKillCountChange) {
        onKillCountChange(newTotalKills);
      }
      
      return newTotalKills;
    });
    
    // Track kills for respawn trigger (resets every 3 kills)
    setKillCount(prev => {
      const newKillCount = prev + 1;
      console.log(`[ZombieManager] 💀 Respawn kill count: ${newKillCount}`);
      
      if (newKillCount % 3 === 0) {
                 console.log(`[ZombieManager] 🎯 RESPAWN TRIGGER! Killed ${newKillCount} zombies, spawning 3 more...`);
         
         // Emit progress update for respawn event
         if (gameReadyCallbacks) {
           gameReadyCallbacks.onZombieProgress(100, '💀 3 zombies killed! Spawning reinforcements...');
         }
         
         // Spawn 3 new zombies after a short delay
         setTimeout(() => {
           spawnNewZombies(3);
           if (gameReadyCallbacks) {
             gameReadyCallbacks.onZombieProgress(100, '🆕 3 new zombies spawned!');
           }
         }, 1000); // 1 second delay for dramatic effect
        
        return 0; // Reset respawn counter
      }
      
      return newKillCount;
    });
  }, [spawnNewZombies, onKillCountChange]);

  // Handle zombie registration for attack detection
  const handleZombieRegister = useCallback((zombieId: string, positionRef: React.MutableRefObject<THREE.Vector3>, triggerDeath: (direction: THREE.Vector3) => void) => {
    zombieInstancesRef.current.set(zombieId, { positionRef, triggerDeath });
  }, []);

  const handleZombieUnregister = useCallback((zombieId: string) => {
    zombieInstancesRef.current.delete(zombieId);
  }, []);

  // Create global attack check function for Player components to use
  const checkPlayerAttack = useCallback((playerPosition: THREE.Vector3, playerRotation: THREE.Euler, attackRange: number = KNOCKBACK_CONFIG.ATTACK_RANGE) => {
    const candidateZombies: Array<{ zombieId: string; position: THREE.Vector3; distance: number; zombieData: any }> = [];
    
    // Get forward direction from player rotation - FLIPPED Z-axis from -1 to 1 to fix direction
    const forwardDirection = new THREE.Vector3(0, 0, 1).applyEuler(playerRotation);
    
    console.log(`[ZombieManager] 🗡️ ATTACK CHECK STARTED`);
    console.log(`[ZombieManager] 📍 Player pos: (${playerPosition.x.toFixed(2)}, ${playerPosition.y.toFixed(2)}, ${playerPosition.z.toFixed(2)})`);
    console.log(`[ZombieManager] 📐 Player rotation: (${playerRotation.x.toFixed(3)}, ${playerRotation.y.toFixed(3)}, ${playerRotation.z.toFixed(3)})`);
    console.log(`[ZombieManager] ➡️ Forward direction: (${forwardDirection.x.toFixed(3)}, ${forwardDirection.y.toFixed(3)}, ${forwardDirection.z.toFixed(3)})`);
    console.log(`[ZombieManager] 📏 Attack range: ${attackRange} units`);
    console.log(`[ZombieManager] 🎯 Facing leniency: ${KNOCKBACK_CONFIG.FACING_LENIENCY} (lower = more lenient)`);
    console.log(`[ZombieManager] 🧟 Checking ${zombieInstancesRef.current.size} zombies...`);
    console.log(`[ZombieManager] ⚔️ Max kills per attack: ${KNOCKBACK_CONFIG.MAX_KILLS_AT_A_TIME}`);
    
    // First pass: Find all eligible zombies within range and facing requirements
    for (const [zombieId, zombieData] of zombieInstancesRef.current) {
      const zombiePos = zombieData.positionRef.current;
      const distance = playerPosition.distanceTo(zombiePos);
      
      console.log(`[ZombieManager] 🔍 Checking ${zombieId}:`);
      console.log(`[ZombieManager]   📍 Zombie pos: (${zombiePos.x.toFixed(2)}, ${zombiePos.y.toFixed(2)}, ${zombiePos.z.toFixed(2)})`);
      console.log(`[ZombieManager]   📏 Distance: ${distance.toFixed(2)} units`);
      
      // Check if zombie is within attack range
      if (distance <= attackRange) {
        console.log(`[ZombieManager]   ✅ DISTANCE OK: ${distance.toFixed(2)} <= ${attackRange}`);
        
        // Check if player is roughly facing the zombie
        const directionToZombie = new THREE.Vector3().subVectors(zombiePos, playerPosition).normalize();
        const dot = forwardDirection.dot(directionToZombie);
        
        console.log(`[ZombieManager]   ➡️ Direction to zombie: (${directionToZombie.x.toFixed(3)}, ${directionToZombie.y.toFixed(3)}, ${directionToZombie.z.toFixed(3)})`);
        console.log(`[ZombieManager]   🎯 Dot product: ${dot.toFixed(3)} (need > ${KNOCKBACK_CONFIG.FACING_LENIENCY})`);
        
        // If dot product > a lenient value, player is facing zombie
        if (dot > KNOCKBACK_CONFIG.FACING_LENIENCY) {
          console.log(`[ZombieManager]   ✅ FACING OK: ${dot.toFixed(3)} > ${KNOCKBACK_CONFIG.FACING_LENIENCY}`);
          
          candidateZombies.push({ 
            zombieId, 
            position: zombiePos.clone(), 
            distance, 
            zombieData 
          });
        } else {
          console.log(`[ZombieManager]   ❌ FACING FAILED: ${dot.toFixed(3)} <= ${KNOCKBACK_CONFIG.FACING_LENIENCY} (player not facing zombie)`);
        }
      } else {
        console.log(`[ZombieManager]   ❌ DISTANCE FAILED: ${distance.toFixed(2)} > ${attackRange} (too far away)`);
      }
    }
    
    // Second pass: Sort by distance and select the closest ones up to MAX_KILLS_AT_A_TIME
    candidateZombies.sort((a, b) => a.distance - b.distance);
    const zombiesToKill = candidateZombies.slice(0, KNOCKBACK_CONFIG.MAX_KILLS_AT_A_TIME);
    
    console.log(`[ZombieManager] 🎯 Found ${candidateZombies.length} eligible zombies, killing ${zombiesToKill.length} closest ones`);
    
    const hitZombies: Array<{ zombieId: string; position: THREE.Vector3; distance: number }> = [];
    
    // Kill the selected zombies
    for (const zombie of zombiesToKill) {
      console.log(`[ZombieManager] 💀 ZOMBIE KILLED! ${zombie.zombieId} hit at distance ${zombie.distance.toFixed(2)}`);
      
      hitZombies.push({ 
        zombieId: zombie.zombieId, 
        position: zombie.position, 
        distance: zombie.distance 
      });
      
      // Trigger zombie death with knockback direction (AWAY from player)
      const directionToZombie = new THREE.Vector3().subVectors(zombie.position, playerPosition).normalize();
      zombie.zombieData.triggerDeath(directionToZombie);
    }
    
    console.log(`[ZombieManager] 🗡️ ATTACK CHECK COMPLETE: Hit ${hitZombies.length} zombies`);
    return hitZombies;
  }, []);

  // Expose the attack check function globally
  useEffect(() => {
    (window as any).checkZombieAttack = checkPlayerAttack;
    return () => {
      delete (window as any).checkZombieAttack;
    };
  }, [checkPlayerAttack]);

  return (
    <ZombieResourceContext.Provider value={resources}>
      {/* Only render zombies when resources are loaded */}
      {resources.isLoaded && zombiePositions.map((position, index) => {
        const zombieId = `zombie-${index}`;
        // For initial zombies, use loading index. For respawned zombies (index >= zombieCount), load immediately
        const shouldLoad = index <= currentLoadingIndex || index >= zombieCount;
        
        // Skip rendering dead zombies
        if (deadZombies.has(zombieId)) {
          return null;
        }
        
        return (
          <ZombieInstance
            key={zombieId}
            zombieId={zombieId}
            position={position}
            players={players}
            isDebugVisible={isDebugVisible}
            shouldLoad={shouldLoad}
            onLoadComplete={handleZombieLoadComplete}
            onZombieDeath={handleZombieDeath}
            onZombieKilled={handleZombieKilled}
            onRegisterInstance={handleZombieRegister}
            onUnregisterInstance={handleZombieUnregister}
          />
        );
      })}
    </ZombieResourceContext.Provider>
  );
}; 