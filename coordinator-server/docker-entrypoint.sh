#!/bin/bash

# Docker Entrypoint Script for NeuroGrid Coordinator
# Handles initialization, secrets loading, and application startup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[ENTRYPOINT]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[ENTRYPOINT]${NC} $1"
}

error() {
    echo -e "${RED}[ENTRYPOINT]${NC} $1"
}

# Function to wait for dependencies
wait_for_dependencies() {
    log "Waiting for dependencies..."
    
    # Wait for PostgreSQL (if configured)
    if [ -n "$DB_HOST" ] && [ "$DB_HOST" != "localhost" ]; then
        log "Waiting for PostgreSQL at $DB_HOST:$DB_PORT..."
        while ! nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; do
            sleep 2
        done
        log "✅ PostgreSQL is ready"
    fi
    
    # Wait for Redis (if configured)
    if [ -n "$REDIS_HOST" ] && [ "$REDIS_HOST" != "localhost" ]; then
        log "Waiting for Redis at $REDIS_HOST:$REDIS_PORT..."
        while ! nc -z "$REDIS_HOST" "$REDIS_PORT" 2>/dev/null; do
            sleep 2
        done
        log "✅ Redis is ready"
    fi
}

# Function to load secrets
load_secrets() {
    if [ -f "./scripts/docker-secrets.sh" ]; then
        log "Loading Docker secrets..."
        ./scripts/docker-secrets.sh load
    else
        warn "Docker secrets script not found, using environment variables"
    fi
}

# Function to run database migrations
run_migrations() {
    log "Running database migrations..."
    
    if npm run migrate; then
        log "✅ Database migrations completed"
    else
        error "❌ Database migrations failed"
        exit 1
    fi
}

# Function to create required directories
create_directories() {
    log "Creating required directories..."
    
    # Create data directory for SQLite (development)
    mkdir -p data
    
    # Create uploads directory
    mkdir -p uploads
    
    # Create logs directory
    mkdir -p logs
    
    log "✅ Directories created"
}

# Function to validate configuration
validate_configuration() {
    log "Validating configuration..."
    
    if node -e "
        const ConfigManager = require('./src/config/manager');
        async function validate() {
            try {
                await ConfigManager.create();
                console.log('Configuration validation passed');
                process.exit(0);
            } catch (error) {
                console.error('Configuration validation failed:', error.message);
                process.exit(1);
            }
        }
        validate();
    "; then
        log "✅ Configuration is valid"
    else
        error "❌ Configuration validation failed"
        exit 1
    fi
}

# Function to perform health check
health_check() {
    log "Performing startup health check..."
    
    if [ -f "./health-check.sh" ]; then
        if ./health-check.sh; then
            log "✅ Health check passed"
        else
            warn "⚠️ Health check warnings detected, but continuing..."
        fi
    else
        warn "Health check script not found"
    fi
}

# Main initialization function
initialize() {
    log "Initializing NeuroGrid Coordinator Server..."
    log "Environment: ${NODE_ENV:-development}"
    log "Version: $(node -p "require('./package.json').version")"
    
    # Create required directories
    create_directories
    
    # Load secrets
    load_secrets
    
    # Wait for dependencies
    wait_for_dependencies
    
    # Validate configuration
    validate_configuration
    
    # Run database migrations (only in production or if explicitly requested)
    if [ "$NODE_ENV" = "production" ] || [ "$RUN_MIGRATIONS" = "true" ]; then
        run_migrations
    else
        log "Skipping database migrations (development mode)"
    fi
    
    # Perform health check
    health_check
    
    log "✅ Initialization completed successfully"
}

# Signal handlers for graceful shutdown
shutdown() {
    log "Received shutdown signal, cleaning up..."
    
    # Kill background processes
    if [ -n "$APP_PID" ]; then
        kill -TERM "$APP_PID" 2>/dev/null || true
        wait "$APP_PID" 2>/dev/null || true
    fi
    
    log "✅ Graceful shutdown completed"
    exit 0
}

# Set up signal handlers
trap shutdown SIGTERM SIGINT

# Run initialization
initialize

# Start the application
log "Starting NeuroGrid Coordinator Server..."

if [ "$NODE_ENV" = "development" ]; then
    # Development mode with nodemon
    log "Starting in development mode with hot reload..."
    exec npm run dev
else
    # Production mode
    log "Starting in production mode..."
    exec npm start
fi