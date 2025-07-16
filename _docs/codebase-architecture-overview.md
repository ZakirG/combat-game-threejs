# X-Combat Codebase Architecture Overview

## Project Summary

X-Combat is a real-time 3D multiplayer combat arena game built with a client-server architecture using SpacetimeDB as the multiplayer backend. The game features intense PvP combat, intelligent AI enemies, multiple character classes, and sophisticated 3D rendering.

**Core Technologies:**
- **Server**: Rust + SpacetimeDB (compiled to WebAssembly)
- **Client**: React 19 + TypeScript + Vite + React Three Fiber + Three.js
- **Real-time Communication**: SpacetimeDB WebSocket subscriptions
- **3D Assets**: FBX models with animation systems

---

## Architecture Overview

### High-Level Structure

```
combat-game-threejs/
├── server/          # Rust SpacetimeDB module
├── client/          # React Three Fiber frontend
├── _docs/           # Technical documentation
├── setup.sh         # Project initialization
├── start-game.sh    # Dual-process launcher
└── stop-game.sh     # Clean shutdown script
```

### Network Architecture

The game implements a **server-authoritative** multiplayer model:

1. **Client** sends input commands to server
2. **Server** validates input, updates game state, broadcasts changes
3. **Clients** receive state updates via real-time subscriptions
4. **Client-side prediction** provides responsive controls

---

## Server Architecture (`server/`)

### Core Components

| File | Purpose | Key Responsibilities |
|------|---------|---------------------|
| `lib.rs` | Main module | Database schema, reducers, lifecycle management |
| `player_logic.rs` | Game logic | Movement calculations, state updates |
| `common.rs` | Shared types | Data structures, constants, game configuration |

### Database Schema

#### PlayerData Table
```rust
#[spacetimedb::table(name = player, public)]
pub struct PlayerData {
    identity: Identity,           // Primary key
    username: String,            // Display name
    character_class: String,     // Character type
    x_handle: Option<String>,    // Social integration
    position: Vector3,           // World coordinates
    rotation: Vector3,           // Orientation
    health: i32,                 // Current health
    max_health: i32,            // Maximum health
    mana: i32,                  // Current mana
    max_mana: i32,              // Maximum mana
    current_animation: String,   // Animation state
    is_moving: bool,            // Movement flags
    is_running: bool,
    is_attacking: bool,
    is_casting: bool,
    last_input_seq: u32,        // Input validation
    input: InputState,          // Current input state
    color: String,              // Player customization
}
```

#### LoggedOutPlayerData Table
- Persistent storage for disconnected players
- Enables reconnection with preserved state
- Maintains position, stats, and character data

#### GameTickSchedule Table
- Manages periodic server updates
- Scheduled reducer execution
- Server-side simulation timing

### Reducer System

| Reducer | Trigger | Function |
|---------|---------|----------|
| `init` | Module startup | Initialize game tick scheduling |
| `identity_connected` | Player connects | Setup player session |
| `identity_disconnected` | Player leaves | Cleanup and persistence |
| `register_player` | Character creation | Add player to game world |
| `update_player_input` | Input received | Process movement and actions |
| `game_tick` | Scheduled | Periodic game state updates |

### Key Features

- **Input Validation**: Sequence numbers prevent duplicate processing
- **Server Authority**: All game state changes validated server-side
- **Lifecycle Management**: Robust connection handling
- **Real-time Updates**: Immediate state broadcasting to all clients

---

## Client Architecture (`client/`)

### Component Hierarchy

```
App.tsx (Root orchestrator)
├── Connection Management
├── Input Processing
├── Game Loop
└── UI Components
    ├── JoinGameDialog.tsx (Character selection)
    ├── LoadingScreen.tsx (Asset loading)
    ├── GameScene.tsx (3D world)
    │   ├── Player.tsx (Character entities)
    │   ├── ZombieManager.tsx (AI system)
    │   └── ControlsPanel.tsx (Camera controls)
    ├── PlayerUI.tsx (HUD overlay)
    └── DebugPanel.tsx (Developer tools)
```

### Core Systems

#### 1. Multiplayer Communication (`App.tsx`)

**Connection Management:**
```typescript
// SpacetimeDB connection setup
const conn = moduleBindings.DbConnection.builder()
  .withModuleName("vibe-multiplayer")
  .withAddress("ws://localhost:3000")
  .onConnect(onConnect)
  .onDisconnect(onDisconnect)
  .build();

// Table subscriptions
conn.subscriptionBuilder()
  .subscribe("SELECT * FROM player")
  .onApplied(callback)
  .build();
```

**Input Processing:**
- Keyboard/mouse event handling
- Input state normalization
- Sequence number tracking
- Animation state determination

**Game Loop:**
- RequestAnimationFrame cycle
- Input sending at appropriate intervals
- State synchronization
- Camera/rotation management

#### 2. 3D Rendering System (`GameScene.tsx`)

**Environment Setup:**
- Three.js scene configuration
- Lighting systems (directional, ambient, environment)
- Terrain and environment assets
- Physics integration

**Entity Management:**
- Player entity instantiation
- AI enemy coordination
- Asset loading and optimization

#### 3. Character System (`Player.tsx`)

**Features:**
- Multi-class character support
- FBX model loading with animations
- Physics-based movement
- Local vs. remote player handling
- Animation state synchronization

