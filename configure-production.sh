#!/bin/bash

# NeuroGrid Production Configuration Setup
# Usage: ./configure-production.sh [domain] [api-domain]
# Example: ./configure-production.sh neurogrid.com api.neurogrid.com

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 NeuroGrid Production Configuration Setup${NC}"
echo "============================================="

# Get domain from argument or prompt
DOMAIN=${1:-}
if [ -z "$DOMAIN" ]; then
    read -p "Enter your main domain (e.g., neurogrid.com): " DOMAIN
fi

API_DOMAIN=${2:-}
if [ -z "$API_DOMAIN" ]; then
    read -p "Enter your API domain (e.g., api.neurogrid.com) [or press Enter to use $DOMAIN:8080]: " API_DOMAIN
    if [ -z "$API_DOMAIN" ]; then
        API_DOMAIN="$DOMAIN:8080"
    fi
fi

# Choose protocol
echo -e "\n${YELLOW}Select protocol:${NC}"
echo "1) HTTPS (Recommended for production)"
echo "2) HTTP (Development/testing only)"
read -p "Enter choice (1 or 2): " PROTOCOL_CHOICE

if [ "$PROTOCOL_CHOICE" = "1" ]; then
    PROTOCOL="https"
    WS_PROTOCOL="wss"
else
    PROTOCOL="http"
    WS_PROTOCOL="ws"
fi

echo -e "\n${YELLOW}Configuration Summary:${NC}"
echo "Main Domain: $DOMAIN"
echo "API Domain: $API_DOMAIN"
echo "Protocol: $PROTOCOL"
echo "Web Interface URL: $PROTOCOL://$DOMAIN"
echo "API Server URL: $PROTOCOL://$API_DOMAIN"
echo "WebSocket URL: $WS_PROTOCOL://$API_DOMAIN/ws"

read -p "Continue with this configuration? (y/n): " CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo "Configuration cancelled."
    exit 1
fi

echo -e "\n${BLUE}Configuring files...${NC}"

# 1. Update web-interface environment
echo -e "${GREEN}✓${NC} Creating web-interface production environment..."
cat > web-interface/.env.production << EOF
# NeuroGrid Production Configuration
# Generated on $(date)

# API Configuration
NEXT_PUBLIC_API_URL=$PROTOCOL://$API_DOMAIN
NEXT_PUBLIC_WS_URL=$WS_PROTOCOL://$API_DOMAIN/ws
NEXT_PUBLIC_APP_URL=$PROTOCOL://$DOMAIN

NODE_ENV=production
NEXT_PUBLIC_ENV=production

# Production features
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_MONITORING=true
NEXT_PUBLIC_ENABLE_ADMIN=true
NEXT_PUBLIC_ENABLE_DEBUG=false

# Site info
NEXT_PUBLIC_SITE_NAME="NeuroGrid - AI Inference Platform"
NEXT_PUBLIC_SITE_DESCRIPTION="Decentralized AI inference network with GPU power sharing"
NEXT_PUBLIC_SITE_URL=$PROTOCOL://$DOMAIN

# Analytics & Monitoring
NEXT_PUBLIC_ENABLE_REAL_TIME=true
NEXT_PUBLIC_ENABLE_WEBSOCKET=true

# Security
NEXT_PUBLIC_SECURE_MODE=true
NEXT_PUBLIC_ENABLE_CORS=true
EOF

# 2. Create coordinator server production config
echo -e "${GREEN}✓${NC} Creating coordinator-server production environment..."
cat > .env.production << EOF
# NeuroGrid Coordinator Server Production Configuration
# Generated on $(date)

NODE_ENV=production
PORT=8080

# Database Configuration
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=neurogrid_production
POSTGRES_USER=neurogrid
POSTGRES_PASSWORD=your_secure_password_here

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password_here

# JWT Configuration
JWT_SECRET=your_very_secure_jwt_secret_here
JWT_EXPIRES_IN=24h

# CORS Configuration
CORS_ORIGIN=$PROTOCOL://$DOMAIN

# API Configuration
API_BASE_URL=$PROTOCOL://$API_DOMAIN
WEB_BASE_URL=$PROTOCOL://$DOMAIN

# Security
RATE_LIMIT_ENABLED=true
SECURITY_ENABLED=true

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/neurogrid/coordinator.log
EOF

# 3. Create Nginx configuration
echo -e "${GREEN}✓${NC} Creating Nginx configuration..."
mkdir -p nginx/conf.d

cat > nginx/conf.d/neurogrid.conf << EOF
# NeuroGrid Nginx Configuration
# Generated on $(date)

# Redirect HTTP to HTTPS (if using HTTPS)
$([ "$PROTOCOL" = "https" ] && cat << 'HTTPS_REDIRECT'
server {
    listen 80;
    server_name $DOMAIN $API_DOMAIN;
    return 301 https://\$server_name\$request_uri;
}
HTTPS_REDIRECT
)

