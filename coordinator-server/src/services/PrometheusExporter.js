const prometheus = require('prom-client');
const express = require('express');
const logger = require('../utils/logger');

/**
 * Prometheus Metrics Exporter for NeuroGrid
 *
 * Provides Prometheus-compatible metrics endpoint and
 * integrates with the existing monitoring service.
 */
class PrometheusExporter {
  constructor(monitoringService, options = {}) {
    this.monitoringService = monitoringService;
    this.port = options.port || 9090;
    this.path = options.path || '/metrics';
    this.collectInterval = options.collectInterval || 15000; // 15 seconds

    // Create separate registry for Prometheus metrics
    this.register = new prometheus.Registry();

    // Collect default Node.js metrics
    prometheus.collectDefaultMetrics({
      register: this.register,
      prefix: 'neurogrid_',
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5]
    });

    this.initializeCustomMetrics();
    this.setupMetricsCollection();

    logger.info('Prometheus exporter initialized', {
      port: this.port,
      path: this.path,
      collectInterval: this.collectInterval
    });
  }

  /**
   * Initialize custom Prometheus metrics
   */
  initializeCustomMetrics() {
    // HTTP metrics
    this.httpRequestsTotal = new prometheus.Counter({
      name: 'neurogrid_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.register]
    });

    this.httpRequestDuration = new prometheus.Histogram({
      name: 'neurogrid_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.register]
    });

    // System metrics
    this.cpuUsagePercent = new prometheus.Gauge({
      name: 'neurogrid_cpu_usage_percent',
      help: 'CPU usage percentage',
      registers: [this.register]
    });

    this.memoryUsageBytes = new prometheus.Gauge({
      name: 'neurogrid_memory_usage_bytes',
      help: 'Memory usage in bytes',
      labelNames: ['type'],
      registers: [this.register]
    });

    // Business metrics
    this.activeUsers = new prometheus.Gauge({
      name: 'neurogrid_active_users',
      help: 'Number of active users',
      registers: [this.register]
    });

    this.tasksTotal = new prometheus.Counter({
      name: 'neurogrid_tasks_total',
      help: 'Total number of tasks',
      labelNames: ['status', 'type'],
      registers: [this.register]
    });

    this.computeHours = new prometheus.Counter({
      name: 'neurogrid_compute_hours_total',
      help: 'Total compute hours consumed',
      labelNames: ['node_type'],
      registers: [this.register]
    });

    // WebSocket metrics
    this.websocketConnections = new prometheus.Gauge({
      name: 'neurogrid_websocket_connections_active',
      help: 'Number of active WebSocket connections',
      registers: [this.register]
    });

    // Database metrics
    this.databaseQueries = new prometheus.Counter({
      name: 'neurogrid_database_queries_total',
      help: 'Total number of database queries',
      labelNames: ['operation', 'status'],
      registers: [this.register]
    });

    // Cache metrics
    this.cacheHitRatio = new prometheus.Gauge({
      name: 'neurogrid_cache_hit_ratio',
      help: 'Cache hit ratio',
      registers: [this.register]
    });

    // Rate limiting metrics
    this.rateLimitedRequests = new prometheus.Counter({
      name: 'neurogrid_rate_limited_requests_total',
      help: 'Total number of rate limited requests',
      registers: [this.register]
    });

    // Error metrics
    this.errorsTotal = new prometheus.Counter({
      name: 'neurogrid_errors_total',
      help: 'Total number of errors',
      labelNames: ['type', 'severity'],
      registers: [this.register]
    });

    // Health score
    this.healthScore = new prometheus.Gauge({
      name: 'neurogrid_health_score',
      help: 'Overall system health score (0-1)',
      registers: [this.register]
    });
  }

  /**
   * Setup periodic metrics collection from monitoring service
   */
  setupMetricsCollection() {
    setInterval(() => {
      this.collectMetricsFromMonitoringService();
    }, this.collectInterval);

    // Initial collection
    this.collectMetricsFromMonitoringService();
  }

  /**
   * Collect metrics from the main monitoring service
   */
  collectMetricsFromMonitoringService() {
    try {
      if (!this.monitoringService) return;

      const stats = this.monitoringService.getStats?.() || {};
      const metrics = this.monitoringService.metrics || {};

      // Update system metrics
      if (metrics.system) {
        if (metrics.system.cpu) {
          this.cpuUsagePercent.set(metrics.system.cpu.usage || 0);
        }

        if (metrics.system.memory) {
          this.memoryUsageBytes.set({ type: 'used' }, metrics.system.memory.used || 0);
          this.memoryUsageBytes.set({ type: 'free' }, metrics.system.memory.free || 0);
          this.memoryUsageBytes.set({ type: 'total' }, metrics.system.memory.total || 0);
        }
      }

      // Update business metrics
      if (metrics.business) {
        this.activeUsers.set(metrics.business.activeUsers || 0);
      }

      // Update health score
      if (stats.healthScore !== undefined) {
        this.healthScore.set(stats.healthScore);
      }

    } catch (error) {
      logger.error('Error collecting metrics from monitoring service', {
        error: error.message
      });
    }
  }

  /**
   * Record HTTP request metrics
   */
  recordHttpRequest(method, route, statusCode, duration) {
    this.httpRequestsTotal.labels(method, route, statusCode.toString()).inc();
    this.httpRequestDuration.labels(method, route).observe(duration / 1000);
  }

  /**
   * Record task completion
   */
  recordTask(status, type = 'general') {
    this.tasksTotal.labels(status, type).inc();
  }

  /**
   * Record compute hours
   */
  recordComputeHours(hours, nodeType = 'gpu') {
    this.computeHours.labels(nodeType).inc(hours);
  }

  /**
   * Record WebSocket connection
   */
  recordWebSocketConnection(change) {
    this.websocketConnections.inc(change);
  }

  /**
   * Record database query
   */
  recordDatabaseQuery(operation, status = 'success') {
    this.databaseQueries.labels(operation, status).inc();
  }

  /**
   * Update cache hit ratio
   */
  updateCacheHitRatio(ratio) {
    this.cacheHitRatio.set(ratio);
  }

  /**
   * Record rate limited request
   */
  recordRateLimitedRequest() {
    this.rateLimitedRequests.inc();
  }

  /**
   * Record error
   */
  recordError(type, severity = 'error') {
    this.errorsTotal.labels(type, severity).inc();
  }

  /**
   * Create Express middleware for HTTP metrics
   */
  createMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now();

      // Override res.end to capture metrics
      const originalEnd = res.end;
      res.end = (...args) => {
        const duration = Date.now() - startTime;
        const route = req.route?.path || req.path || 'unknown';

        this.recordHttpRequest(req.method, route, res.statusCode, duration);

        originalEnd.apply(res, args);
      };

      next();
    };
  }

  /**
   * Get metrics in Prometheus format
   */
  async getMetrics() {
    return this.register.metrics();
  }

  /**
   * Start standalone metrics server
   */
  startMetricsServer() {
    const app = express();

    app.get(this.path, async (req, res) => {
      try {
        res.set('Content-Type', this.register.contentType);
        const metrics = await this.getMetrics();
        res.end(metrics);
      } catch (error) {
        logger.error('Error serving metrics', { error: error.message });
        res.status(500).send('Error generating metrics');
      }
    });

    app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

    const server = app.listen(this.port, () => {
      logger.info(`Prometheus metrics server started on port ${this.port}`);
      console.log(`📊 Metrics available at http://localhost:${this.port}${this.path}`);
    });

    return server;
  }

  /**
   * Get current metric values as JSON
   */
  async getMetricsJSON() {
    const metrics = await this.register.getMetricsAsJSON();
    return metrics;
  }

  /**
   * Reset all metrics
   */
  resetMetrics() {
    this.register.resetMetrics();
  }
}

module.exports = PrometheusExporter;
