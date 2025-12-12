#!/bin/bash

# NeuroGrid Production Deployment Script
# Deploys working local changes to production server

set -e

echo "🚀 Starting NeuroGrid production deployment..."

# Configuration
SERVER="root@5547765-fk95855.twc1.net"
LOCAL_PATH="/Users/a123/neurogrid"
REMOTE_PATH="/root/neurogrid-new"

# Function to deploy API server
deploy_api() {
    echo "📡 Deploying API server..."
    
    # Copy working app-simple.js
    scp "$LOCAL_PATH/coordinator-server/src/app-simple.js" \
        "$SERVER:$REMOTE_PATH/coordinator-server/src/"
    
    # Update package.json with simple script
    scp "$LOCAL_PATH/coordinator-server/package.json" \
        "$SERVER:$REMOTE_PATH/coordinator-server/"
    
    # Restart API server
    ssh "$SERVER" "
        cd $REMOTE_PATH/coordinator-server && \
        npm install --production && \
        pm2 delete neurogrid-api || true && \
        pm2 start src/app-simple.js --name neurogrid-api --watch && \
        pm2 save
    "
    
    echo "✅ API server deployed successfully"
}

# Function to deploy web interface
deploy_web() {
    echo "🌐 Deploying web interface..."
    
    # Copy web-interface files
    rsync -avz --exclude node_modules "$LOCAL_PATH/web-interface/" \
        "$SERVER:$REMOTE_PATH/web-interface/"
    
    # Install dependencies and build
    ssh "$SERVER" "
        cd $REMOTE_PATH/web-interface && \
        npm install && \
        npm run build && \
        pm2 delete neurogrid-web || true && \
        pm2 start 'npm start' --name neurogrid-web && \
        pm2 save
    "
    
    echo "✅ Web interface deployed successfully"
}

# Function to update nginx configuration
update_nginx() {
    echo "⚙️ Updating nginx configuration..."
    
    # Copy nginx config
    scp "$LOCAL_PATH/deploy/nginx-hybrid.conf" \
        "$SERVER:/etc/nginx/sites-available/neurogrid-hybrid.conf"
    
    # Test and reload nginx
    ssh "$SERVER" "
        nginx -t && \
        systemctl reload nginx
    "
    
    echo "✅ Nginx configuration updated"
}

# Main deployment process
main() {
    echo "🔍 Pre-deployment checks..."
    
    # Check if server is accessible
    if ! ssh "$SERVER" "echo 'Server accessible'"; then
        echo "❌ Cannot connect to server"
        exit 1
    fi
    
    # Check if local files exist
    if [[ ! -f "$LOCAL_PATH/coordinator-server/src/app-simple.js" ]]; then
        echo "❌ app-simple.js not found"
        exit 1
    fi
    
    echo "✅ Pre-deployment checks passed"
    
    # Deploy components
    deploy_api
    # deploy_web  # Uncomment when ready
    # update_nginx  # Uncomment when ready
    
    echo "🎉 Deployment completed successfully!"
    echo "📊 Checking service status..."
    
    ssh "$SERVER" "pm2 status"
    
    echo "🔗 Services:"
    echo "   MVP: https://neurogrid.network"
    echo "   API: https://api.neurogrid.network"
    echo "   App: https://app.neurogrid.network"
}

# Run deployment
main "$@"