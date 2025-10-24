#!/bin/bash

# NeuroGrid Monitoring Setup Script
# This script sets up the complete monitoring infrastructure

set -e

echo "🚀 Setting up NeuroGrid Monitoring Infrastructure..."

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

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create necessary directories
print_status "Creating necessary directories..."
mkdir -p logs
mkdir -p ssl
mkdir -p monitoring/grafana/dashboards

# Generate SSL certificates for local development
print_status "Generating SSL certificates for local development..."
if [ ! -f ssl/cert.pem ]; then
    openssl req -x509 -newkey rsa:4096 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes -subj "/C=US/ST=State/L=City/O=NeuroGrid/CN=localhost"
    print_success "SSL certificates generated"
else
    print_status "SSL certificates already exist"
fi

# Create environment file if it doesn't exist
if [ ! -f .env ]; then
    print_status "Creating environment file..."
    cat > .env << EOF
# NeuroGrid Monitoring Environment Configuration

# Application
NODE_ENV=production
JWT_SECRET=$(openssl rand -base64 32)
API_KEY_SECRET=$(openssl rand -base64 32)

# Database
DATABASE_URL=postgresql://neurogrid:neurogrid_pass@postgres:5432/neurogrid_coordinator

# Redis
REDIS_URL=redis://redis:6379

# Monitoring Configuration
HEALTH_CHECK_INTERVAL=30000
CPU_ALERT_THRESHOLD=80
MEMORY_ALERT_THRESHOLD=85
DISK_SPACE_ALERT_THRESHOLD=90
RESPONSE_TIME_ALERT_THRESHOLD=5000
ERROR_RATE_ALERT_THRESHOLD=5

# Grafana
GRAFANA_ADMIN_PASSWORD=$(openssl rand -base64 12)

# Alert Configuration (Disabled by default)
ALERT_EMAIL_ENABLED=false
ALERT_SLACK_ENABLED=false
ALERT_SMS_ENABLED=false
ALERT_WEBHOOK_ENABLED=false

# Uncomment and configure these for alerting:
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASS=your-app-password
# ALERT_EMAIL_FROM=alerts@neurogrid.com
# ALERT_EMAIL_TO=admin@neurogrid.com

# SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
# SLACK_CHANNEL=#alerts

# TWILIO_ACCOUNT_SID=your-twilio-sid
# TWILIO_AUTH_TOKEN=your-twilio-token
# TWILIO_FROM_NUMBER=+1234567890
# ALERT_SMS_TO=+1234567890
EOF
    print_success "Environment file created"
else
    print_status "Environment file already exists"
fi

# Build and start the monitoring stack
print_status "Building and starting monitoring infrastructure..."

# Start core services first
print_status "Starting core services (database, redis, application)..."
docker-compose -f docker-compose.monitoring.yml up -d postgres redis coordinator

# Wait for core services to be healthy
print_status "Waiting for core services to be healthy..."
sleep 30

# Start monitoring services
print_status "Starting monitoring services (prometheus, grafana, alertmanager)..."
docker-compose -f docker-compose.monitoring.yml up -d prometheus grafana alertmanager node-exporter

# Wait for monitoring services
print_status "Waiting for monitoring services to start..."
sleep 20

# Start nginx proxy
print_status "Starting nginx reverse proxy..."
docker-compose -f docker-compose.monitoring.yml up -d nginx

# Optional: Start ELK stack for logging
read -p "Do you want to start the ELK stack for log aggregation? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Starting ELK stack..."
    docker-compose -f docker-compose.monitoring.yml --profile logging up -d
    print_success "ELK stack started"
fi

# Show status
print_status "Checking service status..."
docker-compose -f docker-compose.monitoring.yml ps

# Display access information
echo
print_success "✅ NeuroGrid Monitoring Infrastructure is ready!"
echo
echo "🌐 Access URLs:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Main Application:      http://localhost:3000"
echo "📈 Grafana Dashboard:     http://localhost:3001"
echo "🔍 Prometheus:            http://localhost:9090"
echo "🚨 AlertManager:          http://localhost:9093"
echo "⚡ Node Exporter:         http://localhost:9100"

if docker-compose -f docker-compose.monitoring.yml ps | grep -q "kibana"; then
    echo "📋 Kibana (Logs):         http://localhost:5601"
    echo "🔎 Elasticsearch:         http://localhost:9200"
fi

echo
echo "🔐 Credentials:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 Grafana Admin:         admin / $(grep GRAFANA_ADMIN_PASSWORD .env | cut -d'=' -f2)"
echo
echo "🏥 Health Checks:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💊 Health Status:         http://localhost:3000/api/monitoring/health"
echo "📊 Metrics:               http://localhost:3000/api/monitoring/metrics"
echo "🎯 Prometheus Metrics:    http://localhost:3000/api/monitoring/metrics/prometheus"
echo
echo "📚 Useful Commands:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 View logs:             docker-compose -f docker-compose.monitoring.yml logs -f [service]"
echo "🛑 Stop services:         docker-compose -f docker-compose.monitoring.yml down"
echo "🔄 Restart services:      docker-compose -f docker-compose.monitoring.yml restart [service]"
echo "📊 Service status:        docker-compose -f docker-compose.monitoring.yml ps"
echo
print_warning "Remember to configure alert channels in .env file and alertmanager.yml for production use!"

# Check if services are responding
echo
print_status "Performing health checks..."

# Function to check URL
check_url() {
    if curl -s -f "$1" > /dev/null 2>&1; then
        print_success "$2 is responding"
    else
        print_error "$2 is not responding at $1"
    fi
}

# Wait a bit more for services to fully start
sleep 10

check_url "http://localhost:3000/api/monitoring/health/live" "Application health endpoint"
check_url "http://localhost:9090/-/healthy" "Prometheus"
check_url "http://localhost:3001/api/health" "Grafana"
check_url "http://localhost:9093/-/healthy" "AlertManager"

echo
print_success "🎉 Setup complete! Your monitoring infrastructure is ready to use."
echo
print_status "Next steps:"
echo "1. 📊 Configure Grafana dashboards"
echo "2. 🚨 Set up alert channels in .env and alertmanager.yml"
echo "3. 📈 Import custom dashboards from monitoring/grafana/dashboards/"
echo "4. 🔧 Customize alert rules in monitoring/rules/neurogrid.yml"
echo "5. 📋 Review logs and metrics to ensure everything is working correctly"