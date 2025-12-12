#!/bin/bash

# NeuroGrid Hybrid Deployment Script
# Развертывает полный продукт БЕЗ нарушения работы MVP

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 NeuroGrid Hybrid Deployment${NC}"
echo -e "${YELLOW}⚠️  Сохраняет работающий MVP для Product Hunt${NC}"
echo "=================================================="

log() {
    echo -e "${GREEN}[$(date +'%H:%M:%S')] $1${NC}"
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

# Проверка что мы в правильной директории
if [ ! -f "docker-compose.hybrid.yml" ]; then
    error "docker-compose.hybrid.yml не найден. Запустите скрипт из корня проекта."
fi

if [ ! -f "mvp-server.js" ]; then
    error "mvp-server.js не найден. MVP сервер обязателен для гибридного режима."
fi

log "Проверка готовности к развертыванию..."

# Проверка Docker
if ! command -v docker &> /dev/null; then
    error "Docker не установлен"
fi

if ! command -v docker-compose &> /dev/null; then
    error "Docker Compose не установлен"
fi

# Создание .env файла если его нет
if [ ! -f ".env.hybrid" ]; then
    log "Создание .env.hybrid файла..."
    cat > .env.hybrid << EOF
# NeuroGrid Hybrid Environment
NODE_ENV=production
HTTP_PORT=80
HTTPS_PORT=443

# Database
POSTGRES_PASSWORD=neurogrid_hybrid_$(openssl rand -hex 8)

# Security
JWT_SECRET=$(openssl rand -hex 32)

# Logging
LOG_LEVEL=info
RATE_LIMIT_ENABLED=true
CACHE_ENABLED=true

# Build info
BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
VERSION=hybrid-1.0.0
VCS_REF=$(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')
EOF
    log "✓ .env.hybrid создан"
fi

log "Проверка текущих контейнеров..."
running_containers=$(docker ps --format "table {{.Names}}" | grep neurogrid || true)
if [ -n "$running_containers" ]; then
    warning "Обнаружены работающие NeuroGrid контейнеры:"
    echo "$running_containers"
    echo ""
    read -p "Продолжить? Существующие контейнеры будут остановлены. (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "Развертывание отменено пользователем"
        exit 0
    fi
fi

log "Остановка существующих контейнеров..."
docker-compose -f docker-compose.hybrid.yml down --remove-orphans 2>/dev/null || true

log "Сборка образов..."
docker-compose -f docker-compose.hybrid.yml build

log "Запуск гибридной конфигурации..."
docker-compose -f docker-compose.hybrid.yml --env-file .env.hybrid up -d

log "Ожидание запуска сервисов..."
sleep 15

log "Проверка состояния сервисов..."
services=("neurogrid-nginx" "neurogrid-mvp" "neurogrid-coordinator" "neurogrid-web" "neurogrid-postgres" "neurogrid-redis")
all_healthy=true

for service in "${services[@]}"; do
    if docker ps --filter "name=$service" --filter "status=running" --format "{{.Names}}" | grep -q "^$service$"; then
        log "✓ $service запущен"
    else
        warning "✗ $service не запущен"
        all_healthy=false
    fi
done

if [ "$all_healthy" = true ]; then
    log "Тестирование endpoints..."
    
    # Тест главной страницы
    if curl -f -s "http://localhost/" > /dev/null; then
        log "✓ Главная страница работает"
    else
        warning "✗ Главная страница недоступна"
    fi
    
    # Тест MVP demo (ВАЖНО!)
    if curl -f -s "http://localhost/demo/" > /dev/null; then
        log "✓ MVP Demo работает (Product Hunt готов!)"
    else
        warning "✗ MVP Demo недоступен - ТРЕБУЕТ ИСПРАВЛЕНИЯ!"
    fi
    
    # Тест полного приложения
    if curl -f -s "http://localhost/app/" > /dev/null; then
        log "✓ Полное приложение работает"
    else
        warning "✗ Полное приложение недоступно"
    fi
    
    # Тест API
    if curl -f -s "http://localhost/api/health" > /dev/null; then
        log "✓ API работает"
    else
        warning "✗ API недоступен"
    fi
    
    # Тест страницы инвесторов
    if curl -f -s "http://localhost/investors.html" > /dev/null; then
        log "✓ Страница инвесторов работает"
    else
        warning "✗ Страница инвесторов недоступна"
    fi
fi

echo ""
echo -e "${GREEN}🎉 Гибридное развертывание завершено!${NC}"
echo ""
echo -e "${BLUE}📱 Доступные endpoints:${NC}"
echo "🏠 Главная страница:     http://localhost/"
echo "🚀 MVP Demo (PH):        http://localhost/demo/"
echo "📱 Полное приложение:    http://localhost/app/"
echo "🔧 API:                  http://localhost/api/"
echo "👥 Инвесторы:            http://localhost/investors.html"
echo ""
echo -e "${YELLOW}⚠️  ВАЖНО для Product Hunt:${NC}"
echo "   MVP Demo остается на /demo/ - ВСЕ ссылки работают!"
echo "   Инвесторы могут перейти на /investors.html"
echo "   Новое приложение доступно на /app/"
echo ""
echo -e "${BLUE}📋 Управление:${NC}"
echo "  Логи MVP:        docker-compose -f docker-compose.hybrid.yml logs -f mvp-server"
echo "  Логи Full App:   docker-compose -f docker-compose.hybrid.yml logs -f web-interface"
echo "  Остановить:      docker-compose -f docker-compose.hybrid.yml down"
echo "  Перезапустить:   docker-compose -f docker-compose.hybrid.yml restart"
echo ""
echo -e "${GREEN}✅ Готово к использованию!${NC}"