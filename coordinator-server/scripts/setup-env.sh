#!/bin/bash

# Environment Configuration Helper Script
# Helps set up and validate environment configuration

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[CONFIG]${NC} $1"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to generate secure random string
generate_secret() {
    local length=${1:-32}
    openssl rand -hex "$length" 2>/dev/null || head -c "$length" /dev/urandom | base64 | tr -d '\n=' | head -c "$length"
}

# Function to prompt for user input
prompt_input() {
    local prompt="$1"
    local default="$2"
    local secret="$3"
    
    if [ "$secret" = "true" ]; then
        echo -n "$prompt: "
        read -s input
        echo
    else
        if [ -n "$default" ]; then
            echo -n "$prompt [$default]: "
        else
            echo -n "$prompt: "
        fi
        read input
    fi
    
    if [ -z "$input" ] && [ -n "$default" ]; then
        echo "$default"
    else
        echo "$input"
    fi
}

# Function to setup development environment
setup_dev() {
    log "Setting up development environment..."
    
    cd "$PROJECT_ROOT"
    
    # Create .env file if it doesn't exist
    if [ ! -f .env ]; then
        log "Creating .env file from defaults..."
        cp .env.defaults .env
        
        # Generate development secrets
        log "Generating development secrets..."
        
        JWT_SECRET=$(generate_secret 32)
        SESSION_SECRET=$(generate_secret 32)
        DB_PASSWORD="dev_$(generate_secret 16)"
        REDIS_PASSWORD="redis_$(generate_secret 16)"
        
        # Add secrets to .env file
        {
            echo ""
            echo "# Generated secrets for development"
            echo "JWT_SECRET=$JWT_SECRET"
            echo "SESSION_SECRET=$SESSION_SECRET"
            echo "DB_PASSWORD=$DB_PASSWORD"
            echo "REDIS_PASSWORD=$REDIS_PASSWORD"
        } >> .env
        
        log "✅ Development environment configured"
    else
        warn ".env file already exists, skipping setup"
    fi
    
    # Create data directory for SQLite
    mkdir -p data
    
    # Create uploads directory
    mkdir -p uploads
    
    info "Development setup complete!"
    info "You can now run: npm run dev"
}

# Function to setup production environment
setup_prod() {
    log "Setting up production environment..."
    
    cd "$PROJECT_ROOT"
    
    if [ -f .env ]; then
        warn "Existing .env file found. Backing up to .env.backup"
        cp .env .env.backup
    fi
    
    log "Creating production .env file..."
    
    # Start with example file
    cp .env.example .env.temp
    
    # Interactive configuration
    info "Please provide production configuration values:"
    
    # Database configuration
    info "\n📊 Database Configuration:"
    DB_HOST=$(prompt_input "PostgreSQL host" "postgres")
    DB_PORT=$(prompt_input "PostgreSQL port" "5432")
    DB_NAME=$(prompt_input "Database name" "neurogrid")
    DB_USER=$(prompt_input "Database user" "neurogrid")
    DB_PASSWORD=$(prompt_input "Database password" "" "true")
    
    if [ -z "$DB_PASSWORD" ]; then
        DB_PASSWORD=$(generate_secret 24)
        warn "Generated random database password"
    fi
    
    # Redis configuration
    info "\n🔴 Redis Configuration:"
    REDIS_HOST=$(prompt_input "Redis host" "redis")
    REDIS_PORT=$(prompt_input "Redis port" "6379")
    REDIS_PASSWORD=$(prompt_input "Redis password" "" "true")
    
    if [ -z "$REDIS_PASSWORD" ]; then
        REDIS_PASSWORD=$(generate_secret 24)
        warn "Generated random Redis password"
    fi
    
    # Security secrets
    info "\n🔐 Security Configuration:"
    JWT_SECRET=$(generate_secret 32)
    SESSION_SECRET=$(generate_secret 32)
    
    # Domain configuration
    info "\n🌐 Domain Configuration:"
    DOMAIN=$(prompt_input "Domain name" "neurogrid.example.com")
    ALLOWED_ORIGINS=$(prompt_input "Allowed origins (comma-separated)" "https://$DOMAIN")
    
    # Email configuration
    info "\n📧 Email Configuration:"
    SMTP_HOST=$(prompt_input "SMTP host" "smtp.gmail.com")
    SMTP_PORT=$(prompt_input "SMTP port" "587")
    SMTP_USER=$(prompt_input "SMTP username" "")
    SMTP_PASS=$(prompt_input "SMTP password" "" "true")
    
    # Payment configuration
    info "\n💳 Payment Configuration (optional):"
    read -p "Enable Stripe payments? (y/n): " enable_stripe
    if [ "$enable_stripe" = "y" ]; then
        STRIPE_PUBLISHABLE_KEY=$(prompt_input "Stripe publishable key" "")
        STRIPE_SECRET_KEY=$(prompt_input "Stripe secret key" "" "true")
        STRIPE_WEBHOOK_SECRET=$(prompt_input "Stripe webhook secret" "" "true")
    fi
    
    # Generate production .env file
    {
        echo "# NeuroGrid Production Configuration"
        echo "# Generated on $(date)"
        echo ""
        echo "NODE_ENV=production"
        echo "PORT=3001"
        echo "LOG_LEVEL=info"
        echo ""
        echo "# Database Configuration"
        echo "DATABASE_URL=postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
        echo "DB_HOST=$DB_HOST"
        echo "DB_PORT=$DB_PORT"
        echo "DB_NAME=$DB_NAME"
        echo "DB_USER=$DB_USER"
        echo "DB_PASSWORD=$DB_PASSWORD"
        echo ""
        echo "# Redis Configuration"
        echo "REDIS_HOST=$REDIS_HOST"
        echo "REDIS_PORT=$REDIS_PORT"
        echo "REDIS_PASSWORD=$REDIS_PASSWORD"
        echo ""
        echo "# Security Configuration"
        echo "JWT_SECRET=$JWT_SECRET"
        echo "SESSION_SECRET=$SESSION_SECRET"
        echo ""
        echo "# Domain Configuration"
        echo "ALLOWED_ORIGINS=$ALLOWED_ORIGINS"
        echo ""
        if [ -n "$SMTP_USER" ]; then
            echo "# Email Configuration"
            echo "SMTP_HOST=$SMTP_HOST"
            echo "SMTP_PORT=$SMTP_PORT"
            echo "SMTP_USER=$SMTP_USER"
            echo "SMTP_PASS=$SMTP_PASS"
            echo ""
        fi
        if [ "$enable_stripe" = "y" ]; then
            echo "# Payment Configuration"
            echo "STRIPE_ENABLED=true"
            echo "STRIPE_PUBLISHABLE_KEY=$STRIPE_PUBLISHABLE_KEY"
            echo "STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY"
            echo "STRIPE_WEBHOOK_SECRET=$STRIPE_WEBHOOK_SECRET"
            echo ""
        fi
    } > .env
    
    # Clean up temp file
    rm -f .env.temp
    
    # Set secure permissions
    chmod 600 .env
    
    log "✅ Production environment configured"
    warn "🔒 Make sure to securely store your .env file and secrets!"
}

