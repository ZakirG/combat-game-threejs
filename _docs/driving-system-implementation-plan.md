# Driving System Implementation Plan

## Overview

This document outlines the implementation plan for adding a full driving system to the game. The system will allow players to enter and control a Cybertruck vehicle with physics-based movement, automatic collision attacks against zombies, and seamless transitions between walking and driving modes.

## Feature Requirements

1. **Vehicle Entry/Exit**: Players can press 'K' to enter/exit the Cybertruck when nearby
2. **Driving Physics**: Acceleration, deceleration, momentum-based sliding movement
3. **Visual Changes**: 
   - Player character becomes invisible while driving
   - Player character plays "Driving.fbx" animation while in vehicle
   - Camera zooms out during driving mode
4. **Combat Integration**: Automatic "run-over" attacks on zombies within striking distance
5. **State Preservation**: All existing character functionality preserved when exiting vehicle

## Architecture Analysis

### Current System Components

**Server (`server/src/`)**:
- `PlayerData` table: Stores player state (position, rotation, animation, etc.)
- `update_player_input` reducer: Processes player movement and state updates
- `calculate_new_position` function: Handles movement calculations with sprint/ninja run logic
- Game tick system: Periodic updates for game state

**Client (`client/src/`)**:
- `App.tsx`: Main component handling SpacetimeDB connection, input management, and game loop
- `Player.tsx`: Renders 3D character model, handles animations, physics, and client-side prediction
- `GameScene.tsx`: Manages 3D scene, environment, and object rendering
- Input system: Keyboard/mouse events converted to `InputState` and sent to server

## Implementation Plan

### Phase 1: Server-Side Foundation

#### 1.1 Database Schema Changes (`server/src/lib.rs`)

**Modify `PlayerData` Table**:
```rust
#[spacetimedb::table(name = player, public)]
#[derive(Clone)]
pub struct PlayerData {
    // ... existing fields ...
    is_driving: bool,                    // NEW: Track if player is in driving mode
    vehicle_velocity: Vector3,           // NEW: Store vehicle momentum for physics
    // ... rest of existing fields ...
}
```

**Add `CybertruckData` Table**:
```rust
#[spacetimedb::table(name = cybertruck, public)]
#[derive(Clone)]
pub struct CybertruckData {
    #[primary_key]
    id: u32,                            // Single truck with ID = 1
    position: Vector3,                  // Truck position in world
    rotation: Vector3,                  // Truck rotation
    is_occupied: bool,                  // Track if someone is driving
    driver_identity: Option<Identity>,   // Who is driving (if anyone)
}
```

#### 1.2 New Reducers (`server/src/lib.rs`)

**Toggle Driving Mode Reducer**:
```rust
#[spacetimedb::reducer]
pub fn toggle_driving_mode(ctx: &ReducerContext) {
    // Check distance between player and cybertruck
    // Toggle is_driving state if close enough
    // Sync player position with cybertruck when entering
    // Update cybertruck occupation status
}
```

#### 1.3 Movement Logic Updates (`server/src/player_logic.rs`)

**New Vehicle Physics Function**:
```rust
pub fn calculate_vehicle_movement(
    position: &Vector3, 
    rotation: &Vector3, 
    velocity: &Vector3,
    input: &InputState, 
    delta_time: f32
) -> (Vector3, Vector3, Vector3) {
    // Returns: (new_position, new_rotation, new_velocity)
    // Implement acceleration/deceleration physics
    // Add momentum and sliding behavior
    // Handle steering based on input
}
```

**Modified Input Processing**:
```rust
pub fn update_input_state(player: &mut PlayerData, input: InputState, client_pos: Vector3, client_rot: Vector3, client_animation: String) {
    if player.is_driving {
        // Use vehicle movement logic
        let (new_pos, new_rot, new_velocity) = calculate_vehicle_movement(
            &player.position, &player.rotation, &player.vehicle_velocity, &input, delta_time
        );
        player.position = new_pos;
        player.rotation = new_rot;
        player.vehicle_velocity = new_velocity;
        
        // Update cybertruck position to match
        update_cybertruck_position(ctx, new_pos, new_rot);
    } else {
        // Use existing player movement logic
        // ... existing code ...
    }
}
```

