#!/bin/bash

# NeuroGrid Production Server Deployment Script
# Подготавливает проект для размещения на реальном сервере

echo "🚀 Preparing NeuroGrid for Production Server Deployment"
echo "======================================================"

# Проверяем необходимые параметры
if [ -z "$DOMAIN" ]; then
    echo "⚠️  DOMAIN environment variable not set"
    echo "💡 Usage: DOMAIN=yourdomain.com PORT=80 ./prepare-production.sh"
    echo "💡 Example: DOMAIN=neurogrid.network PORT=443 SSL=true ./prepare-production.sh"
    exit 1
fi

# Параметры по умолчанию
PORT=${PORT:-80}
SSL=${SSL:-false}
API_PORT=${API_PORT:-3001}

# Определяем протокол
if [ "$SSL" = "true" ]; then
    PROTOCOL="https"
    DEFAULT_PORT=443
else
    PROTOCOL="http"
    DEFAULT_PORT=80
fi

# URL конфигурация
if [ "$PORT" = "$DEFAULT_PORT" ]; then
    BASE_URL="${PROTOCOL}://${DOMAIN}"
    API_URL="${BASE_URL}/api"
    WS_URL="${PROTOCOL/http/ws}://${DOMAIN}/ws"
else
    BASE_URL="${PROTOCOL}://${DOMAIN}:${PORT}"
    API_URL="${BASE_URL}/api"
    WS_URL="${PROTOCOL/http/ws}://${DOMAIN}:${PORT}/ws"
fi

echo "🌐 Production Configuration:"
echo "   Domain: $DOMAIN"
echo "   Port: $PORT"
echo "   SSL: $SSL"
echo "   Base URL: $BASE_URL"
echo "   API URL: $API_URL"
echo "   WebSocket URL: $WS_URL"
echo ""

# Создание production конфигурации
echo "⚙️  Creating production configuration files..."

# .env.production для основного сервера
cat > .env.production << EOF
# NeuroGrid Production Configuration
NODE_ENV=production
LOG_LEVEL=info

# Server Configuration
DOMAIN=$DOMAIN
PORT=$PORT
API_PORT=$API_PORT
SSL_ENABLED=$SSL

# URLs
BASE_URL=$BASE_URL
API_URL=$API_URL
WS_URL=$WS_URL

# Database (Production Ready)
DATABASE_TYPE=postgresql
DATABASE_URL=postgres://neurogrid:secure_password@localhost:5432/neurogrid_prod

# Redis (для кеширования и очередей)
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=$(openssl rand -base64 32)
API_RATE_LIMIT=1000

# External APIs (добавить реальные ключи)
OPENAI_API_KEY=""
HUGGINGFACE_API_KEY=""

# Monitoring
ENABLE_METRICS=true
ENABLE_LOGGING=true
LOG_FILE=logs/neurogrid-production.log

# Performance
MAX_WORKERS=4
CACHE_TTL=3600
EOF

# Production конфигурация для веб-интерфейса
mkdir -p web-interface/.next

cat > web-interface/.env.production << EOF
# NeuroGrid Web Interface Production
NEXT_PUBLIC_API_URL=$API_URL
NEXT_PUBLIC_WS_URL=$WS_URL
NEXT_PUBLIC_APP_URL=$BASE_URL

NODE_ENV=production
NEXT_PUBLIC_ENV=production

# Site Configuration
NEXT_PUBLIC_SITE_NAME="NeuroGrid - Decentralized AI Computing Platform"
NEXT_PUBLIC_SITE_DESCRIPTION="Democratizing AI computing through decentralized GPU networks"
NEXT_PUBLIC_SITE_URL=$BASE_URL
NEXT_PUBLIC_DOMAIN=$DOMAIN

# Features
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_MONITORING=true
NEXT_PUBLIC_ENABLE_ADMIN=true
NEXT_PUBLIC_ENABLE_DEBUG=false

# Performance
NEXT_PUBLIC_CACHE_ENABLED=true
NEXT_PUBLIC_CDN_ENABLED=true
EOF

# Обновление производственного скрипта запуска
cat > production-server-launch.sh << 'SCRIPT_EOF'
#!/bin/bash

