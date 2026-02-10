#!/bin/bash

# NeuroGrid Universal Production Deployment Script
# Автоматическая настройка для любого домена и окружения

set -e  # Выходить при любой ошибке

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 NeuroGrid Universal Production Deployment${NC}"
echo "==============================================="

# Функция логирования
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

# Определение параметров развертывания
detect_environment() {
    log "🔍 Определяем окружение развертывания..."
    
    # Если передан аргумент - используем его как домен
    if [ ! -z "$1" ]; then
        export DOMAIN="$1"
        log "✅ Используем домен из аргумента: $DOMAIN"
    # Если есть переменная окружения - используем её
    elif [ ! -z "$DOMAIN" ]; then
        log "✅ Используем домен из переменной окружения: $DOMAIN"
    # Иначе пытаемся определить автоматически
    else
        # Проверяем, есть ли доступ к интернету и внешний IP
        EXTERNAL_IP=$(curl -s ifconfig.me 2>/dev/null || echo "")
        if [ ! -z "$EXTERNAL_IP" ]; then
            warn "⚠️ Внешний IP обнаружен: $EXTERNAL_IP"
            echo "Введите ваш домен (например, yourdomain.com) или нажмите Enter для localhost:"
            read -r USER_DOMAIN
            if [ ! -z "$USER_DOMAIN" ]; then
                export DOMAIN="$USER_DOMAIN"
            else
                export DOMAIN="localhost"
            fi
        else
            export DOMAIN="localhost"
        fi
        log "✅ Определен домен: $DOMAIN"
    fi
    
    # Определяем окружение на основе домена
    if [ "$DOMAIN" = "localhost" ] || [ "$DOMAIN" = "127.0.0.1" ]; then
        export NODE_ENV="development"
        export USE_HTTPS="false"
        export PORT="${PORT:-8080}"
    elif [[ "$DOMAIN" == *"staging"* ]] || [[ "$DOMAIN" == *"test"* ]]; then
        export NODE_ENV="staging"
        export USE_HTTPS="true"
        export PORT="${PORT:-80}"
    else
        export NODE_ENV="production"
        export USE_HTTPS="true"
        export PORT="${PORT:-80}"
    fi
    
    log "🌍 Окружение: $NODE_ENV"
    log "🏠 Домен: $DOMAIN"
    log "🔐 HTTPS: $USE_HTTPS"
    log "📍 Порт: $PORT"
}

# Создание .env файла для окружения
create_environment_config() {
    log "📝 Создание конфигурации окружения..."
    
    # Создаем .env файл с правильными настройками
    cat > .env << EOF
# NeuroGrid Production Environment Configuration
# Generated: $(date)
# Domain: $DOMAIN

NODE_ENV=$NODE_ENV
DOMAIN=$DOMAIN
PORT=$PORT
USE_HTTPS=$USE_HTTPS

# URLs Configuration
$(if [ "$NODE_ENV" = "development" ]; then
echo "API_URL=http://localhost:8080/api"
echo "WS_URL=ws://localhost:8080/ws"
echo "WEB_URL=http://localhost:3000"
else
echo "API_URL=https://$DOMAIN/api"
echo "WS_URL=wss://$DOMAIN/ws" 
echo "WEB_URL=https://$DOMAIN"
fi)

# CORS Configuration
$(if [ "$NODE_ENV" = "development" ]; then
echo "ALLOWED_ORIGINS=http://localhost:3000,http://localhost:8080,http://127.0.0.1:8080"
else
echo "ALLOWED_ORIGINS=https://$DOMAIN,http://$DOMAIN"
fi)

# Database Configuration
$(if [ "$NODE_ENV" = "development" ]; then
echo "POSTGRES_HOST=localhost"
echo "REDIS_HOST=localhost"
else
echo "POSTGRES_HOST=\${DB_HOST:-db}"
echo "REDIS_HOST=\${REDIS_HOST:-redis}"
fi)
POSTGRES_PORT=5432
POSTGRES_DB=neurogrid
POSTGRES_USER=neurogrid
POSTGRES_PASSWORD=neurogrid_secure_password

# Redis Configuration
REDIS_PORT=6379

# Security
JWT_SECRET=\${JWT_SECRET:-neurogrid_jwt_secret_$(openssl rand -hex 16)}

# Feature Flags
ENABLE_DEBUG=$([ "$NODE_ENV" = "development" ] && echo "true" || echo "false")
ENABLE_ANALYTICS=$([ "$NODE_ENV" = "production" ] && echo "true" || echo "false")
ENABLE_SSL=$USE_HTTPS
EOF

    log "✅ Конфигурация создана в .env"
}

