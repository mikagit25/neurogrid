# 🚀 NeuroGrid Smart Router - Production Deployment Guide

## 🌍 Multi-Environment Support

Система теперь полностью адаптирована для работы в разных окружениях:

### ✅ **Автоматическое определение окружения:**
- **Development**: `localhost:8080` → HTTP, полная отладка
- **Staging**: `staging.neurogrid.network` → HTTPS, тестирование
- **Production**: `neurogrid.network` → HTTPS, оптимизация

## 🔧 Подготовка к деплою

### 1. Запуск скрипта конфигурации
```bash
./deploy-production-config.sh
```

Этот скрипт создает:
- `.env.production` - настройки для продакшена
- `.env.staging` - настройки для стейджинга
- Обновляет `package.json` с новыми скриптами

### 2. Проверка файлов конфигурации

**`.env.production`:**
```bash
NODE_ENV=production
DOMAIN=neurogrid.network
PORT=8080
CORS_ORIGINS=https://neurogrid.network,https://www.neurogrid.network
API_BASE_URL=https://neurogrid.network/api
WS_BASE_URL=wss://neurogrid.network/ws
ENABLE_HTTPS=true
ENABLE_SSL_REDIRECT=true
ENABLE_ANALYTICS=true
ENABLE_DEBUG=false
```

### 3. Настройка API ключей (опционально)
```bash
# Добавьте в .env.production
OPENAI_API_KEY=your_actual_openai_key_here
ANTHROPIC_API_KEY=your_actual_anthropic_key_here
```

## 🌐 Варианты деплоя

### Вариант 1: Прямой деплой на сервер
```bash
# На продакшен сервере
git clone https://github.com/your-org/neurogrid.git
cd neurogrid
npm install
npm run start:production
```

### Вариант 2: С помощью PM2 (рекомендуется)
```bash
npm install -g pm2
pm2 start ecosystem.config.js --env production
```

### Вариант 3: Docker деплой
```bash
# Используйте существующий docker-compose.production.yml
docker-compose -f docker-compose.production.yml up -d
```

## 🔒 Настройка HTTPS/SSL

### Option 1: Nginx Proxy (рекомендуется)
```nginx
server {
    listen 443 ssl;
    server_name neurogrid.network;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Option 2: CloudFlare (самый простой)
1. Добавьте домен в CloudFlare
2. Включите SSL/TLS
3. Настройте DNS записи:
   - `A record: @ → YOUR_SERVER_IP`
   - `A record: www → YOUR_SERVER_IP`

### Option 3: Let's Encrypt
```bash
sudo certbot --nginx -d neurogrid.network -d www.neurogrid.network
```

## 🎯 Тестирование продакшен деплоя

### 1. Проверка основных endpoints
```bash
# Health check
curl https://neurogrid.network/health

# Smart AI processing
curl -X POST https://neurogrid.network/api/ai/process \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Test production deployment", 
    "type": "chat"
  }'

# Statistics
curl https://neurogrid.network/api/models/stats
```

### 2. Проверка веб-интерфейсов
- **Main Dashboard**: https://neurogrid.network/
- **Admin Panel**: https://neurogrid.network/admin.html

### 3. Проверка адаптивности
Система должна автоматически:
- ✅ Определить домен `neurogrid.network`
- ✅ Использовать HTTPS API URLs
- ✅ Настроить CORS для продакшен домена
- ✅ Отключить debug режим

## 📊 Мониторинг

### Логи приложения
```bash
# PM2 logs
pm2 logs neurogrid

# Если запущено напрямую
tail -f server.log
```

### Проверка производительности
```bash
# API response time
curl -w "@curl-format.txt" https://neurogrid.network/api/models/stats

# Load testing
curl -X POST https://neurogrid.network/api/ai/process \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Performance test", "type": "chat"}' \
  -w "Time: %{time_total}s\n"
```

## 🔑 Важные моменты

### ✅ **Что работает автоматически:**
- Адаптивное определение API URLs
- Правильная CORS конфигурация  
- Переключение между HTTP/HTTPS
- Environment-specific настройки

### ⚙️ **Что нужно настроить вручную:**
- DNS записи домена
- SSL сертификаты
- API ключи для OpenAI/Anthropic
- Firewall правила (порт 8080)

### 🛡️ **Безопасность:**
- CORS настроен только для neurogrid.network
- Debug отключен в продакшене
- Поддержка HTTPS редиректов
- Безопасное хранение API ключей

## 🎉 Готово!

После успешного деплоя ваш NeuroGrid Smart Router будет доступен:

- 🌐 **Website**: https://neurogrid.network
- 🛠️ **Admin**: https://neurogrid.network/admin.html
- 📡 **API**: https://neurogrid.network/api/*
- 🩺 **Health**: https://neurogrid.network/health

Система автоматически адаптируется к продакшен окружению и готова к обработке задач с полной функциональностью Smart Model Router!