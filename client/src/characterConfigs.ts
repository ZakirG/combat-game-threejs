/**
 * Character Configuration System
 * 
 * This file contains all character-specific settings including:
 * - Model paths and scaling
 * - Animation file mappings
 * - Movement speeds
 * - Animation time scales
 * - Separate settings for character preview vs gameplay
 * 
 * To add a new character:
 * 1. Add a new entry to CHARACTER_CONFIGS
 * 2. Specify the model path, scale, and animation files
 * 3. Set movement speeds and any animation overrides
 * 4. Configure both preview and gameplay positioning
 * 
 * No changes to Player.tsx are needed when adding new characters.
 */

export interface CharacterMovementConfig {
  walkSpeed: number;
  runSpeed: number;
}

export const SPAWN_ALTITUDE = 120.0;

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
  falling: string;
  landing: string;
}

// Separate configuration for character preview (character selector)
export interface CharacterPreviewConfig {
  scale: number;
  yOffset: number;
}

// Separate configuration for gameplay
export interface CharacterGameplayConfig {
  scale: number;
  yOffset: number;
  highAltitudeSpawn: number; // Very high spawn altitude for dramatic entrance
}

export interface CharacterConfig {
  modelPath: string;
  basePath: string; // Base directory for animation files
  scale: number; // Deprecated - use preview.scale or gameplay.scale
  yOffset: number; // Deprecated - use preview.yOffset or gameplay.yOffset
  preview: CharacterPreviewConfig; // Settings for character selector
  gameplay: CharacterGameplayConfig; // Settings for main game
  movement: CharacterMovementConfig;
  animationTable: CharacterAnimationTable;
  timeScale?: Record<string, number>; // Optional per-animation speed overrides
}

export const CHARACTER_CONFIGS: Record<string, CharacterConfig> = {
  "Zaqir Mufasa": {
    modelPath: "/models/zaqir-2/Idle.fbx",
    basePath: "/models/zaqir-2/",
    scale: 0.016, // 1.3x bigger (0.012 * 1.3)
    yOffset: 1.2, // Increased to prevent feet from going into ground
    preview: {
      scale: 0.010, // 1.3x bigger (0.012 * 1.3)
      yOffset: 0.4 // Adjusted for ground level positioning
    },
    gameplay: {
       scale: 0.016, // 1.3x bigger (0.012 * 1.3)
       yOffset: 1.2, // Increased to prevent feet from going into ground
       highAltitudeSpawn: SPAWN_ALTITUDE
     },
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
      death: "death.fbx",
      falling: "Falling.fbx",
      landing: "Landing.fbx"
    },
    timeScale: {
      'walk-forward': 1.0, // Normal speed for mutant walk
      'run-forward': 1.1,  // Slightly faster for the fast run animation
      'run-back': 1.0,     // Normal speed for run back
      'run-left': 1.0,     // Normal speed for run left  
      'run-right': 1.0,    // Normal speed for run right
      idle: 0.8, // Slightly slower idle for more dramatic effect
      falling: 1.0, // Normal falling speed
      landing: 1.2 // Slightly faster landing for quicker recovery
    }
  },
  "Grok Ani": {
    modelPath: "/models/grok-ani/base.fbx",
    basePath: "/models/grok-ani/", // Use Grok Ani's own animations
    scale: 0.01,
    yOffset: 0.0, // Adjusted for ground level positioning
    preview: {
      scale: 0.011,
      yOffset: 0.2
    },
    gameplay: {
       scale: 0.01,
       yOffset: 0.0, // Adjusted for ground level positioning
       highAltitudeSpawn: SPAWN_ALTITUDE
     },
    movement: {
      walkSpeed: 2.8,
      runSpeed: 5.5
    },
    animationTable: {
      idle: "Idle.fbx",
      'walk-forward': "Walk forward.fbx",
      'walk-back': "Happy Walk Backward.fbx", 
      'walk-left': "Left Strafe Walk.fbx",
      'walk-right': "Right Strafe Walk.fbx",
      'run-forward': "Run Forward.fbx",
      'run-back': "Standing Run Back.fbx",
      'run-left': "Standing Run Left.fbx",
      'run-right': "Standing Run Right.fbx",
      jump: "Crouch Torch Walk Back.fbx", // Using available animation as placeholder
      attack1: "Elbow Punch.fbx",
      cast: "Mma Kick.fbx",
      damage: "Hit To Body.fbx",
      death: "Standing React Death Backward.fbx",
      falling: "Falling Idle.fbx", // Use available falling animation
      landing: "Falling To Landing.fbx" // Use available landing animation
    },
    timeScale: {
      'walk-forward': 0.9, // Slightly more elegant movement
      'run-forward': 1.0,
      idle: 0.7, // Slower, more regal idle
      falling: 1.0, // Normal falling speed
      landing: 1.1 // Slightly faster landing
    }
  },
  "Grok Rudi": {
    modelPath: "/models/grok-rudi/Red_Panda_Pal_0715205437_texture.fbx", // Test with original model
    basePath: "/models/grok-rudi/", // Use Grok Rudi's own animations
    scale: 0.01, // Much larger scale for visibility (was 0.0156)
    yOffset: 1.2, // Adjusted for ground level positioning
    preview: {
      scale: 0.01, // Much larger scale for visibility (was 0.0156)
      yOffset: 1.2 // Adjusted for ground level positioning
    },
    gameplay: {
       scale: 0.01, // Much larger scale for visibility (was 0.0156)
       yOffset: 1.2, // Adjusted for ground level positioning
       highAltitudeSpawn: SPAWN_ALTITUDE
     },
    movement: {
      walkSpeed: 3.2,
      runSpeed: 6.5
    },
    animationTable: {
      idle: "Fight Idle.fbx", // Grok Rudi's combat idle
      'walk-forward': "Standing Walk Forward.fbx", // Grok Rudi's forward walk
      'walk-back': "Walking Backward.fbx", // Grok Rudi's backward walk
      'walk-left': "Standing Walk Left.fbx", // Grok Rudi's left walk
      'walk-right': "Standing Walk Right.fbx", // Grok Rudi's right walk
      'run-forward': "Fast Run (Sprint).fbx", // Grok Rudi's sprint
      'run-back': "Walking Backward.fbx", // Use backward walk for run back
      'run-left': "Standing Walk Left.fbx", // Use left walk for run left
      'run-right': "Standing Walk Right.fbx", // Use right walk for run right
      jump: "Standing Walk Forward.fbx", // Placeholder until jump animation is added
      attack1: "Punch.fbx", // Grok Rudi's first punch
      cast: "Punch 2.fbx", // Grok Rudi's second punch for cast
      damage: "Falling Back Death.fbx", // Use death animation for damage
      death: "Falling Back Death.fbx", // Grok Rudi's death animation
      falling: "Falling.fbx", // Grok Rudi's falling animation
      landing: "Landing.fbx" // Grok Rudi's landing animation
    },
    timeScale: {
      'walk-forward': 1.0, // Natural walking pace
      'walk-back': 1.0,    // Natural backward pace
      'walk-left': 1.0,    // Natural left strafe
      'walk-right': 1.0,   // Natural right strafe
      'run-forward': 1.1,  // Slightly faster sprint
      'run-back': 1.0,     // Normal pace for run back
      'run-left': 1.0,     // Normal pace for run left
      'run-right': 1.0,    // Normal pace for run right
      idle: 0.8,           // Slower, more menacing combat idle
      attack1: 1.2,        // Quick punches
      cast: 1.1,           // Slightly faster second punch
      falling: 1.0,        // Normal falling speed
      landing: 1.0,        // Normal landing speed
      death: 0.9           // Slightly slower death for dramatic effect
    }
  }
} as const;

