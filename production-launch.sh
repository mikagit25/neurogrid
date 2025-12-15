#!/bin/bash

# NeuroGrid Production Launch Script
# Простой запуск продукта для быстрого деплоя

echo "🚀 Launching NeuroGrid Production..."

# Загрузка production переменных
export $(cat .env.production.simple | xargs)

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📋 NeuroGrid Production Configuration${NC}"
echo "=================================="
echo -e "Node Environment: ${GREEN}$NODE_ENV${NC}"
echo -e "Server Port: ${GREEN}$SERVER_PORT${NC}"
echo -e "Web Port: ${GREEN}$WEB_PORT${NC}"
echo -e "API URL: ${GREEN}$API_URL${NC}"
echo -e "Web URL: ${GREEN}$WEB_URL${NC}"
echo ""

# Функция для проверки доступности порта
check_port() {
    if lsof -i :$1 >/dev/null 2>&1; then
        echo -e "${RED}❌ Port $1 is already in use${NC}"
        lsof -i :$1
        return 1
    else
        echo -e "${GREEN}✅ Port $1 is available${NC}"
        return 0
    fi
}

# Проверка портов
echo -e "${BLUE}🔍 Checking ports...${NC}"
check_port $SERVER_PORT
check_port $WEB_PORT

# Создание pid файлов
mkdir -p ./pids

# Запуск Enhanced Server
echo -e "${BLUE}🔧 Starting Enhanced Server...${NC}"
NODE_ENV=$NODE_ENV nohup node enhanced-server.js > ./logs/enhanced-server.log 2>&1 &
ENHANCED_PID=$!
echo $ENHANCED_PID > ./pids/enhanced-server.pid
echo -e "${GREEN}✅ Enhanced Server started (PID: $ENHANCED_PID)${NC}"

# Ждем запуска сервера
sleep 3

# Проверка здоровья сервера
echo -e "${BLUE}🏥 Checking Enhanced Server health...${NC}"
if curl -s http://localhost:$SERVER_PORT/health >/dev/null; then
    echo -e "${GREEN}✅ Enhanced Server is healthy${NC}"
else
    echo -e "${RED}❌ Enhanced Server failed to start${NC}"
    exit 1
fi

# Настройка web-interface для production
echo -e "${BLUE}⚙️ Configuring Web Interface...${NC}"
cd web-interface

# Обновление .env.production
cat > .env.production << EOF
NEXT_PUBLIC_API_URL=http://localhost:$SERVER_PORT
NEXT_PUBLIC_WS_URL=ws://localhost:$SERVER_PORT/ws
NEXT_PUBLIC_APP_URL=http://localhost:$WEB_PORT

NODE_ENV=production
NEXT_PUBLIC_ENV=production

# Production features
NEXT_PUBLIC_ENABLE_ANALYTICS=$ENABLE_ANALYTICS
NEXT_PUBLIC_ENABLE_MONITORING=$ENABLE_MONITORING
NEXT_PUBLIC_ENABLE_ADMIN=$ENABLE_ADMIN
NEXT_PUBLIC_ENABLE_DEBUG=$ENABLE_DEBUG

# Site info
NEXT_PUBLIC_SITE_NAME="NeuroGrid - AI Inference Platform"
NEXT_PUBLIC_SITE_DESCRIPTION="Decentralized AI inference network"
NEXT_PUBLIC_SITE_URL=http://localhost:$WEB_PORT
EOF

# Сборка production версии
echo -e "${BLUE}🏗️ Building Web Interface...${NC}"
npm run build

# Запуск production сервера
echo -e "${BLUE}🌐 Starting Web Interface (Production)...${NC}"
nohup npm run start > ../logs/web-interface.log 2>&1 &
WEB_PID=$!
echo $WEB_PID > ../pids/web-interface.pid
echo -e "${GREEN}✅ Web Interface started (PID: $WEB_PID)${NC}"

cd ..

# Ждем запуска web сервера
sleep 5

# Проверка доступности
echo -e "${BLUE}🔍 Final health checks...${NC}"

if curl -s http://localhost:$WEB_PORT >/dev/null; then
    echo -e "${GREEN}✅ Web Interface is accessible${NC}"
else
    echo -e "${YELLOW}⚠️ Web Interface might be still starting...${NC}"
fi

# Финальная информация
echo ""
echo -e "${GREEN}🎉 NeuroGrid Production Launch Complete!${NC}"
echo "================================="
echo -e "${BLUE}📊 Access URLs:${NC}"
echo -e "   Web Interface: ${GREEN}http://localhost:$WEB_PORT${NC}"
echo -e "   API Server: ${GREEN}http://localhost:$SERVER_PORT${NC}"
echo -e "   API Health: ${GREEN}http://localhost:$SERVER_PORT/health${NC}"
echo -e "   API Docs: ${GREEN}http://localhost:$SERVER_PORT/api/docs${NC}"
echo ""
echo -e "${BLUE}📝 Process Management:${NC}"
echo -e "   Enhanced Server PID: ${GREEN}$ENHANCED_PID${NC}"
echo -e "   Web Interface PID: ${GREEN}$WEB_PID${NC}"
echo ""
echo -e "${BLUE}🛠️ Management Commands:${NC}"
echo -e "   Stop all: ${YELLOW}./production-stop.sh${NC}"
echo -e "   View logs: ${YELLOW}tail -f logs/enhanced-server.log${NC}"
echo -e "   View logs: ${YELLOW}tail -f logs/web-interface.log${NC}"
echo ""
echo -e "${GREEN}🚀 NeuroGrid is now running in production mode!${NC}"