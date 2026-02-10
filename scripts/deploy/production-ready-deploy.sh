#!/bin/bash

# NeuroGrid Production Ready Deployment Script
# Универсальное развертывание для любого окружения

set -e

echo "🚀 NeuroGrid Production Deployment"
echo "=================================="

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }

# Определение окружения
determine_environment() {
    if [[ -n "${PRODUCTION}" ]] || [[ "${NODE_ENV}" == "production" ]]; then
        DEPLOY_ENV="production"
        export NODE_ENV=production
        export PORT=${PORT:-8080}
    elif [[ -n "${STAGING}" ]] || [[ "${NODE_ENV}" == "staging" ]]; then
        DEPLOY_ENV="staging"
        export NODE_ENV=staging
        export PORT=${PORT:-8081}
    else
        DEPLOY_ENV="development"
        export NODE_ENV=development
        export PORT=${PORT:-3001}
    fi
    
    # Настройка домена
    if [[ "${DEPLOY_ENV}" == "production" ]]; then
        export DOMAIN=${DOMAIN:-"neurogrid.network"}
        export HOST=${HOST:-"0.0.0.0"}
    else
        export DOMAIN=${DOMAIN:-"localhost"}
        export HOST=${HOST:-"localhost"}
    fi
    
    log_info "Environment: ${DEPLOY_ENV}"
    log_info "Domain: ${DOMAIN}:${PORT}"
}

# Проверка системных требований
check_requirements() {
    log_info "Checking requirements..."
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js not found!"
        exit 1
    fi
    
    NODE_VERSION=$(node --version)
    log_success "Node.js: $NODE_VERSION"
    
    if command -v docker &> /dev/null; then
        HAS_DOCKER=true
        log_success "Docker available"
    else
        HAS_DOCKER=false
        log_warning "Docker not found - using native deployment"
    fi
}

# Установка зависимостей
install_dependencies() {
    log_info "Installing dependencies..."
    
    if [[ "${CLEAN_INSTALL}" == "true" ]]; then
        rm -rf node_modules package-lock.json
        log_info "Cleaned node_modules"
    fi
    
    if [[ "${DEPLOY_ENV}" == "production" ]]; then
        npm ci --only=production --silent
    else
        npm install --silent
    fi
    
    log_success "Dependencies installed"
}

# Выбор сервера
select_server() {
    if [ -f "simple-universal-server.js" ]; then
        SERVER_FILE="simple-universal-server.js"
    elif [ -f "universal-server.js" ]; then
        SERVER_FILE="universal-server.js"
    elif [ -f "enhanced-server.js" ]; then
        SERVER_FILE="enhanced-server.js"
    elif [ -f "mvp-server.js" ]; then
        SERVER_FILE="mvp-server.js"
    else
        log_error "No server file found!"
        exit 1
    fi
    
    log_success "Using: ${SERVER_FILE}"
}

# Остановка существующих процессов
stop_existing() {
    log_info "Stopping existing processes..."
    
    # PM2
    if command -v pm2 &> /dev/null; then
        pm2 delete neurogrid 2>/dev/null || true
    fi
    
    # Прямые процессы
    pkill -f "${SERVER_FILE}" 2>/dev/null || true
    
    # Освобождение порта
    if lsof -Pi :${PORT} -sTCP:LISTEN -t >/dev/null; then
        log_warning "Port ${PORT} in use, stopping..."
        lsof -ti:${PORT} | xargs kill -9 2>/dev/null || true
        sleep 2
    fi
}

# Запуск сервера
start_server() {
    log_info "Starting NeuroGrid server..."
    
    if command -v pm2 &> /dev/null; then
        pm2 start ${SERVER_FILE} \
            --name neurogrid \
            --env ${NODE_ENV} \
            --max-memory-restart 500M \
            --log-date-format "YYYY-MM-DD HH:mm:ss Z"
        pm2 save
        log_success "Started with PM2"
    else
        nohup node ${SERVER_FILE} > neurogrid.log 2>&1 &
        SERVER_PID=$!
        echo $SERVER_PID > neurogrid.pid
        log_success "Started (PID: $SERVER_PID)"
    fi
}

# Health check
health_check() {
    log_info "Health check..."
    
    local attempts=20
    for i in $(seq 1 $attempts); do
        if curl -fs "http://${HOST}:${PORT}/health" >/dev/null 2>&1; then
            log_success "Server is healthy!"
            return 0
        fi
        echo -n "."
        sleep 3
    done
    
    log_error "Health check failed!"
    return 1
}

# Показать информацию о развертывании
show_info() {
    echo
    echo "🎉 NeuroGrid Deployed Successfully!"
    echo "=================================="
    echo
    echo "🌐 Access URLs:"
    echo "  Server: http://${DOMAIN}:${PORT}"
    echo "  API: http://${DOMAIN}:${PORT}/api"
    echo "  Health: http://${DOMAIN}:${PORT}/health"
    echo "  Config: http://${DOMAIN}:${PORT}/api/config"
    echo
    echo "🔧 Management:"
    if command -v pm2 &> /dev/null; then
        echo "  Status: pm2 status"
        echo "  Logs: pm2 logs neurogrid"
        echo "  Restart: pm2 restart neurogrid"
        echo "  Stop: pm2 stop neurogrid"
    else
        echo "  Logs: tail -f neurogrid.log"
        echo "  Stop: kill \$(cat neurogrid.pid)"
    fi
    echo
    echo "📊 Environment: ${DEPLOY_ENV}"
    echo "📁 Server: ${SERVER_FILE}"
    echo
}

# Главная функция
main() {
    # Обработка аргументов
    while [[ $# -gt 0 ]]; do
        case $1 in
            --production) export PRODUCTION=true; shift ;;
            --staging) export STAGING=true; shift ;;
            --clean) export CLEAN_INSTALL=true; shift ;;
            --domain=*) export DOMAIN="${1#*=}"; shift ;;
            --port=*) export PORT="${1#*=}"; shift ;;
            -h|--help)
                echo "Usage: $0 [OPTIONS]"
                echo "Options:"
                echo "  --production    Production mode"
                echo "  --staging      Staging mode"
                echo "  --clean        Clean install"
                echo "  --domain=NAME  Custom domain"
                echo "  --port=PORT    Custom port"
                exit 0 ;;
            *) log_error "Unknown option: $1"; exit 1 ;;
        esac
    done
    
    # Выполнение развертывания
    determine_environment
    check_requirements
    install_dependencies
    select_server
    stop_existing
    start_server
    
    if health_check; then
        show_info
        
        # Сохранение статуса
        cat > deployment-status.json << EOF
{
  "status": "deployed",
  "timestamp": "$(date -Iseconds)",
  "environment": "${DEPLOY_ENV}",
  "domain": "${DOMAIN}",
  "port": ${PORT},
  "server": "${SERVER_FILE}",
  "pid": $(cat neurogrid.pid 2>/dev/null || echo "null")
}
EOF
        
        log_success "Deployment complete!"
    else
        log_error "Deployment failed!"
        exit 1
    fi
}

# Запуск
main "$@"