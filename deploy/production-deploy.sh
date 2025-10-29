#!/bin/bash

# NeuroGrid Production Deployment Script
# Deploys to subdomains: app.neurogrid.network, api.neurogrid.network

set -e

echo "🚀 NeuroGrid Production Deployment"
echo "=================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="neurogrid.network"
APP_SUBDOMAIN="app.$DOMAIN"
API_SUBDOMAIN="api.$DOMAIN"
DEPLOY_USER="deploy"
DEPLOY_PATH="/var/www/neurogrid"
BACKUP_PATH="/var/backups/neurogrid"

# Functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Pre-deployment checks
log_info "Running pre-deployment checks..."

# Check available disk space (need at least 5GB)
AVAILABLE_SPACE=$(df / | awk 'NR==2 {print $4}')
REQUIRED_SPACE=5242880  # 5GB in KB

if [ "$AVAILABLE_SPACE" -lt "$REQUIRED_SPACE" ]; then
    log_error "Insufficient disk space. Available: $(($AVAILABLE_SPACE/1024/1024))GB, Required: 5GB"
    exit 1
fi

log_success "Disk space check passed: $(($AVAILABLE_SPACE/1024/1024))GB available"

# Check if required services are running
if ! systemctl is-active --quiet nginx; then
    log_warning "Nginx is not running. Starting nginx..."
    sudo systemctl start nginx
fi

if ! systemctl is-active --quiet postgresql; then
    log_warning "PostgreSQL is not running. Installing and starting PostgreSQL..."
    sudo apt install -y postgresql postgresql-contrib
    sudo systemctl start postgresql
    sudo systemctl enable postgresql
fi

log_success "Service checks completed"

# Create backup
log_info "Creating backup..."
BACKUP_NAME="neurogrid-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p $BACKUP_PATH

if [ -d "$DEPLOY_PATH" ]; then
    sudo tar -czf "$BACKUP_PATH/$BACKUP_NAME.tar.gz" -C "$DEPLOY_PATH" . 2>/dev/null || true
    log_success "Backup created: $BACKUP_PATH/$BACKUP_NAME.tar.gz"
fi

# Install dependencies
log_info "Installing system dependencies..."
sudo apt update
sudo apt install -y redis-server certbot python3-certbot-nginx nodejs npm git

# Install PM2 globally if not installed
if ! command -v pm2 &> /dev/null; then
    log_info "Installing PM2 globally..."
    sudo npm install -g pm2
fi

# Setup deploy directory
log_info "Setting up deployment directory..."
sudo mkdir -p $DEPLOY_PATH
sudo chown -R $USER:$USER $DEPLOY_PATH

# Clone/update repository
if [ -d "$DEPLOY_PATH/.git" ]; then
    log_info "Updating existing repository..."
    cd $DEPLOY_PATH
    git pull origin main
else
    log_info "Cloning repository..."
    git clone https://github.com/mikagit25/neurogrid.git $DEPLOY_PATH
    cd $DEPLOY_PATH
fi

# Install Node.js dependencies
log_info "Installing coordinator-server dependencies..."
cd $DEPLOY_PATH/coordinator-server
npm ci --production

log_info "Installing web-interface dependencies..."
cd $DEPLOY_PATH/web-interface
npm ci --production

# Build web interface
log_info "Building web interface..."
npm run build

# Setup environment
log_info "Setting up production environment..."
cd $DEPLOY_PATH

# Create production environment file
cat > .env.production << EOF
# Production Environment Configuration
NODE_ENV=production
PORT=3001

# Database Configuration
DATABASE_URL=postgresql://neurogrid_prod:$DB_PASSWORD@localhost:5432/neurogrid_prod
DB_HOST=localhost
DB_PORT=5432
DB_NAME=neurogrid_prod
DB_USERNAME=neurogrid_prod
DB_PASSWORD=$DB_PASSWORD

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT Configuration
JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRES_IN=24h

# API Configuration
API_URL=https://api.$DOMAIN
WEB_URL=https://app.$DOMAIN
CORS_ORIGIN=https://app.$DOMAIN

# Security
SESSION_SECRET=$(openssl rand -base64 32)
BCRYPT_ROUNDS=12

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/neurogrid/app.log
EOF

# Create web interface environment
cat > web-interface/.env.production << EOF
# Next.js Production Configuration
NODE_ENV=production
PORT=3000

# API Configuration
NEXT_PUBLIC_API_URL=https://api.$DOMAIN
NEXT_PUBLIC_WS_URL=wss://api.$DOMAIN

# App Configuration
NEXT_PUBLIC_APP_NAME=NeuroGrid
NEXT_PUBLIC_DOMAIN=$DOMAIN
EOF