**Character Classes:**
- Grok Ani (Balanced fighter)
- Grok Rudi (Powerful brawler)
- Paladin (Tank/defender)
- Wizard (Spellcaster)
- Zaqir variants (Custom fighters)

#### 4. AI System (`ZombieManager.tsx` + `ZombieBrain.tsx`)

**Zombie AI State Machine:**
```
Idle → Hunt → Scream → Attack → Chase
  ↑                              ↓
  ←─────── Return to spawn ──────┘
```

**Performance Optimizations:**
- Shared model instances
- Animation clip reuse
- Efficient spawning algorithms
- Proximity-based activation

**Behaviors:**
- Player detection and tracking
- Smart pathfinding
- Combat mechanics
- Knockback physics

---

## Configuration Systems

### Character Configuration (`characterConfigs.ts`)

**Structure:**
```typescript
interface CharacterConfig {
  modelPath: string;
  scale: number;
  animations: CharacterAnimationTable;
  movement: CharacterMovementConfig;
  preview: CharacterPreviewConfig;
}
```

**Animation Mapping:**
- Standardized animation names
- Character-specific file paths
- Time scale adjustments
- Animation transitions

### Game Constants (`common.rs`)

**Movement Settings:**
```rust
pub const PLAYER_SPEED: f32 = 7.5;
pub const SPRINT_MULTIPLIER: f32 = 1.8;
pub const SPAWN_ALTITUDE: f32 = 90.0;
```

---

## Development Workflow

### Build Process

1. **Server Development:**
   ```bash
   cd server
   spacetime build           # Compile Rust to WASM
   spacetime start           # Start local database
   spacetime publish vibe-multiplayer  # Deploy module
   ```

2. **Client Development:**
   ```bash
   cd client
   spacetime generate --lang typescript --out-dir ../client/src/generated
   npm run dev              # Start Vite dev server
   ```

### Asset Pipeline

**3D Model Workflow:**
1. FBX source files in `public/models/`
2. Optional GLB conversion via `convert-fbx-to-glb.sh`
3. Dynamic loading in components
4. Animation clip extraction and management

**Performance Considerations:**
- Model instancing for repeated entities
- Texture optimization
- Animation sharing
- Progressive loading

---

## Key Design Patterns

### 1. Server-Authoritative Design
- All game state changes validated on server
- Client-side prediction for responsiveness
- Input validation with sequence numbers
- Rollback and reconciliation systems

### 2. Component-Based Architecture
- React components for UI and 3D entities
- Single responsibility principle
- Prop-based communication
- Context for shared state

### 3. Type-Safe Communication
- Generated TypeScript bindings
- SpacetimeDB schema enforcement
- Compile-time error prevention
- Automatic serialization/deserialization

### 4. Performance Optimization
- Object pooling for frequently created entities
- Shared resources for similar objects
- Efficient update cycles
- Memory management best practices

---

## Extension Points

### Adding New Character Classes

1. **Add model assets** to `public/models/[character-name]/`
2. **Configure character** in `characterConfigs.ts`:
   ```typescript
   'new-character': {
     modelPath: '/models/new-character/base.fbx',
     scale: 1.0,
     animations: { /* animation mapping */ },
     movement: { walkSpeed: 5.0, runSpeed: 8.0 }
   }
   ```
3. **No code changes required** - system automatically handles new characters

### Adding New Game Mechanics

1. **Server-side:** Add new fields to database tables
2. **Logic:** Implement in `player_logic.rs` or new modules
3. **Client-side:** Update UI components and input handling
4. **Regenerate** TypeScript bindings

### Adding New AI Behaviors

1. **Extend** `ZombieBrain.tsx` decision logic
2. **Add** new animation states
3. **Configure** behavior parameters
4. **Test** performance impact

---

## Performance Considerations

### Network Optimization
- Efficient state delta transmission
- Input compression and validation
- Connection management and reconnection
- Bandwidth usage monitoring

### Rendering Optimization
- Model instancing and reuse
- Animation clip sharing
- Level-of-detail systems
- Frustum culling

### Memory Management
- Asset cleanup and garbage collection
- Object pooling for temporary entities
- Texture memory management
- Animation memory optimization

---

## Security Features

### Server-Side Validation
- All input commands validated
- Movement bounds checking
- Action cooldown enforcement
- Cheat prevention mechanisms

### Authentication
- SpacetimeDB identity system
- Session management
- Connection state tracking
- Graceful disconnection handling

---

## Testing & Debugging

### Development Tools
- **Debug Panel**: Real-time state inspection
- **Console Logging**: Comprehensive error tracking
- **Performance Monitoring**: Frame rate and network metrics
- **Asset Loading**: Progress tracking and error handling

### Testing Strategies
- Multi-client testing for multiplayer features
- AI behavior validation
- Performance profiling
- Network latency simulation

---

## Future Expansion Possibilities

### Gameplay Features
- Additional combat mechanics (blocking, combos)
- Power-ups and collectibles
- Multiple game modes (team battles, objectives)
- Player progression and unlockables

### Technical Enhancements
- Mobile client support
- VR integration
- Advanced physics systems
- Procedural content generation

### Social Features
- Guilds and teams
- Leaderboards and rankings
- Social media integration
- Spectator modes

---

This architecture provides a solid foundation for a scalable, performant multiplayer game with clear separation of concerns, type safety, and extensible design patterns. 