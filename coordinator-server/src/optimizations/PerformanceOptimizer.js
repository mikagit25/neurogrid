/**
 * NeuroGrid Performance Optimizer
 * Comprehensive performance optimization system for coordinator-server
 */

const cluster = require('cluster');
const os = require('os');
const compression = require('compression');
const logger = require('../utils/logger');

class PerformanceOptimizer {
  constructor(app, config = {}) {
    this.app = app;
    this.config = {
      enableCluster: config.enableCluster !== false,
      enableCompression: config.enableCompression !== false,
      enableHttpCache: config.enableHttpCache !== false,
      enableStreamProcessing: config.enableStreamProcessing !== false,
      maxWorkers: config.maxWorkers || os.cpus().length,
      ...config
    };

    this.metrics = {
      requestCount: 0,
      responseTime: [],
      memoryUsage: [],
      lastOptimized: null
    };

    this.init();
  }

  init() {
    if (this.config.enableCluster && cluster.isMaster) {
      this.setupCluster();
      return;
    }

    this.setupCompressionOptimization();
    this.setupCacheOptimization();
    this.setupStreamProcessing();
    this.setupResponseTimeOptimization();
    this.setupMemoryOptimization();

    logger.info('Performance Optimizer initialized', {
      cluster: this.config.enableCluster,
      compression: this.config.enableCompression,
      workers: this.config.maxWorkers
    });
  }

