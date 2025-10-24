#!/bin/bash

# NeuroGrid Deployment Script
# Automates the deployment process for NeuroGrid infrastructure

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
NAMESPACE="neurogrid"
MONITORING_NAMESPACE="monitoring"

# Default values
ENVIRONMENT="development"
SKIP_TESTS=false
SKIP_BUILD=false
SCALE_REPLICAS=3
WAIT_TIMEOUT=300

# Help function
show_help() {
    cat << EOF
NeuroGrid Deployment Script

Usage: $0 [OPTIONS] COMMAND

Commands:
    dev         Deploy development environment with Docker Compose
    prod        Deploy production environment with Docker Compose
    k8s         Deploy to Kubernetes cluster
    staging     Deploy to staging Kubernetes environment
    production  Deploy to production Kubernetes environment
    clean       Clean up deployment resources
    status      Show deployment status
    logs        Show application logs
    scale       Scale application replicas

Options:
    -e, --env ENV           Environment (development|staging|production)
    -r, --replicas NUM      Number of replicas to deploy (default: 3)
    -t, --timeout SEC       Wait timeout in seconds (default: 300)
    --skip-tests           Skip running tests before deployment
    --skip-build           Skip building Docker images
    --dry-run              Show what would be deployed without executing
    -h, --help             Show this help message

Examples:
    $0 dev                          # Deploy development environment
    $0 k8s --env staging -r 5       # Deploy to K8s staging with 5 replicas
    $0 production --skip-tests      # Deploy to production without tests
    $0 scale -r 10                  # Scale application to 10 replicas
    $0 clean --env staging          # Clean up staging environment

EOF
}

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    local missing_tools=()
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        missing_tools+=("docker")
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        missing_tools+=("docker-compose")
    fi
    
    # Check kubectl for K8s deployments
    if [[ "$1" == "k8s" || "$1" == "staging" || "$1" == "production" ]]; then
        if ! command -v kubectl &> /dev/null; then
            missing_tools+=("kubectl")
        fi
    fi
    
    # Check Node.js and npm for tests
    if [[ "$SKIP_TESTS" == "false" ]]; then
        if ! command -v node &> /dev/null; then
            missing_tools+=("node")
        fi
        if ! command -v npm &> /dev/null; then
            missing_tools+=("npm")
        fi
    fi
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        log_error "Missing required tools: ${missing_tools[*]}"
        log_error "Please install the missing tools and try again."
        exit 1
    fi
    
    log_success "All prerequisites are met"
}

# Run tests
run_tests() {
    if [[ "$SKIP_TESTS" == "true" ]]; then
        log_warning "Skipping tests as requested"
        return
    fi
    
    log_info "Running tests..."
    
    cd "$PROJECT_ROOT/coordinator-server"
    
    # Install dependencies if needed
    if [[ ! -d "node_modules" ]]; then
        log_info "Installing dependencies..."
        npm ci
    fi
    
    # Run linting
    log_info "Running linting..."
    npm run lint
    
    # Run unit tests
    log_info "Running unit tests..."
    npm run test:unit
    
    # For integration tests, we need services running
    if command -v docker-compose &> /dev/null; then
        log_info "Starting test services..."
        cd "$PROJECT_ROOT"
        docker-compose -f docker-compose.test.yml up -d postgres redis
        
        # Wait for services
        sleep 10
        
        cd "$PROJECT_ROOT/coordinator-server"
        log_info "Running integration tests..."
        DATABASE_URL="postgresql://test_user:test123@localhost:5432/neurogrid_test" \
        REDIS_URL="redis://localhost:6379/1" \
        npm run test:integration
        
        # Clean up test services
        cd "$PROJECT_ROOT"
        docker-compose -f docker-compose.test.yml down
    else
        log_warning "Docker Compose not available, skipping integration tests"
    fi
    
    log_success "All tests passed"
}

# Build Docker images
build_images() {
    if [[ "$SKIP_BUILD" == "true" ]]; then
        log_warning "Skipping Docker build as requested"
        return
    fi
    
    log_info "Building Docker images..."
    
    cd "$PROJECT_ROOT"
    
    # Build coordinator image
    log_info "Building coordinator server image..."
    docker build -t neurogrid/coordinator:latest coordinator-server/
    
    # Build web interface image if exists
    if [[ -d "web-interface" ]]; then
        log_info "Building web interface image..."
        docker build -t neurogrid/web-interface:latest web-interface/
    fi
    
    # Build node client image if exists
    if [[ -d "node-client" ]]; then
        log_info "Building node client image..."
        docker build -t neurogrid/node-client:latest node-client/
    fi
    
    log_success "Docker images built successfully"
}

