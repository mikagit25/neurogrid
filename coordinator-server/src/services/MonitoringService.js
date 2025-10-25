const os = require('os');
const logger = require('../utils/logger');
const { healthCheck } = require('../utils/apiHelpers');

class MonitoringService {
  constructor() {
    this.metrics = {
      system: {},
      application: {},
      business: {},
      errors: {}
    };

    this.alerts = new Map();
    this.thresholds = {
      cpu: { warning: 70, critical: 90 },
      memory: { warning: 80, critical: 95 },
      disk: { warning: 85, critical: 95 },
      responseTime: { warning: 1000, critical: 5000 },
      errorRate: { warning: 5, critical: 10 }
    };

    this.monitoringInterval = null;
    this.startTime = Date.now();
    this.requestMetrics = new Map(); // endpoint -> metrics
    this.performanceHistory = [];
    this.maxHistorySize = 1000;
  }

  initialize() {
    this.startMonitoring();
    logger.info('Monitoring service initialized');
  }

  startMonitoring() {
    // Collect metrics every 30 seconds
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, 30000);

    // Clean up old performance history every 5 minutes
    setInterval(() => {
      this.cleanupHistory();
    }, 5 * 60 * 1000);
  }

  collectMetrics() {
    try {
      const systemMetrics = this.collectSystemMetrics();
      const appMetrics = this.collectApplicationMetrics();

      this.metrics.system = systemMetrics;
      this.metrics.application = appMetrics;
      this.metrics.timestamp = new Date().toISOString();

      // Check for alerts
      this.checkAlerts(systemMetrics, appMetrics);

      // Store in history
      this.storeInHistory({
        timestamp: new Date().toISOString(),
        system: systemMetrics,
        application: appMetrics
      });

      // Update health check
      this.updateHealthStatus();

    } catch (error) {
      logger.error('Error collecting metrics', { error: error.message });
    }
  }

  collectSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const loadAvg = os.loadavg();

    return {
      // CPU metrics
      cpu: {
        usage: process.cpuUsage(),
        loadAverage: {
          '1m': loadAvg[0],
          '5m': loadAvg[1],
          '15m': loadAvg[2]
        },
        cores: os.cpus().length
      },

      // Memory metrics
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss,
        system: {
          total: os.totalmem(),
          free: os.freemem(),
          used: os.totalmem() - os.freemem()
        },
        percentage: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100
      },

      // Process metrics
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        version: process.version,
        platform: process.platform,
        arch: process.arch
      },

      // Network interfaces
      network: os.networkInterfaces(),

      // System info
      hostname: os.hostname(),
      type: os.type(),
      release: os.release(),
      uptime: os.uptime()
    };
  }

  collectApplicationMetrics() {
    return {
      // Request metrics
      requests: this.getRequestMetrics(),

      // Database metrics (placeholder)
      database: {
        connections: 0,
        queries: 0,
        averageQueryTime: 0
      },

      // Cache metrics (placeholder)
      cache: {
        hits: 0,
        misses: 0,
        hitRate: 0
      },

      // Business metrics
      business: this.getBusinessMetrics(),

      // Error metrics
      errors: this.getErrorMetrics()
    };
  }

  getRequestMetrics() {
    const totalRequests = Array.from(this.requestMetrics.values())
      .reduce((sum, metrics) => sum + metrics.count, 0);

    const totalResponseTime = Array.from(this.requestMetrics.values())
      .reduce((sum, metrics) => sum + (metrics.totalTime || 0), 0);

    const avgResponseTime = totalRequests > 0 ? totalResponseTime / totalRequests : 0;

    return {
      total: totalRequests,
      averageResponseTime: avgResponseTime,
      byEndpoint: Object.fromEntries(this.requestMetrics)
    };
  }

  getBusinessMetrics() {
    // In a real application, these would come from your business logic
    return {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      activeNodes: 0,
      totalUsers: 0,
      activeUsers: 0
    };
  }

  getErrorMetrics() {
    return {
      total: this.metrics.errors.total || 0,
      rate: this.metrics.errors.rate || 0,
      byType: this.metrics.errors.byType || {},
      recent: this.metrics.errors.recent || []
    };
  }

  // Request tracking
  trackRequest(method, path, responseTime, statusCode) {
    const endpoint = `${method} ${path}`;

    if (!this.requestMetrics.has(endpoint)) {
      this.requestMetrics.set(endpoint, {
        count: 0,
        totalTime: 0,
        averageTime: 0,
        statusCodes: {},
        errors: 0
      });
    }

    const metrics = this.requestMetrics.get(endpoint);
    metrics.count++;
    metrics.totalTime += responseTime;
    metrics.averageTime = metrics.totalTime / metrics.count;

    // Track status codes
    if (!metrics.statusCodes[statusCode]) {
      metrics.statusCodes[statusCode] = 0;
    }
    metrics.statusCodes[statusCode]++;

    // Count errors (4xx and 5xx)
    if (statusCode >= 400) {
      metrics.errors++;
    }
  }

  // Error tracking
  trackError(error, context = {}) {
    if (!this.metrics.errors.total) {
      this.metrics.errors = {
        total: 0,
        rate: 0,
        byType: {},
        recent: []
      };
    }

    this.metrics.errors.total++;

    const errorType = error.name || 'UnknownError';
    if (!this.metrics.errors.byType[errorType]) {
      this.metrics.errors.byType[errorType] = 0;
    }
    this.metrics.errors.byType[errorType]++;

    // Store recent errors (last 100)
    this.metrics.errors.recent.unshift({
      type: errorType,
      message: error.message,
      timestamp: new Date().toISOString(),
      context
    });

    if (this.metrics.errors.recent.length > 100) {
      this.metrics.errors.recent = this.metrics.errors.recent.slice(0, 100);
    }

    // Calculate error rate (errors per minute)
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const recentErrors = this.metrics.errors.recent.filter(
      err => new Date(err.timestamp).getTime() > oneMinuteAgo
    );
    this.metrics.errors.rate = recentErrors.length;
  }

  // Alert system
  checkAlerts(systemMetrics, appMetrics) {
    const checks = [
      {
        name: 'high_cpu',
        value: systemMetrics.cpu.loadAverage['1m'],
        threshold: this.thresholds.cpu,
        message: 'High CPU usage detected'
      },
      {
        name: 'high_memory',
        value: systemMetrics.memory.percentage,
        threshold: this.thresholds.memory,
        message: 'High memory usage detected'
      },
      {
        name: 'high_response_time',
        value: appMetrics.requests.averageResponseTime,
        threshold: this.thresholds.responseTime,
        message: 'High response time detected'
      },
      {
        name: 'high_error_rate',
        value: this.metrics.errors.rate,
        threshold: this.thresholds.errorRate,
        message: 'High error rate detected'
      }
    ];

    checks.forEach(check => {
      const { name, value, threshold, message } = check;
      const existingAlert = this.alerts.get(name);

      if (value >= threshold.critical) {
        if (!existingAlert || existingAlert.level !== 'critical') {
          this.raiseAlert(name, 'critical', message, value);
        }
      } else if (value >= threshold.warning) {
        if (!existingAlert || existingAlert.level !== 'warning') {
          this.raiseAlert(name, 'warning', message, value);
        }
      } else {
        if (existingAlert) {
          this.resolveAlert(name);
        }
      }
    });
  }

  raiseAlert(name, level, message, value) {
    const alert = {
      name,
      level,
      message,
      value,
      timestamp: new Date().toISOString(),
      resolved: false
    };

    this.alerts.set(name, alert);

    logger.warn('Alert raised', alert);

    // In production, send to alerting system (PagerDuty, Slack, etc.)
    this.sendAlert(alert);
  }

  resolveAlert(name) {
    const alert = this.alerts.get(name);
    if (alert) {
      alert.resolved = true;
      alert.resolvedAt = new Date().toISOString();

      logger.info('Alert resolved', { name, duration: alert.resolvedAt - alert.timestamp });

      this.alerts.delete(name);
    }
  }

  sendAlert(alert) {
    // Placeholder for external alerting integration
    // Could send to Slack, email, PagerDuty, etc.
    console.log('🚨 ALERT:', alert);
  }

  // Health status
  updateHealthStatus() {
    const metrics = this.metrics;
    const alerts = Array.from(this.alerts.values());

    // Determine overall health
    let status = 'healthy';
    if (alerts.some(alert => alert.level === 'critical')) {
      status = 'critical';
    } else if (alerts.some(alert => alert.level === 'warning')) {
      status = 'degraded';
    }

    healthCheck.setServiceStatus('system', status, {
      cpu: metrics.system.cpu?.loadAverage['1m'],
      memory: metrics.system.memory?.percentage,
      uptime: metrics.system.process?.uptime,
      activeAlerts: alerts.length
    });
  }

  // Data management
  storeInHistory(snapshot) {
    this.performanceHistory.push(snapshot);

    if (this.performanceHistory.length > this.maxHistorySize) {
      this.performanceHistory = this.performanceHistory.slice(-this.maxHistorySize);
    }
  }

  cleanupHistory() {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours

    this.performanceHistory = this.performanceHistory.filter(
      snapshot => new Date(snapshot.timestamp).getTime() > cutoffTime
    );
  }

  // Query methods
  getMetrics() {
    return {
      ...this.metrics,
      uptime: Date.now() - this.startTime,
      alerts: Array.from(this.alerts.values())
    };
  }

  getHistoricalMetrics(timeframe = '1h') {
    const now = Date.now();
    let cutoffTime;

    switch (timeframe) {
    case '5m':
      cutoffTime = now - (5 * 60 * 1000);
      break;
    case '1h':
      cutoffTime = now - (60 * 60 * 1000);
      break;
    case '6h':
      cutoffTime = now - (6 * 60 * 60 * 1000);
      break;
    case '24h':
      cutoffTime = now - (24 * 60 * 60 * 1000);
      break;
    default:
      cutoffTime = now - (60 * 60 * 1000);
    }

    return this.performanceHistory.filter(
      snapshot => new Date(snapshot.timestamp).getTime() > cutoffTime
    );
  }

  getAlerts(active = true) {
    const allAlerts = Array.from(this.alerts.values());
    return active ? allAlerts.filter(alert => !alert.resolved) : allAlerts;
  }

  // Performance analysis
  getPerformanceReport() {
    const metrics = this.getMetrics();
    const history = this.getHistoricalMetrics('1h');

    return {
      current: metrics,
      trends: this.calculateTrends(history),
      recommendations: this.generateRecommendations(metrics),
      summary: {
        status: this.getOverallStatus(),
        totalRequests: metrics.application.requests.total,
        averageResponseTime: metrics.application.requests.averageResponseTime,
        errorRate: metrics.errors.rate,
        uptime: metrics.uptime
      }
    };
  }

  calculateTrends(history) {
    if (history.length < 2) {
      return {};
    }

    const latest = history[history.length - 1];
    const previous = history[0];

    return {
      cpu: this.calculateTrend(
        previous.system.cpu.loadAverage['1m'],
        latest.system.cpu.loadAverage['1m']
      ),
      memory: this.calculateTrend(
        previous.system.memory.percentage,
        latest.system.memory.percentage
      ),
      responseTime: this.calculateTrend(
        previous.application.requests.averageResponseTime,
        latest.application.requests.averageResponseTime
      )
    };
  }

  calculateTrend(oldValue, newValue) {
    if (oldValue === 0) return 0;
    return ((newValue - oldValue) / oldValue) * 100;
  }

  generateRecommendations(metrics) {
    const recommendations = [];

    if (metrics.system.memory.percentage > 80) {
      recommendations.push({
        type: 'memory',
        severity: 'high',
        message: 'Consider increasing memory allocation or optimizing memory usage'
      });
    }

    if (metrics.application.requests.averageResponseTime > 1000) {
      recommendations.push({
        type: 'performance',
        severity: 'medium',
        message: 'Response times are high. Consider optimizing slow endpoints'
      });
    }

    if (metrics.errors.rate > 5) {
      recommendations.push({
        type: 'reliability',
        severity: 'high',
        message: 'Error rate is elevated. Investigate recent errors'
      });
    }

    return recommendations;
  }

  getOverallStatus() {
    const alerts = this.getAlerts(true);

    if (alerts.some(alert => alert.level === 'critical')) {
      return 'critical';
    } else if (alerts.some(alert => alert.level === 'warning')) {
      return 'warning';
    } else {
      return 'healthy';
    }
  }

  // Configuration
  updateThresholds(newThresholds) {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    logger.info('Monitoring thresholds updated', newThresholds);
  }

  // Cleanup
  shutdown() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    logger.info('Monitoring service stopped');
  }
}

// Singleton instance
const monitoringService = new MonitoringService();

module.exports = monitoringService;
