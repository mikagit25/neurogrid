#!/bin/bash

# NeuroGrid Enhanced Deployment Script
# Supports development, staging, and production environments

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
LOG_FILE="$PROJECT_ROOT/deployment.log"
BACKUP_DIR="$PROJECT_ROOT/backups"

# Default values
ENVIRONMENT="development"
COMPOSE_FILE=""
ENV_FILE=""
SERVICE=""
BACKUP_BEFORE_DEPLOY="false"
FORCE_RECREATE="false"
NO_CACHE="false"
HEALTH_CHECK="true"
TIMEOUT="300"

# Function to print colored output
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}[$(date +'%Y-%m-%d %H:%M:%S')] ${message}${NC}" | tee -a "$LOG_FILE"
}

# Function to show usage
show_usage() {
    cat << EOF
Usage: $0 [OPTIONS]

Enhanced deployment script for NeuroGrid platform.

OPTIONS:
    -e, --env ENVIRONMENT       Set environment (development|staging|production) [default: development]
    -s, --service SERVICE       Deploy specific service only
    -b, --backup               Create backup before deployment
    -f, --force                Force recreate containers
    -n, --no-cache             Build without cache
    --no-health-check          Skip health checks
    --timeout SECONDS          Health check timeout [default: 300]
    -h, --help                 Show this help message

ENVIRONMENTS:
    development                Local development with hot reload
    staging                    Staging environment for testing
    production                 Production deployment with optimizations

EXAMPLES:
    $0 --env development                    # Deploy development environment
    $0 --env production --backup --force    # Production deployment with backup
    $0 --service coordinator-server         # Deploy only coordinator service
    $0 --env staging --no-cache            # Clean staging deployment

EOF
}

# Function to parse command line arguments
parse_arguments() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--env)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -s|--service)
                SERVICE="$2"
                shift 2
                ;;
            -b|--backup)
                BACKUP_BEFORE_DEPLOY="true"
                shift
                ;;
            -f|--force)
                FORCE_RECREATE="true"
                shift
                ;;
            -n|--no-cache)
                NO_CACHE="true"
                shift
                ;;
            --no-health-check)
                HEALTH_CHECK="false"
                shift
                ;;
            --timeout)
                TIMEOUT="$2"
                shift 2
                ;;
            -h|--help)
                show_usage
                exit 0
                ;;
            *)
                print_status "$RED" "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done
}

# Function to validate environment
validate_environment() {
    case $ENVIRONMENT in
        development|staging|production)
            ;;
        *)
            print_status "$RED" "Invalid environment: $ENVIRONMENT"
            print_status "$RED" "Supported environments: development, staging, production"
            exit 1
            ;;
    esac
}

# Function to set environment-specific configurations
setup_environment() {
    case $ENVIRONMENT in
        development)
            COMPOSE_FILE="docker-compose.yml"
            ENV_FILE=".env"
            ;;
        staging)
            COMPOSE_FILE="docker-compose.staging.yml"
            ENV_FILE=".env.staging"
            ;;
        production)
            COMPOSE_FILE="docker-compose.production.yml"
            ENV_FILE=".env.production"
            ;;
    esac

    print_status "$BLUE" "Environment: $ENVIRONMENT"
    print_status "$BLUE" "Compose file: $COMPOSE_FILE"
    print_status "$BLUE" "Environment file: $ENV_FILE"
}

# Function to check prerequisites
check_prerequisites() {
    print_status "$BLUE" "Checking prerequisites..."

    # Check if Docker is installed and running
    if ! command -v docker &> /dev/null; then
        print_status "$RED" "Docker is not installed"
        exit 1
    fi

    if ! docker info &> /dev/null; then
        print_status "$RED" "Docker is not running"
        exit 1
    fi

    # Check if Docker Compose is installed
    if ! command -v docker-compose &> /dev/null; then
        print_status "$RED" "Docker Compose is not installed"
        exit 1
    fi

    # Check if compose file exists
    if [[ ! -f "$PROJECT_ROOT/$COMPOSE_FILE" ]]; then
        print_status "$RED" "Compose file not found: $COMPOSE_FILE"
        exit 1
    fi

    # Check if environment file exists
    if [[ ! -f "$PROJECT_ROOT/$ENV_FILE" ]]; then
        print_status "$YELLOW" "Environment file not found: $ENV_FILE"
        if [[ -f "$PROJECT_ROOT/${ENV_FILE}.example" ]]; then
            print_status "$YELLOW" "Copying from ${ENV_FILE}.example"
            cp "$PROJECT_ROOT/${ENV_FILE}.example" "$PROJECT_ROOT/$ENV_FILE"
            print_status "$YELLOW" "Please edit $ENV_FILE with your configuration"
        else
            print_status "$RED" "No environment file or example found"
            exit 1
        fi
    fi

    print_status "$GREEN" "Prerequisites check passed"
}

