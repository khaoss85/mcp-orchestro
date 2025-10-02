#!/bin/bash

# MCP Coder Expert Server
# This script starts the MCP server for Claude Code integration

cd "$(dirname "$0")"

# Build if needed
if [ ! -d "dist" ]; then
  echo "Building MCP server..."
  npm run build
fi

# Start the MCP server
node dist/server.js
