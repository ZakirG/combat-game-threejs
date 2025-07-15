#!/bin/bash
set -e

# Set up Node.js environment
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

echo "🔧 Setting up Node.js environment..."
nvm use 22

echo "📦 Installing dependencies..."
npm install

echo "🚀 Starting React development server..."
npm run dev
