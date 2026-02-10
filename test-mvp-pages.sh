#!/bin/bash

echo "🧪 Testing NeuroGrid MVP Pages..."
echo "=================================="

# Start enhanced server in background
echo "🚀 Starting enhanced server..."
cd /Users/a123/neurogrid
node enhanced-server.js &
SERVER_PID=$!

# Wait for server to start
echo "⏳ Waiting for server to start..."
sleep 5

# List of MVP pages to test
declare -a PAGES=(
    "ai-chat.html:AI Chat Interface"
    "dashboard.html:Main Dashboard"  
    "marketplace.html:Marketplace Interface"
    "node-setup.html:Node Setup Guide"
    "wallet.html:Wallet Management"
    "profile.html:User Profile"
    "notifications.html:Notifications Center"
)

echo "📋 Testing MVP pages availability..."
echo ""

FAILED_COUNT=0
TOTAL_COUNT=${#PAGES[@]}

for page_info in "${PAGES[@]}"; do
    IFS=':' read -r page_name page_description <<< "$page_info"
    
    echo "🔍 Testing $page_description ($page_name)..."
    
    # Test if page returns 200 OK
    status_code=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/$page_name)
    
    if [ "$status_code" = "200" ]; then
        echo "   ✅ OK (200) - Page accessible"
    else
        echo "   ❌ FAILED ($status_code) - Page not accessible"
        ((FAILED_COUNT++))
    fi
    echo ""
done

echo "🛑 Stopping server..."
kill $SERVER_PID 2>/dev/null
wait $SERVER_PID 2>/dev/null

echo "=================================="
echo "📊 Test Results Summary:"
echo "   Total pages tested: $TOTAL_COUNT"
echo "   Successful: $((TOTAL_COUNT - FAILED_COUNT))"
echo "   Failed: $FAILED_COUNT"

if [ $FAILED_COUNT -eq 0 ]; then
    echo "   🎉 ALL MVP PAGES ARE WORKING!"
    exit 0
else
    echo "   ⚠️  Some pages have issues"
    exit 1
fi