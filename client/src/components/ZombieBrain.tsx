import * as THREE from 'three';
import { PlayerData } from '../generated';

// Configurable distances
const DISTANCE_TO_PLAYER_BEFORE_CHASING = 15.0;
const STRIKING_DISTANCE = 3.0;

// Animation constants
export const ZOMBIE_ANIMATIONS = {
  IDLE: 'idle',
  SCREAM: 'scream',
  WALKING: 'walking',
  RUNNING: 'running',
  ATTACK: 'attack',
  DEATH: 'death',
} as const;

// Zombie decision interface
export interface ZombieDecision {
  action: 'idle' | 'chase' | 'attack' | 'wander' | 'rotate' | 'scream';
  duration: number;
  animation: string;
  speed: number;
  targetPosition?: THREE.Vector3;
  targetRotation?: number;
  isRotating?: boolean;
}

// Zombie state for tracking behavior modes
export interface ZombieState {
  mode: 'idle' | 'pursuing' | 'attacking' | 'wandering';
  targetPlayerId?: string;
  lastDecisionTime?: number;
  currentTargetPosition?: THREE.Vector3;
  rotationStartTime?: number;
  targetRotation?: number;
}

// Find the closest player to the zombie
function findClosestPlayer(
  zombiePosition: THREE.Vector3,
  players: ReadonlyMap<string, PlayerData>
): { player: PlayerData; distance: number; playerId: string } | null {
  let closestPlayer = null;
  let closestDistance = Infinity;
  let closestPlayerId = '';

  for (const [playerId, player] of players) {
    const playerPos = new THREE.Vector3(player.position.x, player.position.y, player.position.z);
    const distance = zombiePosition.distanceTo(playerPos);
    
    if (distance < closestDistance) {
      closestDistance = distance;
      closestPlayer = player;
      closestPlayerId = playerId;
    }
  }

  return closestPlayer ? { player: closestPlayer, distance: closestDistance, playerId: closestPlayerId } : null;
}

// Calculate angle to face a target position
function calculateRotationToTarget(currentPos: THREE.Vector3, targetPos: THREE.Vector3): number {
  const direction = new THREE.Vector3()
    .subVectors(targetPos, currentPos)
    .normalize();
  return Math.atan2(direction.x, direction.z);
}

// Generate random direction for wandering
function generateRandomDirection(): number {
  return Math.random() * Math.PI * 2; // Random angle 0 to 2π
}

// Main zombie decision-making function
export function makeZombieDecision(
  zombiePosition: THREE.Vector3,
  players: ReadonlyMap<string, PlayerData>,
  zombieState?: ZombieState
): ZombieDecision {
  
  // Initialize zombie state if not provided
  if (!zombieState) {
    zombieState = { mode: 'idle' };
  }

  const currentTime = Date.now();
  const closestPlayerInfo = findClosestPlayer(zombiePosition, players);

  // Debug logging for player detection (occasionally)
  if (Math.random() < 0.01 && closestPlayerInfo) {
    console.log(`[ZombieBrain] Closest player at distance ${closestPlayerInfo.distance.toFixed(2)} (chase threshold: ${DISTANCE_TO_PLAYER_BEFORE_CHASING})`);
  }

  // Check if player is nearby for chasing
  if (closestPlayerInfo && closestPlayerInfo.distance <= DISTANCE_TO_PLAYER_BEFORE_CHASING) {
    const playerPos = new THREE.Vector3(
      closestPlayerInfo.player.position.x,
      closestPlayerInfo.player.position.y,
      closestPlayerInfo.player.position.z
    );

    // If we're within striking distance, attack
    if (closestPlayerInfo.distance <= STRIKING_DISTANCE) {
      const targetRotation = calculateRotationToTarget(zombiePosition, playerPos);
      
      // Check if zombie needs to rotate to face player before attacking
      if (zombieState.mode !== 'attacking' || zombieState.targetPlayerId !== closestPlayerInfo.playerId) {
        zombieState.mode = 'attacking';
        zombieState.targetPlayerId = closestPlayerInfo.playerId;
        zombieState.rotationStartTime = currentTime;
        zombieState.targetRotation = targetRotation;

        // Start rotation phase (half second rotation)
        return {
          action: 'rotate',
          duration: 500, // Half second rotation
          animation: ZOMBIE_ANIMATIONS.IDLE,
          speed: 0,
          targetRotation: targetRotation,
          isRotating: true
        };
      } else {
        // Already rotated, now attack
        return {
          action: 'attack',
          duration: 1000, // Attack animation duration
          animation: ZOMBIE_ANIMATIONS.ATTACK,
          speed: 0,
          targetPosition: playerPos
        };
      }
    }

    // If not in striking distance but within chasing distance
    if (zombieState.mode !== 'pursuing' || zombieState.targetPlayerId !== closestPlayerInfo.playerId) {
      // Just entered pursuit mode - scream first
      zombieState.mode = 'pursuing';
      zombieState.targetPlayerId = closestPlayerInfo.playerId;
      
      const targetRotation = calculateRotationToTarget(zombiePosition, playerPos);
      
      return {
        action: 'scream',
        duration: 1500, // Scream duration
        animation: ZOMBIE_ANIMATIONS.SCREAM,
        speed: 0,
        targetRotation: targetRotation
      };
    } else {
      // Already pursuing - continue chasing with updated player position
      zombieState.currentTargetPosition = playerPos;
      
      return {
        action: 'chase',
        duration: 500, // Longer duration for stable chasing, will still update as needed
        animation: ZOMBIE_ANIMATIONS.RUNNING,
        speed: 4.0, // Running speed
        targetPosition: playerPos
      };
    }
  }

  // No player nearby - reset pursuit mode
  if (zombieState.mode === 'pursuing' || zombieState.mode === 'attacking') {
    zombieState.mode = 'idle';
    zombieState.targetPlayerId = undefined;
    zombieState.currentTargetPosition = undefined;
  }

  // Random wandering behavior (30% chance)
  if (Math.random() < 0.3) {
    const randomDirection = generateRandomDirection();
    const wanderDistance = 5.0; // How far to wander
    const targetPosition = new THREE.Vector3(
      zombiePosition.x + Math.sin(randomDirection) * wanderDistance,
      zombiePosition.y,
      zombiePosition.z + Math.cos(randomDirection) * wanderDistance
    );

    zombieState.mode = 'wandering';
    
    return {
      action: 'wander',
      duration: 2000, // Wander for 2 seconds
      animation: ZOMBIE_ANIMATIONS.WALKING,
      speed: 1.5, // Walking speed
      targetPosition: targetPosition,
      targetRotation: randomDirection
    };
  }

  // Default: idle for 2 seconds
  zombieState.mode = 'idle';
  return {
    action: 'idle',
    duration: 2000, // Idle for 2 seconds
    animation: ZOMBIE_ANIMATIONS.IDLE,
    speed: 0
  };
} 