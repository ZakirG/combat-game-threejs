# Screenshake Settings Configuration

This document explains how to configure the global screenshake settings in the 3D multiplayer combat game.

## Overview

The screenshake system provides visual feedback for combat hits and landing impacts. You can easily control different types of screenshake effects using global toggles in `client/src/utils/screenshake.ts`.

## Global Settings

All screenshake settings are located at the top of `client/src/utils/screenshake.ts`:

```typescript
export const SCREENSHAKE_SETTINGS = {
  ENABLED: true,           // Master toggle for all screenshake effects
  HIT_SCREENSHAKE: true,   // Toggle for combat hit screenshakes  
  LANDING_SCREENSHAKE: true // Toggle for landing impact screenshakes
};
```

## Setting Descriptions

### `ENABLED` (Master Toggle)
- **Purpose**: Controls ALL screenshake effects globally
- **Default**: `true`
- **Effect**: When set to `false`, disables every screenshake effect regardless of other settings
- **Use Case**: Complete disable of all screen effects for accessibility or performance

### `HIT_SCREENSHAKE` 
- **Purpose**: Controls screenshake triggered by combat attacks
- **Default**: `true`
- **Effect**: When set to `false`, disables screenshake when players hit zombies
- **Use Case**: Keep landing effects but remove combat feedback

### `LANDING_SCREENSHAKE`
- **Purpose**: Controls screenshake triggered by high-altitude landings
- **Default**: `true`
- **Effect**: When set to `false`, disables screenshake when players land from falling
- **Use Case**: Keep combat effects but remove landing impact

## How to Configure

### Disable All Screenshake
```typescript
export const SCREENSHAKE_SETTINGS = {
  ENABLED: false,           // This alone disables everything
  HIT_SCREENSHAKE: true,    // These don't matter when ENABLED is false
  LANDING_SCREENSHAKE: true
};
```

### Disable Only Combat Screenshake
```typescript
export const SCREENSHAKE_SETTINGS = {
  ENABLED: true,
  HIT_SCREENSHAKE: false,   // No screenshake on zombie hits
  LANDING_SCREENSHAKE: true // Keep landing screenshake
};
```

### Disable Only Landing Screenshake
```typescript
export const SCREENSHAKE_SETTINGS = {
  ENABLED: true,
  HIT_SCREENSHAKE: true,    // Keep combat screenshake
  LANDING_SCREENSHAKE: false // No screenshake on landing
};
```

### Enable Only Combat Screenshake
```typescript
export const SCREENSHAKE_SETTINGS = {
  ENABLED: true,
  HIT_SCREENSHAKE: true,    // Keep combat screenshake
  LANDING_SCREENSHAKE: false // Disable landing screenshake
};
```

## Technical Implementation

The system uses three helper functions:

1. **`triggerScreenshake()`** - Base function that checks `ENABLED` setting
2. **`triggerHitScreenshake()`** - Checks `HIT_SCREENSHAKE` then calls base function
3. **`triggerLandingScreenshake()`** - Checks `LANDING_SCREENSHAKE` then calls base function

## Usage in Code

Components use the specific helper functions:

```typescript
// For combat hits (Player.tsx)
triggerHitScreenshake(camera, SCREENSHAKE_PRESETS.LIGHT);

// For landing impacts (Player.tsx)  
triggerLandingScreenshake(camera, SCREENSHAKE_PRESETS.HEAVY);
```

## Performance Notes

- Disabling screenshake completely (`ENABLED: false`) provides best performance
- Individual toggles have minimal performance impact
- Settings are checked before any screenshake calculations begin
- No memory allocation occurs when effects are disabled

## Accessibility Considerations

- Players sensitive to screen motion can disable all effects with `ENABLED: false`
- Selective disabling allows customization for different comfort levels
- Settings can be easily exposed to UI configuration if needed

## Testing Your Changes

After modifying settings:

1. Save the `screenshake.ts` file
2. Reload the client browser tab
3. Test combat attacks against zombies
4. Test landing from high altitude (spawn altitude)
5. Verify only desired effects are active 