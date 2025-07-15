# 🎮 Vibe Coding 3D Multiplayer Game - Quick Start Scripts

This directory contains automated scripts to easily start and stop the 3D multiplayer game.

## 🚀 Starting the Game

### Option 1: Automatic Terminal Windows (Recommended)
```bash
./start-game.sh
```

This will attempt to open two terminal windows automatically.

### Option 2: Background Processes
```bash
./start-game.sh --background
```

This will start both server and client processes in the background.

### What the script does:
- ✅ Automatically opens terminal windows (or runs in background)
- ✅ Starts the SpacetimeDB server
- ✅ Builds and publishes the server module
- ✅ Starts the React client
- ✅ Sets up all necessary environment variables

**The game will be available at: `http://localhost:5173`**

## 🛑 Stopping the Game

To stop all game processes:

```bash
./stop-game.sh
```

This script will:
- ✅ Kill all SpacetimeDB server processes
- ✅ Kill all Vite development server processes
- ✅ Free up ports 3000 and 5173
- ✅ Clean up any remaining processes

## 🔧 Manual Commands (if needed)

If the automated scripts don't work, you can run these commands manually:

### Server (Terminal 1):
```bash
cd server
source "$HOME/.cargo/env"
export PATH="/Users/zakirgowani/.local/bin:$PATH"
spacetime build
spacetime start
# In another terminal after server starts:
echo "N" | spacetime publish vibe-multiplayer
```

### Client (Terminal 2):
```bash
cd client
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 22
npm install
npm run dev
```

## 📝 Notes

- The scripts are designed to work with **Warp terminal**
- Both services need to be running simultaneously for the game to work
- Server runs on port 3000, client on port 5173
- If you encounter issues, check the terminal output for error messages
- You can restart the game by running `./stop-game.sh` followed by `./start-game.sh`

## 🎯 Quick Commands

| Command | Description |
|---------|-------------|
| `./start-game.sh` | Start the entire game (opens terminal windows) |
| `./start-game.sh --background` | Start the entire game (background processes) |
| `./stop-game.sh` | Stop all game processes |
| `./server/start-server.sh` | Start only the server |
| `./client/start-client.sh` | Start only the client | 