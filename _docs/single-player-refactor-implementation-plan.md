# Single Player Refactor Implementation Plan

## Executive Summary

This document outlines a targeted implementation plan to convert the SpacetimeDB-based multiplayer 3D combat game to a single-player client-only application. The primary goal is to make minimal, surgical changes to eliminate all SpacetimeDB backend dependencies while preserving full game functionality.

## Current Architecture Analysis

### SpacetimeDB Integration Points Identified

1. **Connection Management** (`client/src/App.tsx`)
   - `moduleBindings.DbConnection.builder()` - WebSocket connection establishment
   - Connection lifecycle callbacks (`onConnect`, `onDisconnect`)
   - Global connection storage: `let conn: DbConnection | null = null`

2. **Generated Type Dependencies** (`client/src/generated/`)
   - `PlayerData`, `InputState`, `Vector3` types imported from generated bindings
   - `EventContext`, `ErrorContext` types
   - Identity management via `@clockworklabs/spacetimedb-sdk`

3. **Data Synchronization** (`client/src/App.tsx`)
   - Table subscriptions: `conn.db.player` table callbacks
   - Player state management through server table updates
   - Real-time multiplayer state synchronization

4. **Server Reducer Calls**
   - `conn.reducers.registerPlayer()` - Player registration
   - `conn.reducers.updatePlayerInput()` - Movement and input synchronization  
   - `conn.reducers.setNinjaRunStatus()` - Ninja run state sync

5. **Identity System**
   - SpacetimeDB Identity for player identification
   - Identity-based player mapping and recognition

## Implementation Strategy

### Phase 1: Type Replacement and Local State Management

#### 1.1 Create Local Type Definitions
**File: `client/src/types/localTypes.ts`**

Replace SpacetimeDB generated types with local equivalents:

```typescript
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
  xHandle?: string;
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
}

// Mock identity for single player
export const LOCAL_PLAYER_IDENTITY = "local-player-001";
```

#### 1.2 Update Import Statements
**Files to modify:**
- `client/src/App.tsx`
- `client/src/components/Player.tsx`
- `client/src/components/GameScene.tsx`
- `client/src/components/DebugPanel.tsx`

**Changes:**
```typescript
// Replace this:
import { PlayerData, InputState } from '../generated';
import { Identity } from '@clockworklabs/spacetimedb-sdk';

// With this:
import { PlayerData, InputState, LOCAL_PLAYER_IDENTITY } from '../types/localTypes';
```

### Phase 2: Connection Management Replacement

#### 2.1 Remove SpacetimeDB Connection Logic
**File: `client/src/App.tsx`**

**Function: Connection Setup useEffect**
```typescript
// Replace the entire SpacetimeDB connection useEffect with:
useEffect(() => {
  // Simulate immediate "connection" for single player
  setIdentity(LOCAL_PLAYER_IDENTITY);
  setConnected(true);  
  setStatusMessage("Single Player Mode");
  setupInputListeners();
  setupDelegatedListeners();
  setShowJoinDialog(true);

  return () => {
    removeInputListeners();
    removeDelegatedListeners();
  };
}, []);
```

#### 2.2 Remove Connection State Dependencies
**Variables to remove from App.tsx:**
- `let conn: DbConnection | null = null;`
- `(window as any).spacetimeConnection` assignments

### Phase 3: Local Player State Management

#### 3.1 Replace Server-Side Player Management
**File: `client/src/App.tsx`**

