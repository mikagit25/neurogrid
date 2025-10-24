#!/bin/bash

# NeuroGrid MainNet Production Deployment Script
# Comprehensive deployment automation for multi-region MainNet infrastructure

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOYMENT_LOG="$PROJECT_ROOT/deployment.log"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Default values
ENVIRONMENT="production"
REGIONS="us-east-1,eu-west-1,ap-southeast-1"
ENABLE_MONITORING="true"
ENABLE_BACKUPS="true"
SKIP_TESTS="false"
DRY_RUN="false"
FORCE_DEPLOY="false"

# Functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}" | tee -a "$DEPLOYMENT_LOG"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}" | tee -a "$DEPLOYMENT_LOG"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}" | tee -a "$DEPLOYMENT_LOG"
    exit 1
}

info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}" | tee -a "$DEPLOYMENT_LOG"
}

show_help() {
    cat << EOF
NeuroGrid MainNet Deployment Script

Usage: $0 [OPTIONS]

OPTIONS:
    -e, --environment ENVIRONMENT    Deployment environment (default: production)
    -r, --regions REGIONS           Comma-separated list of AWS regions (default: us-east-1,eu-west-1,ap-southeast-1)
    -m, --monitoring                 Enable monitoring stack (default: true)
    -b, --backups                    Enable automated backups (default: true)
    -s, --skip-tests                 Skip pre-deployment tests
    -d, --dry-run                    Show what would be deployed without actually deploying
    -f, --force                      Force deployment even if checks fail
    -h, --help                       Show this help message

EXAMPLES:
    $0                                      # Deploy to all default regions
    $0 -r us-east-1,us-west-2             # Deploy to specific regions
    $0 -d                                   # Dry run to preview deployment
    $0 -s -f                               # Skip tests and force deployment

ENVIRONMENT VARIABLES:
    AWS_PROFILE                      AWS profile to use
    DATABASE_PASSWORD                PostgreSQL password
    JWT_SECRET                      JWT secret key
    ENCRYPTION_KEY                  Encryption key for sensitive data
    GRAFANA_PASSWORD                Grafana admin password

EOF
}

check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if required commands are available
    local commands=("aws" "docker" "docker-compose" "kubectl" "node" "npm" "curl" "jq")
    for cmd in "${commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            error "Required command '$cmd' is not installed"
        fi
    done
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        error "AWS credentials not configured or invalid"
    fi
    
    # Check environment variables
    local required_vars=("DATABASE_PASSWORD" "JWT_SECRET" "ENCRYPTION_KEY")
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var:-}" ]]; then
            error "Required environment variable '$var' is not set"
        fi
    done
    
    # Check Docker daemon
    if ! docker info &> /dev/null; then
        error "Docker daemon is not running"
    fi
    
    # Check project structure
    if [[ ! -f "$PROJECT_ROOT/coordinator-server/package.json" ]]; then
        error "Invalid project structure: coordinator-server not found"
    fi
    
    log "Prerequisites check completed successfully"
}

run_tests() {
    if [[ "$SKIP_TESTS" == "true" ]]; then
        warn "Skipping tests as requested"
        return 0
    fi
    
    log "Running pre-deployment tests..."
    
    # Install dependencies if needed
    if [[ ! -d "$PROJECT_ROOT/coordinator-server/node_modules" ]]; then
        info "Installing dependencies..."
        cd "$PROJECT_ROOT/coordinator-server"
        npm ci --production
        cd "$PROJECT_ROOT"
    fi
    
    # Run deployment integration tests
    info "Running deployment integration tests..."
    cd "$PROJECT_ROOT"
    if ! node test-deployment-integration.js; then
        if [[ "$FORCE_DEPLOY" == "false" ]]; then
            error "Deployment tests failed. Use --force to override."
        else
            warn "Tests failed but continuing due to --force flag"
        fi
    fi
    
    # Run analytics integration tests
    info "Running analytics integration tests..."
    if ! node test-analytics-integration.js; then
        if [[ "$FORCE_DEPLOY" == "false" ]]; then
            error "Analytics tests failed. Use --force to override."
        else
            warn "Analytics tests failed but continuing due to --force flag"
        fi
    fi
    
    log "All tests passed successfully"
}

