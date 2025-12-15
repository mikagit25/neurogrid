/**
 * Monitoring API Routes - REST endpoints for monitoring data access
 * Provides comprehensive API for metrics, performance, analytics, and alerts
 */

const express = require('express');
const { MetricsCollectorSingleton } = require('./MetricsCollector');
const { PerformanceMonitorSingleton } = require('./PerformanceMonitor');
const { SystemAnalyticsSingleton } = require('./SystemAnalytics');
const { AlertingSystemSingleton } = require('./AlertingSystem');
const { authenticate, requirePermission, validateInput, getRateLimit } = require('../security/middleware');

const router = express.Router();

// Initialize monitoring services
const metricsCollector = MetricsCollectorSingleton.getInstance();
const performanceMonitor = PerformanceMonitorSingleton.getInstance();
const systemAnalytics = SystemAnalyticsSingleton.getInstance();
const alertingSystem = AlertingSystemSingleton.getInstance();

// Rate limiting
const apiRateLimit = getRateLimit('api');

// Validation schemas
const timeRangeSchema = {
  query: {
    start: {
      required: false,
      type: 'string'
    },
    end: {
      required: false,
      type: 'string'
    },
    duration: {
      required: false,
      type: 'string'
    }
  }
};

const alertActionSchema = {
  body: {
    resolution: {
      required: false,
      type: 'string',
      maxLength: 500
    }
  }
};

/**
 * GET /api/monitoring/health
 * Get system health overview
 */
router.get('/health',
  apiRateLimit,
  async (req, res) => {
    try {
      const performanceStats = performanceMonitor.getPerformanceStats();
      const metricsStats = metricsCollector.getStats();
      const alertStats = alertingSystem.getAlertStats();

      const health = {
        status: 'healthy',
        timestamp: new Date(),
        performance: {
          responseTime: performanceStats.health.responseTime,
          errorRate: performanceStats.health.errorRate,
          throughput: performanceStats.health.throughput
        },
        system: {
          memoryUsage: performanceStats.health.memoryUsage,
          cpuUsage: performanceStats.health.cpuUsage,
          uptime: process.uptime()
        },
        monitoring: {
          metricsCollected: metricsStats.totalDataPoints,
          activeAlerts: alertStats.activeAlerts,
          lastCollection: metricsStats.lastCollection
        }
      };

      // Determine overall health status
      if (performanceStats.health.errorRate > 10 ||
                performanceStats.health.memoryUsage > 90 ||
                alertStats.activeAlerts > 5) {
        health.status = 'unhealthy';
      } else if (performanceStats.health.errorRate > 5 ||
                      performanceStats.health.memoryUsage > 80 ||
                      alertStats.activeAlerts > 2) {
        health.status = 'warning';
      }

      const statusCode = health.status === 'healthy' ? 200 :
        health.status === 'warning' ? 200 : 503;

      res.status(statusCode).json({
        success: true,
        data: health
      });

    } catch (error) {
      console.error('Health check error:', error);
      res.status(500).json({
        success: false,
        error: 'Health check failed'
      });
    }
  }
);

/**
 * GET /api/monitoring/metrics
 * Get system metrics
 */
router.get('/metrics',
  apiRateLimit,
  authenticate,
  requirePermission('monitoring:read'),
  validateInput(timeRangeSchema),
  async (req, res) => {
    try {
      const { start, end, duration } = req.query;
      let timeRange = null;

      if (start && end) {
        timeRange = {
          start: new Date(start),
          end: new Date(end)
        };
      }

      const type = req.query.type || 'all';
      const metrics = metricsCollector.getMetrics(type, timeRange);

      if (duration) {
        const timeSeriesData = metricsCollector.getTimeSeriesData('system', duration);
        metrics.timeSeries = { system: timeSeriesData };
      }

      res.json({
        success: true,
        data: metrics
      });

    } catch (error) {
      console.error('Metrics retrieval error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve metrics'
      });
    }
  }
);

/**
 * GET /api/monitoring/performance
 * Get performance statistics
 */
