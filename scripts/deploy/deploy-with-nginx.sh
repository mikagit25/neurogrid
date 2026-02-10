#!/bin/bash

# NeuroGrid Production Deployment Script
# Usage: ./deploy-with-nginx.sh [environment]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
PROJECT_NAME="neurogrid"
BACKUP_DIR="./backups"
LOG_FILE="./deployment.log"

echo -e "${BLUE}🚀 NeuroGrid Deployment Script${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"
echo "=================================="

# Function to log messages
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >> $LOG_FILE
}

# Function to handle errors
error() {
    echo -e "${RED}[ERROR] $1${NC}"
    echo "[ERROR] $1" >> $LOG_FILE
    exit 1
}

# Function to create backup
create_backup() {
    if [ -d "$BACKUP_DIR" ]; then
        log "Creating backup..."
        mkdir -p "$BACKUP_DIR/$(date +%Y%m%d_%H%M%S)"
        docker-compose -f docker-compose.production.yml logs > "$BACKUP_DIR/$(date +%Y%m%d_%H%M%S)/logs.txt" 2>/dev/null || true
        log "Backup created successfully"
    fi
}

# Function to check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        error "Docker is not installed"
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed"
    fi
    
    # Check required files
    required_files=(
        "docker-compose.production.yml"
        "nginx/nginx.conf"
        "landing-page.html"
        "Dockerfile.mvp"
        "mvp-server.js"
    )
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            error "Required file not found: $file"
        fi
    done
    
    log "Prerequisites check passed ✓"
}

# Function to setup environment
setup_environment() {
    log "Setting up environment..."
    
    # Create .env file if it doesn't exist
    if [ ! -f ".env.production" ]; then
        log "Creating .env.production file..."
        cat > .env.production << EOF
# NeuroGrid Production Environment
NODE_ENV=production
HTTP_PORT=80
HTTPS_PORT=443
COORDINATOR_PORT=3001
WEB_PORT=3000
POSTGRES_PORT=5432
REDIS_PORT=6379
PROMETHEUS_PORT=9090
GRAFANA_PORT=3002

# Database
POSTGRES_PASSWORD=neurogrid_prod_$(openssl rand -hex 12)

# Security
JWT_SECRET=$(openssl rand -hex 32)

# External Services (Update these with real values)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLIC_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Monitoring
LOG_LEVEL=info
RATE_LIMIT_ENABLED=true
CACHE_ENABLED=true

# Build info
BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
VERSION=1.0.0
VCS_REF=$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')
EOF
        log ".env.production created ✓"
    else
        log ".env.production already exists ✓"
    fi
}

# Function to build and deploy
deploy() {
    log "Starting deployment..."
    
    # Pull latest images
    log "Pulling latest base images..."
    docker-compose -f docker-compose.production.yml pull postgres redis nginx prometheus grafana || true
    
    # Stop existing containers
    log "Stopping existing containers..."
    docker-compose -f docker-compose.production.yml down --remove-orphans || true
    
    # Build custom images
    log "Building application images..."
    docker-compose -f docker-compose.production.yml build --no-cache
    
    # Start services
    log "Starting services..."
    docker-compose -f docker-compose.production.yml up -d
    
    # Wait for services to be healthy
    log "Waiting for services to be healthy..."
    sleep 30
    
    # Check service health
    services=("neurogrid-nginx" "neurogrid-coordinator" "neurogrid-web" "neurogrid-mvp" "neurogrid-postgres" "neurogrid-redis")
    for service in "${services[@]}"; do
        if docker ps --filter "name=$service" --filter "status=running" | grep -q "$service"; then
            log "✓ $service is running"
        else
            error "✗ $service is not running"
        fi
    done
}

# Function to test deployment
test_deployment() {
    log "Testing deployment..."
    
    # Wait a bit more for services to fully start
    sleep 10
    
    # Test endpoints
    endpoints=(
        "http://localhost/"
        "http://localhost/demo/"
        "http://localhost/app/"
        "http://localhost/api/health"
        "http://localhost/health"
    )
    
    for endpoint in "${endpoints[@]}"; do
        if curl -f -s "$endpoint" > /dev/null; then
            log "✓ $endpoint is responding"
        else
            echo -e "${YELLOW}⚠ $endpoint is not responding (might be normal for some endpoints)${NC}"
        fi
    done
}

# Function to show status
show_status() {
    log "Deployment Status:"
    echo "=================================="
    docker-compose -f docker-compose.production.yml ps
    echo "=================================="
    
    echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
    echo ""
    echo -e "${BLUE}Access your application:${NC}"
    echo "🌐 Landing Page:  http://localhost/"
    echo "🚀 Demo/MVP:      http://localhost/demo/"
    echo "📱 Full App:      http://localhost/app/"
    echo "🔧 API:           http://localhost/api/"
    echo "📊 Grafana:       http://localhost:3002/ (admin/admin123)"
    echo ""
    echo -e "${YELLOW}📝 Next steps:${NC}"
    echo "1. Update DNS to point to your server"
    echo "2. Configure SSL certificates"
    echo "3. Update environment variables for production"
    echo "4. Set up monitoring alerts"
    echo ""
    echo -e "${BLUE}📋 Useful commands:${NC}"
    echo "  View logs:    docker-compose -f docker-compose.production.yml logs -f"
    echo "  Stop:         docker-compose -f docker-compose.production.yml down"
    echo "  Restart:      docker-compose -f docker-compose.production.yml restart"
    echo "  Update:       ./deploy-with-nginx.sh"
}

# Main execution
main() {
    # Create log file
    touch $LOG_FILE
    
    log "Starting NeuroGrid deployment..."
    
    # Run deployment steps
    check_prerequisites
    create_backup
    setup_environment
    deploy
    test_deployment
    show_status
    
    log "Deployment completed successfully! 🎉"
}

# Run main function
main "$@"