#!/bin/bash

echo "🧪 Testing NeuroGrid API endpoints..."

# Start API server in background
cd /Users/a123/neurogrid/coordinator-server
PORT=3001 node src/app-simple.js &
SERVER_PID=$!

# Wait for server to start
echo "⏳ Waiting for server to start..."
sleep 3

# Test endpoints
echo "📋 Testing health endpoint..."
curl -s http://localhost:3001/health | python3 -m json.tool || echo "❌ Health check failed"

echo -e "\n📊 Testing API info endpoint..."
curl -s http://localhost:3001/api/info | python3 -m json.tool || echo "❌ API info failed"

echo -e "\n💰 Testing wallet balance..."
curl -s http://localhost:3001/api/tokens/balance | python3 -m json.tool || echo "❌ Wallet balance failed"

echo -e "\n🏗️ Testing task submission..."
curl -s -X POST http://localhost:3001/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello, test task"}' | python3 -m json.tool || echo "❌ Task submission failed"

echo -e "\n📈 Testing nodes list..."
curl -s http://localhost:3001/api/nodes | python3 -m json.tool || echo "❌ Nodes list failed"

# Stop server
echo -e "\n🛑 Stopping server..."
kill $SERVER_PID
wait $SERVER_PID 2>/dev/null

echo "✅ API testing complete!"