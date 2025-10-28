# 🚀 NeuroGrid Production Deployment Guide

## 📋 Server Requirements

**Minimum Requirements (ваш сервер соответствует):**
- 💾 **Disk:** 13GB available ✅
- ⚡ **CPU:** 1.33 GHz ✅  
- 🧠 **RAM:** 2GB+ recommended
- 🌐 **OS:** Ubuntu 20.04+ / CentOS 8+

## 🏗️ Architecture Overview

```
neurogrid.network
├── app.neurogrid.network    → Next.js Web Interface (Port 3000)
├── api.neurogrid.network    → Node.js API Server (Port 3001)
└── admin.neurogrid.network  → Admin Dashboard (Optional)
```

## 🔧 Pre-Deployment Setup

### 1. DNS Configuration
Add these A records to your domain:
```
A     app     YOUR_SERVER_IP
A     api     YOUR_SERVER_IP
A     admin   YOUR_SERVER_IP (optional)
```

### 2. Server Access
```bash
# SSH to your server
ssh root@your-server-ip

# Create deploy user
useradd -m -s /bin/bash deploy
usermod -aG sudo deploy
su - deploy
```

## 🚀 Deployment Process

### 1. Quick Deploy (Automated)
```bash
# Clone repository
git clone https://github.com/mikagit25/neurogrid.git
cd neurogrid

# Run deployment script
sudo chmod +x deploy/production-deploy.sh
./deploy/production-deploy.sh
```

### 2. Manual Deployment Steps

#### Step 1: Install Dependencies
```bash
sudo apt update
sudo apt install -y nginx postgresql redis-server nodejs npm git certbot python3-certbot-nginx

# Install PM2 globally
sudo npm install -g pm2
```

#### Step 2: SSL Certificates
```bash
# Obtain Let's Encrypt SSL certificates
sudo certbot certonly --nginx \
  -d neurogrid.network \
  -d www.neurogrid.network \
  -d app.neurogrid.network \
  -d api.neurogrid.network \
  --email admin@neurogrid.network \
  --agree-tos
```

#### Step 3: Database Setup
```bash
# Create production database
sudo -u postgres psql
CREATE DATABASE neurogrid_prod;
CREATE USER neurogrid_prod WITH PASSWORD 'SECURE_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE neurogrid_prod TO neurogrid_prod;
\q
```

#### Step 4: Application Setup
```bash
# Clone and install
git clone https://github.com/mikagit25/neurogrid.git /var/www/neurogrid
cd /var/www/neurogrid

# Install dependencies
cd coordinator-server && npm ci --production
cd ../web-interface && npm ci --production && npm run build
```

#### Step 5: Environment Configuration
```bash
# Copy and edit environment files
cp .env.production.example .env.production
cp web-interface/.env.production.example web-interface/.env.production

# Edit with your production settings
nano .env.production
nano web-interface/.env.production
```

#### Step 6: Nginx Configuration
```bash
# Copy nginx configuration
sudo cp deploy/nginx-production.conf /etc/nginx/sites-available/neurogrid
sudo ln -s /etc/nginx/sites-available/neurogrid /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Test and restart nginx
sudo nginx -t
sudo systemctl restart nginx
```

#### Step 7: Start Applications
```bash
# Start with PM2
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

## 🔍 Verification

### Health Checks
```bash
# Check API health
curl https://api.neurogrid.network/health

# Check web interface
curl https://app.neurogrid.network

# Check PM2 status
pm2 status
```

### Expected Response
```
✅ API: {"status":"ok","timestamp":"..."}
✅ Web: HTML page with NeuroGrid interface
✅ PM2: Both apps running (neurogrid-api, neurogrid-web)
```

## 📊 Resource Usage Estimation

| Component | RAM | Disk | CPU |
|-----------|-----|------|-----|
| API Server (2 instances) | 1GB | 3GB | 20% |
| Web Interface | 512MB | 2GB | 10% |
| PostgreSQL | 512MB | 2GB | 15% |
| Redis | 256MB | 500MB | 5% |
| Nginx | 128MB | 200MB | 5% |
| **TOTAL** | **2.4GB** | **7.7GB** | **55%** |

**Ваш сервер:** 13GB доступно ✅ (достаточно места!)

## 🔒 Security Checklist

- [x] SSL certificates (Let's Encrypt)
- [x] Firewall rules (UFW)
- [x] Environment variables (no hardcoded secrets)
- [x] Rate limiting (nginx)
- [x] Security headers
- [x] CORS configuration
- [x] Admin panel protection
- [ ] Database encryption at rest
- [ ] Log monitoring
- [ ] Backup strategy

## 🔧 Management Commands

### PM2 Process Management
```bash
# View status
pm2 status

# View logs
pm2 logs
pm2 logs neurogrid-api
pm2 logs neurogrid-web

# Restart applications
pm2 restart all
pm2 restart neurogrid-api

# Stop applications
pm2 stop all

# Monitor performance
pm2 monit
```

### Database Management
```bash
# Connect to production database
psql -h localhost -U neurogrid_prod -d neurogrid_prod

# Backup database
pg_dump neurogrid_prod > backup_$(date +%Y%m%d).sql

# Restore database
psql neurogrid_prod < backup_file.sql
```

### Nginx Management
```bash
# Test configuration
sudo nginx -t

# Reload configuration
sudo nginx -s reload

# Restart nginx
sudo systemctl restart nginx

# View nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## 🔄 Updates & Maintenance

### Application Updates
```bash
cd /var/www/neurogrid
git pull origin main

# Update API
cd coordinator-server
npm ci --production
pm2 restart neurogrid-api

# Update Web Interface
cd ../web-interface
npm ci --production
npm run build
pm2 restart neurogrid-web
```

### SSL Certificate Renewal
```bash
# Certificates auto-renew, but you can test:
sudo certbot renew --dry-run
```

### System Updates
```bash
sudo apt update && sudo apt upgrade -y
sudo reboot  # if kernel updates
```

## 🚨 Troubleshooting

### Common Issues

#### API not responding
```bash
# Check PM2 status
pm2 status

# Check logs
pm2 logs neurogrid-api

# Check database connection
psql -h localhost -U neurogrid_prod -d neurogrid_prod -c "SELECT 1;"
```

#### Web interface not loading
```bash
# Check if build exists
ls -la web-interface/.next/

# Rebuild if needed
cd web-interface
npm run build
pm2 restart neurogrid-web
```

#### SSL certificate issues
```bash
# Check certificate status
sudo certbot certificates

# Renew if needed
sudo certbot renew
sudo systemctl reload nginx
```

#### Database connection issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Check connection
netstat -an | grep 5432
```

## 📞 Support

If you encounter issues:

1. Check application logs: `pm2 logs`
2. Check nginx logs: `sudo tail -f /var/log/nginx/error.log`
3. Check system resources: `htop` or `top`
4. Check disk space: `df -h`

## 🎉 Success!

Once deployed, your NeuroGrid platform will be available at:

- 🌐 **Main App:** https://app.neurogrid.network
- 🔧 **API:** https://api.neurogrid.network
- 📊 **Admin:** https://admin.neurogrid.network (if enabled)

The platform is now ready for production use! 🚀