**Replace table callbacks with local state management:**
```typescript
// Remove all conn.db.player callback registrations
// Remove registerTableCallbacks function
// Remove subscribeToTables function
// Remove onSubscriptionApplied/onSubscriptionError functions

// Add local player creation function:
const createLocalPlayer = useCallback((username: string, characterClass: string, xHandle?: string) => {
  const newPlayer: PlayerData = {
    identity: LOCAL_PLAYER_IDENTITY,
    username,
    characterClass,
    xHandle,
    position: { x: 0, y: 90, z: 0 }, // High altitude spawn
    rotation: { x: 0, y: 0, z: 0 },
    health: 100,
    maxHealth: 100,
    mana: 100,
    maxMana: 100,
    currentAnimation: "falling",
    isMoving: false,
    isRunning: false,
    isNinjaRunning: false,
    isAttacking: false,
    isCasting: false,
    lastInputSeq: 0,
    input: {
      forward: false, backward: false, left: false, right: false,
      sprint: false, jump: false, attack: false, castSpell: false,
      sequence: 0
    },
    color: "cyan"
  };
  
  // Set single player state
  setLocalPlayer(newPlayer);
  setPlayers(new Map([[LOCAL_PLAYER_IDENTITY, newPlayer]]));
  setStatusMessage(`Playing as ${username}`);
}, []);
```

#### 3.2 Replace handleJoinGame Function
```typescript
const handleJoinGame = (username: string, characterClass: string, xHandle?: string) => {
  setShowJoinDialog(false);
  
  setTimeout(() => {
    setGameReadyState({
      isCharacterReady: false,
      isZombiesReady: false,
      characterProgress: 0,
      zombieProgress: 0,
      characterStatus: 'Starting character load...',
      zombieStatus: 'Preparing to spawn enemies...'
    });
    setGameFullyReady(false);
    setShowLoadingScreen(true);
    
    // Create local player instead of calling server
    createLocalPlayer(username, characterClass, xHandle);
    setHasJoinedGame(true);
  }, 100);
};
```

### Phase 4: Remove Server Reducer Calls

#### 4.1 Replace Input Synchronization
**File: `client/src/App.tsx`**

**Function: sendInput**
```typescript
const sendInput = useCallback((currentInputState: InputState) => {
  // Remove server communication, just update local state
  if (!localPlayer) return;
  
  const currentPosition = {
    x: playerPositionRef.current.x,
    y: playerPositionRef.current.y,
    z: playerPositionRef.current.z
  };
  
  const currentRotation = {
    x: playerRotationRef.current.x,
    y: playerRotationRef.current.y,
    z: playerRotationRef.current.z
  };
  
  const currentAnimation = determineAnimation(currentInputState);
  
  // Update local player state directly
  const updatedPlayer: PlayerData = {
    ...localPlayer,
    position: currentPosition,
    rotation: currentRotation,
    currentAnimation,
    input: currentInputState,
    lastInputSeq: currentInputState.sequence,
    isMoving: currentInputState.forward || currentInputState.backward || 
             currentInputState.left || currentInputState.right,
    isRunning: currentInputState.sprint
  };
  
  setLocalPlayer(updatedPlayer);
  setPlayers(new Map([[LOCAL_PLAYER_IDENTITY, updatedPlayer]]));
}, [localPlayer, determineAnimation]);
```

#### 4.2 Remove Ninja Run Server Sync
**File: `client/src/components/Player.tsx`**

**Remove or replace ninja run server synchronization:**
```typescript
// Replace the server sync useEffect with local state only:
useEffect(() => {
  console.log(`🥷 [Ninja Run State] isNinjaRunActive changed to: ${isNinjaRunActive}`);
  // Remove all server synchronization code
  // Keep only local state management
}, [isNinjaRunActive, isLocalPlayer]);
```

### Phase 5: Identity System Replacement

#### 5.1 Replace Identity Comparisons
**Files: Multiple components**

**Search and replace pattern:**
```typescript
// Replace identity.toHexString() comparisons with direct string comparison
// Old:
if (identity && player.identity.toHexString() === identity.toHexString())

// New:  
if (player.identity === LOCAL_PLAYER_IDENTITY)

// Old:
player.identity.toHexString()

// New:
player.identity
```

#### 5.2 Update Identity State Management
**File: `client/src/App.tsx`**
```typescript
// Change identity state type
const [identity, setIdentity] = useState<string | null>(null);

// Update identity-related callbacks
const handleZombieAttackPlayer = useCallback((targetPlayerId: string) => {
  if (targetPlayerId !== LOCAL_PLAYER_IDENTITY) {
    return;
  }
  // ... rest of function unchanged
}, []); // Remove identity dependency
```

