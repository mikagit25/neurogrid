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

# Check Google Gemini API key
echo ""
echo "🌟 Google Gemini API Configuration:"
if [ -n "$GOOGLE_API_KEY" ]; then
    echo "   ✅ GOOGLE_API_KEY: Set (${#GOOGLE_API_KEY} chars)"
    echo "   💰 Cost: $0.0005/1k tokens (CHEAPEST!)"
else
    echo "   ⚠️  GOOGLE_API_KEY: Not set"
    echo "      Get free key at https://makersuite.google.com/app/apikey"
fi

# Check OpenAI API key  
echo ""
echo "🧠 OpenAI API Configuration:"
if [ -n "$OPENAI_API_KEY" ]; then
    echo "   ✅ OPENAI_API_KEY: Set (${#OPENAI_API_KEY} chars)"
    echo "   💰 Cost: $0.03/1k tokens (GPT-4), $0.002/1k tokens (GPT-3.5)"
else
    echo "   ⚠️  OPENAI_API_KEY: Not set"
fi

# Check Anthropic API key
echo ""
echo "🤖 Anthropic API Configuration:"
if [ -n "$ANTHROPIC_API_KEY" ]; then
    echo "   ✅ ANTHROPIC_API_KEY: Set (${#ANTHROPIC_API_KEY} chars)"
    echo "   💰 Cost: $0.015/1k tokens (Best for analysis)"
else
    echo "   ⚠️  ANTHROPIC_API_KEY: Not set"
fi

# Check HuggingFace API key
echo ""
echo "🤗 HuggingFace API Configuration:"
if [ -n "$HUGGINGFACE_API_KEY" ]; then
    echo "   ✅ HUGGINGFACE_API_KEY: Set (${#HUGGINGFACE_API_KEY} chars)"
    echo "   💰 Cost: $0.001/1k tokens (Open source models)"
else
    echo "   ⚠️  HUGGINGFACE_API_KEY: Not set"
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
if [ -n "$GOOGLE_API_KEY" ]; then
    ((API_COUNT++))
fi
if [ -n "$OPENAI_API_KEY" ]; then
    ((API_COUNT++))
fi
if [ -n "$ANTHROPIC_API_KEY" ]; then
    ((API_COUNT++))
fi
if [ -n "$HUGGINGFACE_API_KEY" ]; then
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