# NeuroGrid API Keys Configuration Guide

## ⚠️ ВАЖНОЕ УТОЧНЕНИЕ О GITHUB COPILOT

**GitHub Copilot НЕ имеет публичного API!** 

Copilot работает только как расширение IDE (VS Code, JetBrains) и не предоставляет REST API для веб-сервисов. Наша система использует **реальные доступные API**.

## 🔑 Доступные AI API (Real Working APIs)

### 1. Google Gemini API ⭐ РЕКОМЕНДУЕТСЯ

**Самый дешевый и быстрый вариант!**
```bash
# Получите на https://makersuite.google.com/app/apikey
GOOGLE_API_KEY=AIzaSyD-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Получение:**
1. Перейдите на https://makersuite.google.com/app/apikey
2. Войдите с Google аккаунтом
3. Нажмите "Create API Key"
4. Скопируйте ключ и добавьте в .env

**Стоимость: $0.0005/1k tokens (в 60 раз дешевле OpenAI!)**

### 2. OpenAI API 🔥 НАИБОЛЕЕ СТАБИЛЬНЫЙ

```bash
# Получите на https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Получение:**
1. Зарегистрируйтесь на https://platform.openai.com/
2. Перейдите в API Keys
3. Создайте новый secret key
4. Скопируйте и добавьте в .env

**Стоимость: $0.03/1k tokens (GPT-4), $0.002/1k tokens (GPT-3.5)**

### 3. Anthropic Claude API 🧠 ЛУЧШИЙ ДЛЯ АНАЛИЗА

```bash
# Получите на https://console.anthropic.com/
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Получение:**
1. Зарегистрируйтесь на https://console.anthropic.com/
2. Перейдите в API Keys
3. Создайте новый ключ
4. Скопируйте и добавьте в .env

**Стоимость: $0.015/1k tokens**

### 4. HuggingFace API 🆓 ОТКРЫТЫЕ МОДЕЛИ

```bash
# Получите на https://huggingface.co/settings/tokens
HUGGINGFACE_API_KEY=hf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Получение:**
1. Зарегистрируйтесь на https://huggingface.co/
2. Перейдите в Settings → Access Tokens
3. Создайте новый token с read правами
4. Скопируйте и добавьте в .env

**Стоимость: $0.001/1k tokens (CodeLlama и другие открытые модели)**

## 🚀 Production Setup

### Шаг 1: Создайте .env файл
```bash
cp .env.example .env
```

### Шаг 2: Отредактируйте .env файл
```bash
# Основные настройки
NODE_ENV=production
DOMAIN=yourdomain.com
PORT=8080

# API ключи (ОБЯЗАТЕЛЬНО!)
GITHUB_COPILOT_API_KEY=your-real-api-key-here
GITHUB_TOKEN=your-github-token-here
ANTHROPIC_API_KEY=your-anthropic-key-here
OPENAI_API_KEY=your-openai-key-here

# Безопасность (ИЗМЕНИТЕ!)
JWT_SECRET=your-super-secure-jwt-secret-for-production
ADMIN_DEFAULT_PASSWORD=YourSecureAdminPassword123!
```

### Шаг 3: Запуск с реальными ключами
```bash
# Development
npm start

# Production
NODE_ENV=production npm start
```

## 💡 Приоритет API Выбора

Smart Model Router автоматически выбирает API в следующем порядке:

1. **GitHub Copilot** (если `GITHUB_COPILOT_API_KEY` или `GITHUB_TOKEN`)
   - Стоимость: ~$0.01/1k tokens
   - Лучший для: code-generation, code-review

2. **Anthropic Claude** (если `ANTHROPIC_API_KEY`)
   - Стоимость: ~$0.02/1k tokens
   - Лучший для: analysis, reasoning

3. **OpenAI GPT** (если `OPENAI_API_KEY`)
   - Стоимость: ~$0.03/1k tokens
   - Fallback для всех типов задач

## 🔍 Проверка Конфигурации

```bash
# Запустите сервер и проверьте доступные API
curl http://localhost:8080/api/models/available

# Ожидаемый результат:
{
  "success": true,
  "data": {
    "coordinators": [
      {
        "id": "github-copilot",
        "name": "GitHub Copilot", 
        "status": "active"  // ← должно быть active!
      }
    ]
  }
}
```

## ⚠️ Важные Замечания

1. **GitHub Copilot**: Требует подписку Business/Enterprise или Personal access token
2. **Стоимость**: GitHub Copilot самый дешевый (~$0.01/1k vs OpenAI $0.03/1k)
3. **Fallback**: Система автоматически переключается между доступными API
4. **Security**: Никогда не коммитьте .env файл в git!

## 🛠️ Troubleshooting

### API Key не работает?
```bash
# Проверьте логи сервера
tail -f server.log

# Ищите ошибки типа:
# "Error: GitHub API authentication failed"
# "Error: Invalid API key format"
```

### GitHub Token Scopes
Убедитесь что токен имеет правильные permissions:
- `read:user` - обязательно
- `read:org` - для организаций  
- `copilot` - если доступно

### Тестирование API
```bash
# Тест GitHub API
curl -H "Authorization: token YOUR_GITHUB_TOKEN" \
     https://api.github.com/user

# Должен вернуть информацию о пользователе
```