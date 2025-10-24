#!/bin/bash

# Docker helper scripts for NeuroGrid Coordinator Server

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper function for colored output
log() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if Docker is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
}

# Function to check if Docker Compose is available
check_docker_compose() {
    if ! command -v docker-compose >/dev/null 2>&1; then
        error "Docker Compose is not installed. Please install Docker Compose."
        exit 1
    fi
}

# Development environment
dev() {
    log "Starting development environment..."
    check_docker
    check_docker_compose
    
    # Build and start development services
    docker-compose -f docker-compose.dev.yml up --build -d
    
    log "Development environment started!"
    log "API available at: http://localhost:3001"
    log "To view logs: docker-compose -f docker-compose.dev.yml logs -f coordinator"
    log "To stop: ./docker.sh dev-stop"
}

# Stop development environment
dev_stop() {
    log "Stopping development environment..."
    docker-compose -f docker-compose.dev.yml down
    log "Development environment stopped."
}

# Production environment
prod() {
    log "Starting production environment..."
    check_docker
    check_docker_compose
    
    # Check if .env file exists
    if [ ! -f .env ]; then
        warn ".env file not found. Creating from template..."
        cp .env.example .env
        warn "Please edit .env file with your production settings before continuing."
        exit 1
    fi
    
    # Build and start production services
    docker-compose up --build -d
    
    log "Production environment started!"
    log "API available at: http://localhost"
    log "Grafana dashboard: http://localhost:3000 (admin/admin)"
    log "To view logs: docker-compose logs -f"
    log "To stop: ./docker.sh prod-stop"
}

# Stop production environment
prod_stop() {
    log "Stopping production environment..."
    docker-compose down
    log "Production environment stopped."
}

# Build images
build() {
    log "Building Docker images..."
    check_docker
    
    # Build development image
    docker build -t neurogrid-coordinator:dev --target development .
    
    # Build production image
    docker build -t neurogrid-coordinator:prod --target production .
    
    log "Docker images built successfully!"
}

# Clean up Docker resources
clean() {
    log "Cleaning up Docker resources..."
    
    # Stop all containers
    docker-compose -f docker-compose.dev.yml down 2>/dev/null || true
    docker-compose down 2>/dev/null || true
    
    # Remove images
    docker rmi neurogrid-coordinator:dev 2>/dev/null || true
    docker rmi neurogrid-coordinator:prod 2>/dev/null || true
    
    # Clean up unused resources
    docker system prune -f
    
    log "Cleanup completed!"
}

# Show logs
logs() {
    local service=${2:-coordinator}
    local env=${1:-dev}
    
    if [ "$env" = "prod" ]; then
        docker-compose logs -f "$service"
    else
        docker-compose -f docker-compose.dev.yml logs -f "$service"
    fi
}

# Database operations
db_migrate() {
    local env=${1:-dev}
    log "Running database migrations..."
    
    if [ "$env" = "prod" ]; then
        docker-compose exec coordinator npm run migrate
    else
        docker-compose -f docker-compose.dev.yml exec coordinator npm run migrate
    fi
    
    log "Database migrations completed!"
}

db_seed() {
    local env=${1:-dev}
    log "Seeding database..."
    
    if [ "$env" = "prod" ]; then
        docker-compose exec coordinator npm run seed
    else
        docker-compose -f docker-compose.dev.yml exec coordinator npm run seed
    fi
    
    log "Database seeding completed!"
}

# Health check
health() {
    local env=${1:-dev}
    local port
    
    if [ "$env" = "prod" ]; then
        port=80
    else
        port=3001
    fi
    
    log "Checking health of coordinator service..."
    
    if curl -f http://localhost:$port/health >/dev/null 2>&1; then
        log "✅ Coordinator service is healthy!"
    else
        error "❌ Coordinator service is not responding"
        exit 1
    fi
}

# Show usage
usage() {
    echo "NeuroGrid Docker Helper Script"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  dev              Start development environment"
    echo "  dev-stop         Stop development environment"
    echo "  prod             Start production environment"
    echo "  prod-stop        Stop production environment"
    echo "  build            Build Docker images"
    echo "  clean            Clean up Docker resources"
    echo "  logs [env] [service]  Show logs (env: dev|prod, default: dev)"
    echo "  db-migrate [env] Run database migrations (env: dev|prod, default: dev)"
    echo "  db-seed [env]    Seed database (env: dev|prod, default: dev)"
    echo "  health [env]     Check service health (env: dev|prod, default: dev)"
    echo ""
    echo "Examples:"
    echo "  $0 dev              # Start development environment"
    echo "  $0 logs prod        # Show production logs"
    echo "  $0 db-migrate prod  # Run migrations in production"
    echo ""
}

# Main script
case "$1" in
    dev)
        dev
        ;;
    dev-stop)
        dev_stop
        ;;
    prod)
        prod
        ;;
    prod-stop)
        prod_stop
        ;;
    build)
        build
        ;;
    clean)
        clean
        ;;
    logs)
        logs "$2" "$3"
        ;;
    db-migrate)
        db_migrate "$2"
        ;;
    db-seed)
        db_seed "$2"
        ;;
    health)
        health "$2"
        ;;
    *)
        usage
        exit 1
        ;;
esac