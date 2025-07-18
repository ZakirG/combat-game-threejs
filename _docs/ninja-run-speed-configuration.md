# Ninja Run Speed Configuration - Technical Guide

## Overview

The ninja run system implements a high-speed movement state that activates after holding `Shift + W` for 1 second. This document provides a comprehensive technical guide for modifying ninja run speeds and ensuring proper propagation across the client-server architecture.

## Architecture Overview

The ninja run speed system operates through a synchronized client-server model:

### Client-Side Prediction
- **Location**: `client/src/characterConfigs.ts`
- **Property**: `movement.sprintRunSpeed`
- **Purpose**: Client-side movement prediction and visual feedback
- **Current Value**: `22.0` (Grok Ani), `24.0` (Zaqir Mufasa), `26.0` (Grok Rudi)

### Server-Side Authority
- **Location**: `server/src/common.rs`
- **Constant**: `NINJA_RUN_MULTIPLIER`
- **Purpose**: Server-authoritative movement calculation
- **Current Value**: `4.0` (4x base player speed)

### Speed Calculation Formula
```
Server Speed = PLAYER_SPEED * NINJA_RUN_MULTIPLIER
Where: PLAYER_SPEED = 7.5 (base movement speed)
Result: 7.5 * 4.0 = 30.0 server units/second
```

### Client-Server Synchronization
The system maintains speed consistency through:
1. **State Synchronization**: Client calls `setNinjaRunStatus()` reducer
2. **Movement Reconciliation**: Server validates and corrects client predictions
3. **Animation Override**: Client displays ninja run animation during high-speed movement

## Files Involved in Speed Modification

### Primary Configuration Files

#### 1. `client/src/characterConfigs.ts`
```typescript
// Character-specific speed configurations
movement: {
  walkSpeed: 2.8,
  runSpeed: 5.5,
  sprintRunSpeed: 22.0 // ← NINJA RUN SPEED (CLIENT)
}
```

#### 2. `server/src/common.rs`
```rust
// Server-side speed multipliers
pub const PLAYER_SPEED: f32 = 7.5;
pub const SPRINT_MULTIPLIER: f32 = 1.8;
pub const NINJA_RUN_MULTIPLIER: f32 = 4.0; // ← NINJA RUN MULTIPLIER (SERVER)
```

### Secondary Implementation Files

#### 3. `server/src/player_logic.rs`
- **Function**: `calculate_new_position()`
- **Logic**: Speed selection based on ninja run state
- **Code Location**: Lines ~44-54

#### 4. `client/src/components/Player.tsx`
- **Function**: `calculateClientMovement()`
- **Logic**: Client-side prediction using `sprintRunSpeed`
- **Code Location**: Lines ~395-410

## Step-by-Step Modification Process

### Phase 1: Update Configuration Values

#### Step 1.1: Modify Client-Side Speed
```bash
# Edit client configuration
vim client/src/characterConfigs.ts
```

**For each character, update the `sprintRunSpeed` value:**
```typescript
// Example: Doubling current speed from 22.0 to 44.0
sprintRunSpeed: 44.0 // New speed value
```

#### Step 1.2: Calculate Corresponding Server Multiplier
```
Required Server Speed = Desired Client Speed
Server Multiplier = Required Server Speed / PLAYER_SPEED
Server Multiplier = 44.0 / 7.5 = 5.87 (rounded to 5.9)
```

#### Step 1.3: Update Server-Side Multiplier
```bash
# Edit server configuration
vim server/src/common.rs
```

```rust
// Update the multiplier to match client speed
pub const NINJA_RUN_MULTIPLIER: f32 = 5.9; // Updated multiplier
```

### Phase 2: Validate Consistency

#### Step 2.1: Verify Speed Relationship
Ensure the following equation holds for each character:
```
client_sprintRunSpeed ≈ PLAYER_SPEED * NINJA_RUN_MULTIPLIER
```

#### Step 2.2: Check All Character Configurations
If modifying the server multiplier affects all characters, update each character's `sprintRunSpeed`:
```typescript
// Grok Ani
sprintRunSpeed: 7.5 * 5.9 = 44.25

// Zaqir Mufasa  
sprintRunSpeed: 7.5 * 5.9 = 44.25

// Grok Rudi
sprintRunSpeed: 7.5 * 5.9 = 44.25
```

### Phase 3: Build and Deploy Changes

#### Step 3.1: Rebuild Server Module
```bash
cd server
spacetime build
```

#### Step 3.2: Regenerate TypeScript Bindings
```bash
# From server directory
spacetime generate --lang typescript --out-dir ../client/src/generated
```

#### Step 3.3: Restart Development Environment
```bash
# From project root
./stop-game.sh
./start-game.sh
```

### Phase 4: Testing and Verification

