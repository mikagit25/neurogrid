# 🚀 Quick Deploy Instructions

## Prerequisites (Already Done ✅)
- [x] DNS A-records configured: app → 37.77.106.215, api → 37.77.106.215
- [x] Nginx subdomain configuration deployed
- [x] Server access confirmed

## Deploy to Production

### Step 1: Connect to your server
```bash
ssh root@37.77.106.215
```

### Step 2: Run the automated deployment script
```bash
# Download the repository
git clone https://github.com/mikagit25/neurogrid.git /tmp/neurogrid-deploy
cd /tmp/neurogrid-deploy

# Make script executable
chmod +x deploy/production-deploy.sh

# Run deployment (this will take 5-10 minutes)
sudo ./deploy/production-deploy.sh
```

### Step 3: Verify deployment
After the script completes, check:
```bash
# Check PM2 processes
pm2 status

# Check if apps are responding
curl http://localhost:3000  # Web interface
curl http://localhost:3001/health  # API health check

# Check nginx status
sudo nginx -t
sudo systemctl status nginx
```

### Step 4: Get SSL certificates
```bash
sudo certbot certonly --nginx \
  -d neurogrid.network \
  -d www.neurogrid.network \
  -d app.neurogrid.network \
  -d api.neurogrid.network \
  --email admin@neurogrid.network \
  --agree-tos --non-interactive
```

### Step 5: Test the live system
Open in browser:
- https://app.neurogrid.network (web interface)
- https://api.neurogrid.network/health (API health)
- https://neurogrid.network (should redirect to app)

## Expected Timeline
- **Deployment script:** 5-10 minutes
- **SSL certificates:** 2-3 minutes  
- **DNS propagation:** Already done ✅
- **Total time:** ~15 minutes

## Troubleshooting
If something goes wrong:
```bash
# Check logs
pm2 logs

# Check nginx logs
sudo tail -f /var/log/nginx/error.log

# Restart applications
pm2 restart all
sudo systemctl reload nginx
```

## What the Script Does
1. ✅ Installs Node.js, PostgreSQL, Redis, PM2
2. ✅ Creates production database with secure password
3. ✅ Generates environment files with proper configuration
4. ✅ Installs dependencies and builds Next.js app
5. ✅ Starts apps with PM2 (API on :3001, Web on :3000)
6. ✅ Configures firewall and security settings
7. ✅ Validates deployment with health checks

Ready to deploy? Let's go! 🚀