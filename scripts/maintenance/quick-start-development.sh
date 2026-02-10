#!/bin/bash

# NeuroGrid Quick Start Development Script
# Автоматизация запуска разработки

echo "🚀 NeuroGrid Development Quick Start"
echo "==================================="

# Проверим статус текущих процессов
echo "📊 Checking current status..."

# MVP статус
echo -e "\n🔍 MVP Status:"
curl -s -o /dev/null -w "%{http_code}" http://neurogrid.network:8080 && echo "MVP: ✅ Running" || echo "MVP: ❌ Down"

# Выбор среды разработки
echo -e "\n🛠️ Available development environments:"
echo "1. Hybrid Deployment (Recommended)"
echo "2. Staging Environment" 
echo "3. Full Local Development"
echo "4. Production Build Test"

read -p "Choose option (1-4): " choice

case $choice in
  1)
    echo "🏗️ Starting Hybrid Deployment..."
    echo "MVP: neurogrid.network/"
    echo "Beta: neurogrid.network/beta/"
    docker-compose -f docker-compose.hybrid.yml up -d
    ;;
  2)
    echo "🧪 Starting Staging Environment..."
    docker-compose -f docker-compose.staging.yml up -d
    ;;
  3)
    echo "💻 Starting Local Development..."
    cd web-interface && npm run dev &
    cd coordinator-server && npm run dev &
    ;;
  4)
    echo "🏭 Testing Production Build..."
    docker-compose -f docker-compose.production.yml build
    ;;
  *)
    echo "Invalid choice"
    exit 1
    ;;
esac

echo "✅ Environment started!"
echo -e "\nNext steps:"
echo "- Check logs: docker-compose logs -f"
echo "- Monitor: docker stats"
echo "- Stop: docker-compose down"