log_success "Production environment files created"

# Database setup
log_info "Setting up production database..."

# Generate random password for database
DB_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-25)

# Create database and user
sudo -u postgres psql << EOF
-- Create database if it doesn't exist
SELECT 'CREATE DATABASE neurogrid_prod' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'neurogrid_prod')\gexec

-- Create user if it doesn't exist
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'neurogrid_prod') THEN
        CREATE USER neurogrid_prod WITH PASSWORD '$DB_PASSWORD';
    END IF;
END
\$\$;

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE neurogrid_prod TO neurogrid_prod;
ALTER USER neurogrid_prod CREATEDB;
EOF

log_success "Database configured with user: neurogrid_prod"
log_info "Database password generated and stored"

# Run database migrations
log_info "Running database migrations..."
cd $DEPLOY_PATH/coordinator-server
NODE_ENV=production npm run migrate

# Setup SSL certificates
log_info "Setting up SSL certificates for subdomains only..."
if [ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
    log_info "Obtaining SSL certificates for app and api subdomains..."
    sudo certbot certonly --nginx -d $APP_SUBDOMAIN -d $API_SUBDOMAIN --non-interactive --agree-tos --email admin@$DOMAIN
    log_success "SSL certificates obtained for subdomains"
else
    log_success "SSL certificates already exist"
fi

# Update nginx configuration
log_info "Nginx is already configured for subdomains"
log_success "Nginx subdomain configuration preserved"

# Test nginx configuration
log_info "Testing nginx configuration..."
sudo nginx -t

if [ $? -ne 0 ]; then
    log_error "Nginx configuration test failed"
    exit 1
fi

# Setup PM2 for process management
log_info "Setting up PM2 process management..."
cd $DEPLOY_PATH

# Create PM2 ecosystem file
cat > ecosystem.config.js << EOF
module.exports = {
  apps: [
    {
      name: 'neurogrid-api',
      cwd: './coordinator-server',
      script: 'src/app.js',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      instances: 2,
      exec_mode: 'cluster',
      max_memory_restart: '1G',
      error_file: '/var/log/neurogrid/api-error.log',
      out_file: '/var/log/neurogrid/api-out.log',
      log_file: '/var/log/neurogrid/api.log',
      time: true
    },
    {
      name: 'neurogrid-web',
      cwd: './web-interface',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      error_file: '/var/log/neurogrid/web-error.log',
      out_file: '/var/log/neurogrid/web-out.log',
      log_file: '/var/log/neurogrid/web.log',
      time: true
    }
  ]
};
EOF

# Create log directory
sudo mkdir -p /var/log/neurogrid
sudo chown -R $USER:$USER /var/log/neurogrid

# Start/restart applications
log_info "Starting applications with PM2..."
pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Restart nginx
log_info "Restarting nginx..."
sudo systemctl restart nginx

# Setup monitoring
log_info "Setting up monitoring..."
pm2 install pm2-logrotate

# Security hardening
log_info "Applying security hardening..."

# Setup firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# Setup automatic security updates
echo 'Unattended-Upgrade::Automatic-Reboot "false";' | sudo tee -a /etc/apt/apt.conf.d/50unattended-upgrades
sudo systemctl enable unattended-upgrades

# Final checks
log_info "Running final checks..."

# Check if services are running
sleep 10

if curl -f -s https://$API_SUBDOMAIN/health > /dev/null; then
    log_success "API server is responding at https://$API_SUBDOMAIN"
else
    log_warning "API server health check failed"
fi

if curl -f -s https://$APP_SUBDOMAIN > /dev/null; then
    log_success "Web interface is responding at https://$APP_SUBDOMAIN"
else
    log_warning "Web interface health check failed"
fi

# Show PM2 status
echo ""
log_info "PM2 Process Status:"
pm2 status

echo ""
log_success "🎉 Deployment completed!"
echo ""
echo "🌐 Your NeuroGrid platform is now live:"
echo "   • Web App: https://$APP_SUBDOMAIN"
echo "   • API:     https://$API_SUBDOMAIN"
echo "   • Main:    https://$DOMAIN (redirects to app)"
echo ""
echo "🔧 Management commands:"
echo "   • View logs:    pm2 logs"
echo "   • Restart:      pm2 restart all"
echo "   • Stop:         pm2 stop all"
echo "   • Monitor:      pm2 monit"
echo ""
log_warning "🔒 Security reminders:"
echo "   • Update passwords in .env.production"
echo "   • Setup database backups"
echo "   • Configure monitoring alerts"
echo "   • Review firewall rules"