router.get('/performance',
  apiRateLimit,
  authenticate,
  requirePermission('monitoring:read'),
  validateInput(timeRangeSchema),
  async (req, res) => {
    try {
      const { duration } = req.query;

      const performanceStats = performanceMonitor.getPerformanceStats();

      if (duration) {
        performanceStats.history = performanceMonitor.getPerformanceHistory(duration);
      }

      res.json({
        success: true,
        data: performanceStats
      });

    } catch (error) {
      console.error('Performance stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve performance statistics'
      });
    }
  }
);

/**
 * GET /api/monitoring/analytics
 * Get system analytics data
 */
router.get('/analytics',
  apiRateLimit,
  authenticate,
  requirePermission('monitoring:read'),
  async (req, res) => {
    try {
      const analyticsData = systemAnalytics.getAnalyticsData();

      res.json({
        success: true,
        data: analyticsData
      });

    } catch (error) {
      console.error('Analytics retrieval error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve analytics data'
      });
    }
  }
);

/**
 * GET /api/monitoring/trends
 * Get trend analysis
 */
router.get('/trends',
  apiRateLimit,
  authenticate,
  requirePermission('monitoring:read'),
  async (req, res) => {
    try {
      const { metric } = req.query;
      const trends = systemAnalytics.getTrends(metric);

      res.json({
        success: true,
        data: trends
      });

    } catch (error) {
      console.error('Trends retrieval error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve trend data'
      });
    }
  }
);

/**
 * GET /api/monitoring/anomalies
 * Get detected anomalies
 */
router.get('/anomalies',
  apiRateLimit,
  authenticate,
  requirePermission('monitoring:read'),
  async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 20;
      const anomalies = systemAnalytics.getAnomalies(limit);

      res.json({
        success: true,
        data: anomalies
      });

    } catch (error) {
      console.error('Anomalies retrieval error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve anomalies'
      });
    }
  }
);

/**
 * GET /api/monitoring/predictions
 * Get system predictions
 */
router.get('/predictions',
  apiRateLimit,
  authenticate,
  requirePermission('monitoring:read'),
  async (req, res) => {
    try {
      const { metric } = req.query;
      const predictions = systemAnalytics.getPredictions(metric);

      res.json({
        success: true,
        data: predictions
      });

    } catch (error) {
      console.error('Predictions retrieval error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve predictions'
      });
    }
  }
);

/**
 * GET /api/monitoring/recommendations
 * Get system recommendations
 */
router.get('/recommendations',
  apiRateLimit,
  authenticate,
  requirePermission('monitoring:read'),
  async (req, res) => {
    try {
      const { priority } = req.query;
      const recommendations = systemAnalytics.getRecommendations(priority);

      res.json({
        success: true,
        data: recommendations
      });

    } catch (error) {
      console.error('Recommendations retrieval error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve recommendations'
      });
    }
  }
);

/**
 * GET /api/monitoring/insights
 * Get system insights
 */
router.get('/insights',
  apiRateLimit,
  authenticate,
  requirePermission('monitoring:read'),
  async (req, res) => {
    try {
      const { type } = req.query;
      const insights = systemAnalytics.getInsights(type);

      res.json({
        success: true,
        data: insights
      });

    } catch (error) {
      console.error('Insights retrieval error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve insights'
      });
    }
  }
);

/**
 * GET /api/monitoring/alerts
 * Get system alerts
 */
router.get('/alerts',
  apiRateLimit,
  authenticate,
  requirePermission('monitoring:read'),
  async (req, res) => {
    try {
      const { status, limit } = req.query;
      const alerts = alertingSystem.getAlerts(status, parseInt(limit) || 50);

      res.json({
        success: true,
        data: alerts
      });

    } catch (error) {
      console.error('Alerts retrieval error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve alerts'
      });
    }
  }
);

/**
 * GET /api/monitoring/alerts/history
 * Get alert history
 */
router.get('/alerts/history',
  apiRateLimit,
  authenticate,
  requirePermission('monitoring:read'),
  async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 100;
      const history = alertingSystem.getAlertHistory(limit);

      res.json({
        success: true,
        data: history
      });

    } catch (error) {
      console.error('Alert history retrieval error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve alert history'
      });
    }
  }
);

/**
 * POST /api/monitoring/alerts/:id/acknowledge
 * Acknowledge an alert
 */
