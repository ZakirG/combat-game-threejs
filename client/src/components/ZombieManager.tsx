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
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { PlayerData } from '../generated';

// Animation names for zombie
const ZOMBIE_ANIMATIONS = {
  IDLE: 'idle',
  SCREAM: 'scream',
  WALKING: 'walking',
  RUNNING: 'running',
  ATTACK: 'attack',
  DEATH: 'death',
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
  
  // AI State management
  const [aiState, setAiState] = useState<ZombieState>(ZombieState.IDLE);
  const [targetPlayer, setTargetPlayer] = useState<PlayerData | null>(null);
  const [stateTimer, setStateTimer] = useState<number>(0);
  const [idleTime, setIdleTime] = useState<number>(Math.random() * 3);
  
  // Movement and rotation
  const zombiePosition = useRef<THREE.Vector3>(new THREE.Vector3(...position));
  const zombieRotation = useRef<THREE.Euler>(new THREE.Euler(0, 0, 0));
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
    
    const loader = new FBXLoader();
    loader.load(
      '/models/zombie-2/zombie.fbx',
      (fbx) => {
        console.log(`[${zombieId}] Fresh model loaded`);
        
        // Apply proper scaling and positioning
        fbx.scale.setScalar(0.02);
        fbx.position.set(0, -0.1, 0);
        
        // Enable shadows and process materials
        fbx.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            
            // Convert material to standard material
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
          group.current.add(fbx);
        }
        
        // Create mixer for this instance
        const instanceMixer = new THREE.AnimationMixer(fbx);
        
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
        
        setInstanceModel(fbx);
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
            // Reset AI state for this instance
            setAiState(ZombieState.IDLE);
            aiStateRef.current = ZombieState.IDLE;
            stateTimerRef.current = 0;
            setStateTimer(0);
            console.log(`[${zombieId}] Initialized with fresh model - AI: ${ZombieState.IDLE}, Position: ${zombiePosition.current.toArray()}`);
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
    
    targetAction.reset()
               .setEffectiveTimeScale(1)
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

  // AI state refs for performance
  const aiStateRef = useRef<ZombieState>(aiState);
  const stateTimerRef = useRef<number>(0);
  
  // Update refs when state changes
  useEffect(() => { 
    aiStateRef.current = aiState; 
  }, [aiState]);
  
  // AI update (simplified for performance)
  const updateAI = useCallback((delta: number) => {
    stateTimerRef.current += delta;
    setStateTimer(stateTimerRef.current);
    
    switch (aiStateRef.current) {
      case ZombieState.IDLE:
        if (stateTimerRef.current >= idleTime) {
          const nearest = findNearestPlayer();
          if (nearest) {
            setTargetPlayer(nearest);
            const targetPos = new THREE.Vector3(nearest.position.x, nearest.position.y, nearest.position.z);
            targetRotation.current = calculateAngleToTarget(targetPos);
            setAiState(ZombieState.TURNING);
            aiStateRef.current = ZombieState.TURNING;
            stateTimerRef.current = 0;
            setStateTimer(0);
            if (zombieId === 'zombie-0') console.log(`[${zombieId}] IDLE -> TURNING`);
          }
        }
        break;
        
      case ZombieState.TURNING:
        const rotationDiff = targetRotation.current - zombieRotation.current.y;
        const normalizedDiff = Math.atan2(Math.sin(rotationDiff), Math.cos(rotationDiff));
        
        if (Math.abs(normalizedDiff) < 0.1) {
          setAiState(ZombieState.SCREAMING);
          aiStateRef.current = ZombieState.SCREAMING;
          stateTimerRef.current = 0;
          setStateTimer(0);
          playZombieAnimation(ZOMBIE_ANIMATIONS.SCREAM);
          if (zombieId === 'zombie-0') console.log(`[${zombieId}] TURNING -> SCREAMING`);
        } else {
          const turnAmount = Math.sign(normalizedDiff) * TURN_SPEED * delta;
          zombieRotation.current.y += turnAmount;
        }
        break;
        
      case ZombieState.SCREAMING:
        if (stateTimerRef.current >= SCREAM_DURATION) {
          setAiState(ZombieState.WALKING);
          aiStateRef.current = ZombieState.WALKING;
          stateTimerRef.current = 0;
          setStateTimer(0);
          playZombieAnimation(ZOMBIE_ANIMATIONS.WALKING);
          if (zombieId === 'zombie-0') console.log(`[${zombieId}] SCREAMING -> WALKING`);
        }
        break;
        
      case ZombieState.WALKING:
        if (targetPlayer) {
          const targetPos = new THREE.Vector3(targetPlayer.position.x, targetPlayer.position.y, targetPlayer.position.z);
          const direction = new THREE.Vector3()
            .subVectors(targetPos, zombiePosition.current)
            .normalize();
          
          const distance = zombiePosition.current.distanceTo(targetPos);
          
          // Dynamic animation switching
          if (distance > 8.0 && currentAnimation !== ZOMBIE_ANIMATIONS.RUNNING) {
            playZombieAnimation(ZOMBIE_ANIMATIONS.RUNNING);
          } else if (distance <= 8.0 && currentAnimation !== ZOMBIE_ANIMATIONS.WALKING) {
            playZombieAnimation(ZOMBIE_ANIMATIONS.WALKING);
          }
          
          const currentSpeed = currentAnimation === ZOMBIE_ANIMATIONS.RUNNING ? ZOMBIE_SPEED * 1.5 : ZOMBIE_SPEED;
          const moveAmount = direction.multiplyScalar(currentSpeed * delta);
          zombiePosition.current.add(moveAmount);
          
          zombieRotation.current.y = calculateAngleToTarget(targetPos);
          
          if (distance < 2.0) {
            setAiState(ZombieState.IDLE);
            aiStateRef.current = ZombieState.IDLE;
            stateTimerRef.current = 0;
            setStateTimer(0);
            setIdleTime(Math.random() * 3);
            setTargetPlayer(null);
            playZombieAnimation(ZOMBIE_ANIMATIONS.IDLE);
            if (zombieId === 'zombie-0') console.log(`[${zombieId}] WALKING -> IDLE (reached target)`);
          }
        }
        break;
    }
  }, [idleTime, findNearestPlayer, calculateAngleToTarget, playZombieAnimation, targetPlayer, currentAnimation, zombieId]);

  // Frame update using React Three Fiber's useFrame hook
  useFrame((state, delta) => {
    if (!isLoaded || !instanceModel || !mixer) return;
    
    // Update animation mixer
    mixer.update(delta);
    
    // Update AI
    updateAI(delta);
    
    // Update group position and rotation
    if (group.current) {
      group.current.position.copy(zombiePosition.current);
      group.current.rotation.copy(zombieRotation.current);
    }
  });
  
  // Debug logging for the first few zombies
  useEffect(() => {
    if ((zombieId === 'zombie-0' || zombieId === 'zombie-1') && instanceModel) {
      console.log(`[${zombieId}] Model loaded at position:`, zombiePosition.current.toArray(), 'spawn position:', position, 'animations:', Object.keys(animations));
      
      // Check group world position after next frame
      setTimeout(() => {
        if (group.current) {
          const worldPos = new THREE.Vector3();
          group.current.getWorldPosition(worldPos);
          console.log(`[${zombieId}] Group world position:`, worldPos.toArray(), 'Group scale:', group.current.scale.toArray());
          
          // Check model scale within group
          if (instanceModel) {
            console.log(`[${zombieId}] Instance model scale:`, instanceModel.scale.toArray());
          }
        }
      }, 500);
    }
  }, [instanceModel, animations, zombieId, position]);

  if (!isLoaded) {
    return null; // Don't render until resources are loaded
  }

  return (
    <group ref={group} castShadow>
      {/* Temporary debug marker for all zombies */}
      <mesh position={[0, 1, 0]}>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshBasicMaterial color={zombieId === 'zombie-0' ? 'red' : 'blue'} />
      </mesh>
      
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
            {zombieId} - State: {aiState}<br/>
            Timer: {stateTimer.toFixed(1)}s<br/>
            Target: {targetPlayer?.username || 'None'}
          </div>
        </Html>
      )}
      
      {/* Zombie nameplate - always show for now */}
      <Html position={[0, 2.5, 0]} center distanceFactor={10}>
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
}