# Function to create backup
create_backup() {
    if [[ "$BACKUP_BEFORE_DEPLOY" == "true" ]]; then
        print_status "$BLUE" "Creating backup..."
        
        mkdir -p "$BACKUP_DIR"
        backup_name="backup-$(date +'%Y%m%d-%H%M%S')"
        backup_path="$BACKUP_DIR/$backup_name"
        
        # Create backup directory
        mkdir -p "$backup_path"
        
        # Backup database if running
        if docker-compose -f "$COMPOSE_FILE" ps postgres | grep -q "Up"; then
            print_status "$BLUE" "Backing up PostgreSQL database..."
            docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U neurogrid neurogrid > "$backup_path/database.sql"
        fi
        
        # Backup volumes
        print_status "$BLUE" "Backing up Docker volumes..."
        docker run --rm \
            -v neurogrid_postgres_data:/source:ro \
            -v "$backup_path":/backup \
            alpine tar czf /backup/postgres_data.tar.gz -C /source .
        
        print_status "$GREEN" "Backup created: $backup_path"
    fi
}

# Function to build services
build_services() {
    print_status "$BLUE" "Building services..."
    
    local build_args=""
    if [[ "$NO_CACHE" == "true" ]]; then
        build_args="--no-cache"
    fi
    
    if [[ -n "$SERVICE" ]]; then
        docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build $build_args "$SERVICE"
    else
        docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build $build_args
    fi
    
    print_status "$GREEN" "Build completed"
}

# Function to deploy services
deploy_services() {
    print_status "$BLUE" "Deploying services..."
    
    local deploy_args="--detach"
    if [[ "$FORCE_RECREATE" == "true" ]]; then
        deploy_args="$deploy_args --force-recreate"
    fi
    
    if [[ -n "$SERVICE" ]]; then
        docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up $deploy_args "$SERVICE"
    else
        docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up $deploy_args
    fi
    
    print_status "$GREEN" "Deployment completed"
}

# Function to check service health
check_health() {
    if [[ "$HEALTH_CHECK" == "false" ]]; then
        return 0
    fi
    
    print_status "$BLUE" "Checking service health..."
    
    local start_time=$(date +%s)
    local timeout_time=$((start_time + TIMEOUT))
    
    # List of services to check
    local services=(coordinator-server web-interface postgres redis)
    
    for service in "${services[@]}"; do
        print_status "$BLUE" "Checking $service health..."
        
        while true; do
            local current_time=$(date +%s)
            if [[ $current_time -gt $timeout_time ]]; then
                print_status "$RED" "Health check timeout for $service"
                return 1
            fi
            
            if docker-compose -f "$COMPOSE_FILE" ps "$service" | grep -q "healthy\|Up"; then
                print_status "$GREEN" "$service is healthy"
                break
            fi
            
            print_status "$YELLOW" "Waiting for $service to be healthy..."
            sleep 5
        done
    done
    
    print_status "$GREEN" "All services are healthy"
}

# Function to show deployment status
show_status() {
    print_status "$BLUE" "Deployment status:"
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps
    
    print_status "$BLUE" "Service URLs:"
    if [[ "$ENVIRONMENT" == "development" ]]; then
        echo "Web Interface: http://localhost:3000"
        echo "API Server: http://localhost:3001"
        echo "API Docs: http://localhost:3001/api-docs"
    elif [[ "$ENVIRONMENT" == "production" ]]; then
        echo "Web Interface: https://neurogrid.network"
        echo "API Server: https://api.neurogrid.network"
        echo "Monitoring: https://monitoring.neurogrid.network"
    fi
}

# Function to cleanup
cleanup_on_exit() {
    if [[ $? -ne 0 ]]; then
        print_status "$RED" "Deployment failed. Check logs for details."
        print_status "$BLUE" "Logs location: $LOG_FILE"
    fi
}

# Main deployment function
main() {
    print_status "$GREEN" "Starting NeuroGrid deployment..."
    
    # Setup trap for cleanup
    trap cleanup_on_exit EXIT
    
    # Parse arguments and setup environment
    parse_arguments "$@"
    validate_environment
    setup_environment
    
    # Run deployment steps
    check_prerequisites
    create_backup
    build_services
    deploy_services
    check_health
    show_status
    
    print_status "$GREEN" "Deployment completed successfully!"
    print_status "$BLUE" "Logs saved to: $LOG_FILE"
}

# Create log directory
mkdir -p "$(dirname "$LOG_FILE")"

# Run main function
main "$@"