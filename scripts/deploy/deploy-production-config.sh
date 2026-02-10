#!/bin/bash

# NeuroGrid Production Deployment Script
# Configures environment variables for neurogrid.network domain

echo "🚀 Setting up NeuroGrid for Production Deployment"
echo "🌍 Domain: neurogrid.network"

# Set environment variables
export NODE_ENV=production
export DOMAIN=neurogrid.network
export PORT=8080
export CORS_ORIGINS="https://neurogrid.network,https://www.neurogrid.network"

# Create production environment file
cat > .env.production << EOF
# NeuroGrid Production Configuration
NODE_ENV=production
DOMAIN=neurogrid.network
PORT=8080

# CORS Configuration
CORS_ORIGINS=https://neurogrid.network,https://www.neurogrid.network

# API Configuration
API_BASE_URL=https://neurogrid.network/api
WS_BASE_URL=wss://neurogrid.network/ws

# Security
ENABLE_HTTPS=true
ENABLE_SSL_REDIRECT=true

# Analytics & Monitoring
ENABLE_ANALYTICS=true
ENABLE_DEBUG=false

# External API Keys (configure with your actual keys)
# OPENAI_API_KEY=your_openai_key_here
# ANTHROPIC_API_KEY=your_anthropic_key_here
EOF

echo "✅ Environment file created: .env.production"

# Create staging environment file
cat > .env.staging << EOF
# NeuroGrid Staging Configuration
NODE_ENV=staging
DOMAIN=staging.neurogrid.network
PORT=8080

# CORS Configuration
CORS_ORIGINS=https://staging.neurogrid.network,http://localhost:3000

# API Configuration
API_BASE_URL=https://staging.neurogrid.network/api
WS_BASE_URL=wss://staging.neurogrid.network/ws

# Security
ENABLE_HTTPS=true
ENABLE_SSL_REDIRECT=false

# Analytics & Monitoring
ENABLE_ANALYTICS=false
ENABLE_DEBUG=true

# External API Keys (test keys)
# OPENAI_API_KEY=your_test_openai_key_here
# ANTHROPIC_API_KEY=your_test_anthropic_key_here
EOF

echo "✅ Environment file created: .env.staging"

# Update package.json scripts
echo "📝 Updating package.json scripts..."

# Check if package.json exists
if [ -f "package.json" ]; then
    # Add production start script
    npm pkg set scripts.start:production="NODE_ENV=production node enhanced-server.js"
    npm pkg set scripts.start:staging="NODE_ENV=staging node enhanced-server.js"
    npm pkg set scripts.deploy:production="source .env.production && npm run start:production"
    npm pkg set scripts.deploy:staging="source .env.staging && npm run start:staging"
    
    echo "✅ Package.json scripts updated"
else
    echo "⚠️  package.json not found, creating basic one..."
    
    cat > package.json << EOF
{
  "name": "neurogrid-smart-router",
  "version": "1.0.0",
  "description": "NeuroGrid Smart Model Router",
  "main": "enhanced-server.js",
  "scripts": {
    "start": "node enhanced-server.js",
    "start:production": "NODE_ENV=production node enhanced-server.js",
    "start:staging": "NODE_ENV=staging node enhanced-server.js",
    "deploy:production": "source .env.production && npm run start:production",
    "deploy:staging": "source .env.staging && npm run start:staging",
    "dev": "NODE_ENV=development node enhanced-server.js"
  },
  "keywords": ["neurogrid", "ai", "router", "smart"],
  "author": "NeuroGrid Team",
  "license": "MIT"
}
EOF
fi

echo ""
echo "🎯 Deployment Configuration Complete!"
echo ""
echo "📋 Available Commands:"
echo "   npm run dev                  - Development (localhost:8080)"
echo "   npm run start:staging        - Staging (staging.neurogrid.network)"
echo "   npm run start:production     - Production (neurogrid.network)"
echo ""
echo "🌐 URLs:"
echo "   Development:  http://localhost:8080"
echo "   Staging:      https://staging.neurogrid.network"
echo "   Production:   https://neurogrid.network"
echo ""
echo "⚙️  Configuration Files:"
echo "   .env.production - Production settings"
echo "   .env.staging    - Staging settings"
echo ""
echo "🔑 Next Steps:"
echo "1. Configure your domain DNS to point to your server"
echo "2. Set up SSL/HTTPS with Let's Encrypt or CloudFlare"
echo "3. Add your OpenAI/Anthropic API keys to .env.production"
echo "4. Run: npm run start:production"
echo ""
echo "✅ NeuroGrid Smart Router is ready for production deployment!"