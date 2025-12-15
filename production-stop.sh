#!/bin/bash

# NeuroGrid Production Stop Script

echo "🛑 Stopping NeuroGrid Production..."

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Создание директорий если их нет
mkdir -p ./pids
mkdir -p ./logs

# Функция для остановки процесса
stop_process() {
    local pid_file=$1
    local process_name=$2
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p $pid > /dev/null 2>&1; then
            echo -e "${YELLOW}Stopping $process_name (PID: $pid)...${NC}"
            kill $pid
            sleep 2
            
            # Принудительное завершение если нужно
            if ps -p $pid > /dev/null 2>&1; then
                echo -e "${RED}Force stopping $process_name...${NC}"
                kill -9 $pid
            fi
            echo -e "${GREEN}✅ $process_name stopped${NC}"
        else
            echo -e "${YELLOW}⚠️ $process_name was not running${NC}"
        fi
        rm -f "$pid_file"
    else
        echo -e "${YELLOW}⚠️ No PID file found for $process_name${NC}"
    fi
}

# Остановка сервисов
stop_process "./pids/web-interface.pid" "Web Interface"
stop_process "./pids/enhanced-server.pid" "Enhanced Server"

# Дополнительная очистка процессов
echo -e "${BLUE}🧹 Additional cleanup...${NC}"

# Завершение всех node процессов NeuroGrid
pkill -f "enhanced-server.js" 2>/dev/null || true
pkill -f "next dev" 2>/dev/null || true
pkill -f "next start" 2>/dev/null || true

# Проверка портов
echo -e "${BLUE}🔍 Checking ports...${NC}"

if lsof -i :8080 >/dev/null 2>&1; then
    echo -e "${RED}❌ Port 8080 is still in use${NC}"
else
    echo -e "${GREEN}✅ Port 8080 is free${NC}"
fi

if lsof -i :3000 >/dev/null 2>&1; then
    echo -e "${RED}❌ Port 3000 is still in use${NC}"
else
    echo -e "${GREEN}✅ Port 3000 is free${NC}"
fi

echo ""
echo -e "${GREEN}🎉 NeuroGrid Production Stopped Successfully!${NC}"
echo ""
echo -e "${BLUE}📋 Log files preserved in:${NC}"
echo -e "   Enhanced Server: ${YELLOW}logs/enhanced-server.log${NC}"
echo -e "   Web Interface: ${YELLOW}logs/web-interface.log${NC}"