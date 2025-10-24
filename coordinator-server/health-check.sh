#!/bin/bash

# Health check script for Docker containers

set -e

# Configuration
MAX_RETRIES=30
RETRY_INTERVAL=2
SERVICE_PORT=${PORT:-3001}

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[HEALTH]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[HEALTH]${NC} $1"
}

error() {
    echo -e "${RED}[HEALTH]${NC} $1"
}

# Check if service is responding
check_http_endpoint() {
    local url="http://localhost:${SERVICE_PORT}/health"
    local retries=0
    
    log "Checking HTTP endpoint: $url"
    
    while [ $retries -lt $MAX_RETRIES ]; do
        if curl -f -s "$url" >/dev/null 2>&1; then
            log "✅ HTTP endpoint is healthy"
            return 0
        fi
        
        retries=$((retries + 1))
        warn "Attempt $retries/$MAX_RETRIES failed, retrying in ${RETRY_INTERVAL}s..."
        sleep $RETRY_INTERVAL
    done
    
    error "❌ HTTP endpoint is not responding after $MAX_RETRIES attempts"
    return 1
}

# Check database connectivity
check_database() {
    log "Checking database connectivity..."
    
    if [ "$NODE_ENV" = "production" ]; then
        # Check PostgreSQL connection
        if command -v pg_isready >/dev/null 2>&1; then
            if pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" >/dev/null 2>&1; then
                log "✅ PostgreSQL database is accessible"
                return 0
            else
                error "❌ PostgreSQL database is not accessible"
                return 1
            fi
        else
            warn "pg_isready not available, skipping database check"
        fi
    else
        # For development, check if SQLite file exists and is readable
        if [ -f "./data/neurogrid.db" ]; then
            log "✅ SQLite database file exists"
            return 0
        else
            warn "SQLite database file not found, will be created on startup"
            return 0
        fi
    fi
}

# Check Redis connectivity (if enabled)
check_redis() {
    if [ -n "$REDIS_HOST" ] && [ "$REDIS_HOST" != "localhost" ]; then
        log "Checking Redis connectivity..."
        
        if command -v redis-cli >/dev/null 2>&1; then
            if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping >/dev/null 2>&1; then
                log "✅ Redis is accessible"
                return 0
            else
                error "❌ Redis is not accessible"
                return 1
            fi
        else
            warn "redis-cli not available, skipping Redis check"
        fi
    fi
}

# Check required environment variables
check_environment() {
    log "Checking required environment variables..."
    
    local required_vars=(
        "NODE_ENV"
        "PORT"
        "JWT_SECRET"
    )
    
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            missing_vars+=("$var")
        fi
    done
    
    if [ ${#missing_vars[@]} -eq 0 ]; then
        log "✅ All required environment variables are set"
        return 0
    else
        error "❌ Missing required environment variables: ${missing_vars[*]}"
        return 1
    fi
}

# Check disk space
check_disk_space() {
    log "Checking disk space..."
    
    local available_space
    available_space=$(df / | tail -1 | awk '{print $4}')
    local min_space=1048576  # 1GB in KB
    
    if [ "$available_space" -gt "$min_space" ]; then
        log "✅ Sufficient disk space available"
        return 0
    else
        warn "⚠️ Low disk space: ${available_space}KB available"
        return 1
    fi
}

# Check memory usage
check_memory() {
    log "Checking memory usage..."
    
    if command -v free >/dev/null 2>&1; then
        local mem_usage
        mem_usage=$(free | grep Mem | awk '{print ($3/$2) * 100.0}')
        local mem_threshold=90
        
        if (( $(echo "$mem_usage < $mem_threshold" | bc -l) )); then
            log "✅ Memory usage is normal (${mem_usage}%)"
            return 0
        else
            warn "⚠️ High memory usage: ${mem_usage}%"
            return 1
        fi
    else
        warn "free command not available, skipping memory check"
        return 0
    fi
}

# Main health check function
main() {
    log "Starting health check..."
    
    local checks_passed=0
    local total_checks=0
    
    # Run all health checks
    local checks=(
        "check_environment"
        "check_disk_space"
        "check_memory"
        "check_database" 
        "check_redis"
        "check_http_endpoint"
    )
    
    for check in "${checks[@]}"; do
        total_checks=$((total_checks + 1))
        if $check; then
            checks_passed=$((checks_passed + 1))
        fi
    done
    
    log "Health check completed: $checks_passed/$total_checks checks passed"
    
    if [ $checks_passed -eq $total_checks ]; then
        log "🎉 All health checks passed!"
        exit 0
    else
        error "💥 Some health checks failed"
        exit 1
    fi
}

# Run health check
main "$@"