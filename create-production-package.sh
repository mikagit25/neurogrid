#!/bin/bash

echo "📦 Creating production deployment package..."

# Create deployment directory
mkdir -p /Users/a123/neurogrid/production-deploy
cd /Users/a123/neurogrid/production-deploy

# Copy essential files
echo "📁 Copying API server files..."
mkdir -p coordinator-server/src
cp /Users/a123/neurogrid/coordinator-server/src/app-simple.js coordinator-server/src/
cp /Users/a123/neurogrid/coordinator-server/src/app-production.js coordinator-server/src/
cp /Users/a123/neurogrid/coordinator-server/package.json coordinator-server/

# Copy deployment scripts
echo "📋 Copying deployment scripts..."
cp /Users/a123/neurogrid/deploy-production.sh .
cp /Users/a123/neurogrid/READY-FOR-PRODUCTION.md .

# Create deployment instructions
cat > deploy-instructions.txt << 'EOF'
🚀 NeuroGrid Production Deployment Instructions

1. Copy this entire folder to your production server:
   scp -r production-deploy/ root@your-server:/root/

2. On production server, run:
   cd /root/production-deploy
   chmod +x deploy-production.sh
   ./deploy-production.sh

3. Or manually:
   cd /root/neurogrid-new/coordinator-server
   cp /root/production-deploy/coordinator-server/src/app-simple.js src/
   cp /root/production-deploy/coordinator-server/package.json .
   npm install --production
   pm2 delete neurogrid-api || true
   pm2 start src/app-simple.js --name neurogrid-api --watch
   pm2 save

4. Test:
   curl http://localhost:3001/health
   curl http://localhost:3001/api/info

✅ All files tested and ready for production!
EOF

# Create archive
echo "🗜️ Creating deployment archive..."
cd /Users/a123/neurogrid
tar -czf neurogrid-production-ready.tar.gz production-deploy/

echo "✅ Production package ready:"
echo "📦 Archive: /Users/a123/neurogrid/neurogrid-production-ready.tar.gz"
echo "📁 Folder: /Users/a123/neurogrid/production-deploy/"
echo ""
echo "🚀 Ready to deploy to production server!"