# Обновление веб-интерфейса для production
update_web_interface() {
    log "🌐 Обновление веб-интерфейса..."
    
    # Создаем .env для веб-интерфейса
    mkdir -p web-interface
    cat > web-interface/.env.production << EOF
# NeuroGrid Web Interface Production Configuration
$(if [ "$NODE_ENV" = "development" ]; then
echo "NEXT_PUBLIC_API_URL=http://localhost:8080"
echo "NEXT_PUBLIC_WS_URL=ws://localhost:8080/ws"
echo "NEXT_PUBLIC_APP_URL=http://localhost:3000"
else
echo "NEXT_PUBLIC_API_URL=https://$DOMAIN"
echo "NEXT_PUBLIC_WS_URL=wss://$DOMAIN/ws"
echo "NEXT_PUBLIC_APP_URL=https://$DOMAIN"
fi)
NEXT_PUBLIC_NODE_ENV=$NODE_ENV
NEXT_PUBLIC_DOMAIN=$DOMAIN
EOF
    
    log "✅ Веб-интерфейс настроен для $DOMAIN"
}

# Проверка зависимостей
check_dependencies() {
    log "🔍 Проверка зависимостей..."
    
    # Node.js
    if ! command -v node &> /dev/null; then
        error "Node.js не установлен. Установите Node.js 16+ и попробуйте снова."
    fi
    
    # npm
    if ! command -v npm &> /dev/null; then
        error "npm не установлен. Установите npm и попробуйте снова."
    fi
    
    # Проверяем версию Node.js
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 16 ]; then
        error "Требуется Node.js версии 16 или выше. Текущая версия: $(node -v)"
    fi
    
    log "✅ Все зависимости в порядке"
}

# Установка пакетов
install_packages() {
    log "📦 Установка пакетов..."
    
    if [ -f "package.json" ]; then
        npm install --production
    else
        # Создаем минимальный package.json если его нет
        cat > package.json << EOF
{
  "name": "neurogrid",
  "version": "1.0.0",
  "description": "NeuroGrid Decentralized AI Computing Platform",
  "main": "enhanced-server.js",
  "scripts": {
    "start": "node enhanced-server.js",
    "dev": "NODE_ENV=development node enhanced-server.js",
    "production": "NODE_ENV=production node enhanced-server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "ws": "^8.13.0",
    "cors": "^2.8.5"
  },
  "keywords": ["ai", "blockchain", "gpu", "computing"],
  "author": "NeuroGrid Team",
  "license": "MIT"
}
EOF
        npm install
    fi
    
    log "✅ Пакеты установлены"
}

# Подготовка директорий и файлов
prepare_structure() {
    log "📁 Подготовка структуры проекта..."
    
    # Создаем необходимые директории
    mkdir -p src/config
    mkdir -p web-interface/public
    mkdir -p logs
    mkdir -p data
    
    # Копируем конфигурационный файл если он есть
    if [ -f "src/config/production-config.js" ]; then
        log "✅ Найден файл конфигурации"
    else
        warn "⚠️ Конфигурационный файл не найден, проверьте структуру проекта"
    fi
    
    log "✅ Структура проекта готова"
}

