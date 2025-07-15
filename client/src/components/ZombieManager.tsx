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

// Animation names for zombie
const ZOMBIE_ANIMATIONS = {
  IDLE: 'idle',
  SCREAM: 'scream',
  WALKING: 'walking',
  RUNNING: 'running',
  ATTACK: 'attack',
  DEATH: 'death',
};

// Configurable spawn settings
const SPAWN_SETTINGS = {
  MIN_DISTANCE_FROM_PLAYERS: 8, // Default minimum distance (can be overridden via props)
  WORLD_SIZE: 40, // Size of the game world for spawning
  MAX_SPAWN_ATTEMPTS: 50, // Maximum attempts to find a safe spawn position
  FALLBACK_EDGE_DISTANCE: 0.4 // Multiplier for edge distance in fallback scenarios
};

// Zombie AI Decision Types
interface ZombieDecision {
  action: 'pursue' | 'attack' | 'wander' | 'idle' | 'rotate' | 'scream_before_pursuit' | 'patrol';
  targetPlayer?: PlayerData;
  direction?: THREE.Vector3;
  duration: number;
  animation: string;
  speed: number;
  nextAction?: 'scream_before_pursuit' | 'pursue'; // For chaining behaviors
}

// Advanced AI Decision Making System
const makeZombieDecision = (
  zombiePosition: THREE.Vector3,
  players: ReadonlyMap<string, PlayerData>,
  lastDecisionTime: number = 0
): ZombieDecision => {
  // Base probabilities (0-100)
  const baseProbabilities = {
    pursue: 20,
    attack: 5,
    wander: 30,
    idle: 25,
    scream_before_pursuit: 15, // Higher chance since it leads to pursuit
    patrol: 10
  };

  // Find all players and calculate distances
  const playerDistances = Array.from(players.values()).map(player => {
    const playerPos = new THREE.Vector3(player.position.x, player.position.y, player.position.z);
    const distance = zombiePosition.distanceTo(playerPos);
    return { player, distance };
  }).sort((a, b) => a.distance - b.distance); // Sort by closest first

  const nearestPlayer = playerDistances[0];
  
  // If no players, default to idle/wander
  if (!nearestPlayer) {
    const diceRoll = Math.random() * 100;
    return {
      action: diceRoll < 60 ? 'idle' : 'wander',
      duration: 2 + Math.random() * 3,
      animation: diceRoll < 60 ? ZOMBIE_ANIMATIONS.IDLE : ZOMBIE_ANIMATIONS.WALKING,
      speed: 0,
      direction: diceRoll >= 60 ? new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        0,
        (Math.random() - 0.5) * 2
      ).normalize() : undefined
    };
  }

  const closestDistance = nearestPlayer.distance;
  
  // Distance-based probability modifiers
  let pursueBonus = 0;
  let attackBonus = 0;
  let aggressionMultiplier = 1;

  // Very close (0-3 units): High aggression
  if (closestDistance <= 3) {
    pursueBonus = 40;
    attackBonus = 35;
    aggressionMultiplier = 2.5;
  }
  // Close (3-8 units): Moderate aggression  
  else if (closestDistance <= 8) {
    pursueBonus = 25;
    attackBonus = 15;
    aggressionMultiplier = 1.8;
  }
  // Medium (8-15 units): Some interest
  else if (closestDistance <= 15) {
    pursueBonus = 15;
    attackBonus = 5;
    aggressionMultiplier = 1.3;
  }
  // Far (15-25 units): Low interest
  else if (closestDistance <= 25) {
    pursueBonus = 5;
    attackBonus = 0;
    aggressionMultiplier = 0.8;
  }
  // Very far (25+ units): Minimal interest
  else {
    pursueBonus = 2;
    attackBonus = 0;
    aggressionMultiplier = 0.5;
  }

  // Multiple player bonus: more chaos when more players are nearby
  const nearbyPlayerCount = playerDistances.filter(p => p.distance <= 12).length;
  const chaosBonus = Math.min(nearbyPlayerCount * 5, 20);
  
  // Time-based variety: prevent getting stuck in same behavior
  const timeSinceLastDecision = Date.now() - lastDecisionTime;
  const varietyBonus = Math.min(timeSinceLastDecision / 1000, 10); // Up to 10% bonus for variety

  // Calculate final probabilities with dice rolls
  const diceRoll1 = Math.random() * 100; // Primary action dice
  const diceRoll2 = Math.random() * 100; // Secondary modifier dice
  const luckyRoll = Math.random() * 100;  // Chaos/lucky event dice

  const finalProbabilities = {
    pursue: Math.min(95, baseProbabilities.pursue + pursueBonus + chaosBonus + (diceRoll2 < 20 ? 10 : 0)),
    attack: Math.min(90, baseProbabilities.attack + attackBonus + (nearbyPlayerCount > 1 ? 10 : 0)),
    scream_before_pursuit: baseProbabilities.scream_before_pursuit + (closestDistance <= 12 ? 20 : 0), // Higher chance when close to player
    wander: baseProbabilities.wander * (1 - aggressionMultiplier * 0.3) + varietyBonus,
    idle: baseProbabilities.idle * (1 - aggressionMultiplier * 0.2),
    patrol: baseProbabilities.patrol + (timeSinceLastDecision > 8000 ? 15 : 0) // Patrol if idle too long
  };

  // Decision logic with cumulative probability
  let cumulativeProbability = 0;
  let decision: ZombieDecision;

  // Attack decision (highest priority when very close)
  cumulativeProbability += finalProbabilities.attack;
  if (diceRoll1 <= cumulativeProbability && closestDistance <= 4) {
    decision = {
      action: 'attack',
      targetPlayer: nearestPlayer.player,
      duration: 1.5 + Math.random() * 0.5,
      animation: ZOMBIE_ANIMATIONS.ATTACK,
      speed: 0
    };
  }
  // Rotate before scream and pursuit decision (creates immersive sequence)
  else {
    cumulativeProbability += finalProbabilities.scream_before_pursuit;
    if (diceRoll1 <= cumulativeProbability) {
      decision = {
        action: 'rotate',
        targetPlayer: nearestPlayer.player,
        duration: 1.0 + Math.random() * 0.5, // Rotation duration
        animation: ZOMBIE_ANIMATIONS.IDLE, // Stay idle while rotating
        speed: 0,
        nextAction: 'scream_before_pursuit'
      };
    }
    // Pursue decision (direct chase without scream)
    else {
      cumulativeProbability += finalProbabilities.pursue;
      if (diceRoll1 <= cumulativeProbability) {
        decision = {
          action: 'pursue',
          targetPlayer: nearestPlayer.player,
          duration: 3 + Math.random() * 2,
          animation: ZOMBIE_ANIMATIONS.RUNNING, // Always run when pursuing
          speed: 6.75 // Always use running speed for pursuit (increased by 50%)
        };
      }
      // Wander decision
      else {
        cumulativeProbability += finalProbabilities.wander;
        if (diceRoll1 <= cumulativeProbability) {
          // Wander with slight bias towards players if they're not too far
          let wanderDirection = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            0,
            (Math.random() - 0.5) * 2
          ).normalize();
          
          // 30% chance to wander towards general player area if within 20 units
          if (closestDistance <= 20 && Math.random() < 0.3) {
            const playerPos = new THREE.Vector3(
              nearestPlayer.player.position.x,
              nearestPlayer.player.position.y,
              nearestPlayer.player.position.z
            );
            const toPlayer = playerPos.sub(zombiePosition).normalize();
            wanderDirection = wanderDirection.lerp(toPlayer, 0.4); // Slight bias towards player
          }

          decision = {
            action: 'wander',
            direction: wanderDirection,
            duration: 4 + Math.random() * 3,
            animation: ZOMBIE_ANIMATIONS.WALKING, // Always use walking for wandering
            speed: 1.5 + Math.random() * 0.375 // Increased by 50% from original speed
          };
        }
        // Patrol decision (systematic movement)
        else {
          cumulativeProbability += finalProbabilities.patrol;
          if (diceRoll1 <= cumulativeProbability) {
            // Create a patrol pattern (figure-8 or circular)
            const patrolAngle = (Date.now() / 1000) % (Math.PI * 2);
            const patrolDirection = new THREE.Vector3(
              Math.cos(patrolAngle),
              0,
              Math.sin(patrolAngle)
            );
            
            decision = {
              action: 'patrol',
              direction: patrolDirection,
              duration: 5 + Math.random() * 3,
              animation: ZOMBIE_ANIMATIONS.WALKING,
              speed: 1.5 // Increased by 50% from original speed
            };
          }
          // Default: Idle
          else {
            decision = {
              action: 'idle',
              duration: 2 + Math.random() * 4,
              animation: ZOMBIE_ANIMATIONS.IDLE,
              speed: 0
            };
          }
        }
      }
    }
  }

  // Debug logging for interesting decisions
  if (closestDistance <= 10 || decision!.action === 'attack' || decision!.action === 'rotate' || decision!.action === 'scream_before_pursuit') {
    console.log(`[Zombie AI] Distance: ${closestDistance.toFixed(1)}u, Decision: ${decision!.action}, Duration: ${decision!.duration.toFixed(1)}s, Dice: ${diceRoll1.toFixed(0)}`);
  }

  return decision!;
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
  
  // Legacy AI states for compatibility (can be removed later)
  const [aiState, setAiState] = useState<ZombieState>(ZombieState.IDLE);
  const [targetPlayer, setTargetPlayer] = useState<PlayerData | null>(null);
  
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
    
    const loader = new GLTFLoader();
    loader.load(
      '/models/zombie-2-converted/zombie.glb',
      (gltf) => {
        console.log(`[${zombieId}] Fresh model loaded`);
        
        const model = gltf.scene;
        
        // Apply proper scaling and positioning
        model.scale.setScalar(1.1); // Doubled the size to make zombies bigger
        model.position.set(0, -0.1, 0);
        
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
            // Initialize AI with the new system
            const initialDecision = makeZombieDecision(zombiePosition.current, players, Date.now());
            setCurrentDecision(initialDecision);
            setDecisionTimer(0);
            setLastDecisionTime(Date.now());
            console.log(`[${zombieId}] Initialized with fresh model - Decision: ${initialDecision.action}, Position: ${zombiePosition.current.toArray()}`);
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

  // Advanced AI Update System
  const updateAdvancedAI = useCallback((delta: number) => {
    // Update decision timer
    setDecisionTimer(prev => prev + delta);
    
    // Check if we need a new decision
    if (!currentDecision || decisionTimer >= currentDecision.duration) {
      let newDecision: ZombieDecision;
      
      // Handle behavior transitions
      if (currentDecision?.nextAction && currentDecision.targetPlayer) {
        if (currentDecision.action === 'rotate' && currentDecision.nextAction === 'scream_before_pursuit') {
          // Rotate → Scream transition
          newDecision = {
            action: 'scream_before_pursuit',
            targetPlayer: currentDecision.targetPlayer,
            duration: 1.5 + Math.random() * 0.5,
            animation: ZOMBIE_ANIMATIONS.SCREAM,
            speed: 0,
            nextAction: 'pursue'
          };
          
          if (zombieId === 'zombie-0' || zombieId === 'zombie-1') {
            console.log(`[${zombieId}] Rotation finished, now screaming at ${currentDecision.targetPlayer.username}`);
          }
        } else if (currentDecision.action === 'scream_before_pursuit' && currentDecision.nextAction === 'pursue') {
          // Scream → Pursue transition
          newDecision = {
            action: 'pursue',
            targetPlayer: currentDecision.targetPlayer,
            duration: 3 + Math.random() * 2,
            animation: ZOMBIE_ANIMATIONS.RUNNING, // Always run when pursuing
            speed: 6.75 // Increased by 50% from original speed
          };
          
          if (zombieId === 'zombie-0' || zombieId === 'zombie-1') {
            console.log(`[${zombieId}] Scream finished, now pursuing ${currentDecision.targetPlayer.username}`);
          }
        } else {
          // Fallback to new decision
          newDecision = makeZombieDecision(zombiePosition.current, players, lastDecisionTime);
        }
      } else if (currentDecision?.action === 'attack' && currentDecision.targetPlayer) {
        // Special handling for attack completion
        const targetPos = new THREE.Vector3(
          currentDecision.targetPlayer.position.x,
          currentDecision.targetPlayer.position.y,
          currentDecision.targetPlayer.position.z
        );
        const distanceToPlayer = zombiePosition.current.distanceTo(targetPos);
        
        if (distanceToPlayer <= 3.0) {
          // Player is still close - continue attacking or pursue briefly
          if (Math.random() < 0.7) {
            // 70% chance to attack again if player is still close
            newDecision = {
              action: 'attack',
              targetPlayer: currentDecision.targetPlayer,
              duration: 1.5 + Math.random() * 1.0,
              animation: ZOMBIE_ANIMATIONS.ATTACK,
              speed: 0
            };
            
            if (zombieId === 'zombie-0' || zombieId === 'zombie-1') {
              console.log(`[${zombieId}] Player still close, continuing attack!`);
            }
          } else {
            // 30% chance to pursue for repositioning
            newDecision = {
              action: 'pursue',
              targetPlayer: currentDecision.targetPlayer,
              duration: 1.0 + Math.random() * 1.0, // Short pursuit
              animation: ZOMBIE_ANIMATIONS.RUNNING,
              speed: 6.75
            };
          }
        } else if (distanceToPlayer <= 8.0) {
          // Player moved away but is still nearby - pursue them
          newDecision = {
            action: 'pursue',
            targetPlayer: currentDecision.targetPlayer,
            duration: 3 + Math.random() * 2,
            animation: ZOMBIE_ANIMATIONS.RUNNING,
            speed: 6.75
          };
          
          if (zombieId === 'zombie-0' || zombieId === 'zombie-1') {
            console.log(`[${zombieId}] Player moved away, resuming pursuit`);
          }
        } else {
          // Player is far away - make a new decision
          newDecision = makeZombieDecision(zombiePosition.current, players, lastDecisionTime);
        }
      } else {
        // Make a new decision normally
        newDecision = makeZombieDecision(zombiePosition.current, players, lastDecisionTime);
      }
      
      setCurrentDecision(newDecision);
      setDecisionTimer(0);
      setLastDecisionTime(Date.now());
      
      // Update legacy states for compatibility
      setTargetPlayer(newDecision.targetPlayer || null);
      
      // Start the appropriate animation
      if (newDecision.animation !== currentAnimation) {
        playZombieAnimation(newDecision.animation);
      }
      
      // Debug logging for decision changes
      if (zombieId === 'zombie-0' || zombieId === 'zombie-1') {
        console.log(`[${zombieId}] New Decision: ${newDecision.action} for ${newDecision.duration.toFixed(1)}s`);
      }
    }
    
    // Execute current decision
    if (currentDecision) {
      switch (currentDecision.action) {
        case 'pursue':
          if (currentDecision.targetPlayer) {
            const targetPos = new THREE.Vector3(
              currentDecision.targetPlayer.position.x,
              currentDecision.targetPlayer.position.y,
              currentDecision.targetPlayer.position.z
            );
            const distanceToPlayer = zombiePosition.current.distanceTo(targetPos);
            
            // Check if close enough to attack (within 2.5 units)
            if (distanceToPlayer <= 2.5) {
              // Stop and transition to attack
              const attackDecision: ZombieDecision = {
                action: 'attack',
                targetPlayer: currentDecision.targetPlayer,
                duration: 2.0 + Math.random() * 1.0, // Attack for 2-3 seconds
                animation: ZOMBIE_ANIMATIONS.ATTACK,
                speed: 0
              };
              
              setCurrentDecision(attackDecision);
              setDecisionTimer(0);
              playZombieAnimation(ZOMBIE_ANIMATIONS.ATTACK);
              
              if (zombieId === 'zombie-0' || zombieId === 'zombie-1') {
                console.log(`[${zombieId}] Close enough to player, starting attack!`);
              }
            } else {
              // Continue pursuing - move towards target
              const direction = new THREE.Vector3()
                .subVectors(targetPos, zombiePosition.current)
                .normalize();
              
              const moveAmount = direction.multiplyScalar(currentDecision.speed * delta);
              zombiePosition.current.add(moveAmount);
            }
            
            // Always face target during pursuit
            zombieRotation.current.y = calculateAngleToTarget(targetPos);
          }
          break;
          
        case 'attack':
          if (currentDecision.targetPlayer) {
            // Face target during attack
            const targetPos = new THREE.Vector3(
              currentDecision.targetPlayer.position.x,
              currentDecision.targetPlayer.position.y,
              currentDecision.targetPlayer.position.z
            );
            zombieRotation.current.y = calculateAngleToTarget(targetPos);
          }
          // Attack animation plays automatically
          break;
          
        case 'wander':
        case 'patrol':
          if (currentDecision.direction) {
            // Move in the specified direction
            const moveAmount = currentDecision.direction
              .clone()
              .multiplyScalar(currentDecision.speed * delta);
            zombiePosition.current.add(moveAmount);
            
            // Face movement direction
            zombieRotation.current.y = Math.atan2(currentDecision.direction.x, currentDecision.direction.z);
          }
          break;
          
        case 'rotate':
          if (currentDecision.targetPlayer) {
            // Slowly rotate to face target
            const targetPos = new THREE.Vector3(
              currentDecision.targetPlayer.position.x,
              currentDecision.targetPlayer.position.y,
              currentDecision.targetPlayer.position.z
            );
            const targetAngle = calculateAngleToTarget(targetPos);
            const currentAngle = zombieRotation.current.y;
            const angleDiff = targetAngle - currentAngle;
            const normalizedDiff = Math.atan2(Math.sin(angleDiff), Math.cos(angleDiff));
            
            // Smooth rotation - slower than normal turning
            const rotationSpeed = 1.5; // Slower rotation for dramatic effect
            if (Math.abs(normalizedDiff) > 0.05) {
              const rotationAmount = Math.sign(normalizedDiff) * rotationSpeed * delta;
              zombieRotation.current.y += rotationAmount;
            }
          }
          break;
          
        case 'scream_before_pursuit':
          if (currentDecision.targetPlayer) {
            // Face target while screaming (should already be facing from rotation)
            const targetPos = new THREE.Vector3(
              currentDecision.targetPlayer.position.x,
              currentDecision.targetPlayer.position.y,
              currentDecision.targetPlayer.position.z
            );
            zombieRotation.current.y = calculateAngleToTarget(targetPos);
          }
          break;
          
        case 'idle':
          // Do nothing, just stay in place
          break;
      }
    }
  }, [currentDecision, decisionTimer, lastDecisionTime, players, playZombieAnimation, currentAnimation, zombieId, calculateAngleToTarget]);

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
            Timer: {decisionTimer.toFixed(1)}s / {currentDecision?.duration.toFixed(1) || '0'}s<br/>
            Target: {currentDecision?.targetPlayer?.username || 'None'}
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
    
    console.log('[ZombieManager] Loading shared zombie resources...');
    
    // Load main model
    loader.load(
      '/models/zombie-2-converted/zombie.glb',
      (gltf) => {
        console.log('[ZombieManager] Shared model loaded');
        const model = gltf.scene;
        console.log('[ZombieManager] Shared model initial scale:', model.scale);
        console.log('[ZombieManager] Shared model initial position:', model.position);
        
        // Ensure shared model has default scale (don't scale the shared model itself)
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
        
        console.log(`[ZombieManager] Zombie ${index} spawned at [${position[0].toFixed(1)}, ${position[2].toFixed(1)}], nearest player: ${nearestPlayerDistance.toFixed(1)}u`);
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