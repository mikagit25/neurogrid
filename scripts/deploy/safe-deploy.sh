#!/bin/bash

# NeuroGrid Safe Deployment Script
# Бережно обновляет файлы не ломая текущую рабочую систему
# Сохраняет PM2 процесс neurogrid на порту 8080

set -e

# Configuration
SERVER_IP="37.77.106.215"
SERVER_USER="root"
SERVER_PATH="/root/neurogrid/neurogrid-main/deploy"
BACKUP_PATH="/root/neurogrid-backups"

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

# Check SSH connection
check_connection() {
    print_status "🔌 Проверка подключения к серверу..."
    if ! ssh -o ConnectTimeout=5 ${SERVER_USER}@${SERVER_IP} "echo 'Connection OK'" >/dev/null 2>&1; then
        print_error "Не удается подключиться к серверу $SERVER_IP"
        exit 1
    fi
    print_success "Подключение к серверу успешно"
}

# Create backup on server
create_backup() {
    print_status "💾 Создание backup текущих файлов..."
    BACKUP_DIR="${BACKUP_PATH}/backup-$(date +%Y%m%d-%H%M%S)"
    
    ssh ${SERVER_USER}@${SERVER_IP} "
        mkdir -p ${BACKUP_DIR}
        cp -r ${SERVER_PATH} ${BACKUP_DIR}/
        echo 'Backup создан в: ${BACKUP_DIR}'
    "
    
    print_success "Backup создан: ${BACKUP_DIR}"
}

# Check current system status
check_system_status() {
    print_status "🔍 Проверка текущего статуса системы..."
    
    ssh ${SERVER_USER}@${SERVER_IP} "
        echo '=== PM2 Status ==='
        pm2 list | grep neurogrid || echo 'neurogrid процесс не найден'
        
        echo '=== Port 8080 Status ==='
        sudo netstat -tlnp | grep ':8080' || echo 'Порт 8080 не слушается'
        
        echo '=== Nginx Status ==='
        sudo nginx -t && echo 'Nginx конфиг OK' || echo 'Nginx конфиг ОШИБКА'
        
        echo '=== Current Landing Page Size ==='
        wc -l ${SERVER_PATH}/landing-page.html 2>/dev/null || echo 'landing-page.html не найден'
    "
}

