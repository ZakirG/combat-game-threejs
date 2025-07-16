# X-Combat
## 3D Multiplayer Combat Arena

Experience intense 3D multiplayer combat in a fully-realized arena where strategy meets action. Choose your fighter, battle intelligent AI enemies, and compete against players worldwide in real-time combat.

---

## 🎮 Game Features

### ⚔️ **Combat System**
- **Real-time PvP Combat**: Engage in fast-paced multiplayer battles
- **Attack & Spell System**: Left-click to attack, right-click to cast spells
- **Physics-Based Combat**: Advanced collision detection and movement physics
- **Dramatic High-Altitude Spawns**: Enter the arena with cinematic falling sequences

### 👥 **Character Classes**
Choose from unique fighters, each with distinct abilities and fighting styles:

- **Grok Ani**: Balanced fighter with elegant combat techniques and spell casting
- **Grok Rudi**: Powerful brawler with devastating punches and combat prowess
and more!

Each character features:
- Unique animation sets and combat moves
- Character-specific movement speeds and abilities  
- Custom visual effects and fighting styles
- Personalized X handle integration

### 🧟 **Advanced AI Enemies**
Battle intelligent zombie enemies with sophisticated behaviors:
- **State-based AI**: Idle → Hunt → Scream → Attack → Chase sequences
- **Dynamic Pathfinding**: Smart enemy movement and player tracking
- **Adaptive Combat**: Enemies that respond to player actions and positioning
- **Performance-Optimized**: Efficient enemy management for smooth gameplay

### 🎥 **Dynamic Camera System**
- **Follow Camera**: Traditional third-person view with mouse look controls
- **Orbital Camera**: Cinematic camera that orbits around your character
- **Seamless Switching**: Toggle between camera modes with 'C' key
- **Smooth Transitions**: Fluid camera movement with zoom controls

### 🌐 **Multiplayer Technology**
- **Real-time Synchronization**: Powered by SpacetimeDB for instant updates
- **Server Authority**: Cheat-resistant gameplay with server-side validation
- **Client Prediction**: Responsive controls with lag compensation
- **Seamless Join/Leave**: Drop in and out of battles effortlessly

---

## 🛠️ **Tech Stack**

### **Frontend**
- **React 18** - Modern UI framework with hooks and context
- **TypeScript** - Type-safe development with full IDE support
- **Three.js + React Three Fiber** - High-performance 3D rendering
- **Vite** - Lightning-fast development and building

### **Backend**
- **SpacetimeDB** - Real-time multiplayer database with Rust modules
- **Rust** - High-performance server-side logic and state management
- **WebAssembly** - Optimized cross-platform execution

### **3D Assets & Animation**
- **FBX Model Pipeline** - Complex character models with detailed animations
- **Animation Blending** - Smooth transitions between movement states
- **Physics Integration** - Gravity, collision, and movement systems
- **LOD Optimization** - Performance-optimized asset loading

### **Real-time Features**
- **WebSocket Communication** - Ultra-low latency multiplayer
- **State Synchronization** - Automatic client-server data sync
- **Input Prediction** - Responsive controls despite network latency

---

## 🎯 **Controls**

| Input | Action |
|-------|--------|
| **W, A, S, D** | Move your character |
| **Shift** | Sprint (increased movement speed) |
| **Space** | Jump |
| **Mouse** | Look around / Camera control |
| **Left Click** | Attack |
| **Right Click** | Cast Spell |
| **C** | Toggle Camera Mode (Follow ↔ Orbital) |
| **Mouse Wheel** | Zoom in/out |

---

## 🚀 **Quick Start**

### **Prerequisites**
- Node.js 18+ and npm
- Rust and Cargo  
- SpacetimeDB CLI

### **One-Command Setup**
```bash
git clone <repository-url>
cd combat-game-threejs
chmod +x setup.sh && ./setup.sh
```

### **Start Playing**
```bash
# Start the game (opens two terminals)
./start-game.sh

# Game will be available at http://localhost:5173
```

### **Stop Game**
```bash
./stop-game.sh
```

---

## 🏗️ **Development**

### **Manual Setup**
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
rustup target add wasm32-unknown-unknown

# Install SpacetimeDB
curl -sSf https://install.spacetimedb.com | sh
export PATH="$HOME/.local/bin:$PATH"

# Install dependencies
cd client && npm install
cd ../server && spacetime build
spacetime generate --lang typescript --out-dir ../client/src/generated
```

### **Development Mode**
```bash
# Terminal 1: Server
cd server
spacetime build && spacetime start
spacetime publish vibe-multiplayer

# Terminal 2: Client  
cd client
npm run dev
```

### **After Schema Changes**
```bash
cd server
spacetime generate --lang typescript --out-dir ../client/src/generated
```

---

## 🎨 **Customization**

### **Adding Characters**
1. Add 3D models to `/public/models/your-character/`
2. Configure in `client/src/characterConfigs.ts`
3. Set animations, scaling, and movement properties
4. Test with the character preview system

### **Combat Mechanics**
- Modify attack patterns in `server/src/player_logic.rs`
- Adjust damage and health in `server/src/common.rs`
- Customize spell effects in the client components

### **AI Behavior**
- Edit zombie AI in `client/src/components/ZombieBrain.tsx`
- Adjust spawn patterns in `client/src/components/ZombieManager.tsx`
- Modify enemy stats in `client/src/characterConfigs.ts`

### **Visual Effects**
- Environment settings in `client/src/components/GameScene.tsx`
- Lighting and shadows throughout the scene components
- Post-processing effects via Three.js

---

## 🏛️ **Architecture**

### **Client Architecture**
```
client/src/
├── components/           # React components
│   ├── Player.tsx       # Character rendering & physics
│   ├── GameScene.tsx    # 3D world environment  
│   ├── ZombieManager.tsx # AI enemy system
│   └── JoinGameDialog.tsx # Character selection
├── generated/           # Auto-generated SpacetimeDB types
├── characterConfigs.ts  # Character definitions
└── App.tsx             # Main game orchestration
```

### **Server Architecture**
```
server/src/
├── lib.rs              # Database schema & reducers
├── player_logic.rs     # Movement & combat logic
└── common.rs           # Shared data structures
```

### **Key Systems**
- **Player State Management**: Server-authoritative with client prediction
- **Real-time Sync**: SpacetimeDB handles all networking automatically
- **Animation Pipeline**: Complex FBX loading with retargeting support
- **AI Management**: Optimized multi-entity AI with state machines

---

## 🎖️ **Game Modes**

- **Free-for-All**: Battle against other players and AI enemies
- **Survival**: Last player standing wins
- **Team Combat**: Coordinate with allies against enemy forces
- **Training Mode**: Practice against AI to hone your skills

---

## 🔧 **Performance**

- **Optimized Rendering**: Efficient 3D asset streaming
- **Smart AI Loading**: Sequential zombie spawning prevents frame drops
- **Network Efficiency**: Minimal bandwidth with delta compression
- **Scalable Architecture**: Handles multiple concurrent players

---

## 📝 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🤝 **Contributing**

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 🎮 **Join the Battle**

Ready to enter the arena? Clone the repository and start your combat journey today!

```bash
git clone <repository-url>
cd combat-game-threejs
./start-game.sh
```

**Game URL**: http://localhost:5173

---

*Built with cutting-edge web technologies for maximum performance and scalability.* 
