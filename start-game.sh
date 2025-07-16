#!/bin/bash

# Vibe Coding 3D Multiplayer Game - Auto Start Script
# This script automatically opens Warp terminal tabs and starts the game

nvm use 22

set -e

# Get the absolute path of the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/server"
CLIENT_DIR="$SCRIPT_DIR/client"

echo "🎮 Starting Vibe Coding 3D Multiplayer Game..."
echo "📁 Project directory: $SCRIPT_DIR"

# Check if we're in the right directory
if [ ! -d "$SERVER_DIR" ] || [ ! -d "$CLIENT_DIR" ]; then
    echo "❌ Error: server or client directory not found!"
    echo "Please run this script from the vibe-coding-starter-pack-3d-multiplayer directory"
    exit 1
fi

# Stop any existing game processes first to prevent conflicts
echo "🛑 Stopping any existing game processes..."
if [ -f "./stop-game.sh" ]; then
    ./stop-game.sh
    echo "✅ Existing processes stopped"
    # Wait a moment for processes to fully terminate
    sleep 2
else
    echo "⚠️  stop-game.sh not found, checking for running SpacetimeDB processes..."
    # Try to kill any existing spacetime processes manually
    if pgrep -f "spacetime" > /dev/null; then
        echo "🔍 Found running SpacetimeDB processes, terminating..."
        pkill -f "spacetime" || true
        sleep 2
        echo "✅ SpacetimeDB processes terminated"
    else
        echo "✅ No existing SpacetimeDB processes found"
    fi
fi

# Create server startup script
cat > "$SERVER_DIR/start-server.sh" << 'EOF'
#!/bin/bash
set -e

# Set up environment
source "$HOME/.cargo/env"
export PATH="/Users/zakirgowani/.local/bin:$PATH"

echo "🔧 Building SpacetimeDB module..."
spacetime build

echo "🔄 Regenerating TypeScript client bindings..."
spacetime generate --lang typescript --out-dir ../client/src/generated
if [ $? -eq 0 ]; then
    echo "✅ TypeScript bindings regenerated successfully"
else
    echo "❌ Failed to regenerate TypeScript bindings"
    exit 1
fi

echo "🚀 Starting SpacetimeDB server..."
spacetime start &
SERVER_PID=$!

# Wait for server to start
echo "⏳ Waiting for server to start..."
sleep 8

echo "📦 Publishing module..."
echo "N" | spacetime publish vibe-multiplayer

echo "✅ SpacetimeDB server is running!"
echo "🌐 Server URL: http://127.0.0.1:3000"
echo "📊 Database: vibe-multiplayer"
echo ""
echo "📝 Note: TypeScript client bindings are automatically regenerated on each start"
echo "Press Ctrl+C to stop the server"

# Wait for server process
wait $SERVER_PID
EOF

# Create client startup script
cat > "$CLIENT_DIR/start-client.sh" << 'EOF'
#!/bin/bash
set -e

# Set up Node.js environment
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

echo "🔧 Setting up Node.js environment..."
echo "Current Node.js version: $(node --version)"

# Force use Node 22 (compatible with Vite)
echo "🔄 Switching to Node.js 22..."
if nvm use 22 2>/dev/null; then
    echo "✅ Successfully switched to Node.js 22: $(node --version)"
elif nvm install 22 && nvm use 22; then
    echo "✅ Installed and switched to Node.js 22: $(node --version)"
else
    echo "❌ Failed to install/switch to Node.js 22"
    echo "   Manual steps:"
    echo "   1. Install nvm: https://github.com/nvm-sh/nvm"
    echo "   2. Run: nvm install 22 && nvm use 22"
    echo "   3. Try starting the client again"
    exit 1
fi

echo "📦 Installing dependencies..."
npm install

echo "🚀 Starting React development server..."
npm run dev
EOF

# Make scripts executable
chmod +x "$SERVER_DIR/start-server.sh"
chmod +x "$CLIENT_DIR/start-client.sh"



# Function to open terminals using open command (more reliable)
open_terminals_with_open() {
    echo "🖥️  Opening terminal sessions..."
    
    # Create temporary scripts for each terminal
    cat > /tmp/start-server-temp.sh << EOF
#!/bin/bash
cd "$SERVER_DIR"
./start-server.sh
EOF
    
    cat > /tmp/start-client-temp.sh << EOF
#!/bin/bash
cd "$CLIENT_DIR"
./start-client.sh
EOF
    
    chmod +x /tmp/start-server-temp.sh /tmp/start-client-temp.sh
    
    # Open server in new terminal window
    echo "🚀 Starting server..."
    if command -v warp-cli > /dev/null 2>&1; then
        # Use Warp CLI if available
        warp-cli open /tmp/start-server-temp.sh
        sleep 2
        warp-cli open /tmp/start-client-temp.sh
    else
        # Fall back to using open command with Terminal.app
        open -a Terminal /tmp/start-server-temp.sh
        sleep 2
        open -a Terminal /tmp/start-client-temp.sh
    fi
    
    # Clean up temp files after a delay
    (sleep 30 && rm -f /tmp/start-server-temp.sh /tmp/start-client-temp.sh) &
}

# Function to start processes in background (alternative approach)
start_processes_background() {
    echo "🖥️  Starting processes in background..."
    
    # Start server in background
    echo "🚀 Starting SpacetimeDB server..."
    (cd "$SERVER_DIR" && ./start-server.sh) &
    SERVER_PID=$!
    
    # Wait for server to start
    sleep 10
    
    # Start client
    echo "🚀 Starting React client..."
    (cd "$CLIENT_DIR" && ./start-client.sh) &
    CLIENT_PID=$!
    
    echo "✅ Processes started!"
    echo "🌐 Server PID: $SERVER_PID"
    echo "🌐 Client PID: $CLIENT_PID"
    echo "🌐 Game URL: http://localhost:5173"
    echo ""
    echo "To stop processes:"
    echo "  ./stop-game.sh"
    echo "  OR"
    echo "  kill $SERVER_PID $CLIENT_PID"
}

# Try different approaches
if [[ "$1" == "--background" ]]; then
    start_processes_background
else
    echo "🖥️  Attempting to open terminal windows..."
    open_terminals_with_open
    
    echo ""
    echo "If terminal windows didn't open automatically, run these commands manually:"
    echo ""
    echo "Terminal 1 (Server):"
    echo "cd '$SERVER_DIR' && ./start-server.sh"
    echo ""
    echo "Terminal 2 (Client):"
    echo "cd '$CLIENT_DIR' && ./start-client.sh"
    echo ""
    echo "Alternative: Run with --background flag to start processes in background:"
    echo "./start-game.sh --background"
fi

echo ""
echo "🎉 Game setup complete!"
echo "🌐 Once both services are running, open your browser to:"
echo "   http://localhost:5173"
echo ""
echo "📝 Tips:"
echo "   - Server runs on port 3000"
echo "   - Client runs on port 5173"
echo "   - TypeScript bindings are automatically regenerated on server start"
echo "   - Press Ctrl+C in each terminal to stop services"
echo "   - Check browser console for any errors" 