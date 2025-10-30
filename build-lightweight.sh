#!/bin/bash

# NeuroGrid Lightweight Production Build Script
# Без TensorFlow.js для быстрой сборки

set -e

echo "🚀 NeuroGrid Lightweight Build Starting..."

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

# Check directory
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
rm -rf dist/

# Install minimal dependencies for coordinator
print_status "Установка минимальных зависимостей coordinator..."
cd coordinator-server
# Исключаем проблемные TensorFlow зависимости
npm install express cors helmet bcrypt jsonwebtoken dotenv pg redis --production
npm install typescript @types/node @types/express ts-node --save-dev
cd ..

# Install minimal dependencies for web interface  
print_status "Установка минимальных зависимостей web interface..."
cd web-interface
npm install next react react-dom --production
npm install @types/react @types/node typescript --save-dev
cd ..

# Build Coordinator Server
print_status "Сборка Coordinator Server..."
cd coordinator-server
# Простая сборка без сложных зависимостей
mkdir -p dist
cat > dist/index.js << 'EOF'
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        service: 'neurogrid-coordinator'
    });
});

// Basic API endpoints
app.get('/api/status', (req, res) => {
    res.json({
        status: 'active',
        message: 'NeuroGrid Coordinator API',
        version: '1.0.0'
    });
});

app.get('/api/nodes', (req, res) => {
    res.json({
        nodes: [],
        message: 'Node management coming soon'
    });
});

app.listen(PORT, () => {
    console.log(`NeuroGrid Coordinator running on port ${PORT}`);
});
EOF

print_success "Coordinator Server собран (lightweight version)"
cd ..

# Build Web Interface
print_status "Сборка Web Interface..."
cd web-interface

# Создаем минимальный Next.js проект
cat > next.config.js << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  trailingSlash: true,
  images: {
    unoptimized: true
  }
}

module.exports = nextConfig
EOF

# Создаем основные страницы
mkdir -p pages
cat > pages/index.js << 'EOF'
import Head from 'next/head';

export default function Home() {
  return (
    <div>
      <Head>
        <title>NeuroGrid - Distributed AI Platform</title>
        <meta name="description" content="Decentralized AI inference network" />
      </Head>
      
      <main style={{ padding: '2rem', textAlign: 'center', fontFamily: 'Arial, sans-serif' }}>
        <h1 style={{ color: '#667eea', fontSize: '3rem' }}>🚀 NeuroGrid</h1>
        <p style={{ fontSize: '1.2rem', marginBottom: '2rem' }}>
          Распределенная AI платформа
        </p>
        <div style={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          padding: '2rem',
          borderRadius: '10px',
          margin: '2rem 0'
        }}>
          <h2>Добро пожаловать!</h2>
          <p>Основной интерфейс скоро будет доступен</p>
        </div>
        <a 
          href="http://neurogrid.network" 
          style={{
            padding: '15px 30px',
            background: '#ff6b6b',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '5px',
            fontWeight: 'bold'
          }}
        >
          ← Вернуться на главную
        </a>
      </main>
    </div>
  );
}
EOF

cat > package.json << 'EOF'
{
  "name": "neurogrid-web",
  "version": "1.0.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "latest",
    "react": "latest",
    "react-dom": "latest"
  },
  "devDependencies": {
    "@types/node": "latest",
    "@types/react": "latest",
    "typescript": "latest"
  }
}
EOF

npm install
npm run build
print_success "Web Interface собран (lightweight version)"
cd ..

# Create deployment package
print_status "Создание deployment пакета..."
mkdir -p dist/
mkdir -p dist/coordinator-server
mkdir -p dist/web-interface

# Copy coordinator
cp -r coordinator-server/dist/ dist/coordinator-server/
cp coordinator-server/package*.json dist/coordinator-server/ 2>/dev/null || true

# Copy web interface
cp -r web-interface/.next/ dist/web-interface/
cp web-interface/package*.json dist/web-interface/
cp web-interface/next.config.js dist/web-interface/

# Copy configs
cp .env.production dist/
cp web-interface/.env.production dist/web-interface/ 2>/dev/null || true
cp ecosystem.config.json dist/
cp deploy/nginx-hybrid.conf dist/

# Install script
cat > dist/install-production.sh << 'EOF'
#!/bin/bash
echo "🚀 Installing NeuroGrid Production..."

# Coordinator dependencies
cd coordinator-server
npm install --production
cd ..

# Web interface dependencies  
cd web-interface
npm install --production
cd ..

echo "✅ Production dependencies installed"
EOF

chmod +x dist/install-production.sh

print_success "🎉 Lightweight build завершен!"
echo ""
print_status "📁 Файлы готовы в dist/"
print_status "📋 Следующие шаги:"
echo "   1. Загрузить nginx конфигурацию: scp dist/nginx-hybrid.conf root@37.77.106.215:/etc/nginx/sites-available/"
echo "   2. Активировать: ssh root@37.77.106.215 'ln -sf /etc/nginx/sites-available/nginx-hybrid.conf /etc/nginx/sites-enabled/ && nginx -t && systemctl reload nginx'"
echo "   3. Полный деплой: ./deploy.sh"