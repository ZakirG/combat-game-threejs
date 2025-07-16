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
