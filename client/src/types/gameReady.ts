/**
 * gameReady.ts
 * 
 * Types and interfaces for the GameReady event system:
 * 
 * This system tracks when all game components are loaded and ready:
 * - Character model loaded, visible, and in falling animation
 * - All zombie models spawned and ready
 * 
 * Used to determine when to hide loading screen and show game view
 */

import * as THREE from 'three';

export interface GameReadyState {
  isCharacterReady: boolean;
  isZombiesReady: boolean;
  characterProgress: number; // 0-100
  zombieProgress: number; // 0-100
  characterStatus: string;
  zombieStatus: string;
}

export interface GameReadyCallbacks {
  onCharacterReady: () => void;
  onZombiesReady: () => void;
  onCharacterProgress: (progress: number, status: string) => void;
  onZombieProgress: (progress: number, status: string) => void;
  onCoinCollected?: (count: number) => void;
  onSwordCollected?: (swordModel: THREE.Group) => void;
}

export interface PlayerReadyState {
  modelLoaded: boolean;
  animationsLoaded: boolean;
  isVisible: boolean;
  isInFallingAnimation: boolean;
  physicsEnabled: boolean;
}

export interface ZombieManagerReadyState {
  totalZombies: number;
  loadedZombies: number;
  allZombiesSpawned: boolean;
  resourcesLoaded: boolean;
}

// Helper function to check if game is completely ready
export const isGameReady = (state: GameReadyState): boolean => {
  return state.isCharacterReady && state.isZombiesReady;
};

// Helper function to calculate overall progress
export const calculateOverallProgress = (state: GameReadyState): number => {
  return Math.round((state.characterProgress + state.zombieProgress) / 2);
}; 