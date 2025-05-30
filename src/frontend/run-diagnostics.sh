#!/bin/bash
# Run this script to test WebSocket connections after fixes

echo "Starting development server with diagnostic mode enabled..."

# Set diagnostic mode flag if not already set
export VITE_DIAGNOSTIC_MODE=true

# Run the development server
echo "Starting development server..."
cd "$(dirname "$0")"
npm run dev