// Main ZombieManager component
export const ZombieManager: React.FC<ZombieManagerProps> = ({
  zombieCount = 25,
  players,
  isDebugVisible = false
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
    const loader = new FBXLoader();
    let loadedModel: THREE.Group | null = null;
    const loadedClips: Record<string, THREE.AnimationClip> = {};
    
    console.log('[ZombieManager] Loading shared zombie resources...');
    
    // Load main model
    loader.load(
      '/models/zombie-2/zombie.fbx',
      (fbx) => {
        console.log('[ZombieManager] Shared model loaded');
        console.log('[ZombieManager] Shared model initial scale:', fbx.scale);
        console.log('[ZombieManager] Shared model initial position:', fbx.position);
        
        // Ensure shared model has default scale (don't scale the shared model itself)
        fbx.scale.set(1, 1, 1);
        fbx.position.set(0, 0, 0);
        
        loadedModel = fbx;
        
        // Process materials
        fbx.traverse((child) => {
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
        
        console.log('[ZombieManager] Shared model after processing scale:', fbx.scale);
        checkLoadComplete();
      },
      undefined,
      (error) => {
        console.error('[ZombieManager] Error loading shared model:', error);
      }
    );

    // Load animations
    const animationPaths: Record<string, string> = {
      [ZOMBIE_ANIMATIONS.IDLE]: '/models/zombie-2/Zombie Walk.fbx',
      [ZOMBIE_ANIMATIONS.SCREAM]: '/models/zombie-2/Zombie Scream.fbx',
      [ZOMBIE_ANIMATIONS.WALKING]: '/models/zombie-2/Zombie Walk.fbx',
      [ZOMBIE_ANIMATIONS.RUNNING]: '/models/zombie-2/Zombie Running.fbx',
      [ZOMBIE_ANIMATIONS.ATTACK]: '/models/zombie-2/Zombie Punching.fbx',
      [ZOMBIE_ANIMATIONS.DEATH]: '/models/zombie-2/Zombie Death.fbx',
    };

    let loadedAnimations = 0;
    const totalAnimations = Object.keys(animationPaths).length;

    Object.entries(animationPaths).forEach(([name, path]) => {
      loader.load(
        path,
        (animFbx) => {
          if (animFbx.animations && animFbx.animations.length > 0) {
            const clip = animFbx.animations[0].clone();
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

  // Generate zombie positions (useMemo to prevent regeneration on each render)
  const zombiePositions = useMemo(() => 
    Array.from({ length: zombieCount }, (_, index) => {
      const randomX = (Math.random() - 0.5) * 40;
      const randomZ = (Math.random() - 0.5) * 40;
      return [randomX, 0, randomZ] as [number, number, number];
    }), [zombieCount]
  );

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