# Deploy development environment
deploy_dev() {
    log_info "Deploying development environment..."
    
    cd "$PROJECT_ROOT"
    
    # Stop any existing containers
    docker-compose -f docker-compose.dev.yml down 2>/dev/null || true
    
    # Start development environment
    docker-compose -f docker-compose.dev.yml up -d
    
    # Wait for services to be ready
    log_info "Waiting for services to be ready..."
    sleep 30
    
    # Health check
    if curl -f http://localhost:3001/api/monitoring/health &> /dev/null; then
        log_success "Development environment deployed successfully"
        log_info "Access the application at: http://localhost:3001"
        log_info "View logs with: docker-compose -f docker-compose.dev.yml logs -f"
    else
        log_error "Health check failed"
        exit 1
    fi
}

# Deploy production environment
deploy_prod() {
    log_info "Deploying production environment..."
    
    cd "$PROJECT_ROOT"
    
    # Check for required environment variables
    local required_vars=("POSTGRES_PASSWORD" "JWT_SECRET" "STRIPE_SECRET_KEY")
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        log_error "Missing required environment variables: ${missing_vars[*]}"
        log_error "Please set these variables and try again."
        exit 1
    fi
    
    # Stop any existing containers
    docker-compose -f docker-compose.production.yml down 2>/dev/null || true
    
    # Start production environment
    docker-compose -f docker-compose.production.yml up -d
    
    # Wait for services to be ready
    log_info "Waiting for services to be ready..."
    sleep 60
    
    # Health check
    if curl -f http://localhost:3001/api/monitoring/health &> /dev/null; then
        log_success "Production environment deployed successfully"
        log_info "Monitor the application at: http://localhost:3002 (Grafana)"
        log_info "View logs with: docker-compose -f docker-compose.production.yml logs -f"
    else
        log_error "Health check failed"
        exit 1
    fi
}

# Deploy to Kubernetes
deploy_k8s() {
    log_info "Deploying to Kubernetes ($ENVIRONMENT environment)..."
    
    cd "$PROJECT_ROOT"
    
    # Check if kubectl is configured
    if ! kubectl cluster-info &> /dev/null; then
        log_error "kubectl is not configured or cluster is not accessible"
        exit 1
    fi
    
    # Create namespaces
    log_info "Creating namespaces..."
    kubectl create namespace "$NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    kubectl create namespace "$MONITORING_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -
    
    # Deploy monitoring first
    log_info "Deploying monitoring stack..."
    kubectl apply -f k8s/monitoring-deployment.yaml
    
    # Deploy databases
    log_info "Deploying databases..."
    kubectl apply -f k8s/database-deployment.yaml
    
    # Wait for databases to be ready
    log_info "Waiting for databases to be ready..."
    kubectl wait --for=condition=ready pod -l app=postgres -n "$NAMESPACE" --timeout="${WAIT_TIMEOUT}s"
    kubectl wait --for=condition=ready pod -l app=redis -n "$NAMESPACE" --timeout="${WAIT_TIMEOUT}s"
    
    # Deploy application configuration
    log_info "Deploying application configuration..."
    kubectl apply -f k8s/coordinator-config.yaml
    
    # Deploy application
    log_info "Deploying coordinator application..."
    kubectl apply -f k8s/coordinator-deployment.yaml
    
    # Scale if requested
    if [[ "$SCALE_REPLICAS" != "3" ]]; then
        log_info "Scaling to $SCALE_REPLICAS replicas..."
        kubectl scale deployment neurogrid-coordinator --replicas="$SCALE_REPLICAS" -n "$NAMESPACE"
    fi
    
    # Wait for deployment to be ready
    log_info "Waiting for deployment to be ready..."
    kubectl rollout status deployment/neurogrid-coordinator -n "$NAMESPACE" --timeout="${WAIT_TIMEOUT}s"
    
    # Get service information
    local service_info
    service_info=$(kubectl get service neurogrid-coordinator-service -n "$NAMESPACE" -o jsonpath='{.spec.clusterIP}:{.spec.ports[0].port}')
    
    log_success "Kubernetes deployment completed successfully"
    log_info "Service available at: $service_info"
    log_info "Check status with: kubectl get pods -n $NAMESPACE"
    log_info "View logs with: kubectl logs -f deployment/neurogrid-coordinator -n $NAMESPACE"
}

