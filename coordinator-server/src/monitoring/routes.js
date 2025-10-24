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
            const { status, limit } = req.query;\n            const alerts = alertingSystem.getAlerts(status, parseInt(limit) || 50);\n            \n            res.json({\n                success: true,\n                data: alerts\n            });\n            \n        } catch (error) {\n            console.error('Alerts retrieval error:', error);\n            res.status(500).json({\n                success: false,\n                error: 'Failed to retrieve alerts'\n            });\n        }\n    }\n);\n\n/**\n * GET /api/monitoring/alerts/history\n * Get alert history\n */\nrouter.get('/alerts/history',\n    apiRateLimit,\n    authenticate,\n    requirePermission('monitoring:read'),\n    async (req, res) => {\n        try {\n            const limit = parseInt(req.query.limit) || 100;\n            const history = alertingSystem.getAlertHistory(limit);\n            \n            res.json({\n                success: true,\n                data: history\n            });\n            \n        } catch (error) {\n            console.error('Alert history retrieval error:', error);\n            res.status(500).json({\n                success: false,\n                error: 'Failed to retrieve alert history'\n            });\n        }\n    }\n);\n\n/**\n * POST /api/monitoring/alerts/:id/acknowledge\n * Acknowledge an alert\n */\nrouter.post('/alerts/:id/acknowledge',\n    apiRateLimit,\n    authenticate,\n    requirePermission('monitoring:admin'),\n    async (req, res) => {\n        try {\n            const { id } = req.params;\n            const result = alertingSystem.acknowledgeAlert(id, req.user.id);\n            \n            if (result.success) {\n                res.json({\n                    success: true,\n                    message: 'Alert acknowledged successfully',\n                    data: result.alert\n                });\n            } else {\n                res.status(404).json({\n                    success: false,\n                    error: result.error\n                });\n            }\n            \n        } catch (error) {\n            console.error('Alert acknowledgment error:', error);\n            res.status(500).json({\n                success: false,\n                error: 'Failed to acknowledge alert'\n            });\n        }\n    }\n);\n\n/**\n * POST /api/monitoring/alerts/:id/resolve\n * Resolve an alert\n */\nrouter.post('/alerts/:id/resolve',\n    apiRateLimit,\n    authenticate,\n    requirePermission('monitoring:admin'),\n    validateInput(alertActionSchema),\n    async (req, res) => {\n        try {\n            const { id } = req.params;\n            const { resolution } = req.body;\n            \n            const result = alertingSystem.resolveAlert(id, req.user.id, resolution);\n            \n            if (result.success) {\n                res.json({\n                    success: true,\n                    message: 'Alert resolved successfully',\n                    data: result.alert\n                });\n            } else {\n                res.status(404).json({\n                    success: false,\n                    error: result.error\n                });\n            }\n            \n        } catch (error) {\n            console.error('Alert resolution error:', error);\n            res.status(500).json({\n                success: false,\n                error: 'Failed to resolve alert'\n            });\n        }\n    }\n);\n\n/**\n * GET /api/monitoring/dashboard\n * Get dashboard data (combined overview)\n */\nrouter.get('/dashboard',\n    apiRateLimit,\n    authenticate,\n    requirePermission('monitoring:read'),\n    async (req, res) => {\n        try {\n            const performanceStats = performanceMonitor.getPerformanceStats();\n            const metricsStats = metricsCollector.getStats();\n            const alertStats = alertingSystem.getAlertStats();\n            const analytics = systemAnalytics.getAnalyticsData();\n            \n            const dashboard = {\n                timestamp: new Date(),\n                health: {\n                    status: performanceStats.health.errorRate > 10 ? 'critical' :\n                           performanceStats.health.errorRate > 5 ? 'warning' : 'healthy',\n                    responseTime: performanceStats.health.responseTime,\n                    errorRate: performanceStats.health.errorRate,\n                    throughput: performanceStats.health.throughput,\n                    memoryUsage: performanceStats.health.memoryUsage,\n                    cpuUsage: performanceStats.health.cpuUsage\n                },\n                metrics: {\n                    totalDataPoints: metricsStats.totalDataPoints,\n                    collectionsCount: metricsStats.collectionsCount,\n                    uptime: metricsStats.uptime\n                },\n                alerts: {\n                    active: alertStats.activeAlerts,\n                    total: alertStats.totalAlerts,\n                    escalated: alertStats.escalatedAlerts,\n                    suppressed: alertStats.suppressedAlerts\n                },\n                analytics: {\n                    trends: Object.keys(analytics.trends || {}).length,\n                    anomalies: (analytics.anomalies || []).length,\n                    recommendations: (analytics.recommendations || []).length,\n                    insights: (analytics.insights || []).length\n                },\n                recentData: {\n                    performanceHistory: performanceMonitor.getPerformanceHistory('1h'),\n                    recentAlerts: alertingSystem.getAlerts('active', 5),\n                    topRecommendations: analytics.recommendations?.slice(0, 3) || []\n                }\n            };\n            \n            res.json({\n                success: true,\n                data: dashboard\n            });\n            \n        } catch (error) {\n            console.error('Dashboard data error:', error);\n            res.status(500).json({\n                success: false,\n                error: 'Failed to retrieve dashboard data'\n            });\n        }\n    }\n);\n\n/**\n * GET /api/monitoring/stats\n * Get comprehensive monitoring statistics\n */\nrouter.get('/stats',\n    apiRateLimit,\n    authenticate,\n    requirePermission('monitoring:read'),\n    async (req, res) => {\n        try {\n            const stats = {\n                metrics: metricsCollector.getStats(),\n                performance: performanceMonitor.getPerformanceStats(),\n                alerts: alertingSystem.getAlertStats(),\n                system: {\n                    uptime: process.uptime(),\n                    memory: process.memoryUsage(),\n                    pid: process.pid,\n                    version: process.version,\n                    platform: process.platform\n                }\n            };\n            \n            res.json({\n                success: true,\n                data: stats\n            });\n            \n        } catch (error) {\n            console.error('Stats retrieval error:', error);\n            res.status(500).json({\n                success: false,\n                error: 'Failed to retrieve statistics'\n            });\n        }\n    }\n);\n\n/**\n * POST /api/monitoring/reset\n * Reset monitoring statistics (Admin only)\n */\nrouter.post('/reset',\n    apiRateLimit,\n    authenticate,\n    requirePermission('monitoring:admin'),\n    async (req, res) => {\n        try {\n            performanceMonitor.resetStats();\n            \n            res.json({\n                success: true,\n                message: 'Monitoring statistics reset successfully'\n            });\n            \n        } catch (error) {\n            console.error('Stats reset error:', error);\n            res.status(500).json({\n                success: false,\n                error: 'Failed to reset statistics'\n            });\n        }\n    }\n);\n\nmodule.exports = router;