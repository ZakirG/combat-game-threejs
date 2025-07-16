# Blood Effects Toggle

This document explains how to enable or disable the blood spurt effects in the combat game.

## Overview

The blood spurt effects are particle-based visual effects that trigger when zombies are successfully hit by player attacks. The system includes:

- Particle explosions with red and brown colors
- Physics simulation with gravity
- Fade-out animation over time
- Sound effects (blood-spurt-sound-short.mp3)

## Global Toggle Control

### Location
The blood effects toggle is located in:
```
client/src/utils/bloodEffect.ts
```

### Toggle Variable
```typescript
// GLOBAL TOGGLE - Set to false to disable all blood effects
export const BLOOD_EFFECTS_ENABLED = false;
```

## How to Enable/Disable Blood Effects

### To ENABLE Blood Effects:
1. Open `client/src/utils/bloodEffect.ts`
2. Change the toggle value:
   ```typescript
   export const BLOOD_EFFECTS_ENABLED = true;
   ```
3. Save the file
4. The changes will take effect immediately (hot reload)

### To DISABLE Blood Effects:
1. Open `client/src/utils/bloodEffect.ts`
2. Change the toggle value:
   ```typescript
   export const BLOOD_EFFECTS_ENABLED = false;
   ```
3. Save the file
4. The changes will take effect immediately (hot reload)

## What Happens When Disabled

When `BLOOD_EFFECTS_ENABLED = false`:

- ✅ **Blood sound effects still play** (controlled separately in `audioUtils.ts`)
- ❌ **No blood particle effects are created**
- ❌ **No particle systems are added to the scene**
- ❌ **No performance impact from blood particles**
- ✅ **Console logging indicates effects are disabled**
- ✅ **All other combat systems work normally**

## Technical Details

### Performance Impact
- **Enabled**: Creates 120 particles per zombie hit (40% red, 35% dark red, 25% brown)
- **Disabled**: Zero performance impact, early return before any particle creation

### Integration Points
The blood effects are triggered from:
- `client/src/components/Player.tsx` - When zombie hits are detected
- Uses `BloodEffectManager` class for particle management
- Automatic cleanup after 2 seconds

### Related Systems
- **Audio**: Blood spurt sound (controlled separately in `audioUtils.ts`)
- **Combat**: Zombie hit detection and knockback
- **Particles**: Three.js Points system with custom materials

## Current Status
**Blood effects are currently DISABLED** (`BLOOD_EFFECTS_ENABLED = false`)

## Quick Reference
```typescript
// File: client/src/utils/bloodEffect.ts
// Line: ~13

// To enable:
export const BLOOD_EFFECTS_ENABLED = true;

// To disable:
export const BLOOD_EFFECTS_ENABLED = false;
``` 