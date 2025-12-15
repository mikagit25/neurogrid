# NeuroGrid API Keys Configuration Guide

## 🔑 Required API Keys for Production

### 1. GitHub Copilot API Key

**Опция A: GitHub Copilot Business/Enterprise**
```bash
# Получите ключ через GitHub Settings
GITHUB_COPILOT_API_KEY=your-github-copilot-api-key-here
```

**Опция B: GitHub Personal Access Token**
```bash
# Создайте в https://github.com/settings/tokens
# Scope: "read:user", "read:org"
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Получение GitHub Copilot API ключа:**
1. Перейдите на https://github.com/settings/tokens
2. Нажмите "Generate new token" → "Generate new token (classic)"
3. Выберите scopes:
   - `read:user` - для чтения информации о пользователе
   - `read:org` - для организации (если нужно)
   - `copilot` - для доступа к Copilot API (если доступно)
4. Скопируйте токен и добавьте в .env как `GITHUB_TOKEN=`

### 2. Anthropic Claude API Key (Optional)

```bash
# Получите на https://console.anthropic.com/
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Получение:**
1. Зарегистрируйтесь на https://console.anthropic.com/
2. Перейдите в API Keys
3. Создайте новый ключ
4. Скопируйте и добавьте в .env

### 3. OpenAI API Key (Fallback)

```bash
# Получите на https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

**Получение:**
1. Зарегистрируйтесь на https://platform.openai.com/
2. Перейдите в API Keys
3. Создайте новый secret key
4. Скопируйте и добавьте в .env

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