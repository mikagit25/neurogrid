# NeuroGrid Monitoring & Alerting System

## 📊 Comprehensive Infrastructure Monitoring

### 🏗️ Architecture Overview

The NeuroGrid monitoring system provides enterprise-level observability with:

- **Real-time health monitoring** with automated alerts
- **Multi-channel notifications** (Email, Slack, SMS, Webhooks)
- **Prometheus metrics collection** with Grafana visualization
- **Distributed logging** with ELK stack (optional)
- **Performance tracking** and SLA monitoring
- **Security event monitoring** and incident response

---

## 🚀 Quick Start

### 1. Setup Monitoring Infrastructure

```bash
# Make the setup script executable
chmod +x setup-monitoring.sh

# Run the setup script
./setup-monitoring.sh
```

This script will:
- Create necessary directories and SSL certificates
- Generate environment configuration
- Start all monitoring services in Docker containers
- Perform health checks

### 2. Access Monitoring Dashboards

| Service | URL | Purpose |
|---------|-----|---------|
| **Main Application** | http://localhost:3000 | NeuroGrid Coordinator API |
| **Grafana Dashboard** | http://localhost:3001 | Metrics visualization |
| **Prometheus** | http://localhost:9090 | Metrics collection & queries |
| **AlertManager** | http://localhost:9093 | Alert management |
| **Kibana** (optional) | http://localhost:5601 | Log analysis |

### 3. Health Check Endpoints

```bash
# Basic health check
curl http://localhost:3000/api/monitoring/health

# Detailed system information
curl http://localhost:3000/api/monitoring/health/detailed

# Kubernetes-style probes
curl http://localhost:3000/api/monitoring/health/live
curl http://localhost:3000/api/monitoring/health/ready

# Prometheus metrics
curl http://localhost:3000/api/monitoring/metrics/prometheus
```

---

## 🔧 Components

### 1. Health Monitor (`HealthMonitor.js`)

**Core health monitoring service that tracks:**

- **System Resources**: CPU usage, memory consumption, disk space
- **Database Health**: Connection status, query performance, connection pooling
- **Redis Health**: Connection status, memory usage
- **External Services**: Payment gateways, third-party APIs
- **Application Performance**: Response times, error rates

**Key Features:**
- ⏰ Configurable check intervals (default: 30 seconds)
- 🎯 Threshold-based alerting
- 📈 Performance metrics tracking
- 🔄 Automatic recovery detection

### 2. Alerting System (`AlertingSystem.js`)

**Multi-channel notification system with:**

**Notification Channels:**
- 📧 **Email**: SMTP-based email alerts
- 💬 **Slack**: Webhook integration with rich formatting
- 📱 **SMS**: Twilio integration for critical alerts
- 🔗 **Webhooks**: Custom webhook endpoints

**Alert Severity Levels:**
- 🟢 **Low**: Email notifications, 30min cooldown
- 🟡 **Medium**: Email + Slack, 15min cooldown, escalates to High after 30min
- 🔴 **High**: Email + Slack + SMS, 5min cooldown, escalates to Critical after 15min
- 🟣 **Critical**: All channels, 2min cooldown, immediate escalation

**Smart Features:**
- 🔄 Alert escalation workflows
- 🕐 Cooldown periods to prevent spam
- 📊 Alert suppression for duplicates
- ✅ Automatic resolution notifications

### 3. Metrics Collector (`MetricsCollector.js`)

**Prometheus-compatible metrics collection:**

**HTTP Metrics:**
- Request duration histograms
- Request count by status/method/route
- Active connection tracking

**Database Metrics:**
- Query duration histograms
- Connection pool statistics
- Transaction success/failure rates

**Authentication Metrics:**
- Login attempt tracking
- 2FA usage statistics
- API key usage patterns

**Security Metrics:**
- Rate limiting events
- Security violations
- Brute force attempt detection

**Business Metrics:**
- Task completion rates
- Payment processing stats
- Node network statistics

### 4. Monitoring Controller (`MonitoringController.js`)

**RESTful API for monitoring operations:**

