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
  sprintRunSpeed: number; // New: high-speed sprint (activated after 2s of sprint+forward)
}

export const SPAWN_ALTITUDE = 90.0;

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
  'ninja-run'?: string; // Special high-speed sprint animation (activated after 2s of sprint+forward)
  jump: string;
  attack1: string;
  attack2: string; // Combo attack animation
  attack3: string; // Third combo attack animation
  attack4: string; // Fourth combo attack animation
  'cartwheel'?: string; // Special ninja run attack animation
  'ninja-run-attack'?: string; // Ninja run attack using Sprinting Forward Roll
  cast: string;
  damage: string;
  death: string;
  falling: string;
  landing: string;
  powerup?: string; // Optional power-up animation when sword is equipped
}

export interface AnimationTableSet {
  default: CharacterAnimationTable;     // existing/unarmed animations
  sword?: CharacterAnimationTable;      // optional weapon-equipped animations
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
  animationTable: CharacterAnimationTable; // Deprecated - use animations.default
  animations?: AnimationTableSet; // New structure with default and optional sword tables
  timeScale?: Record<string, number>; // Optional per-animation speed overrides for default animations
  swordTimeScale?: Record<string, number>; // Optional per-animation speed overrides for sword animations
}

export const CHARACTER_CONFIGS: Record<string, CharacterConfig> = {
  "Grok Ani": {
    modelPath: "/models/grok-ani/base.fbx",
    basePath: "/models/grok-ani/", // Use Grok Ani's own animations
    scale: 0.018,
    yOffset: 0.0, // Adjusted for ground level positioning
    preview: {
      scale: 0.011,
      yOffset: 0.2
    },
    gameplay: {
       scale: 0.012,
       yOffset: 0.0, // Adjusted for ground level positioning
       highAltitudeSpawn: SPAWN_ALTITUDE
     },
    movement: {
      walkSpeed: 2.8,
      runSpeed: 5.5,
      sprintRunSpeed: 22.0 // Quadruple the run speed for ninja run (4x normal run speed)
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
      'ninja-run': "Ninja Run.fbx", // High-speed sprint animation
      jump: "Crouch Torch Walk Back.fbx", // Using available animation as placeholder
      attack1: "Mma Kick.fbx",
      attack2: "Flip Kick.fbx", // Combo attack animation
      attack3: "Inverted Double Kick To Kip Up.fbx", // Third combo attack animation
      attack4: "Martelo Do Chau.fbx", // Fourth combo attack animation
      'cartwheel': "Cartwheel.fbx", // Special ninja run attack
      cast: "Elbow Punch.fbx",
      damage: "Hit To Body.fbx",
      death: "Standing React Death Backward.fbx",
      falling: "Falling Idle.fbx", // Use available falling animation
      landing: "Falling To Landing.fbx" // Use available landing animation
    },
    animations: {
      default: {
        idle: "Idle.fbx",
        'walk-forward': "Walk forward.fbx",
        'walk-back': "Happy Walk Backward.fbx", 
        'walk-left': "Left Strafe Walk.fbx",
        'walk-right': "Right Strafe Walk.fbx",
        'run-forward': "Run Forward.fbx",
        'run-back': "Standing Run Back.fbx",
        'run-left': "Standing Run Left.fbx",
        'run-right': "Standing Run Right.fbx",
        'ninja-run': "Ninja Run.fbx", // High-speed sprint animation
        jump: "Crouch Torch Walk Back.fbx", // Using available animation as placeholder
        attack1: "Mma Kick.fbx",
        attack2: "Flip Kick.fbx", // Combo attack animation
        attack3: "Inverted Double Kick To Kip Up.fbx", // Third combo attack animation
        attack4: "Martelo Do Chau.fbx", // Fourth combo attack animation
        'cartwheel': "Cartwheel.fbx", // Special ninja run attack
        'ninja-run-attack': "Sprinting Forward Roll.fbx", // Ninja run attack using sprinting forward roll
        cast: "Elbow Punch.fbx",
        damage: "Hit To Body.fbx",
        death: "Standing React Death Backward.fbx",
        falling: "Falling Idle.fbx", // Use available falling animation
        landing: "Falling To Landing.fbx" // Use available landing animation
      },
      sword: {
        idle: "Sword And Shield Idle.fbx",
        'walk-forward': "Great Sword Walk Forward.fbx",
        'walk-back': "Sword Walk Back.fbx",
        'walk-left': "Great Sword Walk Right.fbx", // Using right walk as placeholder for left
        'walk-right': "Great Sword Walk Right.fbx",
        'run-forward': "Great Sword Run Forward.fbx",
        'run-back': "Sword And Shield Run Back.fbx",
        'run-left': "Great Sword Run Left.fbx",
        'run-right': "Great Sword Run Right.fbx",
        'ninja-run': "Ninja Run.fbx", // High-speed sprint animation (same for sword)
        jump: "Sword And Shield Jump.fbx",
        attack1: "Sword And Shield Attack.fbx", // Swapped: now the first attack
        attack2: "Cartwheel.fbx", // Now the second attack
        attack3: "Sword And Shield Attack B.fbx", // Swapped: third combo attack animation
        attack4: "Sword And Shield Slash B.fbx", // Fourth combo attack animation
        'ninja-run-attack': "Sprinting Forward Roll.fbx", // Ninja run attack using sprinting forward roll
        cast: "Great Sword Kick.fbx", // Use kick for casting with sword
        damage: "Hit To Body.fbx", // Keep same damage animation
        death: "Standing React Death Backward.fbx", // Keep same death animation
        falling: "Falling Idle.fbx", // Keep same falling animation
        landing: "Falling To Landing.fbx", // Keep same landing animation
        powerup: "Sword And Shield Power Up.fbx" // Special power-up animation when sword is equipped
      }
    },
    timeScale: {
      'walk-forward': 2.7, // 1.5x faster walking (1.8 * 1.5 = 2.7)
      'run-forward': 1.0,
      'ninja-run': 1.2, // Slightly faster animation for high-speed sprint
      idle: 0.7, // Slower, more regal idle
      jump: 1.3, // Double speed for faster jumping animation
      falling: 1.3, // Normal falling speed
      landing: 0.275, // 4x slower landing (1.1 / 4 = 0.275)
      attack1: 3.0, // 1.5x speed increase (2.0 * 1.5 = 3.0)
      attack2: 3.0, // Same speed as attack1 for combo consistency
      attack3: 2.5, // Slightly slower for dramatic third combo finisher
      attack4: 3.5, // Faster fourth attack for quick finisher
      'cartwheel': 1.5, // Moderate speed for special ninja run attack
      'ninja-run-attack': 2.0, // Double speed for sprinting forward roll attack
      cast: 3.0, // 1.5x speed increase (2.0 * 1.5 = 3.0)
      damage: 2.0 // Double speed for damage animation
    },
    swordTimeScale: {
      'walk-forward': 2.4, // Doubled speed for sword walk forward (1.2 * 2 = 2.4)
      'walk-back': 2.4, // Doubled speed for sword walk back
      'walk-left': 2.4, // Doubled speed for sword walk left
      'walk-right': 2.4, // Doubled speed for sword walk right
      'run-forward': 1.3, // 1.5x speed for sword run forward (1.1 * 1.5 = 1.65)
      'run-left': 1.3, // 1.5x speed for sword run left
      'run-right': 1.5, // 1.5x speed for sword run right
      'run-back': 1.1, // Keep normal speed for run back
      'ninja-run': 1.2, // Same high-speed animation for sword ninja run
      idle: 0.8, // Slower sword idle stance
      jump: 2.0, // Normal sword jump speed
      falling: 1.3, // Normal falling speed
      landing: 0.3, // Slower landing with sword
      attack1: 3.0, // Swapped: Speed for Sword And Shield Slash A.fbx (now first attack)
      attack2: 1.8, // Speed for Sword And Shield Attack.fbx (now second attack)
      attack3: 4.0, // Swapped: Speed for Sword And Shield Attack B.fbx (now third attack)
      attack4: 2.5, // Final sword combo strike
      cast: 2.5, // Sword casting speed
      'ninja-run-attack': 2.0, // Double speed for sprinting forward roll attack
      powerup: 1.2, // Power-up animation speed when sword is equipped
      damage: 2.0 // Double speed for damage animation with sword
    }
  },
  "Zaqir Mufasa": {
    modelPath: "/models/zaqir-2/Idle.fbx",
    basePath: "/models/zaqir-2/",
    scale: 0.016, // 1.3x bigger (0.012 * 1.3)
    yOffset: 2.5, // Increased to prevent feet from going into ground
    preview: {
      scale: 0.010, // 1.3x bigger (0.012 * 1.3)
      yOffset: 0.4 // Adjusted for ground level positioning
    },
    gameplay: {
       scale: 0.016, // 1.3x bigger (0.012 * 1.3)
       yOffset: 1.8, // Increased to prevent feet from going into ground
       highAltitudeSpawn: SPAWN_ALTITUDE
     },
    movement: {
      walkSpeed: 3.0,
      runSpeed: 6.0,
      sprintRunSpeed: 24.0 // Quadruple the run speed for ninja run (4x normal run speed)
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
      attack1: "Roundhouse Kick.fbx", // Changed from Standing Melee Punch
      attack2: "Flip Kick.fbx", // Combo attack (was cast)
      attack3: "Inverted Double Kick To Kip Up.fbx", // Third combo attack animation
      attack4: "Martelo Do Chau.fbx", // Fourth combo attack animation
      cast: "Punching.fbx", // Use different punching animation for cast
      damage: "Receive Hit.fbx",
      death: "death.fbx",
      falling: "Falling.fbx",
      landing: "Landing.fbx"
    },
    animations: {
      default: {
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
        attack1: "Roundhouse Kick.fbx", // Changed from Standing Melee Punch
        attack2: "Flip Kick.fbx", // Combo attack (was cast)
        attack3: "Inverted Double Kick To Kip Up.fbx", // Third combo attack animation
        attack4: "Martelo Do Chau.fbx", // Fourth combo attack animation
        cast: "Punching.fbx", // Use different punching animation for cast
        damage: "Receive Hit.fbx",
        death: "death.fbx",
        falling: "Falling.fbx",
        landing: "Landing.fbx"
      }
      // No sword animations - will fall back to default when sword is equipped
    },
    timeScale: {
      'walk-forward': 1.0, // Normal speed for mutant walk
      'run-forward': 1.1,  // Slightly faster for the fast run animation
      'run-back': 1.0,     // Normal speed for run back
      'run-left': 1.0,     // Normal speed for run left  
      'run-right': 1.0,    // Normal speed for run right
      idle: 0.8, // Slightly slower idle for more dramatic effect
      jump: 1.3, // Double speed for faster jumping animation
      falling: 1.0, // Normal falling speed
      landing: 0.3, // 4x slower landing (1.2 / 4 = 0.3)
      attack1: 3.0, // 1.5x speed increase (2.0 * 1.5 = 3.0)
      attack2: 3.0, // Same speed as attack1 for combo consistency
      attack3: 2.5, // Slightly slower for dramatic third combo finisher
      attack4: 3.5, // Faster fourth attack for quick finisher
      cast: 3.0, // 1.5x speed increase (2.0 * 1.5 = 3.0)
      damage: 2.0 // Double speed for damage animation
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
      runSpeed: 6.5,
      sprintRunSpeed: 26.0 // Quadruple the run speed for ninja run (4x normal run speed)
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
      attack2: "Punch 2.fbx", // Combo attack (was cast)
      attack3: "Mma Kick.fbx", // Third combo attack animation (use kick for Grok Rudi)
      attack4: "Mma Kick.fbx", // Fourth combo attack animation (reuse kick for Grok Rudi)
      cast: "Mma Kick.fbx", // Use kick animation for cast
      damage: "Falling Back Death.fbx", // Use death animation for damage
      death: "Falling Back Death.fbx", // Grok Rudi's death animation
      falling: "Falling.fbx", // Grok Rudi's falling animation
      landing: "Landing.fbx" // Grok Rudi's landing animation
    },
    animations: {
      default: {
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
        attack2: "Punch 2.fbx", // Combo attack (was cast)
        attack3: "Mma Kick.fbx", // Third combo attack animation (use kick for Grok Rudi)
        attack4: "Mma Kick.fbx", // Fourth combo attack animation (reuse kick for Grok Rudi)
        cast: "Mma Kick.fbx", // Use kick animation for cast
        damage: "Falling Back Death.fbx", // Use death animation for damage
        death: "Falling Back Death.fbx", // Grok Rudi's death animation
        falling: "Falling.fbx", // Grok Rudi's falling animation
        landing: "Landing.fbx" // Grok Rudi's landing animation
      }
      // No sword animations - will fall back to default when sword is equipped
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
      attack1: 3.6,        // 1.5x speed increase (2.4 * 1.5 = 3.6)
      attack2: 3.3,        // Same speed as previous cast for combo consistency
      attack3: 2.8,        // Slightly slower for dramatic third combo finisher
      attack4: 3.8,        // Faster fourth attack for quick finisher
      cast: 3.0,           // New cast animation speed
      jump: 1.3,           // Double speed for faster jumping animation
      falling: 1.0,        // Normal falling speed
      landing: 0.25,       // 4x slower landing (1.0 / 4 = 0.25)
      damage: 2.0,         // Double speed for damage animation
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
  scale: 1.2, // Increased from 1.1 to 1.6 for larger, more imposing zombies
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

// Helper functions with sword support
export function getAnimationPath(characterClass: string, animationName: string, isSwordEquipped: boolean = false): string {
  const config = getCharacterConfig(characterClass);
  
  // Choose the appropriate animation table
  let animationTable: CharacterAnimationTable;
  if (isSwordEquipped && config.animations?.sword) {
    animationTable = config.animations.sword;
  } else if (config.animations?.default) {
    animationTable = config.animations.default;
  } else {
    // Fallback to legacy animationTable
    animationTable = config.animationTable;
  }
  
  const animationFileName = animationTable[animationName as keyof CharacterAnimationTable];
  
  if (!animationFileName) {
    console.warn(`Animation ${animationName} not found for ${characterClass} (sword: ${isSwordEquipped}), using idle`);
    // Try to get idle from the same table first, then fallback
    const idleFileName = animationTable.idle || config.animationTable.idle;
    return `${config.basePath}${idleFileName}`;
  }
  
  return `${config.basePath}${animationFileName}`;
}

export function getAnimationTimeScale(characterClass: string, animationName: string, isSwordEquipped: boolean = false): number {
  const config = getCharacterConfig(characterClass);
  
  // Choose the appropriate time scale settings
  let timeScaleConfig: Record<string, number> | undefined;
  if (isSwordEquipped && config.swordTimeScale) {
    timeScaleConfig = config.swordTimeScale;
  } else {
    timeScaleConfig = config.timeScale;
  }
  
  if (timeScaleConfig && timeScaleConfig[animationName]) {
    return timeScaleConfig[animationName];
  }
  
  return 1.0; // Default time scale
}

// Helper function to get the current animation table for a character
export function getCurrentAnimationTable(characterClass: string, isSwordEquipped: boolean = false): CharacterAnimationTable {
  const config = getCharacterConfig(characterClass);
  
  if (isSwordEquipped && config.animations?.sword) {
    return config.animations.sword;
  } else if (config.animations?.default) {
    return config.animations.default;
  } else {
    // Fallback to legacy animationTable
    return config.animationTable;
  }
}

// Legacy helper functions (for backwards compatibility)
export function getAnimationPathLegacy(characterClass: string, animationName: string): string {
  return getAnimationPath(characterClass, animationName, false);
}

export function getAnimationTimeScaleLegacy(characterClass: string, animationName: string): number {
  return getAnimationTimeScale(characterClass, animationName, false);
}

// Export available character classes for UI components in desired order
export const AVAILABLE_CHARACTERS: Array<keyof typeof CHARACTER_CONFIGS> = [
  "Grok Ani"
  // "Zaqir Mufasa",
  // "Grok Rudi"
]; 