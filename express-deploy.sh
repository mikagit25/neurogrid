#!/bin/bash

# NeuroGrid EXPRESS Deploy - против конкуренции от Telegram/TON
# Молниеносное обновление только критических файлов

SERVER_IP="37.77.106.215"
SERVER_USER="root"
SERVER_PATH="/root/neurogrid/neurogrid-main/deploy"

echo "⚡ EXPRESS DEPLOY против Telegram конкуренции!"

# 1. Мгновенный backup
ssh ${SERVER_USER}@${SERVER_IP} "cp ${SERVER_PATH}/landing-page.html ${SERVER_PATH}/landing-page.html.backup"

# 2. Обновляем только landing page
if [ -f "deploy/landing-page.html" ]; then
    echo "📤 Обновляем главную страницу..."
    scp deploy/landing-page.html ${SERVER_USER}@${SERVER_IP}:${SERVER_PATH}/landing-page.html
fi

# 3. Быстрый рестарт
echo "🔄 Быстрый перезапуск..."
ssh ${SERVER_USER}@${SERVER_IP} "pm2 restart neurogrid"

# 4. Проверка
sleep 3
if curl -s http://neurogrid.network | grep -q "NeuroGrid"; then
    echo "✅ Сайт работает!"
    echo "🚀 Готовы к конкуренции с Telegram!"
else
    echo "❌ Проблема! Откатываемся..."
    ssh ${SERVER_USER}@${SERVER_IP} "cp ${SERVER_PATH}/landing-page.html.backup ${SERVER_PATH}/landing-page.html && pm2 restart neurogrid"
fi

echo "⚡ EXPRESS DEPLOY завершен!"