router.post('/alerts/:id/acknowledge',
  apiRateLimit,
  authenticate,
  requirePermission('monitoring:admin'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const result = alertingSystem.acknowledgeAlert(id, req.user.id);

      if (result.success) {
        res.json({
          success: true,
          message: 'Alert acknowledged successfully',
          data: result.alert
        });
      } else {
        res.status(404).json({
          success: false,
          error: result.error
        });
      }

    } catch (error) {
      console.error('Alert acknowledgment error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to acknowledge alert'
      });
    }
  }
);

/**
 * POST /api/monitoring/alerts/:id/resolve
 * Resolve an alert
 */
router.post('/alerts/:id/resolve',
  apiRateLimit,
  authenticate,
  requirePermission('monitoring:admin'),
  validateInput(alertActionSchema),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { resolution } = req.body;

      const result = alertingSystem.resolveAlert(id, req.user.id, resolution);

      if (result.success) {
        res.json({
          success: true,
          message: 'Alert resolved successfully',
          data: result.alert
        });
      } else {
        res.status(404).json({
          success: false,
          error: result.error
        });
      }

    } catch (error) {
      console.error('Alert resolution error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to resolve alert'
      });
    }
  }
);

/**
 * GET /api/monitoring/dashboard
 * Get dashboard data (combined overview)
 */
router.get('/dashboard',
  apiRateLimit,
  authenticate,
  requirePermission('monitoring:read'),
  async (req, res) => {
    try {
      const performanceStats = performanceMonitor.getPerformanceStats();
      const metricsStats = metricsCollector.getStats();
      const alertStats = alertingSystem.getAlertStats();
      const analytics = systemAnalytics.getAnalyticsData();

      const dashboard = {
        timestamp: new Date(),
        health: {
          status: performanceStats.health.errorRate > 10 ? 'critical' :
            performanceStats.health.errorRate > 5 ? 'warning' : 'healthy',
          responseTime: performanceStats.health.responseTime,
          errorRate: performanceStats.health.errorRate,
          throughput: performanceStats.health.throughput,
          memoryUsage: performanceStats.health.memoryUsage,
          cpuUsage: performanceStats.health.cpuUsage
        },
        metrics: {
          totalDataPoints: metricsStats.totalDataPoints,
          collectionsCount: metricsStats.collectionsCount,
          uptime: metricsStats.uptime
        },
        alerts: {
          active: alertStats.activeAlerts,
          total: alertStats.totalAlerts,
          escalated: alertStats.escalatedAlerts,
          suppressed: alertStats.suppressedAlerts
        },
        analytics: {
          trends: Object.keys(analytics.trends || {}).length,
          anomalies: (analytics.anomalies || []).length,
          recommendations: (analytics.recommendations || []).length,
          insights: (analytics.insights || []).length
        },
        recentData: {
          performanceHistory: performanceMonitor.getPerformanceHistory('1h'),
          recentAlerts: alertingSystem.getAlerts('active', 5),
          topRecommendations: analytics.recommendations?.slice(0, 3) || []
        }
      };

      res.json({
        success: true,
        data: dashboard
      });

    } catch (error) {
      console.error('Dashboard data error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve dashboard data'
      });
    }
  }
);

/**
 * GET /api/monitoring/stats
 * Get comprehensive monitoring statistics
 */
router.get('/stats',
  apiRateLimit,
  authenticate,
  requirePermission('monitoring:read'),
  async (req, res) => {
    try {
      const stats = {
        metrics: metricsCollector.getStats(),
        performance: performanceMonitor.getPerformanceStats(),
        alerts: alertingSystem.getAlertStats(),
        system: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          pid: process.pid,
          version: process.version,
          platform: process.platform
        }
      };

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      console.error('Stats retrieval error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve statistics'
      });
    }
  }
);

/**
 * POST /api/monitoring/reset
 * Reset monitoring statistics (Admin only)
 */
router.post('/reset',
  apiRateLimit,
  authenticate,
  requirePermission('monitoring:admin'),
  async (req, res) => {
    try {
      performanceMonitor.resetStats();

      res.json({
        success: true,
        message: 'Monitoring statistics reset successfully'
      });

    } catch (error) {
      console.error('Stats reset error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reset statistics'
      });
    }
  }
);

module.exports = router;