# NeuroGrid Production Server Launch
# Для развертывания на реальном сервере

echo "🚀 Starting NeuroGrid Production Server"
echo "======================================"

# Загрузка production переменных
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v ^# | xargs)
    echo "✅ Production environment loaded"
else
    echo "❌ .env.production not found! Run prepare-production.sh first"
    exit 1
fi

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}📋 Production Configuration:${NC}"
echo "=================================="
echo -e "Domain: ${GREEN}$DOMAIN${NC}"
echo -e "Port: ${GREEN}$PORT${NC}"
echo -e "SSL: ${GREEN}$SSL_ENABLED${NC}"
echo -e "API URL: ${GREEN}$API_URL${NC}"
echo -e "Base URL: ${GREEN}$BASE_URL${NC}"
echo ""

# Проверка портов
check_port() {
    if lsof -i :$1 >/dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Port $1 is in use (this may be expected)${NC}"
        return 1
    else
        echo -e "${GREEN}✅ Port $1 is available${NC}"
        return 0
    fi
}

echo -e "${BLUE}🔍 Checking ports...${NC}"
check_port $API_PORT

# Создание необходимых директорий
mkdir -p logs pids

# Обновление конфигурации веб-интерфейса для production
echo -e "${BLUE}⚙️  Updating web interface configuration...${NC}"
cd web-interface

# Сборка production версии
echo -e "${BLUE}🏗️  Building optimized web interface...${NC}"
npm run build

# Запуск production сервера
echo -e "${BLUE}🌐 Starting production web server...${NC}"
nohup npm run start > ../logs/web-interface-production.log 2>&1 &
WEB_PID=$!
echo $WEB_PID > ../pids/web-interface.pid
echo -e "${GREEN}✅ Web Interface started (PID: $WEB_PID)${NC}"

cd ..

# Запуск Enhanced Server в production режиме
echo -e "${BLUE}🔧 Starting Enhanced Server (Production Mode)...${NC}"
NODE_ENV=production nohup node enhanced-server.js > logs/enhanced-server-production.log 2>&1 &
ENHANCED_PID=$!
echo $ENHANCED_PID > pids/enhanced-server.pid
echo -e "${GREEN}✅ Enhanced Server started (PID: $ENHANCED_PID)${NC}"

# Ждем запуска сервисов
sleep 5

# Проверка здоровья системы
echo -e "${BLUE}🏥 Production health checks...${NC}"

# Проверяем API сервер
API_CHECK_URL="$API_URL/health"
if curl -s "$API_CHECK_URL" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ API Server is healthy${NC}"
else
    echo -e "${RED}❌ API Server health check failed${NC}"
fi

# Проверяем веб-интерфейс
if curl -s "$BASE_URL" >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Web Interface is accessible${NC}"
else
    echo -e "${YELLOW}⚠️  Web Interface check failed (may still be starting)${NC}"
fi

# Финальная информация
echo ""
echo -e "${GREEN}🎉 NeuroGrid Production Server Launch Complete!${NC}"
echo "=========================================="
echo -e "${BLUE}🌐 Access URLs:${NC}"
echo -e "   Production Site: ${GREEN}$BASE_URL${NC}"
echo -e "   API Endpoint: ${GREEN}$API_URL${NC}"
echo -e "   Health Check: ${GREEN}$API_URL/health${NC}"
echo -e "   API Documentation: ${GREEN}$API_URL/docs${NC}"
echo ""
echo -e "${BLUE}📝 Process Management:${NC}"
echo -e "   Enhanced Server PID: ${GREEN}$ENHANCED_PID${NC}"
echo -e "   Web Interface PID: ${GREEN}$WEB_PID${NC}"
echo ""
echo -e "${BLUE}📊 Monitoring:${NC}"
echo -e "   Production Logs: ${YELLOW}tail -f logs/enhanced-server-production.log${NC}"
echo -e "   Web Logs: ${YELLOW}tail -f logs/web-interface-production.log${NC}"
echo -e "   Stop Services: ${YELLOW}./production-server-stop.sh${NC}"
echo ""
echo -e "${GREEN}🚀 NeuroGrid is now running in production mode at $BASE_URL${NC}"

SCRIPT_EOF

