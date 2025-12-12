# NeuroGrid Production Deployment Guide

## Manual deployment steps (if SSH not available)

### 1. Copy API server file
Copy the working API server to production:
```bash
# From local: /Users/a123/neurogrid/coordinator-server/src/app-simple.js
# To server: /root/neurogrid-new/coordinator-server/src/app-simple.js
```

### 2. Update package.json 
Copy updated package.json with dev:simple script:
```bash
# From: /Users/a123/neurogrid/coordinator-server/package.json  
# To: /root/neurogrid-new/coordinator-server/package.json
```

### 3. Server commands to run:
```bash
# On production server:
cd /root/neurogrid-new/coordinator-server

# Install dependencies
npm install --production

# Stop existing API server
pm2 delete neurogrid-api || true

# Start new API server
pm2 start src/app-simple.js --name neurogrid-api --watch

# Save PM2 config
pm2 save

# Check status
pm2 status
```

### 4. Test API endpoints:
```bash
# Test locally on server
curl http://localhost:3001/health
curl http://localhost:3001/api/info
curl http://localhost:3001/api/network/status
```

### 5. Update nginx proxy (if needed):
The current nginx config proxies port 8080 to MVP.
API server runs on port 3001, so for api.neurogrid.network subdomain:

```nginx
# Add to nginx config:
server {
    listen 80;
    server_name api.neurogrid.network;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Files to copy:

1. **API Server**: coordinator-server/src/app-simple.js
2. **Package.json**: coordinator-server/package.json  
3. **Nginx config**: deploy/nginx-hybrid.conf (optional)

## Expected result:
- MVP site: ✅ Already working on port 8080
- API server: ✅ Working on port 3001 
- Web interface: 🔄 Future deployment

## Health checks:
- http://localhost:8080/health (MVP)
- http://localhost:3001/health (API)
- https://neurogrid.network (Public MVP)