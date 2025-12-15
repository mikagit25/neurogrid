/**
 * Advanced Analytics API Routes
 * Real-time dashboard, predictions, and monitoring endpoints
 */

const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const logger = require('../../utils/logger');

const router = express.Router();

// Dependency injection placeholder
let realTimeAnalytics = null;
let wsManager = null;

// Set dependencies from main app
router.setDependencies = (analytics, webSocketManager) => {
  realTimeAnalytics = analytics;
  wsManager = webSocketManager;
};

/**
 * @route GET /api/analytics/dashboard
 * @desc Get comprehensive dashboard data
 * @access Admin
 */
router.get('/dashboard', authenticate, requireRole(['admin', 'operator']), (req, res) => {
  try {
    if (!realTimeAnalytics) {
      return res.status(503).json({
        success: false,
        error: 'Analytics service not available'
      });
    }

    const dashboardData = realTimeAnalytics.getDashboardData();

    res.json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    logger.error('Dashboard data fetch failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data'
    });
  }
});

/**
 * @route GET /api/analytics/realtime
 * @desc Get current real-time metrics
 * @access Admin
 */
router.get('/realtime', authenticate, requireRole(['admin', 'operator']), (req, res) => {
  try {
    if (!realTimeAnalytics) {
      return res.status(503).json({
        success: false,
        error: 'Analytics service not available'
      });
    }

    const realtimeData = Array.from(realTimeAnalytics.analytics.realTimeMetrics.values()).slice(-1)[0];
    
    res.json({
      success: true,
      data: realtimeData || null
    });

  } catch (error) {
    logger.error('Real-time data fetch failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch real-time data'
    });
  }
});

/**
 * @route GET /api/analytics/predictions
 * @desc Get predictive analytics
 * @access Admin
 */
router.get('/predictions', authenticate, requireRole(['admin', 'operator']), (req, res) => {
  try {
    if (!realTimeAnalytics) {
      return res.status(503).json({
        success: false,
        error: 'Analytics service not available'
      });
    }

    res.json({
      success: true,
      data: realTimeAnalytics.analytics.predictions
    });

  } catch (error) {
    logger.error('Predictions fetch failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch predictions'
    });
  }
});

/**
 * @route GET /api/analytics/alerts
 * @desc Get system alerts
 * @access Admin
 */
router.get('/alerts', authenticate, requireRole(['admin', 'operator']), (req, res) => {
  try {
    if (!realTimeAnalytics) {
      return res.status(503).json({
        success: false,
        error: 'Analytics service not available'
      });
    }

    const limit = parseInt(req.query.limit) || 50;
    const severity = req.query.severity;
    
    let alerts = realTimeAnalytics.analytics.alerts;
    
    // Filter by severity if specified
    if (severity) {
      alerts = alerts.filter(alert => alert.severity === severity);
    }
    
    // Limit results
    alerts = alerts.slice(-limit);

    res.json({
      success: true,
      data: {
        alerts,
        total: realTimeAnalytics.analytics.alerts.length,
        systemHealth: realTimeAnalytics.analytics.systemHealth
      }
    });

  } catch (error) {
    logger.error('Alerts fetch failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch alerts'
    });
  }
});

/**
 * @route GET /api/analytics/historical
 * @desc Get historical analytics data
 * @access Admin
 */
router.get('/historical', authenticate, requireRole(['admin', 'operator']), (req, res) => {
  try {
    if (!realTimeAnalytics) {
      return res.status(503).json({
        success: false,
        error: 'Analytics service not available'
      });
    }

    const timeframe = req.query.timeframe || '1h'; // 1h, 6h, 24h, 7d
    const metric = req.query.metric; // specific metric to filter
    
    let data = realTimeAnalytics.analytics.historicalData;
    
    // Filter by timeframe
    const timeframeMs = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000
    };
    
    const cutoff = Date.now() - (timeframeMs[timeframe] || timeframeMs['1h']);
    data = data.filter(d => d.timestamp > cutoff);
    
    // Filter by specific metric if requested
    if (metric) {
      data = data.map(d => ({
        timestamp: d.timestamp,
        [metric]: d[metric]
      }));
    }

    res.json({
      success: true,
      data: {
        timeframe,
        metric: metric || 'all',
        points: data.length,
        data: data
      }
    });

  } catch (error) {
    logger.error('Historical data fetch failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch historical data'
    });
  }
});

/**
 * @route POST /api/analytics/subscribe
 * @desc Subscribe to real-time analytics updates via WebSocket
 * @access Admin
 */
