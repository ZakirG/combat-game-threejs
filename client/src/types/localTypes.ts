// Local type definitions to replace SpacetimeDB generated types
export interface Vector3 {
  x: number;
  y: number; 
  z: number;
}

export interface InputState {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
  jump: boolean;
  attack: boolean;
  castSpell: boolean;
  sequence: number;
}

export interface PlayerData {
  identity: string; // Changed from Identity to string
  username: string;
  characterClass: string;
  xHandle: string | undefined;
  position: Vector3;
  rotation: Vector3;
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  currentAnimation: string;
  isMoving: boolean;
  isRunning: boolean;
  isNinjaRunning: boolean;
  isAttacking: boolean;
  isCasting: boolean;
  lastInputSeq: number;
  input: InputState;
  color: string;
  isDriving: boolean;
  vehicleVelocity: Vector3;
}

// Mock identity for single player
export const LOCAL_PLAYER_IDENTITY = "local-player-001"; 