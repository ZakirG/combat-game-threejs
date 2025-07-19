#!/bin/bash

# Vibe Coding 3D Single Player Game - Stop Script
# This script stops all running client processes (no server in single-player mode)

echo "🛑 Stopping Vibe Coding 3D Single Player Game..."

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

# SpacetimeDB server no longer needed for single-player mode
# kill_process "spacetime.*start"
# kill_process "spacetimedb-standalone"

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
    
    # Port 5555 no longer used (was SpacetimeDB server)
    # local port_5555_pids=$(lsof -ti :5555 || true)
    # if [ -n "$port_5555_pids" ]; then
    #     echo "🔥 Killing processes on port 5555: $port_5555_pids"
    #     echo "$port_5555_pids" | xargs kill -TERM 2>/dev/null || true
    # fi
fi

echo "✅ Client processes stopped!"
echo "🧹 You can now restart the single-player game using ./start-game.sh" 