# Deploy specific files safely
deploy_files() {
    print_status "📤 Безопасная загрузка обновленных файлов..."
    
    # Only deploy essential files that we know are good
    FILES_TO_DEPLOY=(
        "deploy/landing-page.html"
        "deploy/investors.html" 
        "deploy/demo-client.html"
        "deploy/api-docs.html"
        "deploy/technical-docs.html"
        "deploy/about-project.html"
    )
    
    for file in "${FILES_TO_DEPLOY[@]}"; do
        if [ -f "$file" ]; then
            print_status "Загружаем: $file"
            scp "$file" ${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/$(basename "$file")
        else
            print_warning "Файл не найден локально: $file"
        fi
    done
}

# Update nginx config safely (only if needed)
update_nginx_config() {
    print_status "🔧 Проверка nginx конфигурации..."
    
    # Only update if we have a newer config
    if [ -f "deploy/nginx-hybrid.conf" ]; then
        print_status "Загружаем обновленный nginx конфиг..."
        scp deploy/nginx-hybrid.conf ${SERVER_USER}@${SERVER_IP}:/tmp/nginx-hybrid-new.conf
        
        ssh ${SERVER_USER}@${SERVER_IP} "
            # Test the new config first
            sudo cp /tmp/nginx-hybrid-new.conf /etc/nginx/sites-available/neurogrid-hybrid-new.conf
            sudo nginx -t -c /etc/nginx/nginx.conf || {
                echo 'Новый nginx конфиг некорректен, откатываемся'
                sudo rm -f /etc/nginx/sites-available/neurogrid-hybrid-new.conf
                exit 1
            }
            
            # If test passed, activate it
            sudo mv /etc/nginx/sites-available/neurogrid-hybrid-new.conf /etc/nginx/sites-available/neurogrid-hybrid.conf
            sudo ln -sf /etc/nginx/sites-available/neurogrid-hybrid.conf /etc/nginx/sites-enabled/neurogrid-hybrid.conf
            sudo nginx -t && sudo systemctl reload nginx
            echo 'Nginx конфиг обновлен'
        "
    else
        print_warning "nginx-hybrid.conf не найден локально, пропускаем"
    fi
}

# Restart only if needed
restart_services() {
    print_status "🔄 Мягкий перезапуск сервисов (только если нужно)..."
    
    ssh ${SERVER_USER}@${SERVER_IP} "
        # Check if neurogrid process is running healthy
        if pm2 describe neurogrid >/dev/null 2>&1; then
            echo 'PM2 процесс neurogrid найден, перезапускаем...'
            pm2 restart neurogrid
            sleep 3
            pm2 logs neurogrid --lines 5
        else
            echo 'PM2 процесс neurogrid не найден, возможно нужна настройка'
        fi
    "
}

# Health check
health_check() {
    print_status "🏥 Проверка работоспособности..."
    
    sleep 5
    
    # Check main site
    if curl -s -f "http://${SERVER_IP}:8080" >/dev/null; then
        print_success "✅ Главный сайт (порт 8080) работает"
    else
        print_error "❌ Главный сайт не отвечает"
        return 1
    fi
    
    # Check through nginx
    if curl -s -f "http://neurogrid.network" >/dev/null; then
        print_success "✅ Сайт через nginx работает"
    else
        print_warning "⚠️ Сайт через nginx не отвечает (возможно DNS еще обновляется)"
    fi
    
    # Check for MVP features
    print_status "Проверяем MVP функции..."
    if curl -s "http://neurogrid.network" | grep -q "investors\|demo" >/dev/null 2>&1; then
        print_success "✅ MVP функции (investors/demo) найдены"
    else
        print_warning "⚠️ MVP функции не найдены в ответе"
    fi
}

# Rollback function
rollback() {
    print_error "🔄 Откат изменений..."
    LATEST_BACKUP=$(ssh ${SERVER_USER}@${SERVER_IP} "ls -t ${BACKUP_PATH}/ | head -1")
    
    if [ -n "$LATEST_BACKUP" ]; then
        ssh ${SERVER_USER}@${SERVER_IP} "
            cp -r ${BACKUP_PATH}/${LATEST_BACKUP}/deploy/* ${SERVER_PATH}/
            pm2 restart neurogrid
        "
        print_success "Откат выполнен из backup: $LATEST_BACKUP"
    else
        print_error "Backup не найден для отката"
    fi
}

# Main deployment flow
main() {
    print_status "🚀 NeuroGrid Safe Deployment Script"
    print_warning "⚠️ Конкуренция с Telegram/TON - деплоим быстро но безопасно!"
    echo ""
    
    check_connection
    check_system_status
    create_backup
    
    print_status "📦 Начинаем безопасный деплой..."
    
    # Deploy files
    if deploy_files; then
        print_success "Файлы загружены"
    else
        print_error "Ошибка при загрузке файлов"
        rollback
        exit 1
    fi
    
    # Update nginx if needed
    if update_nginx_config; then
        print_success "Nginx обновлен"
    else
        print_warning "Nginx не обновлен (возможно не требовалось)"
    fi
    
    # Restart services
    if restart_services; then
        print_success "Сервисы перезапущены"
    else
        print_error "Ошибка при перезапуске сервисов"
        rollback
        exit 1
    fi
    
    # Final health check
    if health_check; then
        print_success "🎉 Деплой завершен успешно!"
        echo ""
        print_status "🌐 Проверьте сайт:"
        echo "   • http://neurogrid.network"
        echo "   • http://api.neurogrid.network" 
        echo "   • http://app.neurogrid.network"
        echo ""
        print_status "📊 Мониторинг:"
        echo "   • PM2: ssh ${SERVER_USER}@${SERVER_IP} 'pm2 status'"
        echo "   • Логи: ssh ${SERVER_USER}@${SERVER_IP} 'pm2 logs neurogrid'"
        echo ""
        print_warning "🚀 Готовы конкурировать с Telegram!"
    else
        print_error "Проблемы при проверке работоспособности"
        rollback
        exit 1
    fi
}

# Handle Ctrl+C
trap 'print_error "Деплой прерван пользователем"; rollback; exit 1' INT

# Run main function
main "$@"