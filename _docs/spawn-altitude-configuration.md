# Spawn Altitude Configuration Guide

## Overview

This document provides comprehensive instructions for modifying the spawn altitude in the 3D multiplayer combat game. Spawn altitude determines where characters appear when they join the game and affects various game mechanics including falling sequences, zombie AI, and physics reconciliation.

## Critical Requirements

When changing spawn altitude, **ALL** the following values must be updated to maintain game functionality. Mismatched values will cause:
- Character teleporting/reconciliation conflicts
- Broken zombie AI (zombies won't chase players)
- Incorrect falling sequences
- Physics synchronization issues

## Required Changes (Must Match Exactly)

### 1. Client Spawn Altitude
**File:** `client/src/characterConfigs.ts`
```typescript
export const SPAWN_ALTITUDE = 90.0; // Update this value
```

### 2. Server Spawn Altitude  
**File:** `server/src/common.rs`
```rust
pub const SPAWN_ALTITUDE: f32 = 90.0; // Must match client value
```

### 3. App Position Reference
**File:** `client/src/App.tsx`
```typescript
const playerPositionRef = useRef(new THREE.Vector3(0, 90, 0)); // Update Y value
```

## Threshold Updates (Scale Proportionally)

These thresholds are altitude-dependent and must be scaled when spawn altitude changes:

### 4. Player Physics Thresholds
**File:** `client/src/components/Player.tsx`

**Current values for 90.0 spawn altitude:**
```typescript
// High altitude threshold (~60% of spawn altitude)
if (position.y > 50) {
    // High altitude logic
}

// Medium altitude threshold (~10% of spawn altitude) 
if (position.y > 10) {
    // Medium altitude logic
}

// Ground threshold (always 0.7)
const groundY = 0.7;
```

**Scaling formula:**
- High threshold = `spawn_altitude * 0.6` (rounded)
- Medium threshold = `spawn_altitude * 0.1` (rounded)
- Ground threshold = `0.7` (constant)

**Example for 200.0 spawn altitude:**
```typescript
if (position.y > 120) { // 200 * 0.6
    // High altitude logic
}

if (position.y > 20) { // 200 * 0.1
    // Medium altitude logic
}
```

## Common Spawn Altitude Configurations

### Low Altitude (30.0)
```typescript
// Client & Server
SPAWN_ALTITUDE = 30.0

// App.tsx
new THREE.Vector3(0, 30, 0)

// Player.tsx thresholds
position.y > 18  // High (30 * 0.6)
position.y > 3   // Medium (30 * 0.1)
```

### Standard Altitude (90.0) - Current
```typescript
// Client & Server  
SPAWN_ALTITUDE = 90.0

// App.tsx
new THREE.Vector3(0, 90, 0)

// Player.tsx thresholds
position.y > 50  // High (90 * 0.6)  
position.y > 10  // Medium (90 * 0.1)
```

### High Altitude (200.0)
```typescript
// Client & Server
SPAWN_ALTITUDE = 200.0

// App.tsx
new THREE.Vector3(0, 200, 0)

// Player.tsx thresholds
position.y > 120 // High (200 * 0.6)
position.y > 20  // Medium (200 * 0.1)
```

## Technical Background

### Why These Changes Are Required

1. **Client-Server Sync:** The reconciliation system compares client and server positions. Mismatched spawn altitudes cause constant position conflicts.

2. **Multiplayer Position Broadcasting:** The server needs accurate client positions to sync between players. Using wrong positions breaks multiplayer visibility.

3. **Zombie AI Distance Calculations:** Zombies calculate distance to players using server position. If server thinks player is at wrong altitude, zombies won't chase.

4. **Physics State Management:** Player component uses altitude thresholds to determine physics states (falling, landing, grounded). Wrong thresholds break physics transitions.

### Architecture Notes

- **Client Authority:** Y-axis position is client-authoritative for responsive physics
- **Server Authority:** X/Z coordinates are server-authoritative for anti-cheat
- **Horizontal Distance:** Zombie AI uses 2D distance calculations to avoid altitude issues
- **Position Callback Chain:** Player → GameScene → App → Server for position sync

## Validation Checklist

After changing spawn altitude, verify:

- [ ] Client and server spawn altitudes match exactly
- [ ] Characters spawn at correct height and fall properly
- [ ] No reconciliation conflicts in browser console
- [ ] Zombies chase players correctly
- [ ] Characters land on ground (Y ≈ 0.7) after falling
- [ ] Multiplayer position sync works (test with 2+ players)
- [ ] All altitude thresholds scaled proportionally

## Troubleshooting

### Character Teleporting Back to Old Altitude
- Check client/server spawn altitude mismatch
- Verify App.tsx position reference updated

### Zombies Not Chasing
- Confirm server spawn altitude matches client
- Check zombie AI using horizontal distance calculations

### Character Spawning on Ground Instead of Falling
- Verify App.tsx playerPositionRef initialized to correct spawn altitude
- Check Player.tsx altitude thresholds are correct

### Physics State Issues
- Ensure Player.tsx thresholds scaled proportionally
- Verify falling/landing state transitions work correctly

## Related Files

This configuration affects the following files:
- `client/src/characterConfigs.ts` (spawn altitude constant)
- `server/src/common.rs` (spawn altitude constant)  
- `client/src/App.tsx` (position reference initialization)
- `client/src/components/Player.tsx` (altitude thresholds)
- `client/src/components/ZombieBrain.tsx` (distance calculations)
- `client/src/components/ZombieManager.tsx` (position targeting)

## Version History

- **v1.0:** Initial spawn altitude system with basic falling mechanics
- **v1.1:** Added reconciliation system and multiplayer sync
- **v1.2:** Implemented client Y-authority with server X/Z authority
- **v1.3:** Added proportional threshold scaling and zombie AI fixes 