// Zombie configuration interface
export interface ZombieConfig {
  modelPath: string;
  scale: number;
  yOffset: number;
}

// Zombie configuration
export const ZOMBIE_CONFIG: ZombieConfig = {
  modelPath: "/models/zombie-2-converted/zombie.glb",
  scale: 1.1,
  yOffset: 0.0 // Adjusted for ground level positioning
};

// Helper functions to get character configuration for specific contexts
export function getCharacterConfig(characterClass: string): CharacterConfig {
  return CHARACTER_CONFIGS[characterClass] || CHARACTER_CONFIGS['Zaqir Mufasa'];
}

// Get configuration specifically for character preview (character selector)
export function getCharacterPreviewConfig(characterClass: string): CharacterPreviewConfig {
  const config = getCharacterConfig(characterClass);
  return config.preview;
}

// Get configuration specifically for gameplay
export function getCharacterGameplayConfig(characterClass: string): CharacterGameplayConfig {
  const config = getCharacterConfig(characterClass);
  return config.gameplay;
}

// Legacy helper functions (updated to use new structure)
export function getAnimationPath(characterClass: string, animationName: string): string {
  const config = getCharacterConfig(characterClass);
  const animationFileName = config.animationTable[animationName as keyof CharacterAnimationTable];
  
  if (!animationFileName) {
    console.warn(`Animation ${animationName} not found for ${characterClass}, using idle`);
    return `${config.basePath}${config.animationTable.idle}`;
  }
  
  return `${config.basePath}${animationFileName}`;
}

export function getAnimationTimeScale(characterClass: string, animationName: string): number {
  const config = getCharacterConfig(characterClass);
  if (config.timeScale && config.timeScale[animationName]) {
    return config.timeScale[animationName];
  }
  return 1.0; // Default time scale
}

// Export available character classes for UI components
export const AVAILABLE_CHARACTERS = Object.keys(CHARACTER_CONFIGS) as Array<keyof typeof CHARACTER_CONFIGS>; 