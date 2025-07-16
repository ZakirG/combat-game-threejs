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
