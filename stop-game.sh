#!/bin/bash

# Vibe Coding 3D Multiplayer Game - Stop Script
# This script stops all running game processes

echo "🛑 Stopping Vibe Coding 3D Multiplayer Game..."

# Function to kill processes by name
kill_process() {
    local process_name=$1
    local pids=$(pgrep -f "$process_name" || true)
    
    if [ -n "$pids" ]; then
        echo "🔥 Killing $process_name processes: $pids"
        echo "$pids" | xargs kill -TERM 2>/dev/null || true
        sleep 2
        # Force kill if still running
        local remaining_pids=$(pgrep -f "$process_name" || true)
        if [ -n "$remaining_pids" ]; then
            echo "🔥 Force killing remaining $process_name processes: $remaining_pids"
            echo "$remaining_pids" | xargs kill -KILL 2>/dev/null || true
        fi
    else
        echo "✅ No $process_name processes found"
    fi
}

# Kill SpacetimeDB server processes
kill_process "spacetime.*start"
kill_process "spacetimedb-standalone"

# Kill Vite development server
kill_process "vite"

# Kill any npm dev processes
kill_process "npm.*run.*dev"

# Kill any node processes running on port 5173
if command -v lsof > /dev/null 2>&1; then
    local port_5173_pids=$(lsof -ti :5173 || true)
    if [ -n "$port_5173_pids" ]; then
        echo "🔥 Killing processes on port 5173: $port_5173_pids"
        echo "$port_5173_pids" | xargs kill -TERM 2>/dev/null || true
    fi
    
    # Kill any processes on port 3000 (SpacetimeDB)
    local port_3000_pids=$(lsof -ti :3000 || true)
    if [ -n "$port_3000_pids" ]; then
        echo "🔥 Killing processes on port 3000: $port_3000_pids"
        echo "$port_3000_pids" | xargs kill -TERM 2>/dev/null || true
    fi
fi

echo "✅ Game processes stopped!"
echo "🧹 You can now restart the game using ./start-game.sh" 