  /**
   * Setup cluster mode for better CPU utilization
   */
  setupCluster() {
    const numCPUs = Math.min(this.config.maxWorkers, os.cpus().length);

    logger.info(`Starting ${numCPUs} worker processes`);

    for (let i = 0; i < numCPUs; i++) {
      cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
      logger.warn(`Worker ${worker.process.pid} died`, { code, signal });
      logger.info('Starting a new worker');
      cluster.fork();
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('Master received SIGTERM, shutting down workers');
      for (const id in cluster.workers) {
        cluster.workers[id].kill();
      }
    });
  }

  /**
   * Advanced compression optimization
   */
  setupCompressionOptimization() {
    if (!this.config.enableCompression) return;

    // Smart compression based on content type and size
    this.app.use(compression({
      // Compress responses larger than 1kb
      threshold: 1024,

      // Higher compression for JSON/text
      level: (req, res) => {
        const contentType = res.getHeader('content-type') || '';
        if (contentType.includes('json') || contentType.includes('text')) {
          return 6; // Higher compression for text content
        }
        return 4; // Standard compression for others
      },

      // Compression filter
      filter: (req, res) => {
        // Don't compress server-sent events
        if (res.getHeader('content-type') === 'text/event-stream') {
          return false;
        }

        // Don't compress already compressed content
        if (res.getHeader('content-encoding')) {
          return false;
        }

        // Use compression default filter
        return compression.filter(req, res);
      }
    }));

    logger.info('Advanced compression optimization enabled');
  }

  /**
   * HTTP cache optimization
   */
  setupCacheOptimization() {
    if (!this.config.enableHttpCache) return;

    // ETags for cache validation
    this.app.use((req, res, next) => {
      res.setHeader('Cache-Control', this.getCacheControl(req.path));
      next();
    });

    // Static cache headers
    this.app.use('/static', (req, res, next) => {
      res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1 year
      res.setHeader('Expires', new Date(Date.now() + 31536000 * 1000).toUTCString());
      next();
    });

    logger.info('HTTP cache optimization enabled');
  }

  /**
   * Stream processing for large responses
   */
  setupStreamProcessing() {
    if (!this.config.enableStreamProcessing) return;

    // Override res.json for large objects
    this.app.use((req, res, next) => {
      const originalJson = res.json;

      res.json = function(obj) {
        const jsonStr = JSON.stringify(obj);

        // Stream large responses
        if (jsonStr.length > 100000) { // 100KB threshold
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Transfer-Encoding', 'chunked');

          const chunkSize = 8192; // 8KB chunks
          let offset = 0;

          const sendChunk = () => {
            const chunk = jsonStr.slice(offset, offset + chunkSize);
            if (chunk.length > 0) {
              res.write(chunk);
              offset += chunkSize;
              setImmediate(sendChunk);
            } else {
              res.end();
            }
          };

          sendChunk();
        } else {
          originalJson.call(this, obj);
        }
      };

      next();
    });

    logger.info('Stream processing optimization enabled');
  }

  /**
   * Response time optimization
   */
  setupResponseTimeOptimization() {
    this.app.use((req, res, next) => {
      const startTime = Date.now();

      res.on('finish', () => {
        const duration = Date.now() - startTime;
        this.metrics.requestCount++;
        this.metrics.responseTime.push(duration);

        // Keep only last 1000 response times for analysis
        if (this.metrics.responseTime.length > 1000) {
          this.metrics.responseTime = this.metrics.responseTime.slice(-1000);
        }

        // Log slow requests
        if (duration > 5000) { // 5 seconds
          logger.warn('Slow request detected', {
            path: req.path,
            method: req.method,
            duration: `${duration}ms`,
            userAgent: req.get('User-Agent'),
            ip: req.ip
          });
        }
      });

      next();
    });
  }

  /**
   * Memory optimization
   */
  setupMemoryOptimization() {
    // Monitor memory usage
    setInterval(() => {
      const memUsage = process.memoryUsage();
      this.metrics.memoryUsage.push({
        timestamp: Date.now(),
        ...memUsage
      });

      // Keep only last 100 memory measurements
      if (this.metrics.memoryUsage.length > 100) {
        this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-100);
      }

      // Trigger garbage collection if memory usage is high
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      if (heapUsedMB > 512 && global.gc) { // 512MB threshold
        global.gc();
        logger.info('Garbage collection triggered', { heapUsedMB });
      }

      // Log memory warnings
      if (heapUsedMB > 1024) { // 1GB warning
        logger.warn('High memory usage detected', {
          heapUsedMB: Math.round(heapUsedMB),
          heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
          rss: Math.round(memUsage.rss / 1024 / 1024)
        });
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Get cache control header based on path
   */
  getCacheControl(path) {
    if (path.includes('/api/tasks') || path.includes('/api/nodes/status')) {
      return 'no-cache, no-store, must-revalidate'; // Real-time data
    }

    if (path.includes('/api/stats') || path.includes('/api/analytics')) {
      return 'public, max-age=60'; // Cache for 1 minute
    }

    if (path.includes('/api/auth') || path.includes('/api/wallet')) {
      return 'private, no-cache'; // Sensitive data
    }

    return 'public, max-age=300'; // Default: 5 minutes
  }

  /**
   * Get performance metrics
   */
  getMetrics() {
    const avgResponseTime = this.metrics.responseTime.length > 0
      ? this.metrics.responseTime.reduce((a, b) => a + b, 0) / this.metrics.responseTime.length
      : 0;

    const lastMemory = this.metrics.memoryUsage[this.metrics.memoryUsage.length - 1];

    return {
      requests: {
        total: this.metrics.requestCount,
        averageResponseTime: Math.round(avgResponseTime),
        slowRequests: this.metrics.responseTime.filter(t => t > 5000).length
      },
      memory: lastMemory ? {
        heapUsedMB: Math.round(lastMemory.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(lastMemory.heapTotal / 1024 / 1024),
        rssMB: Math.round(lastMemory.rss / 1024 / 1024)
      } : null,
      cluster: {
        enabled: this.config.enableCluster,
        workers: this.config.maxWorkers,
        isMaster: cluster.isMaster,
        workerId: cluster.worker ? cluster.worker.id : null
      },
      optimizations: {
        compression: this.config.enableCompression,
        httpCache: this.config.enableHttpCache,
        streamProcessing: this.config.enableStreamProcessing
      },
      lastOptimized: this.metrics.lastOptimized
    };
  }

  /**
   * Force optimization cycle
   */
  async optimize() {
    logger.info('Running performance optimization cycle');

    // Clear old metrics
    if (this.metrics.responseTime.length > 10000) {
      this.metrics.responseTime = this.metrics.responseTime.slice(-1000);
    }

    if (this.metrics.memoryUsage.length > 1000) {
      this.metrics.memoryUsage = this.metrics.memoryUsage.slice(-100);
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    this.metrics.lastOptimized = new Date().toISOString();

    logger.info('Performance optimization completed');
    return this.getMetrics();
  }
}

module.exports = PerformanceOptimizer;
