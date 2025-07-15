/**
 * Zombie.tsx
 * 
 * Enemy NPC component that provides basic AI behavior:
 * 
 * Key functionality:
 * - Loads zombie 3D model and animations from the zombie folder
 * - Implements AI state machine: idle → turn to face player → scream → walk towards player
 * - Finds and targets the nearest human player
 * - Manages zombie-specific animations and behavior
 * 
 * AI States:
 * - IDLE: Random idle time (< 3 seconds)
 * - TURNING: Rotating to face the nearest player
 * - SCREAMING: Playing scream animation
 * - WALKING: Moving towards the target player
 * 
 * Technical implementation:
 * - Uses React Three Fiber for 3D rendering
 * - Implements Three.js AnimationMixer for animations
 * - Uses FBXLoader for model and animation loading
 * - Manages AI state with useEffect and useFrame hooks
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { PlayerData } from '../generated';

// AI States
enum ZombieState {
  IDLE = 'idle',
  TURNING = 'turning',
  SCREAMING = 'screaming',
  WALKING = 'walking'
}

// Animation names for zombie
const ZOMBIE_ANIMATIONS = {
  IDLE: 'idle',
  SCREAM: 'scream',
  WALKING: 'walking',
  ATTACK: 'attack',
  DEATH: 'death',
};

interface ZombieProps {
  position?: [number, number, number];
  players: ReadonlyMap<string, PlayerData>;
  isDebugVisible?: boolean;
}

export const Zombie: React.FC<ZombieProps> = ({
  position = [10, 0, 5], // Default spawn position
  players,
  isDebugVisible = false
}) => {
  const group = useRef<THREE.Group>(null!);
  
  // Model and animation management
  const [modelLoaded, setModelLoaded] = useState(false);
  const [model, setModel] = useState<THREE.Group | null>(null);
  const [mixer, setMixer] = useState<THREE.AnimationMixer | null>(null);
  const [animations, setAnimations] = useState<Record<string, THREE.AnimationAction>>({});
  const [currentAnimation, setCurrentAnimation] = useState<string>(ZOMBIE_ANIMATIONS.IDLE);
  
  // AI State management
  const [aiState, setAiState] = useState<ZombieState>(ZombieState.IDLE);
  const [targetPlayer, setTargetPlayer] = useState<PlayerData | null>(null);
  const [stateTimer, setStateTimer] = useState<number>(0);
  const [idleTime, setIdleTime] = useState<number>(Math.random() * 3); // Random time < 3 seconds
  
  // Movement and rotation
  const zombiePosition = useRef<THREE.Vector3>(new THREE.Vector3(...position));
  const zombieRotation = useRef<THREE.Euler>(new THREE.Euler(0, 0, 0));
  const targetRotation = useRef<number>(0);
  
  // Constants
  const ZOMBIE_SPEED = 3.0;
  const TURN_SPEED = 2.0;
  const SCREAM_DURATION = 2.0;
  
  // Animation loading setup
  const animationsLoadedRef = useRef(false);
  
  // Load zombie model and animations
  useEffect(() => {
    const loader = new FBXLoader();
    
    // Load main zombie model
    loader.load(
      '/models/zombie/zombie.fbx',
      (fbx) => {
        console.log('[Zombie] Main model loaded');
        
        // Set scale and position
        fbx.scale.setScalar(0.02); // Same scale as other characters
        fbx.position.set(0, 0, 0);
        
        // Enable shadows
        fbx.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            
            // Convert material to standard material for better lighting
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
          fbx.position.y = -0.1; // Lower the model slightly
        }
        
        setModel(fbx);
        const newMixer = new THREE.AnimationMixer(fbx);
        setMixer(newMixer);
        setModelLoaded(true);
      },
      (progress) => {
        // Loading progress
      },
      (error) => {
        console.error('[Zombie] Error loading model:', error);
      }
    );
    
    return () => {
      if (mixer) mixer.stopAllAction();
      if (model && group.current) group.current.remove(model);
    };
  }, []);
  
  // Load animations when mixer is ready
  useEffect(() => {
    if (mixer && model && !animationsLoadedRef.current) {
      console.log('[Zombie] Loading animations...');
      animationsLoadedRef.current = true;
      loadZombieAnimations(mixer);
    }
  }, [mixer, model]);
  
  // Function to load zombie animations
  const loadZombieAnimations = (mixerInstance: THREE.AnimationMixer) => {
    if (!mixerInstance) {
      console.error('[Zombie] Cannot load animations: mixer not initialized');
      return;
    }
    
    const loader = new FBXLoader();
    const basePath = '/models/zombie/';
    
    // Map animation keys to zombie FBX files
    const animationPaths: Record<string, string> = {
      [ZOMBIE_ANIMATIONS.IDLE]: `${basePath}Zombie Idle.fbx`,
      [ZOMBIE_ANIMATIONS.SCREAM]: `${basePath}Zombie Scream.fbx`,
      [ZOMBIE_ANIMATIONS.WALKING]: `${basePath}Walking.fbx`,
      [ZOMBIE_ANIMATIONS.ATTACK]: `${basePath}Zombie Attack.fbx`,
      [ZOMBIE_ANIMATIONS.DEATH]: `${basePath}Zombie Death.fbx`,
    };
    
    const newAnimations: Record<string, THREE.AnimationAction> = {};
    let loadedCount = 0;
    const totalCount = Object.keys(animationPaths).length;
    
    const checkCompletedLoading = () => {
      loadedCount++;
      if (loadedCount === totalCount) {
        console.log(`[Zombie] Loaded ${Object.keys(newAnimations).length}/${totalCount} animations`);
        setAnimations(newAnimations);
        
        // Start with idle animation
        if (newAnimations[ZOMBIE_ANIMATIONS.IDLE]) {
          setTimeout(() => {
            if (animationsLoadedRef.current) {
              playZombieAnimation(ZOMBIE_ANIMATIONS.IDLE, newAnimations);
            }
          }, 100);
        }
      }
    };
    
    // Load each animation
    Object.entries(animationPaths).forEach(([name, path]) => {
      loader.load(
        path,
        (animFbx) => {
          try {
            if (!animFbx.animations || animFbx.animations.length === 0) {
              console.error(`[Zombie] No animations found in ${path}`);
              checkCompletedLoading();
              return;
            }
            
            const clip = animFbx.animations[0];
            clip.name = name;
            
            // Remove root motion for in-place animation
            makeZombieAnimationInPlace(clip);
            
            const action = mixerInstance.clipAction(clip);
            newAnimations[name] = action;
            
            // Set loop mode
            if (name === ZOMBIE_ANIMATIONS.IDLE || name === ZOMBIE_ANIMATIONS.WALKING) {
              action.setLoop(THREE.LoopRepeat, Infinity);
            } else {
              action.setLoop(THREE.LoopOnce, 1);
              action.clampWhenFinished = true;
            }
            
            console.log(`[Zombie] Animation "${name}" loaded successfully`);
          } catch (e) {
            console.error(`[Zombie] Error processing animation ${name}:`, e);
          }
          
          checkCompletedLoading();
        },
        undefined,
        (error) => {
          console.error(`[Zombie] Error loading animation ${name}:`, error);
          checkCompletedLoading();
        }
      );
    });
  };
  
  // Remove root motion from animations
  const makeZombieAnimationInPlace = (clip: THREE.AnimationClip) => {
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
          values[i] = 0;     // Remove X movement
          values[i + 2] = 0; // Remove Z movement
          // Keep Y for vertical movement
        }
      }
    }
  };
  
  // Play zombie animation
  const playZombieAnimation = useCallback((name: string, animationsMap?: Record<string, THREE.AnimationAction>) => {
    const animsToUse = animationsMap || animations;
    
    if (!mixer || !animsToUse[name]) {
      console.warn(`[Zombie] Animation not found: ${name}`);
      return;
    }
    
    console.log(`[Zombie] Playing animation: ${name}`);
    
    const targetAction = animsToUse[name];
    const currentAction = animsToUse[currentAnimation];
    
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
  
  // AI State machine and animation updates
  useFrame((state, delta) => {
    if (!modelLoaded || !mixer) return;
    
    // Update animation mixer
    mixer.update(delta);
    
    // Update state timer
    setStateTimer(prev => prev + delta);
    
    // Update group position and rotation
    if (group.current) {
      group.current.position.copy(zombiePosition.current);
      group.current.rotation.copy(zombieRotation.current);
    }
    
    // AI State Machine
    switch (aiState) {
      case ZombieState.IDLE:
        if (stateTimer >= idleTime) {
          // Find nearest player and start turning towards them
          const nearest = findNearestPlayer();
          if (nearest) {
            setTargetPlayer(nearest);
            const targetPos = new THREE.Vector3(nearest.position.x, nearest.position.y, nearest.position.z);
            targetRotation.current = calculateAngleToTarget(targetPos);
            setAiState(ZombieState.TURNING);
            setStateTimer(0);
            console.log('[Zombie] Found target player, starting to turn');
          }
        }
        break;
        
      case ZombieState.TURNING:
        // Smoothly rotate towards target
        const rotationDiff = targetRotation.current - zombieRotation.current.y;
        const normalizedDiff = Math.atan2(Math.sin(rotationDiff), Math.cos(rotationDiff));
        
        if (Math.abs(normalizedDiff) < 0.1) {
          // Finished turning, start screaming
          setAiState(ZombieState.SCREAMING);
          setStateTimer(0);
          playZombieAnimation(ZOMBIE_ANIMATIONS.SCREAM);
          console.log('[Zombie] Finished turning, starting scream');
        } else {
          // Continue turning
          const turnAmount = Math.sign(normalizedDiff) * TURN_SPEED * delta;
          zombieRotation.current.y += turnAmount;
        }
        break;
        
      case ZombieState.SCREAMING:
        if (stateTimer >= SCREAM_DURATION) {
          // Finished screaming, start walking
          setAiState(ZombieState.WALKING);
          setStateTimer(0);
          playZombieAnimation(ZOMBIE_ANIMATIONS.WALKING);
          console.log('[Zombie] Finished screaming, starting to walk');
        }
        break;
        
      case ZombieState.WALKING:
        if (targetPlayer) {
          const targetPos = new THREE.Vector3(targetPlayer.position.x, targetPlayer.position.y, targetPlayer.position.z);
          const direction = new THREE.Vector3()
            .subVectors(targetPos, zombiePosition.current)
            .normalize();
          
          // Move towards target
          const moveAmount = direction.multiplyScalar(ZOMBIE_SPEED * delta);
          zombiePosition.current.add(moveAmount);
          
          // Update rotation to face movement direction
          zombieRotation.current.y = calculateAngleToTarget(targetPos);
          
          // Check if reached target (within 2 units)
          const distance = zombiePosition.current.distanceTo(targetPos);
          if (distance < 2.0) {
            // Reset to idle for now (could extend to attack)
            setAiState(ZombieState.IDLE);
            setStateTimer(0);
            setIdleTime(Math.random() * 3);
            setTargetPlayer(null);
            playZombieAnimation(ZOMBIE_ANIMATIONS.IDLE);
            console.log('[Zombie] Reached target, returning to idle');
          }
        }
        break;
    }
  });
  
  return (
    <group ref={group} castShadow>
      {/* Debug info */}
      {isDebugVisible && (
        <Html position={[0, 3, 0]} center>
          <div style={{ 
            background: 'rgba(255, 0, 0, 0.8)', 
            color: 'white', 
            padding: '5px',
            borderRadius: '3px',
            fontSize: '12px'
          }}>
            Zombie - State: {aiState}<br/>
            Timer: {stateTimer.toFixed(1)}s<br/>
            Target: {targetPlayer?.username || 'None'}
          </div>
        </Html>
      )}
      
      {/* Zombie nameplate */}
      {model && (
        <Html position={[0, 2.5, 0]} center distanceFactor={10}>
          <div className="nametag">
            <div className="nametag-text" style={{ color: '#ff6666' }}>Zombie</div>
            <div className="nametag-class" style={{ color: '#cc4444' }}>Enemy NPC</div>
          </div>
        </Html>
      )}
    </group>
  );
}; 