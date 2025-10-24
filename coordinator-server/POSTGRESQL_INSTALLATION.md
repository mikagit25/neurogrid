# Установка PostgreSQL для NeuroGrid

## Способ 1: Официальный установщик (Рекомендуется)

1. Перейдите на https://www.postgresql.org/download/macos/
2. Скачайте PostgreSQL для macOS
3. Запустите установщик и следуйте инструкциям
4. Запомните пароль для пользователя `postgres`

## Способ 2: Postgres.app (Простой способ)

1. Перейдите на https://postgresapp.com/
2. Скачайте Postgres.app
3. Перетащите в папку Applications
4. Запустите приложение
5. Нажмите "Initialize" для создания нового сервера

## Способ 3: Homebrew (если есть права администратора)

```bash
# Установка Homebrew (если не установлен)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Установка PostgreSQL
brew install postgresql@15

# Запуск службы
brew services start postgresql@15
```

## Способ 4: Docker (Альтернатива)

```bash
# Если установлен Docker
docker run --name neurogrid-postgres -e POSTGRES_PASSWORD=neurogrid123 -e POSTGRES_DB=neurogrid -p 5432:5432 -d postgres:15

# Подключение к контейнеру
docker exec -it neurogrid-postgres psql -U postgres -d neurogrid
```

## После установки PostgreSQL

### 1. Создание базы данных

```bash
# Подключитесь к PostgreSQL (замените пароль на ваш)
psql -U postgres

# Создайте базу данных и пользователя
CREATE DATABASE neurogrid;
CREATE USER neurogrid WITH PASSWORD 'neurogrid_password';
GRANT ALL PRIVILEGES ON DATABASE neurogrid TO neurogrid;
\q
```

### 2. Настройка окружения

Обновите файл `.env`:

```bash
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=neurogrid
DB_USER=neurogrid
DB_PASSWORD=neurogrid_password
```

### 3. Применение схем базы данных

```bash
cd /Users/a123/neurogrid/coordinator-server
psql -U neurogrid -d neurogrid -f src/database/schemas.sql
```

### 4. Тестирование новых моделей

```bash
# Проверка подключения
node test-models.js connection

# Полный тест
node test-models.js test
```

## Проверка установки

После установки PostgreSQL проверьте подключение:

```bash
# Проверка версии
psql --version

# Проверка подключения
psql -U postgres -c "SELECT version();"
```

## Альтернатива: Использование SQLite для разработки

Если PostgreSQL сложно установить, можно временно использовать SQLite:

```bash
npm install sqlite3
```

И создать адаптер для SQLite в проекте.

## Помощь

Если возникают проблемы:
1. Убедитесь, что PostgreSQL запущен
2. Проверьте настройки подключения в `.env`
3. Убедитесь, что порт 5432 не занят
4. Запустите `lsof -i:5432` для проверки

## Следующие шаги

После успешной установки PostgreSQL:
1. Запустите `node test-models.js test`
2. Интегрируйте новые компоненты в основное приложение
3. Мигрируйте данные из AuthManager