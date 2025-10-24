#!/bin/bash

# Docker Secrets Manager
# Manages secrets for Docker containers securely

set -e

SECRETS_DIR="/run/secrets"
ENV_FILE="/app/.env"
TEMP_ENV_FILE="/tmp/.env.temp"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[SECRETS]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[SECRETS]${NC} $1"
}

error() {
    echo -e "${RED}[SECRETS]${NC} $1"
}

# Function to check if running in Docker
is_docker() {
    [ -f /.dockerenv ] || grep -q docker /proc/1/cgroup 2>/dev/null
}

# Function to load Docker secrets
load_docker_secrets() {
    if [ ! -d "$SECRETS_DIR" ]; then
        warn "Docker secrets directory not found: $SECRETS_DIR"
        return 0
    fi

    log "Loading Docker secrets from $SECRETS_DIR"
    
    # Define secret mappings (secret_file -> env_variable)
    declare -A secret_mappings=(
        ["jwt_secret"]="JWT_SECRET"
        ["db_password"]="DB_PASSWORD"
        ["redis_password"]="REDIS_PASSWORD"
        ["session_secret"]="SESSION_SECRET"
        ["stripe_secret_key"]="STRIPE_SECRET_KEY"
        ["stripe_webhook_secret"]="STRIPE_WEBHOOK_SECRET"
        ["paypal_client_secret"]="PAYPAL_CLIENT_SECRET"
        ["crypto_api_key"]="CRYPTO_API_KEY"
        ["exchange_rate_api_key"]="EXCHANGE_RATE_API_KEY"
        ["smtp_password"]="SMTP_PASS"
    )

    # Load secrets into environment
    for secret_file in "${!secret_mappings[@]}"; do
        secret_path="$SECRETS_DIR/$secret_file"
        env_var="${secret_mappings[$secret_file]}"
        
        if [ -f "$secret_path" ]; then
            secret_value=$(cat "$secret_path" | tr -d '\n\r')
            if [ -n "$secret_value" ]; then
                export "$env_var"="$secret_value"
                log "✅ Loaded secret: $env_var"
            else
                warn "Empty secret file: $secret_file"
            fi
        else
            warn "Secret file not found: $secret_file"
        fi
    done
}

# Function to generate random secrets for development
generate_dev_secrets() {
    log "Generating development secrets..."
    
    # Generate secure random strings
    export JWT_SECRET=$(openssl rand -hex 32)
    export SESSION_SECRET=$(openssl rand -hex 32)
    export DB_PASSWORD="dev_$(openssl rand -hex 16)"
    export REDIS_PASSWORD="redis_$(openssl rand -hex 16)"
    
    log "✅ Generated development secrets"
}

