#!/bin/bash

# Get absolute path to the script's directory
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "🎓 Starting StudyAI..."

# Check for .env in backend
if [ ! -f "$SCRIPT_DIR/backend/.env" ]; then
  echo "❌ Missing backend/.env file."
  echo "Run: cp backend/.env.example backend/.env and fill in your keys"
  exit 1
fi

# Kill anything on ports 3001 and 5173
echo "🔍 Clearing ports..."
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true
sleep 1

# Install backend dependencies
echo "📦 Installing backend dependencies..."
cd "$SCRIPT_DIR/backend"
npm install

# Install frontend dependencies
echo "📦 Installing frontend dependencies..."
cd "$SCRIPT_DIR/frontend"
npm install

# Start backend in background
echo "🚀 Starting backend on http://localhost:3001..."
cd "$SCRIPT_DIR/backend"
node src/index.js &
BACKEND_PID=$!

# Start frontend (opens browser automatically)
echo "🌐 Starting frontend on http://localhost:5173..."
cd "$SCRIPT_DIR/frontend"
npm run dev -- --open

# Cleanup on exit
kill $BACKEND_PID 2>/dev/null
