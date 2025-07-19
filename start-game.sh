#!/bin/bash

# Vibe Coding 3D Single Player Game - Auto Start Script
# This script starts the single-player client (SpacetimeDB backend no longer needed)

nvm use 22

set -e

# Get the absolute path of the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$SCRIPT_DIR/server"
CLIENT_DIR="$SCRIPT_DIR/client"

echo "🎮 Starting Vibe Coding 3D Single Player Game..."
echo "📁 Project directory: $SCRIPT_DIR"

# Check if we're in the right directory
if [ ! -d "$SERVER_DIR" ] || [ ! -d "$CLIENT_DIR" ]; then
    echo "❌ Error: server or client directory not found!"
    echo "Please run this script from the vibe-coding-starter-pack-3d-multiplayer directory"
    exit 1
fi

# Stop any existing client processes first to prevent conflicts
echo "🛑 Stopping any existing client processes..."
if [ -f "./stop-game.sh" ]; then
    ./stop-game.sh
    echo "✅ Existing processes stopped"
    # Wait a moment for processes to fully terminate
    sleep 2
else
    echo "⚠️  stop-game.sh not found, checking for running client processes..."
    # Try to kill any existing vite/npm processes manually
    if pgrep -f "vite\|npm.*run.*dev" > /dev/null; then
        echo "🔍 Found running client processes, terminating..."
        pkill -f "vite\|npm.*run.*dev" || true
        sleep 2
        echo "✅ Client processes terminated"
    else
        echo "✅ No existing client processes found"
    fi
fi

# Server no longer needed for single-player mode
# # Create server startup script
# cat > "$SERVER_DIR/start-server.sh" << 'EOF'
# #!/bin/bash
# set -e
# 
# # Set up environment
# source "$HOME/.cargo/env"
# export PATH="/Users/zakirgowani/.local/bin:$PATH"
# 
# echo "🔧 Building SpacetimeDB module..."
# spacetime build
# 
# echo "🔄 Regenerating TypeScript client bindings..."
# spacetime generate --lang typescript --out-dir ../client/src/generated
# if [ $? -eq 0 ]; then
#     echo "✅ TypeScript bindings regenerated successfully"
# else
#     echo "❌ Failed to regenerate TypeScript bindings"
#     exit 1
# fi
# 
# echo "🚀 Starting SpacetimeDB server..."
# spacetime start --listen-addr 0.0.0.0:5555 &
# SERVER_PID=$!
# 
# # Wait for server to start
# echo "⏳ Waiting for server to start..."
# sleep 8
# 
# echo "📦 Publishing module..."
# echo "N" | spacetime publish vibe-multiplayer
# 
# echo "✅ SpacetimeDB server is running!"
# echo "🌐 Server URL: http://127.0.0.1:5555"
# echo "📊 Database: vibe-multiplayer"
# echo ""
# echo "📝 Note: TypeScript client bindings are automatically regenerated on each start"
# echo "Press Ctrl+C to stop the server"
# 
# # Wait for server process
# wait $SERVER_PID
# EOF

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

# Make client script executable (server no longer needed)
# chmod +x "$SERVER_DIR/start-server.sh"
chmod +x "$CLIENT_DIR/start-client.sh"



# Function to open client terminal (server no longer needed)
open_client_terminal() {
    echo "🖥️  Opening client terminal..."
    
    # Create temporary script for client
    cat > /tmp/start-client-temp.sh << EOF
#!/bin/bash
cd "$CLIENT_DIR"
./start-client.sh
EOF
    
    chmod +x /tmp/start-client-temp.sh
    
    # Open client in new terminal window
    echo "🚀 Starting client..."
    if command -v warp-cli > /dev/null 2>&1; then
        # Use Warp CLI if available
        warp-cli open /tmp/start-client-temp.sh
    else
        # Fall back to using open command with Terminal.app
        open -a Terminal /tmp/start-client-temp.sh
    fi
    
    # Clean up temp files after a delay
    (sleep 30 && rm -f /tmp/start-client-temp.sh) &
}

# Function to start client in background (server no longer needed)
start_client_background() {
    echo "🖥️  Starting client in background..."
    
    # Start client only (single-player mode)
    echo "🚀 Starting React client..."
    (cd "$CLIENT_DIR" && ./start-client.sh) &
    CLIENT_PID=$!
    
    echo "✅ Client started!"
    echo "🌐 Client PID: $CLIENT_PID"
    echo "🌐 Game URL: http://localhost:5173"
    echo ""
    echo "To stop process:"
    echo "  ./stop-game.sh"
    echo "  OR"
    echo "  kill $CLIENT_PID"
}

# Try different approaches (client only for single-player)
if [[ "$1" == "--background" ]]; then
    start_client_background
else
    echo "🖥️  Attempting to open client terminal..."
    open_client_terminal
    
    echo ""
    echo "If terminal window didn't open automatically, run this command manually:"
    echo ""
    echo "Client Terminal:"
    echo "cd '$CLIENT_DIR' && ./start-client.sh"
    echo ""
    echo "Alternative: Run with --background flag to start client in background:"
    echo "./start-game.sh --background"
fi

echo ""
echo "🎉 Single-player game setup complete!"
echo "🌐 Once the client is running, open your browser to:"
echo "   http://localhost:5173"
echo ""
echo "📝 Tips:"
echo "   - Client runs on port 5173 (no server needed in single-player mode)"
echo "   - Press Ctrl+C in the terminal to stop the client"
echo "   - Check browser console for any errors" 