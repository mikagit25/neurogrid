#!/bin/bash

# NeuroGrid Production Build Script
# Запускать локально перед деплоем

set -e  # Exit on any error

echo "🚀 NeuroGrid Production Build Starting..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Запустите скрипт из корневой директории проекта"
    exit 1
fi

print_status "Проверка Node.js версии..."
node --version
npm --version

# Clean previous builds
print_status "Очистка предыдущих сборок..."
rm -rf coordinator-server/dist/
rm -rf web-interface/.next/
rm -rf web-interface/out/

# Install dependencies
print_status "Установка зависимостей..."

print_status "  → Coordinator Server dependencies..."
cd coordinator-server
# Skip problematic packages temporarily
npm ci --production=false --ignore-scripts || {
    print_warning "Полная установка не удалась, пытаемся без скриптов..."
    npm install --production=false --ignore-scripts
}
cd ..

print_status "  → Web Interface dependencies..."
cd web-interface
npm ci --production=false --ignore-scripts || {
    print_warning "Полная установка не удалась, пытаемся без скриптов..."
    npm install --production=false --ignore-scripts
}
cd ..

# Build Coordinator Server
print_status "Сборка Coordinator Server..."
cd coordinator-server
npm run build
print_success "Coordinator Server собран"
cd ..

# Build Web Interface
print_status "Сборка Web Interface..."
cd web-interface
npm run build
print_success "Web Interface собран"
cd ..

# Create deployment package
print_status "Создание deployment пакета..."
mkdir -p dist/
mkdir -p dist/coordinator-server
mkdir -p dist/web-interface

# Copy built coordinator
cp -r coordinator-server/dist/ dist/coordinator-server/
cp coordinator-server/package.json dist/coordinator-server/
cp coordinator-server/package-lock.json dist/coordinator-server/

# Copy built web interface
cp -r web-interface/.next/ dist/web-interface/
cp web-interface/package.json dist/web-interface/
cp web-interface/package-lock.json dist/web-interface/
cp web-interface/next.config.js dist/web-interface/ 2>/dev/null || true

# Copy configuration files
cp .env.production dist/
cp web-interface/.env.production dist/web-interface/
cp ecosystem.config.json dist/
cp deploy/nginx-hybrid.conf dist/

# Copy any additional files
cp README.md dist/ 2>/dev/null || true

print_success "Deployment пакет создан в директории dist/"

# Create production install script
cat > dist/install-production.sh << 'EOF'
#!/bin/bash
# Production installation script

set -e

echo "🚀 NeuroGrid Production Installation..."

# Install production dependencies only
echo "Installing Coordinator dependencies..."
cd coordinator-server
npm ci --production
cd ..

echo "Installing Web Interface dependencies..."
cd web-interface
npm ci --production
cd ..

echo "✅ Production dependencies installed"
EOF

chmod +x dist/install-production.sh

# Create database setup script
cat > dist/setup-database.sql << 'EOF'
-- NeuroGrid Production Database Setup

CREATE DATABASE neurogrid_prod;
CREATE USER neurogrid_prod WITH ENCRYPTED PASSWORD 'NeuroGrid2024!Prod';
GRANT ALL PRIVILEGES ON DATABASE neurogrid_prod TO neurogrid_prod;

-- Connect to the database
\c neurogrid_prod

-- Grant additional permissions
GRANT ALL ON SCHEMA public TO neurogrid_prod;
GRANT CREATE ON SCHEMA public TO neurogrid_prod;

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

EOF

print_success "Database setup скрипт создан"

# Display final information
print_success "🎉 Production build завершен!"
echo ""
print_status "📁 Файлы для деплоя находятся в dist/"
print_status "📋 Следующие шаги:"
echo "   1. Скопировать dist/ на сервер: scp -r dist/ user@server:/tmp/"
echo "   2. На сервере выполнить: sudo cp -r /tmp/dist/* /var/www/neurogrid/"
echo "   3. Настроить базу данных: sudo -u postgres psql < setup-database.sql"
echo "   4. Установить зависимости: ./install-production.sh"
echo "   5. Запустить PM2: pm2 start ecosystem.config.json"
echo ""
print_warning "⚠️  Не забудьте обновить пароли в .env файлах!"

# Show file sizes
echo ""
print_status "📊 Размеры файлов:"
du -sh dist/
ls -la dist/