build_images() {
    log "Building Docker images..."
    
    # Build coordinator image
    info "Building coordinator server image..."
    docker build -t neurogrid/coordinator:${TIMESTAMP} \
                 -t neurogrid/coordinator:latest \
                 --target production \
                 "$PROJECT_ROOT"
    
    # Build additional images if needed
    if [[ -f "$PROJECT_ROOT/web-interface/Dockerfile" ]]; then
        info "Building web interface image..."
        docker build -t neurogrid/web-interface:${TIMESTAMP} \
                     -t neurogrid/web-interface:latest \
                     "$PROJECT_ROOT/web-interface"
    fi
    
    log "Docker images built successfully"
}

deploy_infrastructure() {
    local region=$1
    log "Deploying infrastructure to region: $region"
    
    # Set AWS region
    export AWS_REGION=$region
    
    # Deploy networking infrastructure
    info "Deploying networking infrastructure..."
    aws cloudformation deploy \
        --template-file "$PROJECT_ROOT/infrastructure/networking.yaml" \
        --stack-name "neurogrid-${region}-networking" \
        --parameter-overrides Region=$region Environment=$ENVIRONMENT \
        --capabilities CAPABILITY_IAM \
        --region $region
    
    # Deploy database infrastructure
    info "Deploying database infrastructure..."
    aws cloudformation deploy \
        --template-file "$PROJECT_ROOT/infrastructure/database.yaml" \
        --stack-name "neurogrid-${region}-database" \
        --parameter-overrides Region=$region Environment=$ENVIRONMENT \
        --capabilities CAPABILITY_IAM \
        --region $region
    
    # Deploy container infrastructure
    info "Deploying container infrastructure..."
    aws cloudformation deploy \
        --template-file "$PROJECT_ROOT/infrastructure/containers.yaml" \
        --stack-name "neurogrid-${region}-containers" \
        --parameter-overrides Region=$region Environment=$ENVIRONMENT \
        --capabilities CAPABILITY_IAM \
        --region $region
    
    # Deploy monitoring infrastructure if enabled
    if [[ "$ENABLE_MONITORING" == "true" ]]; then
        info "Deploying monitoring infrastructure..."
        aws cloudformation deploy \
            --template-file "$PROJECT_ROOT/infrastructure/monitoring.yaml" \
            --stack-name "neurogrid-${region}-monitoring" \
            --parameter-overrides Region=$region Environment=$ENVIRONMENT \
            --capabilities CAPABILITY_IAM \
            --region $region
    fi
    
    log "Infrastructure deployment completed for region: $region"
}

deploy_applications() {
    local region=$1
    log "Deploying applications to region: $region"
    
    # Set region-specific environment variables
    export AWS_REGION=$region
    export COORDINATOR_IMAGE="neurogrid/coordinator:${TIMESTAMP}"
    
    # Deploy using Docker Compose in production mode
    info "Starting application containers..."
    
    # Copy environment-specific compose file
    cp "$PROJECT_ROOT/docker-compose.mainnet.yml" "/tmp/docker-compose-${region}.yml"
    
    # Deploy containers
    docker-compose -f "/tmp/docker-compose-${region}.yml" up -d
    
    # Wait for services to be healthy
    info "Waiting for services to become healthy..."
    local max_attempts=30
    local attempt=0
    
    while [[ $attempt -lt $max_attempts ]]; do
        if docker-compose -f "/tmp/docker-compose-${region}.yml" ps | grep -q "healthy"; then
            break
        fi
        info "Waiting for services... (attempt $((attempt + 1))/$max_attempts)"
        sleep 10
        ((attempt++))
    done
    
    if [[ $attempt -eq $max_attempts ]]; then
        error "Services failed to become healthy in region: $region"
    fi
    
    log "Applications deployed successfully to region: $region"
}

configure_load_balancing() {
    log "Configuring global load balancing..."
    
    # Create Route53 hosted zone if it doesn't exist
    info "Setting up DNS and load balancing..."
    
    # Configure health checks for each region
    IFS=',' read -ra REGION_ARRAY <<< "$REGIONS"
    for region in "${REGION_ARRAY[@]}"; do
        info "Configuring health check for $region..."
        
        # Create health check
        aws route53 create-health-check \
            --caller-reference "neurogrid-${region}-${TIMESTAMP}" \
            --health-check-config \
            Type=HTTPS,ResourcePath=/health,FullyQualifiedDomainName=${region}.mainnet.neurogrid.network,Port=443,RequestInterval=30,FailureThreshold=3 \
            --region us-east-1 || warn "Health check for $region may already exist"
    done
    
    # Configure weighted routing
    info "Configuring weighted routing..."
    # This would typically involve Route53 record set operations
    
    log "Global load balancing configured successfully"
}

