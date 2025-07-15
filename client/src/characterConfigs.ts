/**
 * Character Configuration System
 * 
 * This file contains all character-specific settings including:
 * - Model paths and scaling
 * - Animation file mappings
 * - Movement speeds
 * - Animation time scales
 * 
 * To add a new character:
 * 1. Add a new entry to CHARACTER_CONFIGS
 * 2. Specify the model path, scale, and animation files
 * 3. Set movement speeds and any animation overrides
 * 
 * No changes to Player.tsx are needed when adding new characters.
 */

export interface CharacterMovementConfig {
  walkSpeed: number;
  runSpeed: number;
}

export interface CharacterAnimationTable {
  idle: string;
  'walk-forward': string;
  'walk-back': string;
  'walk-left': string;
  'walk-right': string;
  'run-forward': string;
  'run-back': string;
  'run-left': string;
  'run-right': string;
  jump: string;
  attack1: string;
  cast: string;
  damage: string;
  death: string;
}

export interface CharacterConfig {
  modelPath: string;
  basePath: string; // Base directory for animation files
  scale: number;
  yOffset: number;
  movement: CharacterMovementConfig;
  animationTable: CharacterAnimationTable;
  timeScale?: Record<string, number>; // Optional per-animation speed overrides
}

export const CHARACTER_CONFIGS: Record<string, CharacterConfig> = {
  "Zaqir Mufasa": {
    modelPath: "/models/zaqir-2/Idle.fbx",
    basePath: "/models/zaqir-2/",
    scale: 0.012,
    yOffset: -0.3,
    movement: {
      walkSpeed: 3.0,
      runSpeed: 6.0
    },
    animationTable: {
      idle: "Idle.fbx",
      'walk-forward': "Mutant Walk.fbx", // Use the mutant walk animation
      'walk-back': "Standing Walk Back.fbx", 
      'walk-left': "Standing Walk Left.fbx",
      'walk-right': "Standing Walk Right.fbx",
      'run-forward': "Fast Run.fbx", // Use the dedicated fast run animation
      'run-back': "Standing Run Back.fbx", // Use dedicated run back animation
      'run-left': "Standing Run Left.fbx", // Use dedicated run left animation
      'run-right': "Standing Run Right.fbx", // Use dedicated run right animation
      jump: "Jumping.fbx",
      attack1: "Standing Melee Punch.fbx",
      cast: "Roundhouse Kick.fbx",
      damage: "Receive Hit.fbx",
      death: "death.fbx"
    },
    timeScale: {
      'walk-forward': 1.0, // Normal speed for mutant walk
      'run-forward': 1.1,  // Slightly faster for the fast run animation
      'run-back': 1.0,     // Normal speed for run back
      'run-left': 1.0,     // Normal speed for run left  
      'run-right': 1.0,    // Normal speed for run right
      idle: 0.8 // Slightly slower idle for more dramatic effect
    }
  },
  "Grok Ani": {
    modelPath: "/models/grok-ani/Gothic_Elegance_0715203917_texture_fbx/Gothic_Elegance_0715203917_texture.fbx",
    basePath: "/models/zaqir-2/", // Use Zaqir's animations as fallback
    scale: 0.012,
    yOffset: -0.3,
    movement: {
      walkSpeed: 2.8,
      runSpeed: 5.5
    },
    animationTable: {
      idle: "Idle.fbx",
      'walk-forward': "Mutant Walk.fbx",
      'walk-back': "Standing Walk Back.fbx", 
      'walk-left': "Standing Walk Left.fbx",
      'walk-right': "Standing Walk Right.fbx",
      'run-forward': "Fast Run.fbx",
      'run-back': "Standing Run Back.fbx",
      'run-left': "Standing Run Left.fbx",
      'run-right': "Standing Run Right.fbx",
      jump: "Jumping.fbx",
      attack1: "Standing Melee Punch.fbx",
      cast: "Roundhouse Kick.fbx",
      damage: "Receive Hit.fbx",
      death: "death.fbx"
    },
    timeScale: {
      'walk-forward': 0.9, // Slightly more elegant movement
      'run-forward': 1.0,
      idle: 0.7 // Slower, more regal idle
    }
  },
  "Grok Rudi": {
    modelPath: "/models/grok-rudi/Red_Panda_Pal_0715205437_texture_fbx/Red_Panda_Pal_0715205437_texture.fbx",
    basePath: "/models/zaqir-2/", // Use Zaqir's animations as fallback
    scale: 0.012,
    yOffset: -0.3,
    movement: {
      walkSpeed: 3.2,
      runSpeed: 6.5
    },
    animationTable: {
      idle: "Idle.fbx",
      'walk-forward': "Mutant Walk.fbx",
      'walk-back': "Standing Walk Back.fbx", 
      'walk-left': "Standing Walk Left.fbx",
      'walk-right': "Standing Walk Right.fbx",
      'run-forward': "Fast Run.fbx",
      'run-back': "Standing Run Back.fbx",
      'run-left': "Standing Run Left.fbx",
      'run-right': "Standing Run Right.fbx",
      jump: "Jumping.fbx",
      attack1: "Standing Melee Punch.fbx",
      cast: "Roundhouse Kick.fbx",
      damage: "Receive Hit.fbx",
      death: "death.fbx"
    },
    timeScale: {
      'walk-forward': 1.1, // More energetic movement
      'run-forward': 1.2,  // Faster, more agile
      'run-back': 1.1,
      'run-left': 1.1,
      'run-right': 1.1,
      idle: 0.9 // Slightly more active idle
    }
  }
} as const;

// Helper function to get character config with fallback
export function getCharacterConfig(characterClass: string): CharacterConfig {
  const config = CHARACTER_CONFIGS[characterClass];
  
  if (!config) {
    console.warn(`Unknown character class: ${characterClass}. Falling back to Zaqir Mufasa.`);
    return CHARACTER_CONFIGS["Zaqir Mufasa"];
  }
  
  return config;
}

// Helper function to get full animation path
export function getAnimationPath(config: CharacterConfig, animationKey: keyof CharacterAnimationTable): string {
  const filename = config.animationTable[animationKey];
  return `${config.basePath}${filename}`;
}

// Helper function to get animation time scale
export function getAnimationTimeScale(config: CharacterConfig, animationKey: string): number {
  return config.timeScale && config.timeScale[animationKey] !== undefined ? config.timeScale[animationKey] : 1.0;
}

// Export available character classes for UI components
export const AVAILABLE_CHARACTERS = Object.keys(CHARACTER_CONFIGS) as Array<keyof typeof CHARACTER_CONFIGS>; 