#### Step 4.1: Client-Side Verification
1. Load game with Grok Ani character
2. Hold `Shift + W` for 1+ seconds
3. Monitor console for ninja run activation:
   ```
   🥷 [Ninja Run] NINJA RUN ACTIVATED! High-speed sprint engaged.
   🥷 [Server Sync] Sent ninja run status to server: true
   ```

#### Step 4.2: Server-Side Verification
1. Check server logs for reducer calls:
   ```
   [DEBUG] Player <identity> ninja run status set to: true
   ```

#### Step 4.3: Speed Validation
Monitor console output during ninja run:
```
🥷 [Ninja Run Speed] Using ninja run speed: 44.0 vs normal run: 5.5
```

#### Step 4.4: Visual Confirmation
1. Observe character movement speed increase
2. Verify ninja run animation plays continuously
3. Confirm smooth movement without position "snapping"

## Technical Considerations

### Performance Impact
- **Client Prediction**: Higher speeds require more frequent position updates
- **Network Traffic**: Increased `updatePlayerInput` calls during high-speed movement
- **Animation Sync**: Ensure animation time scales accommodate speed changes

### Edge Cases to Test
1. **Sprint Key Release**: Ninja run should deactivate within 100ms grace period
2. **Direction Changes**: Speed should only apply during forward movement
3. **Collision Detection**: High speeds should not bypass collision systems
4. **Network Latency**: Test with simulated lag to verify reconciliation

### Debugging Tools

#### Console Debugging
Enable detailed logging by uncommenting debug lines in:
- `client/src/components/Player.tsx` (lines with `🥷` prefix)
- Server logs via SpacetimeDB console

#### Speed Measurement
```typescript
// Add to Player.tsx for precise speed measurement
const startPos = localPositionRef.current.clone();
setTimeout(() => {
  const endPos = localPositionRef.current.clone();
  const distance = startPos.distanceTo(endPos);
  const actualSpeed = distance / 1.0; // Distance per second
  console.log(`Measured speed: ${actualSpeed.toFixed(2)} units/second`);
}, 1000);
```

## Common Issues and Solutions

### Issue 1: Speed Mismatch Between Client and Server
**Symptoms**: Character movement appears jerky or "rubber-band" effect
**Solution**: Verify `sprintRunSpeed` ≈ `PLAYER_SPEED * NINJA_RUN_MULTIPLIER`

### Issue 2: Ninja Run Not Activating
**Symptoms**: Timer reaches 2000ms but no speed increase
**Check**:
1. Animation loading: `🥷 [Animation Loading] Ninja run animation loaded: true`
2. State sync: `🥷 [Server Sync] Sent ninja run status to server: true`
3. Server response: Check SpacetimeDB logs for reducer calls

### Issue 3: Speed Persists After Deactivation
**Symptoms**: Character continues high-speed movement after releasing keys
**Solution**: Verify grace period logic and state cleanup in `useEffect` dependencies

## Advanced Configuration

### Character-Specific Speed Scaling
For different speeds per character while maintaining server consistency:

```typescript
// In characterConfigs.ts
const BASE_NINJA_SPEED = PLAYER_SPEED * NINJA_RUN_MULTIPLIER; // 30.0
const characterMultipliers = {
  "Grok Ani": 1.0,    // 30.0
  "Zaqir Mufasa": 1.2, // 36.0  
  "Grok Rudi": 0.8     // 24.0
};

// Apply in movement config
sprintRunSpeed: BASE_NINJA_SPEED * characterMultipliers[characterClass]
```

### Dynamic Speed Scaling
For runtime speed modifications:

```typescript
// Add to Player component
const [speedMultiplier, setSpeedMultiplier] = useState(1.0);

// In calculateClientMovement
const finalSpeed = characterConfig.movement.sprintRunSpeed * speedMultiplier;
```

## Version Compatibility

### SpacetimeDB Schema Changes
When modifying server-side constants, ensure compatibility:
1. **Development**: Delete and recreate database: `spacetime delete vibe-multiplayer`
2. **Production**: Plan migration strategy for persistent data

### Client Binding Synchronization
Always regenerate bindings after server changes:
```bash
spacetime generate --lang typescript --out-dir ../client/src/generated
```

## Performance Benchmarks

### Recommended Speed Ranges
- **Minimum**: `1.5x` normal run speed (8.25 client units)
- **Maximum**: `6.0x` normal run speed (33.0 client units)
- **Optimal**: `3.0-5.0x` normal run speed (16.5-27.5 client units)

### Testing Load
Verify performance with multiple concurrent ninja runners:
```bash
# Test with 4+ clients simultaneously activating ninja run
# Monitor server CPU and network usage
```

This document provides the complete technical workflow for modifying ninja run speeds. Follow all steps in sequence to ensure proper propagation and system consistency. 