#### 1.4 Combat Integration (`server/src/lib.rs`)

**Auto-Attack in Game Tick**:
```rust
#[spacetimedb::reducer(update)]
pub fn game_tick(ctx: &ReducerContext, _tick_info: GameTickSchedule) {
    // ... existing logic ...
    
    // Check for vehicle collision attacks
    check_vehicle_zombie_collisions(ctx);
}

fn check_vehicle_zombie_collisions(ctx: &ReducerContext) {
    // For each driving player:
    //   - Check distance to all zombies
    //   - If within "run-over" range, apply damage
    //   - Trigger same effects as melee combat
}
```

### Phase 2: Client-Side Integration

#### 2.1 Cybertruck Rendering (`client/src/components/`)

**New Cybertruck Component**:
```typescript
// components/Cybertruck.tsx
export const Cybertruck: React.FC<{
  cybertruckData: CybertruckData;
  isLocalPlayerDriving: boolean;
}> = ({ cybertruckData, isLocalPlayerDriving }) => {
  // Load cybertruck.glb model
  // Position based on cybertruckData
  // Handle visibility and interaction states
};
```

#### 2.2 Player Component Updates (`client/src/components/Player.tsx`)

**Driving State Handling**:
```typescript
// Add to Player component
const isDriving = playerData.is_driving;

// In useFrame hook:
if (isDriving) {
  // Hide player model
  group.current.visible = false;
  
  // Play driving animation (even though invisible)
  if (animations['driving'] && !isPlayingPowerUp) {
    playAnimation('driving');
  }
  
  // Adjust camera zoom for local player
  if (isLocalPlayer) {
    targetZoom.current = 8; // Zoomed out for driving
  }
  
  // Use vehicle physics for movement prediction
  if (isLocalPlayer && currentInput) {
    const newPos = calculateVehicleMovement(localPositionRef.current, localRotationRef.current, currentInput, delta);
    localPositionRef.current.copy(newPos);
  }
} else {
  // Normal player behavior
  group.current.visible = true;
  // ... existing logic ...
}
```

**New Vehicle Movement Function**:
```typescript
const calculateVehicleMovement = useCallback((currentPos: THREE.Vector3, currentRot: THREE.Euler, inputState: InputState, delta: number): THREE.Vector3 => {
  // Implement client-side vehicle physics matching server logic
  // Include acceleration, momentum, and sliding mechanics
  // Handle steering and rotation
}, []);
```

#### 2.3 Input Handling Updates (`client/src/App.tsx`)

**Add K Key Handler**:
```typescript
// In handleSpecialKeyDown function:
else if (event.code === 'KeyK') {
  event.preventDefault();
  console.log('🚗 Toggle driving mode');
  if (conn && connected) {
    conn.reducers.toggleDrivingMode();
  }
}
```

#### 2.4 Scene Updates (`client/src/components/GameScene.tsx`)

**Cybertruck Integration**:
```typescript
// Add cybertruck state management
const [cybertruckData, setCybertruckData] = useState<CybertruckData | null>(null);

// Subscribe to cybertruck table
useEffect(() => {
  if (!conn) return;
  
  conn.db.cybertruck.onInsert((ctx, truck) => setCybertruckData(truck));
  conn.db.cybertruck.onUpdate((ctx, oldTruck, newTruck) => setCybertruckData(newTruck));
}, [conn]);

// Render cybertruck in scene
{cybertruckData && (
  <Cybertruck 
    cybertruckData={cybertruckData}
    isLocalPlayerDriving={localPlayer?.is_driving || false}
  />
)}
```

### Phase 3: Physics and Animation Details

#### 3.1 Vehicle Physics Parameters

**Movement Constants**:
```typescript
const VEHICLE_PHYSICS = {
  ACCELERATION: 25.0,           // How quickly vehicle speeds up
  DECELERATION: 15.0,           // How quickly vehicle slows down when no input
  MAX_SPEED: 40.0,              // Maximum vehicle speed
  TURN_SPEED: 2.0,              // How quickly vehicle turns
  MOMENTUM_RETENTION: 0.95,     // How much velocity is retained each frame
  SLIDE_FRICTION: 0.85,         // Friction for sliding physics
};
```