```javascript
// Get current health status
GET /api/monitoring/health

// Get detailed system information
GET /api/monitoring/health/detailed

// Kubernetes-style health probes
GET /api/monitoring/health/live    // Liveness probe
GET /api/monitoring/health/ready   // Readiness probe

// Metrics endpoints
GET /api/monitoring/metrics                 // JSON metrics
GET /api/monitoring/metrics/prometheus      // Prometheus format

// Alert management
GET /api/monitoring/alerts/active          // Active alerts
GET /api/monitoring/alerts/history         // Alert history
GET /api/monitoring/alerts/stats           // Alert statistics
POST /api/monitoring/alerts/:id/resolve    // Manually resolve alert
POST /api/monitoring/alerts/test           // Send test alert

// System information
GET /api/monitoring/system/info            // System details
GET /api/monitoring/system/performance     // Performance metrics
```

---

## ⚙️ Configuration

### Environment Variables (`.env`)

```bash
# Application
NODE_ENV=production
JWT_SECRET=your-jwt-secret
API_KEY_SECRET=your-api-key-secret

# Database & Cache
DATABASE_URL=postgresql://neurogrid:pass@postgres:5432/neurogrid_coordinator
REDIS_URL=redis://redis:6379

# Monitoring Thresholds
HEALTH_CHECK_INTERVAL=30000              # 30 seconds
CPU_ALERT_THRESHOLD=80                   # 80% CPU usage
MEMORY_ALERT_THRESHOLD=85                # 85% memory usage
DISK_SPACE_ALERT_THRESHOLD=90            # 90% disk usage
RESPONSE_TIME_ALERT_THRESHOLD=5000       # 5 second response time
ERROR_RATE_ALERT_THRESHOLD=5             # 5% error rate

# Email Alerts
ALERT_EMAIL_ENABLED=true
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=alerts@neurogrid.com
SMTP_PASS=your-app-password
ALERT_EMAIL_FROM=alerts@neurogrid.com
ALERT_EMAIL_TO=admin@neurogrid.com,dev-team@neurogrid.com

# Slack Alerts
ALERT_SLACK_ENABLED=true
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
SLACK_CHANNEL=#alerts
SLACK_USERNAME=NeuroGrid Alerts

# SMS Alerts (Twilio)
ALERT_SMS_ENABLED=true
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_FROM_NUMBER=+1234567890
ALERT_SMS_TO=+1234567890,+0987654321

# Webhook Alerts
ALERT_WEBHOOK_ENABLED=true
ALERT_WEBHOOK_URLS=https://your-webhook-endpoint.com/alerts

# Grafana
GRAFANA_ADMIN_PASSWORD=secure-admin-password
```

---

## 🐳 Docker Deployment

### Full Stack with Monitoring

```bash
# Start complete monitoring infrastructure
docker-compose -f docker-compose.monitoring.yml up -d

# Start with ELK stack for logging
docker-compose -f docker-compose.monitoring.yml --profile logging up -d

# Scale specific services
docker-compose -f docker-compose.monitoring.yml up -d --scale coordinator=3

# View logs
docker-compose -f docker-compose.monitoring.yml logs -f coordinator

# Service health status
docker-compose -f docker-compose.monitoring.yml ps
```

### Container Health Checks

All services include proper health checks:

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/api/monitoring/health/live"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

---

## 📈 Grafana Dashboards

### Pre-configured Dashboards

1. **System Overview**
   - System resource utilization
   - Application performance metrics
   - Database connection status
   - Alert summary

2. **Application Performance**
   - HTTP request metrics
   - Response time percentiles
   - Error rate trends
   - Active sessions

3. **Database Monitoring**
   - Query performance
   - Connection pool status
   - Transaction rates
   - Slow query identification

4. **Security Dashboard**
   - Authentication events
   - Rate limiting statistics
   - Security violations
   - Brute force attempts

5. **Business Metrics**
   - Task completion rates
   - Payment processing
   - Node network status
   - Revenue tracking

### Custom Dashboard Creation

```json
{
  "dashboard": {
    "title": "NeuroGrid Custom Dashboard",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(neurogrid_http_requests_total[5m])",
            "legendFormat": "{{method}} {{route}}"
          }
        ]
      }
    ]
  }
}
```

---

## 🚨 Alert Rules & Prometheus

### Pre-configured Alert Rules

**Critical Alerts:**
- Application down (1 minute)
- Database unavailable (1 minute)
- High error rate (>5% for 3 minutes)

**High Priority:**
- Application unhealthy (2 minutes)
- Disk space critical (>90% for 5 minutes)
- Brute force attacks (>20 failed logins/minute)

**Medium Priority:**
- High response time (>5s for 5 minutes)
- High resource usage (CPU >80%, Memory >85%)
- Payment failures (>5% for 10 minutes)

**Low Priority:**
- System warnings
- Non-critical service degradation

