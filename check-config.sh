#!/bin/bash

# NeuroGrid API Configuration Test Script

echo "🔍 NeuroGrid API Configuration Checker"
echo "======================================"

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found!"
    echo "📋 Creating .env from template..."
    cp .env.example .env
    echo "✅ .env file created. Please edit it with your API keys."
    echo ""
    echo "📝 Required API Keys:"
    echo "   - GITHUB_COPILOT_API_KEY or GITHUB_TOKEN"
    echo "   - ANTHROPIC_API_KEY (optional)"  
    echo "   - OPENAI_API_KEY (optional)"
    echo ""
    echo "📖 See API_KEYS_SETUP.md for detailed instructions"
    exit 1
fi

echo "✅ .env file found"

# Source the .env file
source .env

# Check GitHub API keys
echo ""
echo "🐙 GitHub API Configuration:"
if [ -n "$GITHUB_COPILOT_API_KEY" ]; then
    echo "   ✅ GITHUB_COPILOT_API_KEY: Set (${#GITHUB_COPILOT_API_KEY} chars)"
elif [ -n "$GITHUB_TOKEN" ]; then
    echo "   ✅ GITHUB_TOKEN: Set (${#GITHUB_TOKEN} chars)"
    
    # Test GitHub API if token is provided
    if command -v curl &> /dev/null; then
        echo "   🔬 Testing GitHub API..."
        HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
            -H "Authorization: token $GITHUB_TOKEN" \
            https://api.github.com/user)
        
        if [ "$HTTP_STATUS" = "200" ]; then
            echo "   ✅ GitHub API: Working"
        else
            echo "   ❌ GitHub API: Failed (HTTP $HTTP_STATUS)"
            echo "      Check your token permissions and validity"
        fi
    fi
else
    echo "   ❌ No GitHub API key found"
    echo "      Set GITHUB_COPILOT_API_KEY or GITHUB_TOKEN"
fi

# Check Anthropic API key
echo ""
echo "🤖 Anthropic API Configuration:"
if [ -n "$ANTHROPIC_API_KEY" ]; then
    echo "   ✅ ANTHROPIC_API_KEY: Set (${#ANTHROPIC_API_KEY} chars)"
else
    echo "   ⚠️  ANTHROPIC_API_KEY: Not set (optional)"
fi

# Check OpenAI API key  
echo ""
echo "🧠 OpenAI API Configuration:"
if [ -n "$OPENAI_API_KEY" ]; then
    echo "   ✅ OPENAI_API_KEY: Set (${#OPENAI_API_KEY} chars)"
else
    echo "   ⚠️  OPENAI_API_KEY: Not set (optional)"
fi

# Check basic server configuration
echo ""
echo "⚙️  Server Configuration:"
echo "   📍 NODE_ENV: ${NODE_ENV:-development}"
echo "   🌐 DOMAIN: ${DOMAIN:-localhost}"
echo "   🔌 PORT: ${PORT:-8080}"

# Count available APIs
API_COUNT=0
if [ -n "$GITHUB_COPILOT_API_KEY" ] || [ -n "$GITHUB_TOKEN" ]; then
    ((API_COUNT++))
fi
if [ -n "$ANTHROPIC_API_KEY" ]; then
    ((API_COUNT++))
fi
if [ -n "$OPENAI_API_KEY" ]; then
    ((API_COUNT++))
fi

echo ""
echo "📊 Summary:"
echo "   🔑 Available APIs: $API_COUNT"

if [ "$API_COUNT" -eq 0 ]; then
    echo "   ❌ No API keys configured!"
    echo "   📖 See API_KEYS_SETUP.md for setup instructions"
    exit 1
elif [ "$API_COUNT" -eq 1 ]; then
    echo "   ⚠️  Only 1 API configured (no fallback)"
    echo "   💡 Consider adding more APIs for redundancy"
else
    echo "   ✅ Multiple APIs configured (good redundancy)"
fi

echo ""
echo "🚀 Ready to start server!"
echo "   🏃 Run: npm start"
echo "   🌐 Then visit: http://${DOMAIN:-localhost}:${PORT:-8080}"

# Test if server is already running
if command -v curl &> /dev/null; then
    echo ""
    echo "🔬 Testing if server is running..."
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://${DOMAIN:-localhost}:${PORT:-8080}/health" 2>/dev/null)
    
    if [ "$HTTP_STATUS" = "200" ]; then
        echo "   ✅ Server is already running!"
        echo "   📊 Check APIs: curl http://${DOMAIN:-localhost}:${PORT:-8080}/api/models/available"
    else
        echo "   📴 Server not running (HTTP $HTTP_STATUS)"
    fi
fi