# Show deployment status
show_status() {
    log_info "Deployment Status"
    echo
    
    if command -v docker-compose &> /dev/null; then
        log_info "Docker Compose Services:"
        docker-compose -f docker-compose.dev.yml ps 2>/dev/null || echo "  Development environment not running"
        echo
        docker-compose -f docker-compose.production.yml ps 2>/dev/null || echo "  Production environment not running"
        echo
    fi
    
    if command -v kubectl &> /dev/null && kubectl cluster-info &> /dev/null; then
        log_info "Kubernetes Resources:"
        kubectl get pods -n "$NAMESPACE" 2>/dev/null || echo "  No pods found in $NAMESPACE namespace"
        echo
        kubectl get services -n "$NAMESPACE" 2>/dev/null || echo "  No services found in $NAMESPACE namespace"
        echo
    fi
}

# Show logs
show_logs() {
    case "$ENVIRONMENT" in
        development)
            docker-compose -f docker-compose.dev.yml logs -f coordinator
            ;;
        production)
            if command -v kubectl &> /dev/null && kubectl cluster-info &> /dev/null; then
                kubectl logs -f deployment/neurogrid-coordinator -n "$NAMESPACE"
            else
                docker-compose -f docker-compose.production.yml logs -f coordinator
            fi
            ;;
        staging|k8s)
            kubectl logs -f deployment/neurogrid-coordinator -n "$NAMESPACE"
            ;;
    esac
}

# Scale application
scale_app() {
    log_info "Scaling application to $SCALE_REPLICAS replicas..."
    
    if command -v kubectl &> /dev/null && kubectl cluster-info &> /dev/null; then
        kubectl scale deployment neurogrid-coordinator --replicas="$SCALE_REPLICAS" -n "$NAMESPACE"
        kubectl rollout status deployment/neurogrid-coordinator -n "$NAMESPACE" --timeout="${WAIT_TIMEOUT}s"
        log_success "Scaled successfully to $SCALE_REPLICAS replicas"
    else
        docker-compose -f docker-compose.production.yml up -d --scale coordinator="$SCALE_REPLICAS"
        log_success "Scaled Docker Compose service to $SCALE_REPLICAS replicas"
    fi
}

# Clean up deployment
clean_deployment() {
    log_info "Cleaning up deployment resources..."
    
    case "$ENVIRONMENT" in
        development)
            docker-compose -f docker-compose.dev.yml down -v
            docker-compose -f docker-compose.test.yml down -v 2>/dev/null || true
            ;;
        production)
            docker-compose -f docker-compose.production.yml down -v
            ;;
        staging|k8s)
            if command -v kubectl &> /dev/null; then
                kubectl delete namespace "$NAMESPACE" --ignore-not-found
                kubectl delete namespace "$MONITORING_NAMESPACE" --ignore-not-found
            fi
            ;;
    esac
    
    log_success "Cleanup completed"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        -r|--replicas)
            SCALE_REPLICAS="$2"
            shift 2
            ;;
        -t|--timeout)
            WAIT_TIMEOUT="$2"
            shift 2
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        dev|development)
            COMMAND="dev"
            ENVIRONMENT="development"
            shift
            ;;
        prod|production)
            COMMAND="prod"
            ENVIRONMENT="production"
            shift
            ;;
        k8s|kubernetes)
            COMMAND="k8s"
            shift
            ;;
        staging)
            COMMAND="k8s"
            ENVIRONMENT="staging"
            shift
            ;;
        clean)
            COMMAND="clean"
            shift
            ;;
        status)
            COMMAND="status"
            shift
            ;;
        logs)
            COMMAND="logs"
            shift
            ;;
        scale)
            COMMAND="scale"
            shift
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Validate command
if [[ -z "$COMMAND" ]]; then
    log_error "No command specified"
    show_help
    exit 1
fi

# Main execution
log_info "Starting NeuroGrid deployment script"
log_info "Command: $COMMAND"
log_info "Environment: $ENVIRONMENT"

if [[ "$DRY_RUN" == "true" ]]; then
    log_warning "DRY RUN MODE - No actual deployment will occur"
    exit 0
fi

# Check prerequisites
check_prerequisites "$COMMAND"

# Execute command
case "$COMMAND" in
    dev)
        run_tests
        build_images
        deploy_dev
        ;;
    prod)
        run_tests
        build_images
        deploy_prod
        ;;
    k8s)
        run_tests
        build_images
        deploy_k8s
        ;;
    status)
        show_status
        ;;
    logs)
        show_logs
        ;;
    scale)
        scale_app
        ;;
    clean)
        clean_deployment
        ;;
    *)
        log_error "Unknown command: $COMMAND"
        exit 1
        ;;
esac

log_success "Deployment script completed successfully"