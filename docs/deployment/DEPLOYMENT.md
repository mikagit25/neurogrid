# NeuroGrid Deployment Scripts and Configuration

## Quick Start Commands

### Development Environment
```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f coordinator

# Stop development environment
docker-compose -f docker-compose.dev.yml down
```

### Production Environment
```bash
# Start production environment
docker-compose -f docker-compose.production.yml up -d

# Scale coordinator service
docker-compose -f docker-compose.production.yml up -d --scale coordinator=3

# View logs
docker-compose -f docker-compose.production.yml logs -f coordinator

# Stop production environment
docker-compose -f docker-compose.production.yml down
```

### Kubernetes Deployment
```bash
# Create namespace and deploy all services
kubectl apply -f k8s/monitoring-deployment.yaml
kubectl apply -f k8s/database-deployment.yaml
kubectl apply -f k8s/coordinator-config.yaml
kubectl apply -f k8s/coordinator-deployment.yaml

# Check deployment status
kubectl get pods -n neurogrid
kubectl get services -n neurogrid

# View logs
kubectl logs -f deployment/neurogrid-coordinator -n neurogrid

# Scale deployment
kubectl scale deployment neurogrid-coordinator --replicas=5 -n neurogrid
```

## Environment Variables

### Required Production Variables
```bash
# Database
export POSTGRES_PASSWORD="your-secure-postgres-password"
export DATABASE_URL="postgresql://neurogrid:${POSTGRES_PASSWORD}@postgres:5432/neurogrid"

# Redis
export REDIS_URL="redis://redis:6379"

# Security
export JWT_SECRET="your-super-secret-jwt-key-change-this-in-production"

# Stripe
export STRIPE_SECRET_KEY="sk_live_your_stripe_secret_key"
export STRIPE_WEBHOOK_SECRET="whsec_your_webhook_secret"
export STRIPE_PUBLIC_KEY="pk_live_your_stripe_public_key"

# Monitoring
export GRAFANA_PASSWORD="your-grafana-admin-password"
```

### Optional Configuration
```bash
# Logging
export LOG_LEVEL="info"  # debug, info, warn, error

# Features
export RATE_LIMIT_ENABLED="true"
export CACHE_ENABLED="true"

# Performance
export NODE_ENV="production"
export WEB_CONCURRENCY="4"  # Number of worker processes
```

## Security Considerations

### Before Production Deployment
1. **Change all default passwords** in `k8s/coordinator-config.yaml`
2. **Update JWT secrets** and API keys
3. **Configure SSL certificates** for HTTPS
4. **Set up proper firewall rules**
5. **Enable audit logging**
6. **Configure backup strategies**

### Kubernetes Secrets Management
```bash
# Create secrets from command line
kubectl create secret generic neurogrid-secrets \
  --from-literal=database-url="postgresql://..." \
  --from-literal=jwt-secret="..." \
  --from-literal=stripe-secret-key="..." \
  -n neurogrid

# Or use external secret management
# - AWS Secrets Manager
# - HashiCorp Vault
# - Azure Key Vault
```

## Monitoring and Observability

### Access Dashboards
- **Grafana**: http://localhost:3002 (admin/admin123)
- **Prometheus**: http://localhost:9090
- **Application Metrics**: http://localhost:3001/metrics

### Key Metrics to Monitor
- HTTP request rate and latency
- Database connection pool usage
- Redis cache hit rate
- Memory and CPU usage
- Error rates and types
- WebSocket connection counts

### Alerting Rules
- High error rate (>5% over 5 minutes)
- High memory usage (>90%)
- High CPU usage (>80%)
- Database connection failures
- Redis connection failures

## Backup and Recovery

### Database Backups
```bash
# Manual backup
kubectl exec -n neurogrid postgres-pod-name -- pg_dump -U neurogrid neurogrid > backup.sql

# Automated backups (add to cron)
kubectl create job --from=cronjob/postgres-backup manual-backup-$(date +%Y%m%d-%H%M%S) -n neurogrid
```

### Redis Persistence
Redis is configured with both RDB snapshots and AOF persistence for data durability.

## Performance Tuning

### Database Optimization
- Connection pooling configured for high concurrency
- Indexes on frequently queried columns
- Vacuum and analyze scheduled regularly

### Redis Configuration
- Memory limit: 512MB with LRU eviction
- Persistence: AOF with every second sync
- Connection pooling enabled

### Application Performance
- Node.js cluster mode for multi-core usage
- Gzip compression enabled
- Static file caching
- Database query optimization

## Troubleshooting

### Common Issues

#### Database Connection Errors
```bash
# Check PostgreSQL status
kubectl get pods -l app=postgres -n neurogrid
kubectl logs -l app=postgres -n neurogrid

# Test connection
kubectl exec -it postgres-pod-name -n neurogrid -- psql -U neurogrid -d neurogrid -c "SELECT version();"
```

#### Redis Connection Issues
```bash
# Check Redis status
kubectl get pods -l app=redis -n neurogrid
kubectl logs -l app=redis -n neurogrid

# Test Redis
kubectl exec -it redis-pod-name -n neurogrid -- redis-cli ping
```

#### Application Health Checks
```bash
# Check application health
curl http://your-domain/api/monitoring/health
curl http://your-domain/api/monitoring/ready

# View application logs
kubectl logs -f deployment/neurogrid-coordinator -n neurogrid
```

### Performance Issues
1. Check metrics in Grafana dashboards
2. Analyze slow query logs in PostgreSQL
3. Monitor Redis memory usage and eviction
4. Review application error logs
5. Check resource limits and requests

## Scaling Guidelines

### Horizontal Scaling
```bash
# Scale coordinator service
kubectl scale deployment neurogrid-coordinator --replicas=N -n neurogrid

# Auto-scaling is configured with HPA:
# - CPU target: 70%
# - Memory target: 80%
# - Min replicas: 3
# - Max replicas: 10
```

### Vertical Scaling
Update resource limits in `k8s/coordinator-deployment.yaml`:
```yaml
resources:
  requests:
    memory: "512Mi"
    cpu: "500m"
  limits:
    memory: "1Gi"
    cpu: "1000m"
```

### Database Scaling
- Read replicas for read-heavy workloads
- Connection pooling optimization
- Query optimization and indexing
- Consider database sharding for very large datasets

## CI/CD Pipeline

The GitHub Actions pipeline includes:
1. **Code Quality**: ESLint, Prettier, Security audit
2. **Testing**: Unit, Integration, E2E tests
3. **Security**: CodeQL analysis, Container scanning
4. **Build**: Multi-platform Docker images
5. **Deploy**: Automated staging and production deployments

### Pipeline Secrets Required
```bash
# GitHub Repository Secrets
DOCKER_USERNAME=your-docker-username
DOCKER_PASSWORD=your-docker-password
KUBE_CONFIG_STAGING=base64-encoded-kubeconfig
KUBE_CONFIG_PRODUCTION=base64-encoded-kubeconfig
SLACK_WEBHOOK_URL=your-slack-webhook-url
STAGING_URL=https://staging.neurogrid.com
```

This comprehensive deployment setup provides a production-ready infrastructure with monitoring, security, scalability, and automated deployment capabilities.