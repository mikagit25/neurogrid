# 🚀 NeuroGrid Quick Start Guide

## 🔧 Setup (5 минут)

### 1. Конфигурация API ключей

```bash
# 1. Проверить конфигурацию
./check-config.sh

# 2. Если нужно - отредактировать .env файл
nano .env
```

**Минимальная конфигурация (.env):**
```bash
# Основные настройки
NODE_ENV=development
DOMAIN=localhost
PORT=8080

# GitHub API ключ (ОБЯЗАТЕЛЬНО!)
GITHUB_TOKEN=your-github-token-here

# Дополнительные API (опционально)
ANTHROPIC_API_KEY=your-anthropic-key-here
OPENAI_API_KEY=your-openai-key-here
```

### 2. Получение GitHub Token (2 минуты)

1. Идите на https://github.com/settings/tokens
2. "Generate new token" → "Generate new token (classic)"
3. Выберите scopes: `read:user`
4. Скопируйте токен → добавьте в `.env` как `GITHUB_TOKEN=`

### 3. Запуск сервера

```bash
# Запуск
npm start

# Или с конкретным API ключом
GITHUB_TOKEN=your_token_here npm start
```

### 4. Проверка

```bash
# Браузер
open http://localhost:8080

# CLI тест
curl http://localhost:8080/api/models/available
```

## 🎯 Быстрый тест Smart Router

```bash
# Тест генерации кода
curl -X POST http://localhost:8080/api/ai/process \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Create React component", 
    "type": "code-generation",
    "complexity": "simple"
  }'
```

## 📊 Мониторинг

- **Dashboard**: http://localhost:8080
- **Admin Panel**: http://localhost:8080/admin.html  
- **Performance**: http://localhost:8080/api/performance
- **Health**: http://localhost:8080/health

## ⚠️ Troubleshooting

### API ключи не работают?
```bash
# Проверить конфигурацию  
./check-config.sh

# Проверить логи
tail -f server.log
```

### Сервер не запускается?
```bash
# Проверить порт
lsof -i :8080

# Убить процесс
pkill -f "enhanced-server"
```

## 🔑 Production Setup

Для production используйте:
- Real GitHub Copilot API key
- `NODE_ENV=production`  
- HTTPS конфигурацию
- Реальные пароли и секреты

См. `API_KEYS_SETUP.md` для подробных инструкций.