# Скрипт остановки production сервера
cat > production-server-stop.sh << 'STOP_EOF'
#!/bin/bash

echo "🛑 Stopping NeuroGrid Production Server"
echo "======================================"

# Остановка процессов по PID файлам
if [ -f pids/enhanced-server.pid ]; then
    PID=$(cat pids/enhanced-server.pid)
    if kill -0 $PID 2>/dev/null; then
        kill $PID
        echo "✅ Enhanced Server stopped (PID: $PID)"
    else
        echo "⚠️  Enhanced Server process not found"
    fi
    rm pids/enhanced-server.pid
fi

if [ -f pids/web-interface.pid ]; then
    PID=$(cat pids/web-interface.pid)
    if kill -0 $PID 2>/dev/null; then
        kill $PID
        echo "✅ Web Interface stopped (PID: $PID)"
    else
        echo "⚠️  Web Interface process not found"
    fi
    rm pids/web-interface.pid
fi

# Дополнительная очистка
pkill -f "node enhanced-server.js"
pkill -f "npm run start"

echo "🏁 NeuroGrid Production Server stopped"
STOP_EOF

# Делаем скрипты исполняемыми
chmod +x production-server-launch.sh
chmod +x production-server-stop.sh

# Обновление главной страницы для корректного отображения production URL
echo "🔧 Updating main page for production URLs..."

# Обновляем index.html для production
if [ -f web-interface/index.html ]; then
    # Заменяем статический блок с localhost на динамический
    sed -i '' 's|<div class="text-gray-300 font-mono text-sm">http://localhost:3000</div>|<div class="text-gray-300 font-mono text-sm" id="web-url">Loading...</div>|g' web-interface/index.html
    sed -i '' 's|<div class="text-gray-300 font-mono text-sm">http://localhost:3001</div>|<div class="text-gray-300 font-mono text-sm" id="api-url">Loading...</div>|g' web-interface/index.html
    
    echo "✅ Main page updated for dynamic URLs"
fi

# Создание Nginx конфигурации (опционально)
cat > nginx-neurogrid.conf << NGINX_EOF
# NeuroGrid Nginx Configuration
# Поместите в /etc/nginx/sites-available/neurogrid

server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    
    # Redirect HTTP to HTTPS (если используется SSL)
    if (\$host = $DOMAIN) {
        return 301 https://\$host\$request_uri;
    }
    
    return 404;
}

server {
    listen ${SSL:+443 ssl http2}${SSL:-80};
    server_name $DOMAIN www.$DOMAIN;
    
    # SSL настройки (если SSL=true)
    ${SSL:+ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;}
    ${SSL:+ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;}
    ${SSL:+ssl_protocols TLSv1.2 TLSv1.3;}
    ${SSL:+ssl_ciphers HIGH:!aNULL:!MD5;}
    
    # Статические файлы (веб-интерфейс)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
    
    # API endpoints
    location /api/ {
        proxy_pass http://localhost:$API_PORT/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        
        # CORS headers для API
        add_header 'Access-Control-Allow-Origin' '*';
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE';
        add_header 'Access-Control-Allow-Headers' 'Origin, X-Requested-With, Content-Type, Accept, Authorization';
    }
    
    # WebSocket соединения
    location /ws {
        proxy_pass http://localhost:$API_PORT/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;
}
NGINX_EOF

echo ""
echo "✅ Production deployment preparation complete!"
echo ""
echo "📋 Next Steps:"
echo "1. Copy project files to your server"
echo "2. Install Node.js, npm, and dependencies"
echo "3. Run: DOMAIN=your-domain.com ./prepare-production.sh"
echo "4. Run: ./production-server-launch.sh"
echo "5. (Optional) Configure Nginx with nginx-neurogrid.conf"
echo ""
echo "🌐 Example usage:"
echo "   DOMAIN=neurogrid.network PORT=443 SSL=true ./prepare-production.sh"
echo "   ./production-server-launch.sh"
echo ""
echo "📊 Files created:"
echo "   - .env.production (server config)"
echo "   - web-interface/.env.production (web config)"
echo "   - production-server-launch.sh (start script)"
echo "   - production-server-stop.sh (stop script)"  
echo "   - nginx-neurogrid.conf (nginx config)"