### Phase 6: Update Component Props and Interfaces

#### 6.1 Update DebugPanel Component
**File: `client/src/components/DebugPanel.tsx`**
```typescript
interface DebugPanelProps {
  statusMessage: string;
  localPlayer: PlayerData | null;
  identity: string | null; // Changed from Identity
  playerMap: ReadonlyMap<string, PlayerData>;
  expanded: boolean;
  onToggleExpanded: () => void;
  isPointerLocked: boolean;
}
```

#### 6.2 Update GameScene Component
**File: `client/src/components/GameScene.tsx`**
```typescript
interface GameSceneProps {
  players: ReadonlyMap<string, PlayerData>;
  localPlayerIdentity: string | null; // Changed from Identity
  // ... other props unchanged
}
```

### Phase 7: Game Loop and Physics Adjustments

#### 7.1 Maintain Client-Side Physics
**File: `client/src/components/Player.tsx`**

The existing client-side physics and movement calculation should remain unchanged, as they're already implemented for client-side prediction. The key changes:

```typescript
// Remove server position reconciliation logic
// Keep all local physics calculations
// Remove server-calculated position blending
```

#### 7.2 Update Movement Calculations
Remove server-side movement validation while keeping client-side movement:
```typescript
// Keep existing calculateClientMovement function
// Remove server reconciliation in useFrame
// Use only local position updates
```

### Phase 8: Clean Up and Optimization

#### 8.1 Remove Unused Imports and Dependencies
**Files to clean up:**
- Remove `@clockworklabs/spacetimedb-sdk` imports
- Remove `* as moduleBindings from './generated'` imports
- Clean up connection-related state variables

#### 8.2 Update Game State Management
```typescript
// Simplify game state to single player
// Remove multiplayer-specific state tracking
// Maintain all game mechanics (zombies, combat, etc.)
```

## Testing Strategy

### Validation Checklist

1. **Player Creation and Controls**
   - [ ] Player spawns correctly at high altitude
   - [ ] All movement controls work (WASD, sprint, jump)
   - [ ] Camera controls and rotation work
   - [ ] Animation system functions properly

2. **Game Mechanics**
   - [ ] Zombie spawning and AI behavior
   - [ ] Combat system and attack detection
   - [ ] Sword equipping and weapon switching
   - [ ] Combo system and kill counting
   - [ ] Coin collection and effects

3. **UI Systems**
   - [ ] Debug panel shows correct single-player data
   - [ ] Weapon panel displays correctly
   - [ ] Health/mana bars update properly
   - [ ] Loading screen and character selection

4. **Performance**
   - [ ] No network calls or connection attempts
   - [ ] Smooth 60fps gameplay
   - [ ] Memory usage comparable to current version

## Implementation Priority

### Critical Path (Must Work)
1. Type replacements and local state management
2. Remove SpacetimeDB connection and dependencies
3. Local player creation and management
4. Input handling without server calls

### Secondary (Should Work) 
1. Identity system replacement
2. Component prop updates
3. Debug panel functionality

### Nice to Have (Could Work)
1. Code cleanup and optimization
2. Single-player specific improvements
3. Performance optimizations

## Risk Mitigation

### Potential Issues and Solutions

1. **Type Compatibility**
   - Risk: Generated types might have subtle differences
   - Solution: Comprehensive type definitions with exact property matching

2. **State Management**
   - Risk: Complex state dependencies on server updates
   - Solution: Maintain same state shape with local updates

3. **Animation System**
   - Risk: Animation state might depend on server synchronization
   - Solution: Keep existing client-side animation logic

4. **Physics Integration**
   - Risk: Movement might be tightly coupled to server validation
   - Solution: Use existing client-side prediction logic

## Conclusion

This implementation plan provides a surgical approach to converting the multiplayer game to single-player by:
- Replacing SpacetimeDB types with local equivalents
- Removing network dependencies while preserving game logic
- Maintaining all existing game mechanics and systems
- Making minimal changes to preserve stability

The plan prioritizes targeted changes over wholesale refactoring, ensuring that the core 3D game experience remains intact while eliminating the backend dependency. 