### Custom Alert Rules

```yaml
groups:
  - name: custom.rules
    rules:
      - alert: CustomBusinessAlert
        expr: neurogrid_business_custom_metric > 100
        for: 5m
        labels:
          severity: medium
          service: business
        annotations:
          summary: "Custom business threshold exceeded"
          description: "Custom metric is {{ $value }}"
```

---

## 🔒 Security Monitoring

### Security Event Tracking

- **Authentication Events**: Login attempts, 2FA usage, API key access
- **Rate Limiting**: Threshold violations, IP blocking
- **Input Validation**: Malicious input attempts, XSS prevention
- **API Security**: Unauthorized access attempts, privilege escalation

### Security Alerts

```javascript
// Example: Record security event
monitoringController.recordSecurityEvent('suspicious_login', 'high', {
  ip: req.ip,
  userAgent: req.get('user-agent'),
  attempts: 5
});

// Example: Record authentication event
monitoringController.recordAuthenticationEvent('login', false, userId);
```

---

## 📊 Performance Optimization

### Database Query Monitoring

```javascript
// Automatic query performance tracking
const startTime = Date.now();
const result = await db.query('SELECT * FROM nodes');
const duration = Date.now() - startTime;

monitoringController.recordDatabaseQuery('SELECT', 'nodes', duration, true);
```

### HTTP Request Tracking

```javascript
// Automatic request/response tracking via middleware
app.use(monitoringController.getPerformanceMiddleware());

// Manual tracking
const responseTime = Date.now() - req.startTime;
monitoringController.recordRequest(req, res, responseTime);
```

---

## 🛠️ Troubleshooting

### Common Issues

**1. High Memory Usage**
```bash
# Check memory usage
curl http://localhost:3000/api/monitoring/system/info

# View memory metrics in Grafana
# Check for memory leaks in application logs
docker-compose logs coordinator | grep -i memory
```

**2. Database Connection Issues**
```bash
# Check database health
curl http://localhost:3000/api/monitoring/health | jq '.components.database'

# Verify database connectivity
docker-compose exec postgres pg_isready -U neurogrid
```

**3. Alert Notification Failures**
```bash
# Test alert channels
curl -X POST http://localhost:3000/api/monitoring/alerts/test \
  -H "Content-Type: application/json" \
  -d '{"severity": "low"}'

# Check AlertManager logs
docker-compose logs alertmanager
```

### Debugging Commands

```bash
# View all monitoring metrics
curl http://localhost:3000/api/monitoring/metrics | jq '.'

# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# View active alerts
curl http://localhost:3000/api/monitoring/alerts/active

# System performance check
curl http://localhost:3000/api/monitoring/system/performance
```

---

## 📋 Maintenance

### Regular Tasks

**Daily:**
- Review alert history and trends
- Check system resource usage
- Verify backup completion

**Weekly:**
- Update alert thresholds based on trends
- Review and optimize slow queries
- Clean up old logs and metrics

**Monthly:**
- Review and update monitoring dashboards
- Test disaster recovery procedures
- Update monitoring infrastructure

### Log Rotation

```bash
# Configure log rotation in docker-compose.monitoring.yml
logging:
  driver: "json-file"
  options:
    max-size: "100m"
    max-file: "5"
```

---

## 🔗 Integration Examples

### Custom Business Metrics

```javascript
// Track custom business events
const monitoringController = require('./controllers/MonitoringController');

// Task completion
monitoringController.recordBusinessMetric('task_completed', 1, {
  type: 'ai_training',
  duration: taskDuration,
  success: true
});

// Payment processing
monitoringController.recordBusinessMetric('payment_processed', amount, {
  currency: 'USD',
  gateway: 'stripe',
  success: true
});

// Node network events
monitoringController.recordBusinessMetric('node_joined', 1, {
  region: node.region,
  capabilities: node.supported_models.join(',')
});
```

### Health Check Integration

```javascript
// Custom health check
app.get('/api/custom/health', async (req, res) => {
  const health = await monitoringController.healthMonitor.getHealthStatus();
  
  // Add custom checks
  const customHealth = {
    ...health,
    customService: await checkCustomService(),
    externalAPI: await checkExternalAPI()
  };
  
  res.json(customHealth);
});
```

---

This comprehensive monitoring system provides production-ready observability for the NeuroGrid platform with automated alerting, performance tracking, and security monitoring. The system is designed to scale with your infrastructure and provide early warning of potential issues.