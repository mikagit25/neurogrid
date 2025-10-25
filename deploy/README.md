# 🚀 DEPLOY NEUROGRID НА HOSTER.BY

## 📋 ПОДГОТОВКА К ДЕПЛОЮ

### Файлы для загрузки на сервер:
```
deploy/
├── server.js              # Основной сервер
├── package.json           # Зависимости Node.js
├── landing-page.html      # Главная страница
├── about-project.html     # Описание проекта ✨
├── api-docs.html          # API документация ✨ НОВОЕ
├── technical-docs.html    # Техническая документация ✨ НОВОЕ
├── investors.html         # Страница для инвесторов ✨ НОВОЕ
├── demo-client.html       # Клиентский демо
├── demo-setup.html        # Провайдерский демо
└── README.md              # Эта инструкция
```

## 🔧 ТРЕБОВАНИЯ К СЕРВЕРУ

### Минимальные требования:
- **Node.js**: версия 16.0.0 или выше
- **RAM**: минимум 512MB (рекомендуется 1GB)
- **Storage**: 1GB свободного места
- **Network**: стабильное интернет-соединение

### Поддерживаемые порты:
- **Port 3000** (по умолчанию)
- Или любой другой доступный порт

## 📦 ИНСТРУКЦИЯ ПО ДЕПЛОЮ

### Шаг 1: Подключение к серверу
```bash
# Подключитесь к вашему серверу на hoster.by через SSH
ssh username@your-server.hoster.by

# Или используйте веб-панель управления файлами
```

### Шаг 2: Создание директории проекта
```bash
# Создайте папку для проекта
mkdir neurogrid
cd neurogrid
```

### Шаг 3: Загрузка файлов
Загрузите все файлы из папки `deploy/` на сервер:
- `server.js`
- `package.json` 
- `landing-page.html`

### Шаг 4: Установка зависимостей
```bash
# Убедитесь что Node.js установлен
node --version

# Если Node.js не установлен:
# На Ubuntu/Debian:
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Установите зависимости проекта
npm install
```

### Шаг 5: Настройка переменных окружения
```bash
# Создайте файл .env (опционально)
cat > .env << EOF
NODE_ENV=production
PORT=3000
DOMAIN=neurogrid.network
EOF
```

### Шаг 6: Запуск сервера
```bash
# Тестовый запуск
node server.js

# Запуск в фоне (production)
nohup node server.js > output.log 2>&1 &

# Или используйте PM2 (если доступен)
npm install -g pm2
pm2 start server.js --name "neurogrid"
pm2 startup
pm2 save
```

## 🌐 НАСТРОЙКА ДОМЕНА

### Привязка домена neurogrid.network:
1. В панели управления hoster.by найдите раздел "Домены"
2. Добавьте домен `neurogrid.network`
3. Настройте DNS записи:
   ```
   A record: neurogrid.network → IP_вашего_сервера
   CNAME: www.neurogrid.network → neurogrid.network
   ```

### SSL сертификат:
```bash
# Если доступен certbot:
sudo certbot --nginx -d neurogrid.network -d www.neurogrid.network

# Или используйте панель управления hoster.by для SSL
```

## ✅ ПРОВЕРКА РАБОТЫ

### Тестирование endpoints:
```bash
# Health check
curl https://neurogrid.network/health

# API info
curl https://neurogrid.network/api/info

# Главная страница
curl https://neurogrid.network/

# О проекте
curl https://neurogrid.network/about-project

# API документация (новое!)
curl https://neurogrid.network/api/docs

# Техническая документация (новое!)
curl https://neurogrid.network/technical-docs

# Страница для инвесторов (новое!)
curl https://neurogrid.network/investors

# Демо-страницы
curl https://neurogrid.network/demo
curl https://neurogrid.network/client
curl https://neurogrid.network/provider

# Beta signup test
curl -X POST https://neurogrid.network/api/beta/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","type":"developer"}'

# AI task test
curl -X POST https://neurogrid.network/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Hello, explain AI in simple terms"}'
```

## 🔧 TROUBLESHOOTING

### Проблема: "Cannot find module"
```bash
# Переустановите зависимости
rm -rf node_modules package-lock.json
npm install
```

### Проблема: "Port already in use"
```bash
# Найдите процесс использующий порт
sudo netstat -tulpn | grep :3000
sudo kill -9 PID

# Или используйте другой порт
export PORT=8080
node server.js
```

### Проблема: "Permission denied"
```bash
# Дайте права на выполнение
chmod +x server.js

# Запустите от имени пользователя (не root)
```

### Логи и мониторинг:
```bash
# Просмотр логов
tail -f output.log

# Проверка статуса процесса
ps aux | grep node

# Мониторинг ресурсов
htop
```

## 📊 ПОСЛЕ ДЕПЛОЯ

### 1. Проверьте все endpoints:
- ✅ https://neurogrid.network (главная страница)
- ✅ https://neurogrid.network/about-project (описание проекта)
- ✅ https://neurogrid.network/api/docs (API документация) ✨ НОВОЕ
- ✅ https://neurogrid.network/technical-docs (техническая документация) ✨ НОВОЕ  
- ✅ https://neurogrid.network/investors (страница для инвесторов) ✨ НОВОЕ
- ✅ https://neurogrid.network/demo (демо-хаб)
- ✅ https://neurogrid.network/client (клиентский демо)
- ✅ https://neurogrid.network/provider (провайдерский демо)
- ✅ https://neurogrid.network/health (статус сервера)
- ✅ https://neurogrid.network/api/info (API информация)

### 2. Настройте мониторинг:
- Проверяйте логи регулярно
- Настройте алерты при падении сервиса
- Мониторьте использование ресурсов

### 3. Продакшн готовность:
```bash
# Создайте backup скрипт
cat > backup.sh << EOF
#!/bin/bash
cp -r /path/to/neurogrid /backup/neurogrid-$(date +%Y%m%d)
EOF

# Настройте автозапуск при перезагрузке
crontab -e
# Добавьте: @reboot cd /path/to/neurogrid && node server.js
```

## 🎯 NEXT STEPS

После успешного деплоя:
1. ✅ Протестируйте все функции
2. ✅ Настройте SSL
3. ✅ Проверьте производительность  
4. ✅ Подготовьтесь к Product Hunt запуску!

---

**💡 ВАЖНО:** Сохраните все логи и статистику - они понадобятся для анализа после Product Hunt запуска!

**🚀 ГОТОВЫ К ЗАПУСКУ?** После деплоя можно сразу начинать собирать beta пользователей!