#### 3.2 Animation System Integration

**Driving Animation Loading**:
- Load `Driving.fbx` animation alongside other character animations
- Ensure smooth transitions between driving and other animations
- Handle animation state when entering/exiting vehicle

#### 3.3 Camera System Updates

**Driving Camera Behavior**:
- Increase zoom distance from default 5 to 8 units
- Maintain same following behavior but at greater distance
- Smooth transitions when entering/exiting driving mode

### Phase 4: Combat Integration

#### 4.1 Run-Over Mechanics

**Distance Calculation**:
- Define larger striking distance for vehicle vs. melee combat
- Vehicle striking distance: 3.0 units (vs. 2.0 for melee)
- Check collision using vehicle bounding box rather than point distance

**Damage Application**:
- Reuse existing zombie damage and knockback systems
- Apply same coin drop mechanics
- Trigger same visual effects (blood, screen shake)
- Count as combo hits for scoring system

### Phase 5: State Synchronization

#### 5.1 Network Optimization

**State Updates**:
- Cybertruck position/rotation updated via existing player update system
- Driving state synchronized through player data updates
- Minimal additional network overhead

#### 5.2 Collision Detection

**Environment Collision**:
- Use existing environment collision system
- Adjust collision radius for vehicle size
- Implement sliding along walls for vehicle physics

## Testing Strategy

### 5.1 Single Player Testing
1. Vehicle entry/exit mechanics
2. Driving physics feel and responsiveness
3. Camera behavior during transitions
4. Animation state preservation
5. Combat system integration

### 5.2 Multiplayer Testing
1. Multiple players interacting with single vehicle
2. Vehicle state synchronization across clients
3. Combat interactions while one player drives
4. Network performance with additional state data

## Risk Mitigation

### 5.1 Backward Compatibility
- All existing functionality preserved through conditional logic
- New database fields have safe defaults
- Graceful degradation if vehicle model fails to load

### 5.2 Performance Considerations
- Vehicle physics calculations optimized for 60fps
- Minimal impact on existing movement systems
- Efficient collision detection for run-over mechanics

### 5.3 Edge Cases
- Handle player disconnection while driving
- Prevent multiple players from entering same vehicle
- Ensure vehicle doesn't get stuck in environment geometry
- Handle animation conflicts during state transitions

## Stuff We Learned on Our First Attempt at Implementing This

#### 1. Server Module Publishing Requirements
**Problem**: Reducers not available on server despite being defined in code.
**Root Cause**: Server module needs to be rebuilt and republished after any reducer changes.
**Solution (VERIFIED)**:
```bash
# In server/ directory
spacetime build
spacetime publish vibe-multiplayer -s http://127.0.0.1:5555
```
**Key Learning**: Client was calling `conn.reducers.toggleDrivingMode()` successfully, but server had no `toggle_driving_mode` reducer because module wasn't republished.

#### 2. Cybertruck Position Coordinate Mismatch  
**Problem**: Distance calculation failed because driving logic used wrong vehicle coordinates.
**Root Cause**: Actual Cybertruck spawn position is `[-1, -1.0, -140]` (defined in `CYBERTRUCK_SPAWN_POSITION`), but driving logic assumed `[50, 0, 50]`.
**Solution (VERIFIED)**: 
```typescript
// Use actual cybertruck coordinates from EnvironmentAssets.tsx
const vehiclePosition = new THREE.Vector3(-1, 0, -140);
```
**Key Learning**: Always reference the actual model spawn coordinates, not arbitrary coordinates.