# Запуск сервера
start_server() {
    log "🚀 Запуск NeuroGrid сервера..."
    
    # Убиваем существующие процессы если они есть
    pkill -f "enhanced-server.js" 2>/dev/null || true
    pkill -f "node.*8080" 2>/dev/null || true
    
    # Ждем немного
    sleep 2
    
    # Запускаем сервер
    if [ "$NODE_ENV" = "development" ]; then
        log "🔧 Запуск в режиме разработки..."
        node enhanced-server.js &
    else
        log "🏭 Запуск в production режиме..."
        NODE_ENV=$NODE_ENV DOMAIN=$DOMAIN PORT=$PORT node enhanced-server.js &
    fi
    
    SERVER_PID=$!
    echo $SERVER_PID > .server.pid
    
    # Ждем запуска сервера
    log "⏳ Ожидание запуска сервера..."
    sleep 5
    
    # Проверяем, что сервер запущен
    if [ "$NODE_ENV" = "development" ]; then
        HEALTH_URL="http://localhost:8080/health"
    else
        HEALTH_URL="http://$DOMAIN:$PORT/health"
    fi
    
    if curl -s "$HEALTH_URL" >/dev/null; then
        log "✅ Сервер успешно запущен!"
    else
        error "❌ Не удалось запустить сервер. Проверьте логи."
    fi
}

# Показать результаты развертывания
show_results() {
    log "🎉 Развертывание завершено!"
    echo ""
    echo -e "${BLUE}📋 Информация о развертывании:${NC}"
    echo "==============================================="
    echo -e "   🌍 Окружение: ${GREEN}$NODE_ENV${NC}"
    echo -e "   🏠 Домен: ${GREEN}$DOMAIN${NC}"
    echo -e "   📍 Порт: ${GREEN}$PORT${NC}"
    echo -e "   🔐 HTTPS: ${GREEN}$USE_HTTPS${NC}"
    echo ""
    echo -e "${BLUE}🔗 Доступные URL:${NC}"
    if [ "$NODE_ENV" = "development" ]; then
        echo -e "   🌐 Главная: ${GREEN}http://localhost:8080/${NC}"
        echo -e "   🛠️  Админка: ${GREEN}http://localhost:8080/admin.html${NC}"
        echo -e "   📚 API Docs: ${GREEN}http://localhost:8080/api/docs${NC}"
        echo -e "   ❤️  Health: ${GREEN}http://localhost:8080/health${NC}"
    else
        PROTOCOL=$([ "$USE_HTTPS" = "true" ] && echo "https" || echo "http")
        echo -e "   🌐 Главная: ${GREEN}$PROTOCOL://$DOMAIN/${NC}"
        echo -e "   🛠️  Админка: ${GREEN}$PROTOCOL://$DOMAIN/admin.html${NC}"
        echo -e "   📚 API Docs: ${GREEN}$PROTOCOL://$DOMAIN/api/docs${NC}"
        echo -e "   ❤️  Health: ${GREEN}$PROTOCOL://$DOMAIN/health${NC}"
    fi
    echo ""
    echo -e "${BLUE}💡 Полезные команды:${NC}"
    echo "   Остановить: kill \$(cat .server.pid)"
    echo "   Логи: tail -f logs/neurogrid.log"
    echo "   Статус: curl -s $HEALTH_URL"
    echo ""
}

# Основная функция
main() {
    echo -e "${BLUE}🚀 Запуск универсального развертывания NeuroGrid${NC}"
    
    # Проверяем, передан ли домен как аргумент
    if [ ! -z "$1" ]; then
        log "📝 Используем домен из аргумента: $1"
    fi
    
    detect_environment "$1"
    check_dependencies
    create_environment_config
    update_web_interface
    prepare_structure
    install_packages
    start_server
    show_results
    
    log "🎉 Универсальное развертывание завершено!"
}

# Обработка сигналов для корректного завершения
trap 'echo ""; log "🛑 Развертывание прервано пользователем"; exit 1' INT

# Запуск основной функции
main "$@"