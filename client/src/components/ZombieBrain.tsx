import * as THREE from 'three';
import { PlayerData } from '../generated';

// Animation constants
export const ZOMBIE_ANIMATIONS = {
  IDLE: 'idle',
  SCREAM: 'scream',
  WALKING: 'walking',
  RUNNING: 'running',
  ATTACK: 'attack',
  DEATH: 'death',
} as const;

// Simple zombie decision interface
export interface ZombieDecision {
  action: 'idle';
  duration: number;
  animation: string;
  speed: number;
}

// Simple zombie brain - just idle for now
export function makeZombieDecision(
  zombiePosition: THREE.Vector3,
  players: ReadonlyMap<string, PlayerData>
): ZombieDecision {
  
  // For now, just idle forever
  return {
    action: 'idle',
    duration: 1000, // Very long duration so we don't keep making new decisions
    animation: ZOMBIE_ANIMATIONS.IDLE,
    speed: 0
  };
} 