#### 3. SpacetimeDB React State Management Issues
**Problem**: React state shows `connected: false`, `identity: undefined`, `localPlayer: null` even when connection works.
**Root Cause**: SpacetimeDB React integration has broken state synchronization - the connection object exists but React state gets reset/nullified.
**Solution (VERIFIED)**:
```typescript
// Bypass broken React state by extracting from connection object directly
let workingIdentity = identity;
if (!workingIdentity && conn) {
  const connIdentity = (conn as any).identity || (conn as any)._identity;
  if (connIdentity) {
    workingIdentity = connIdentity;
  }
}

if (conn && workingIdentity) {
  conn.reducers.toggleDrivingMode(); // This works
}
```
**Key Learning**: SpacetimeDB React state is unreliable - use connection object directly when React state fails.

#### 4. Client-Side Approach Success
**Problem**: Server-side state management complexity with broken React integration.
**Solution (VERIFIED)**: Client-side only driving state management bypasses all SpacetimeDB state issues.
**Implementation**:
```typescript
// Client-side driving state (no server complexity)
const [isDriving, setIsDriving] = useState(false);
const [vehiclePosition, setVehiclePosition] = useState(() => new THREE.Vector3(-1, 0, -140));

// Distance check works with correct coordinates
const distance = Math.sqrt(
  Math.pow(playerPos.x - vehiclePosition.x, 2) + 
  Math.pow(playerPos.z - vehiclePosition.z, 2)
);

if (distance < 10) {
  setIsDriving(!isDriving); // Simple client-side toggle
}
```
**Key Learning**: For rapid prototyping, client-side state management is more reliable than complex server synchronization.

### Implementation Strategy Adjustments

Based on verified learnings:

1. **Always rebuild and republish server module** after any reducer changes
2. **Use actual coordinate references** from existing spawn position constants  
3. **Extract identity from connection object** when React state fails
4. **Consider client-side approaches** for UI state that doesn't need server validation
5. **Test reducer calls in isolation** before implementing complex state synchronization

# More Learnings from our First Attempt at Implementing the Driving Feature

# GLTF Loading & Subscription Bug Fixes

## Bug 1: GLTF Loader Constructor Error

**Error**: `window.GLTFLoader is not a constructor`

**Root Cause**: Attempted to instantiate GLTFLoader from global window object which doesn't exist in browser context.

**Problematic Code**:
```typescript
const gltfLoader = new (window as any).GLTFLoader();
gltfLoader.load('/models/items/cybertruck.glb', callback);
```

**Fix**: Use React Three Fiber's `useGLTF` hook from `@react-three/drei`:
```typescript
const gltf = useGLTF('/models/items/cybertruck.glb');
useEffect(() => {
  if (gltf?.scene) {
    // Process loaded model
  }
}, [gltf]);
```

**Key Learning**: In React Three Fiber, use hooks from `@react-three/drei` for asset loading, not direct Three.js loaders.

## Bug 2: Subscription Unsubscribe TypeError

**Error**: `this.db.unsubscribe is not a function`

**Root Cause**: SpacetimeDB subscription object structure inconsistent, cleanup functions called without type checking.

**Problematic Code**:
```typescript
return () => {
  subscription.unsubscribe();
  unsubscribeInsert();
};
```

**Fix**: Add defensive type checking:
```typescript
return () => {
  if (subscription && typeof subscription.unsubscribe === 'function') {
    subscription.unsubscribe();
  }
  if (unsubscribeInsert && typeof unsubscribeInsert === 'function') {
    unsubscribeInsert();
  }
};
```

**Key Learning**: Always validate function existence before calling cleanup methods in SpacetimeDB subscriptions.

## Additional Fix: Model Fallback

Added geometric primitive fallback to ensure driving system functionality regardless of model loading:
```typescript
<mesh castShadow receiveShadow>
  <boxGeometry args={[6, 3, 12]} />
  <meshStandardMaterial color={isOccupied ? "#ff4444" : "#888888"} />
</mesh>
```

**Pattern**: Always provide functional fallbacks for 3D assets to prevent feature blocking. 


## Implementation Order

1. **Server Foundation**: Database changes, basic reducers
2. **Client Infrastructure**: Cybertruck component, basic rendering
3. **Physics Integration**: Vehicle movement on both server and client
4. **Animation System**: Driving animation integration
5. **Combat System**: Run-over mechanics and damage application
6. **Polish & Testing**: Camera transitions, edge cases, optimization