router.post('/subscribe', authenticate, requireRole(['admin', 'operator']), (req, res) => {
  try {
    if (!realTimeAnalytics || !wsManager) {
      return res.status(503).json({
        success: false,
        error: 'Analytics or WebSocket service not available'
      });
    }

    const { clientId } = req.body;
    
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'Client ID required'
      });
    }

    realTimeAnalytics.subscribeClient(clientId);

    res.json({
      success: true,
      message: 'Successfully subscribed to real-time analytics',
      clientId
    });

    logger.info('Analytics subscription created', { 
      clientId, 
      userId: req.user.id 
    });

  } catch (error) {
    logger.error('Analytics subscription failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to subscribe to analytics'
    });
  }
});

/**
 * @route POST /api/analytics/unsubscribe
 * @desc Unsubscribe from real-time analytics updates
 * @access Admin
 */
router.post('/unsubscribe', authenticate, requireRole(['admin', 'operator']), (req, res) => {
  try {
    if (!realTimeAnalytics) {
      return res.status(503).json({
        success: false,
        error: 'Analytics service not available'
      });
    }

    const { clientId } = req.body;
    
    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'Client ID required'
      });
    }

    realTimeAnalytics.unsubscribeClient(clientId);

    res.json({
      success: true,
      message: 'Successfully unsubscribed from real-time analytics'
    });

  } catch (error) {
    logger.error('Analytics unsubscription failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to unsubscribe from analytics'
    });
  }
});

/**
 * @route GET /api/analytics/health
 * @desc Get system health overview
 * @access Admin
 */
router.get('/health', authenticate, requireRole(['admin', 'operator']), (req, res) => {
  try {
    if (!realTimeAnalytics) {
      return res.status(503).json({
        success: false,
        error: 'Analytics service not available'
      });
    }

    const health = realTimeAnalytics.analytics.systemHealth;
    const recentMetrics = Array.from(realTimeAnalytics.analytics.realTimeMetrics.values()).slice(-5);
    
    res.json({
      success: true,
      data: {
        health,
        recentMetrics: recentMetrics.map(m => ({
          timestamp: m.timestamp,
          memory: m.system.memory.usagePercent,
          nodes: m.nodes.online,
          tasks: m.tasks.active
        }))
      }
    });

  } catch (error) {
    logger.error('Health data fetch failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch health data'
    });
  }
});

/**
 * @route POST /api/analytics/alert/acknowledge
 * @desc Acknowledge a system alert
 * @access Admin
 */
router.post('/alert/:alertId/acknowledge', authenticate, requireRole(['admin']), (req, res) => {
  try {
    if (!realTimeAnalytics) {
      return res.status(503).json({
        success: false,
        error: 'Analytics service not available'
      });
    }

    const { alertId } = req.params;
    const { note } = req.body;

    // Find and update alert
    const alertIndex = realTimeAnalytics.analytics.alerts.findIndex(alert => alert.id === alertId);
    
    if (alertIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }

    realTimeAnalytics.analytics.alerts[alertIndex].acknowledged = {
      by: req.user.id,
      at: Date.now(),
      note: note || null
    };

    res.json({
      success: true,
      message: 'Alert acknowledged successfully'
    });

    logger.info('Alert acknowledged', { 
      alertId, 
      acknowledgedBy: req.user.id,
      note 
    });

  } catch (error) {
    logger.error('Alert acknowledgment failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to acknowledge alert'
    });
  }
});

/**
 * @route GET /api/analytics/export
 * @desc Export analytics data
 * @access Admin
 */
router.get('/export', authenticate, requireRole(['admin']), (req, res) => {
  try {
    if (!realTimeAnalytics) {
      return res.status(503).json({
        success: false,
        error: 'Analytics service not available'
      });
    }

    const format = req.query.format || 'json'; // json, csv
    const timeframe = req.query.timeframe || '24h';
    
    if (format !== 'json' && format !== 'csv') {
      return res.status(400).json({
        success: false,
        error: 'Unsupported format. Use json or csv.'
      });
    }

    const dashboardData = realTimeAnalytics.getDashboardData();
    
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="neurogrid-analytics-${timeframe}.json"`);
      res.json(dashboardData);
    } else if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="neurogrid-analytics-${timeframe}.csv"`);
      
      // Convert to CSV (simplified)
      const csvData = dashboardData.realTimeMetrics.map(metric => ({
        timestamp: new Date(metric.timestamp).toISOString(),
        memoryUsage: metric.system.memory.usagePercent,
        nodesOnline: metric.nodes.online,
        activeTasks: metric.tasks.active,
        systemHealth: metric.health.status
      }));
      
      const csv = [
        'timestamp,memoryUsage,nodesOnline,activeTasks,systemHealth',
        ...csvData.map(row => `${row.timestamp},${row.memoryUsage},${row.nodesOnline},${row.activeTasks},${row.systemHealth}`)
      ].join('\n');
      
      res.send(csv);
    }

    logger.info('Analytics data exported', { 
      format, 
      timeframe, 
      exportedBy: req.user.id 
    });

  } catch (error) {
    logger.error('Analytics export failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to export analytics data'
    });
  }
});

module.exports = router;