# Function to validate configuration
validate_config() {
    log "Validating configuration..."
    
    cd "$PROJECT_ROOT"
    
    # Use Node.js to validate configuration
    if node -e "
        const ConfigManager = require('./src/config/manager');
        
        async function validate() {
            try {
                const config = await ConfigManager.create();
                console.log('✅ Configuration is valid');
                process.exit(0);
            } catch (error) {
                console.error('❌ Configuration validation failed:', error.message);
                process.exit(1);
            }
        }
        
        validate();
    "; then
        log "✅ Configuration validation passed"
    else
        error "❌ Configuration validation failed"
        exit 1
    fi
}

# Function to show configuration (masked)
show_config() {
    log "Current configuration (secrets masked):"
    
    cd "$PROJECT_ROOT"
    
    node -e "
        const ConfigManager = require('./src/config/manager');
        
        async function show() {
            try {
                const config = await ConfigManager.create();
                const secureConfig = config.getSecure();
                
                console.log(JSON.stringify(secureConfig, null, 2));
            } catch (error) {
                console.error('Failed to load configuration:', error.message);
                process.exit(1);
            }
        }
        
        show();
    "
}

# Function to generate Docker secrets
generate_docker_secrets() {
    log "Generating Docker secrets..."
    
    cd "$PROJECT_ROOT"
    
    # Create secrets directory
    mkdir -p docker/secrets
    
    # Generate secret files
    generate_secret 32 > docker/secrets/jwt_secret
    generate_secret 32 > docker/secrets/session_secret
    generate_secret 24 > docker/secrets/db_password
    generate_secret 24 > docker/secrets/redis_password
    
    # Set secure permissions
    chmod 600 docker/secrets/*
    
    log "✅ Docker secrets generated in docker/secrets/"
    warn "🔒 These files contain sensitive data - do not commit to version control!"
}

# Function to clean configuration
clean_config() {
    log "Cleaning configuration files..."
    
    cd "$PROJECT_ROOT"
    
    read -p "This will remove .env files. Are you sure? (y/N): " confirm
    if [ "$confirm" = "y" ]; then
        rm -f .env .env.local .env.backup
        rm -rf docker/secrets
        log "✅ Configuration files cleaned"
    else
        log "Configuration cleaning cancelled"
    fi
}

# Function to show usage
usage() {
    echo "NeuroGrid Environment Configuration Helper"
    echo ""
    echo "Usage: $0 <command>"
    echo ""
    echo "Commands:"
    echo "  setup-dev       Setup development environment with defaults"
    echo "  setup-prod      Interactive production environment setup"
    echo "  validate        Validate current configuration"
    echo "  show            Show current configuration (secrets masked)"
    echo "  docker-secrets  Generate Docker secrets files"
    echo "  clean           Clean configuration files"
    echo ""
    echo "Examples:"
    echo "  $0 setup-dev          # Quick development setup"
    echo "  $0 setup-prod         # Interactive production setup"
    echo "  $0 validate           # Validate configuration"
    echo ""
}

# Main script
case "${1:-help}" in
    "setup-dev")
        setup_dev
        ;;
    "setup-prod")
        setup_prod
        ;;
    "validate")
        validate_config
        ;;
    "show")
        show_config
        ;;
    "docker-secrets")
        generate_docker_secrets
        ;;
    "clean")
        clean_config
        ;;
    "help"|*)
        usage
        exit 1
        ;;
esac