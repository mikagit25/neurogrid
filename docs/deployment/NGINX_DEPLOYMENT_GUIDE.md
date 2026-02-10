# NeuroGrid Production Deployment Guide

## 🎯 Архитектура

### URL Structure:
```
neurogrid.com/           → Landing Page (маркетинг + ссылки)
neurogrid.com/demo/      → MVP Demo (простая демо-версия)
neurogrid.com/app/       → Full Application (полный продукт)
neurogrid.com/api/       → API Endpoints
```

### Компоненты:
- **Nginx** - Reverse Proxy & Load Balancer (порт 80/443)
- **MVP Server** - Demo версия (внутренний порт 3000)
- **Web Interface** - Next.js приложение (внутренний порт 3000)
- **Coordinator Server** - API Backend (внутренний порт 3001)
- **PostgreSQL** - База данных (порт 5432)
- **Redis** - Кэш и сессии (порт 6379)
- **Prometheus** - Мониторинг (порт 9090)
- **Grafana** - Дашборды (порт 3002)

## 🚀 Быстрый старт

### 1. Подготовка сервера
```bash
# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Установка Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Перезагрузка для применения групп
sudo reboot
```

### 2. Клонирование и развертывание
```bash
# Клонирование репозитория
git clone https://github.com/mikagit25/neurogrid.git
cd neurogrid

# Запуск развертывания
./deploy-with-nginx.sh production
```

### 3. Проверка
```bash
# Проверка статуса
docker-compose -f docker-compose.production.yml ps

# Проверка логов
docker-compose -f docker-compose.production.yml logs -f nginx
```

## 🌍 Доступ к приложению

После развертывания:

### 🏠 Landing Page - `http://your-domain.com/`
- Маркетинговая страница
- Ссылки на демо и полное приложение
- Секция для инвесторов
- Форма подписки на бета

### 🚀 Demo/MVP - `http://your-domain.com/demo/`
- Простая демо-версия
- Mock данные
- Основной функционал для презентации
- Быстрая загрузка

### 📱 Full Application - `http://your-domain.com/app/`
- Полнофункциональное приложение
- Dashboard с аналитикой
- Wallet management
- Node monitoring
- Система аутентификации

### 🔧 API - `http://your-domain.com/api/`
- RESTful API endpoints
- WebSocket подключения
- Документация Swagger
- Rate limiting

## ⚙️ Конфигурация

### Environment Variables (.env.production)
```bash
# Основные настройки
NODE_ENV=production
HTTP_PORT=80
HTTPS_PORT=443

# База данных
POSTGRES_PASSWORD=your_secure_password

# Безопасность
JWT_SECRET=your_jwt_secret_key

# Внешние сервисы
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLIC_KEY=pk_live_...

# Мониторинг
LOG_LEVEL=info
RATE_LIMIT_ENABLED=true
```

### Nginx Configuration
- Rate limiting для API и demo
- GZIP compression
- Security headers
- WebSocket support
- Static file caching

## 🔒 SSL/HTTPS Setup

### Let's Encrypt (Рекомендуется)
```bash
# Установка Certbot
sudo apt install certbot python3-certbot-nginx

# Получение сертификата
sudo certbot --nginx -d neurogrid.com -d www.neurogrid.com

# Автообновление
sudo crontab -e
# Добавить: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Обновление Nginx для HTTPS
1. Раскомментировать HTTPS блок в `nginx/nginx.conf`
2. Добавить пути к сертификатам
3. Перезапустить: `docker-compose restart nginx`

## 📊 Мониторинг

### Grafana Dashboard
- URL: `http://your-domain.com:3002`
- Login: admin / admin123
- Дашборды для всех сервисов
- Алерты и уведомления

### Prometheus Metrics
- URL: `http://your-domain.com:9090`
- Метрики приложений
- Системные метрики
- Custom metrics

### Логи
```bash
# Все сервисы
docker-compose -f docker-compose.production.yml logs -f

# Конкретный сервис
docker-compose -f docker-compose.production.yml logs -f nginx
docker-compose -f docker-compose.production.yml logs -f coordinator
```

## 🔧 Обслуживание

### Обновление приложения
```bash
# Полное обновление
git pull origin main
./deploy-with-nginx.sh production

# Быстрое обновление (без пересборки)
docker-compose -f docker-compose.production.yml pull
docker-compose -f docker-compose.production.yml up -d
```

### Резервное копирование
```bash
# База данных
docker exec neurogrid-postgres pg_dump -U neurogrid neurogrid > backup_$(date +%Y%m%d).sql

# Volumes
docker run --rm -v neurogrid_postgres_data:/data -v $(pwd):/backup alpine tar czf /backup/postgres_backup_$(date +%Y%m%d).tar.gz -C /data .
```

### Масштабирование
```bash
# Увеличение replica count
docker-compose -f docker-compose.production.yml up -d --scale coordinator=3 --scale web-interface=2

# Load balancing через nginx
# Добавить серверы в upstream блоки
```

## 🚨 Troubleshooting

### Частые проблемы

1. **Порты заняты**
   ```bash
   sudo netstat -tulpn | grep :80
   sudo systemctl stop apache2  # если установлен
   ```

2. **Недостаточно памяти**
   ```bash
   # Увеличить swap
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   ```

3. **Docker permission denied**
   ```bash
   sudo usermod -aG docker $USER
   newgrp docker
   ```

### Полезные команды
```bash
# Перезапуск сервисов
docker-compose -f docker-compose.production.yml restart

# Просмотр использования ресурсов
docker stats

# Очистка неиспользуемых образов
docker system prune -a

# Просмотр сетевых соединений
docker network ls
docker network inspect neurogrid_neurogrid-network
```

## 📞 Поддержка

- 📧 Email: support@neurogrid.com
- 💬 GitHub Issues: https://github.com/mikagit25/neurogrid/issues
- 📚 Documentation: https://docs.neurogrid.com

## 🎉 Production Checklist

- [ ] Обновить DNS записи
- [ ] Настроить SSL сертификаты
- [ ] Обновить переменные окружения
- [ ] Настроить мониторинг и алерты
- [ ] Протестировать все endpoints
- [ ] Настроить резервное копирование
- [ ] Обновить документацию
- [ ] Уведомить команду о развертывании