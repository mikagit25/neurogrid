# NeuroGrid Deployment Configuration

## Docker Configuration

### Dockerfile for Coordinator Server
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

EXPOSE 3001

CMD ["node", "src/app.js"]
```

### Docker Compose Setup
```yaml
version: '3.8'

services:
  coordinator:
    build: ./coordinator-server
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://user:pass@db:5432/neurogrid
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis

  web-interface:
    build: ./web-interface
    ports:
      - "3000:3000"
    depends_on:
      - coordinator

  db:
    image: postgres:15
    environment:
      POSTGRES_DB: neurogrid
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

## Kubernetes Deployment

### Coordinator Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: neurogrid-coordinator
spec:
  replicas: 3
  selector:
    matchLabels:
      app: neurogrid-coordinator
  template:
    metadata:
      labels:
        app: neurogrid-coordinator
    spec:
      containers:
      - name: coordinator
        image: neurogrid/coordinator:latest
        ports:
        - containerPort: 3001
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: neurogrid-secrets
              key: database-url
```

## CI/CD Pipeline

### GitHub Actions
```yaml
name: Deploy NeuroGrid

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: npm ci
      
    - name: Run tests
      run: npm test
      
    - name: Build Docker image
      run: docker build -t neurogrid/coordinator .
      
    - name: Deploy to production
      run: kubectl apply -f k8s/
```

## Production Configuration

### Environment Variables
```bash
NODE_ENV=production
PORT=3001
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=your-super-secret-key
API_RATE_LIMIT=1000
```

### Nginx Configuration
```nginx
upstream neurogrid_coordinator {
    server coordinator:3001;
}

server {
    listen 80;
    server_name api.neurogrid.io;
    
    location / {
        proxy_pass http://neurogrid_coordinator;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Monitoring & Scaling

### Auto-scaling Configuration
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: neurogrid-coordinator-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: neurogrid-coordinator
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

## Database Migrations

### Production Migration Script
```javascript
const { Pool } = require('pg');

async function runMigrations() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  
  // Run migration files
  const migrations = await fs.readdir('./migrations');
  for (const migration of migrations) {
    await pool.query(fs.readFileSync(`./migrations/${migration}`, 'utf8'));
  }
  
  await pool.end();
}

runMigrations().catch(console.error);
```

## Backup & Recovery

### Database Backup
```bash
#!/bin/bash
pg_dump $DATABASE_URL | gzip > backup-$(date +%Y%m%d).sql.gz
aws s3 cp backup-$(date +%Y%m%d).sql.gz s3://neurogrid-backups/
```

### Restore Script
```bash
#!/bin/bash
aws s3 cp s3://neurogrid-backups/$1 ./restore.sql.gz
gunzip restore.sql.gz
psql $DATABASE_URL < restore.sql
```