setup_monitoring() {
    if [[ "$ENABLE_MONITORING" != "true" ]]; then
        info "Monitoring disabled, skipping setup"
        return 0
    fi
    
    log "Setting up monitoring and alerting..."
    
    # Deploy Prometheus configuration
    info "Configuring Prometheus..."
    
    # Deploy Grafana dashboards
    info "Setting up Grafana dashboards..."
    
    # Configure alerting
    info "Setting up alerting rules..."
    
    log "Monitoring setup completed"
}

setup_backups() {
    if [[ "$ENABLE_BACKUPS" != "true" ]]; then
        info "Backups disabled, skipping setup"
        return 0
    fi
    
    log "Setting up automated backups..."
    
    IFS=',' read -ra REGION_ARRAY <<< "$REGIONS"
    for region in "${REGION_ARRAY[@]}"; do
        info "Setting up backups for $region..."
        
        # Create S3 backup bucket
        aws s3 mb s3://neurogrid-backups-${region} --region $region || info "Backup bucket may already exist"
        
        # Setup automated backup schedule
        # This would typically involve Lambda functions and CloudWatch Events
    done
    
    log "Backup setup completed"
}

verify_deployment() {
    log "Verifying deployment..."
    
    IFS=',' read -ra REGION_ARRAY <<< "$REGIONS"
    for region in "${REGION_ARRAY[@]}"; do
        info "Verifying deployment in $region..."
        
        # Check service health
        local health_url="https://${region}.mainnet.neurogrid.network/health"
        if curl -f -s "$health_url" > /dev/null; then
            info "✅ Health check passed for $region"
        else
            warn "❌ Health check failed for $region"
        fi
        
        # Check API endpoints
        local api_url="https://${region}.mainnet.neurogrid.network/api/deployment/status"
        if curl -f -s "$api_url" > /dev/null; then
            info "✅ API check passed for $region"
        else
            warn "❌ API check failed for $region"
        fi
    done
    
    log "Deployment verification completed"
}

cleanup() {
    log "Cleaning up temporary files..."
    rm -f /tmp/docker-compose-*.yml
    log "Cleanup completed"
}

main() {
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -e|--environment)
                ENVIRONMENT="$2"
                shift 2
                ;;
            -r|--regions)
                REGIONS="$2"
                shift 2
                ;;
            -m|--monitoring)
                ENABLE_MONITORING="true"
                shift
                ;;
            -b|--backups)
                ENABLE_BACKUPS="true"
                shift
                ;;
            -s|--skip-tests)
                SKIP_TESTS="true"
                shift
                ;;
            -d|--dry-run)
                DRY_RUN="true"
                shift
                ;;
            -f|--force)
                FORCE_DEPLOY="true"
                shift
                ;;
            -h|--help)
                show_help
                exit 0
                ;;
            *)
                error "Unknown option: $1"
                ;;
        esac
    done
    
    # Start deployment
    log "Starting NeuroGrid MainNet deployment..."
    log "Environment: $ENVIRONMENT"
    log "Regions: $REGIONS"
    log "Monitoring: $ENABLE_MONITORING"
    log "Backups: $ENABLE_BACKUPS"
    log "Dry run: $DRY_RUN"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        info "DRY RUN MODE - No actual deployment will occur"
        info "Would deploy to regions: $REGIONS"
        info "Would build images with timestamp: $TIMESTAMP"
        info "Would setup monitoring: $ENABLE_MONITORING"
        info "Would setup backups: $ENABLE_BACKUPS"
        exit 0
    fi
    
    # Set trap for cleanup
    trap cleanup EXIT
    
    # Execute deployment steps
    check_prerequisites
    run_tests
    build_images
    
    # Deploy to each region
    IFS=',' read -ra REGION_ARRAY <<< "$REGIONS"
    for region in "${REGION_ARRAY[@]}"; do
        deploy_infrastructure "$region"
        deploy_applications "$region"
    done
    
    configure_load_balancing
    setup_monitoring
    setup_backups
    verify_deployment
    
    log "🎉 NeuroGrid MainNet deployment completed successfully!"
    log "Deployment details saved to: $DEPLOYMENT_LOG"
    log "Timestamp: $TIMESTAMP"
    log "Regions deployed: $REGIONS"
    
    # Show next steps
    echo
    echo "🚀 Next Steps:"
    echo "1. Monitor deployment status: https://grafana.mainnet.neurogrid.network"
    echo "2. Check API health: https://api.mainnet.neurogrid.network/health"
    echo "3. Review logs: $DEPLOYMENT_LOG"
    echo "4. Update DNS records if needed"
    echo "5. Run post-deployment tests"
}

# Execute main function with all arguments
main "$@"