# Function to validate required secrets
validate_secrets() {
    local required_secrets=(
        "JWT_SECRET"
        "SESSION_SECRET"
    )
    
    local missing_secrets=()
    
    for secret in "${required_secrets[@]}"; do
        if [ -z "${!secret}" ]; then
            missing_secrets+=("$secret")
        fi
    done
    
    if [ ${#missing_secrets[@]} -gt 0 ]; then
        error "Missing required secrets: ${missing_secrets[*]}"
        return 1
    fi
    
    log "✅ All required secrets are available"
    return 0
}

# Function to create environment file from secrets
create_env_file() {
    log "Creating environment file with secrets..."
    
    # Start with base environment file if it exists
    if [ -f "$ENV_FILE.template" ]; then
        cp "$ENV_FILE.template" "$TEMP_ENV_FILE"
    else
        touch "$TEMP_ENV_FILE"
    fi
    
    # Add secrets to environment file
    {
        echo ""
        echo "# Secrets loaded by Docker secrets manager"
        echo "# Generated at $(date)"
        
        if [ -n "$JWT_SECRET" ]; then
            echo "JWT_SECRET=$JWT_SECRET"
        fi
        
        if [ -n "$SESSION_SECRET" ]; then
            echo "SESSION_SECRET=$SESSION_SECRET"
        fi
        
        if [ -n "$DB_PASSWORD" ]; then
            echo "DB_PASSWORD=$DB_PASSWORD"
        fi
        
        if [ -n "$REDIS_PASSWORD" ]; then
            echo "REDIS_PASSWORD=$REDIS_PASSWORD"
        fi
        
        if [ -n "$STRIPE_SECRET_KEY" ]; then
            echo "STRIPE_SECRET_KEY=$STRIPE_SECRET_KEY"
        fi
        
        if [ -n "$STRIPE_WEBHOOK_SECRET" ]; then
            echo "STRIPE_WEBHOOK_SECRET=$STRIPE_WEBHOOK_SECRET"
        fi
        
        if [ -n "$PAYPAL_CLIENT_SECRET" ]; then
            echo "PAYPAL_CLIENT_SECRET=$PAYPAL_CLIENT_SECRET"
        fi
        
        if [ -n "$CRYPTO_API_KEY" ]; then
            echo "CRYPTO_API_KEY=$CRYPTO_API_KEY"
        fi
        
        if [ -n "$EXCHANGE_RATE_API_KEY" ]; then
            echo "EXCHANGE_RATE_API_KEY=$EXCHANGE_RATE_API_KEY"
        fi
        
        if [ -n "$SMTP_PASS" ]; then
            echo "SMTP_PASS=$SMTP_PASS"
        fi
        
    } >> "$TEMP_ENV_FILE"
    
    # Move temp file to final location
    mv "$TEMP_ENV_FILE" "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    
    log "✅ Environment file created: $ENV_FILE"
}

# Function to clean up secrets from memory
cleanup_secrets() {
    log "Cleaning up secrets from environment..."
    
    local secret_vars=(
        "JWT_SECRET"
        "SESSION_SECRET"
        "DB_PASSWORD"
        "REDIS_PASSWORD"
        "STRIPE_SECRET_KEY"
        "STRIPE_WEBHOOK_SECRET"
        "PAYPAL_CLIENT_SECRET"
        "CRYPTO_API_KEY"
        "EXCHANGE_RATE_API_KEY"
        "SMTP_PASS"
    )
    
    for var in "${secret_vars[@]}"; do
        unset "$var"
    done
    
    log "✅ Secrets cleaned from environment"
}

# Function to rotate secrets (for production use)
rotate_secrets() {
    warn "Secret rotation is not implemented yet"
    warn "This should be handled by your secrets management system"
}

# Main function
main() {
    case "${1:-load}" in
        "load")
            log "Loading secrets..."
            
            if is_docker; then
                load_docker_secrets
            else
                if [ "$NODE_ENV" = "development" ]; then
                    generate_dev_secrets
                else
                    warn "Not running in Docker and not in development mode"
                    warn "Secrets should be provided via environment variables"
                fi
            fi
            
            if ! validate_secrets; then
                exit 1
            fi
            
            log "✅ Secrets loaded successfully"
            ;;
            
        "generate-env")
            main load
            create_env_file
            cleanup_secrets
            ;;
            
        "validate")
            if validate_secrets; then
                log "✅ All secrets are valid"
                exit 0
            else
                error "❌ Secret validation failed"
                exit 1
            fi
            ;;
            
        "rotate")
            rotate_secrets
            ;;
            
        "cleanup")
            cleanup_secrets
            ;;
            
        *)
            echo "Usage: $0 {load|generate-env|validate|rotate|cleanup}"
            echo ""
            echo "Commands:"
            echo "  load         Load secrets from Docker secrets or generate for dev"
            echo "  generate-env Create .env file with loaded secrets"
            echo "  validate     Validate that all required secrets are available"
            echo "  rotate       Rotate secrets (placeholder)"
            echo "  cleanup      Remove secrets from environment variables"
            exit 1
            ;;
    esac
}

# Run main function
main "$@"