# Main web interface
server {
    $([ "$PROTOCOL" = "https" ] && echo "listen 443 ssl http2;" || echo "listen 80;")
    server_name $DOMAIN;
    
    $([ "$PROTOCOL" = "https" ] && cat << 'SSL_CONFIG'
    ssl_certificate /etc/ssl/certs/neurogrid.crt;
    ssl_certificate_key /etc/ssl/private/neurogrid.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
SSL_CONFIG
)

    # Web interface (Next.js)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}

# API server
server {
    $([ "$PROTOCOL" = "https" ] && echo "listen 443 ssl http2;" || echo "listen 80;")
    server_name $API_DOMAIN;
    
    $([ "$PROTOCOL" = "https" ] && cat << 'SSL_CONFIG2'
    ssl_certificate /etc/ssl/certs/neurogrid-api.crt;
    ssl_certificate_key /etc/ssl/private/neurogrid-api.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
SSL_CONFIG2
)

    # API endpoints
    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # CORS headers
        add_header Access-Control-Allow-Origin "$PROTOCOL://$DOMAIN" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept, Authorization" always;
        
        if (\$request_method = OPTIONS) {
            return 204;
        }
    }
    
    # WebSocket support
    location /ws {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        # WebSocket timeouts
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }
}
EOF

# 4. Create production docker-compose
echo -e "${GREEN}✓${NC} Creating production docker-compose..."
cat > docker-compose.production.yml << EOF
# NeuroGrid Production Docker Compose
# Generated on $(date)

version: '3.8'

services:
  coordinator-server:
    build: 
      context: .
      dockerfile: Dockerfile
    environment:
      - NODE_ENV=production
    env_file:
      - .env.production
    ports:
      - "8080:8080"
    depends_on:
      - postgres
      - redis
    restart: unless-stopped
    volumes:
      - ./logs:/var/log/neurogrid
    networks:
      - neurogrid-network

  web-interface:
    build:
      context: ./web-interface
      dockerfile: Dockerfile.production
    environment:
      - NODE_ENV=production
    env_file:
      - ./web-interface/.env.production
    ports:
      - "3000:3000"
    restart: unless-stopped
    networks:
      - neurogrid-network

  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: neurogrid_production
      POSTGRES_USER: neurogrid
      POSTGRES_PASSWORD: your_secure_password_here
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./coordinator-server/sql/init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    restart: unless-stopped
    networks:
      - neurogrid-network

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass your_redis_password_here
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    restart: unless-stopped
    networks:
      - neurogrid-network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      $([ "$PROTOCOL" = "https" ] && echo '      - "443:443"')
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d
      $([ "$PROTOCOL" = "https" ] && cat << 'SSL_VOLUMES'
      - /etc/ssl/certs:/etc/ssl/certs
      - /etc/ssl/private:/etc/ssl/private
SSL_VOLUMES
)
    depends_on:
      - coordinator-server
      - web-interface
    restart: unless-stopped
    networks:
      - neurogrid-network

volumes:
  postgres_data:
  redis_data:

networks:
  neurogrid-network:
    driver: bridge
EOF

# 5. Create production deployment script
echo -e "${GREEN}✓${NC} Creating deployment script..."
cat > deploy-production.sh << 'EOF'
#!/bin/bash

# NeuroGrid Production Deployment Script
set -e

echo "🚀 Starting NeuroGrid Production Deployment..."

# Stop existing services
echo "Stopping existing services..."
docker-compose -f docker-compose.production.yml down

# Build and start services
echo "Building and starting services..."
docker-compose -f docker-compose.production.yml up --build -d

# Wait for services to start
echo "Waiting for services to start..."
sleep 30

# Health check
echo "Performing health checks..."
curl -f http://localhost:8080/health || exit 1
curl -f http://localhost:3000 || exit 1

echo "✅ NeuroGrid deployed successfully!"
echo "Web Interface: $PROTOCOL://$DOMAIN"
echo "API Server: $PROTOCOL://$API_DOMAIN"

EOF
chmod +x deploy-production.sh

echo -e "\n${GREEN}✅ Production configuration completed!${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Update database and Redis passwords in .env.production"
echo "2. Update JWT secret in .env.production"
if [ "$PROTOCOL" = "https" ]; then
    echo "3. Place SSL certificates in /etc/ssl/certs/ and /etc/ssl/private/"
fi
echo "4. Run: ./deploy-production.sh"
echo ""
echo -e "${BLUE}URLs:${NC}"
echo "Web Interface: $PROTOCOL://$DOMAIN"
echo "API Server: $PROTOCOL://$API_DOMAIN"
echo "Admin Panel: $PROTOCOL://$DOMAIN/admin"