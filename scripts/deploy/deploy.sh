#!/bin/bash

# NeuroGrid Automated Deployment Script
# Запускает сборку локально и деплоит на сервер

set -e

# Configuration
SERVER_IP="37.77.106.215"
SERVER_USER="root"  # or your server username
DEPLOY_PATH="/var/www/neurogrid"
BACKUP_PATH="/var/backups/neurogrid"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if SSH key exists
if [ ! -f ~/.ssh/id_rsa ]; then
    print_warning "SSH ключ не найден. Будет запрошен пароль."
fi

print_status "🚀 NeuroGrid Automated Deployment Starting..."

# Step 1: Build locally
print_status "📦 Шаг 1: Локальная сборка..."
./build-production.sh

if [ $? -ne 0 ]; then
    print_error "Ошибка при локальной сборке"
    exit 1
fi

# Step 2: Create backup on server
print_status "💾 Шаг 2: Создание backup на сервере..."
ssh ${SERVER_USER}@${SERVER_IP} "
    sudo mkdir -p ${BACKUP_PATH}
    if [ -d ${DEPLOY_PATH} ]; then
        sudo cp -r ${DEPLOY_PATH} ${BACKUP_PATH}/backup-\$(date +%Y%m%d-%H%M%S)
        echo 'Backup создан'
    else
        echo 'Первый деплой - backup не требуется'
    fi
"

# Step 3: Upload files
print_status "📤 Шаг 3: Загрузка файлов на сервер..."
scp -r dist/ ${SERVER_USER}@${SERVER_IP}:/tmp/neurogrid-deploy/

# Step 4: Deploy on server
print_status "🔧 Шаг 4: Деплой на сервере..."
ssh ${SERVER_USER}@${SERVER_IP} << 'EOF'
    set -e
    
    echo "Создание директорий..."
    sudo mkdir -p /var/www/neurogrid
    sudo mkdir -p /var/log/neurogrid
    
    echo "Копирование файлов..."
    sudo cp -r /tmp/neurogrid-deploy/* /var/www/neurogrid/
    
    echo "Настройка прав доступа..."
    sudo chown -R www-data:www-data /var/www/neurogrid
    sudo chmod -R 755 /var/www/neurogrid
    
    echo "Настройка логов..."
    sudo chown -R www-data:www-data /var/log/neurogrid
    sudo chmod -R 755 /var/log/neurogrid
    
    echo "Обновление nginx конфигурации..."
    if [ -f /var/www/neurogrid/nginx-hybrid.conf ]; then
        sudo cp /var/www/neurogrid/nginx-hybrid.conf /etc/nginx/sites-available/
        sudo ln -sf /etc/nginx/sites-available/nginx-hybrid.conf /etc/nginx/sites-enabled/
        sudo nginx -t && sudo systemctl reload nginx
        echo "Nginx обновлен"
    fi
    
    echo "Установка зависимостей..."
    cd /var/www/neurogrid
    sudo -u www-data ./install-production.sh
    
    echo "Настройка базы данных..."
    if [ -f setup-database.sql ]; then
        sudo -u postgres psql < setup-database.sql || echo "База данных уже настроена"
    fi
    
    echo "Остановка старых процессов..."
    pm2 stop neurogrid-coordinator neurogrid-web || true
    pm2 delete neurogrid-coordinator neurogrid-web || true
    
    echo "Запуск новых процессов..."
    cd /var/www/neurogrid
    pm2 start ecosystem.config.json
    pm2 save
    
    echo "Проверка статуса..."
    pm2 status
    
    echo "Очистка временных файлов..."
    rm -rf /tmp/neurogrid-deploy
    
    echo "✅ Деплой завершен!"
EOF

if [ $? -ne 0 ]; then
    print_error "Ошибка при деплое на сервере"
    exit 1
fi

# Step 5: Health check
print_status "🏥 Шаг 5: Проверка работоспособности..."
sleep 10

# Check API
print_status "Проверка API..."
if curl -s -f http://${SERVER_IP}:3001/health > /dev/null; then
    print_success "API работает"
else
    print_warning "API не отвечает (возможно еще запускается)"
fi

# Check Web App
print_status "Проверка Web App..."
if curl -s -f http://${SERVER_IP}:3000 > /dev/null; then
    print_success "Web App работает"
else
    print_warning "Web App не отвечает (возможно еще запускается)"
fi

# Final status
print_success "🎉 Деплой завершен успешно!"
echo ""
print_status "🌐 Доступные URL:"
echo "   • Основной сайт: http://neurogrid.network"
echo "   • API: http://api.neurogrid.network"
echo "   • Web App: http://app.neurogrid.network"
echo ""
print_status "📊 Мониторинг:"
echo "   • PM2 статус: ssh ${SERVER_USER}@${SERVER_IP} 'pm2 status'"
echo "   • Логи API: ssh ${SERVER_USER}@${SERVER_IP} 'pm2 logs neurogrid-coordinator'"
echo "   • Логи Web: ssh ${SERVER_USER}@${SERVER_IP} 'pm2 logs neurogrid-web'"
echo ""
print_warning "⚠️  Следующие шаги:"
echo "   1. Настроить SSL сертификаты: certbot --nginx -d api.neurogrid.network -d app.neurogrid.network"
echo "   2. Включить HTTPS редиректы в nginx"
echo "   3. Настроить мониторинг и бэкапы"

# Clean up local build
print_status "🧹 Очистка локальных файлов сборки..."
rm -rf dist/
print_success "Очистка завершена"