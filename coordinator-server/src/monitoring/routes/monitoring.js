/**
 * Monitoring API Routes - Comprehensive monitoring endpoints
 * Provides access to metrics, performance data, analytics, and alerts
 */

const express = require('express');
const { MetricsCollectorSingleton } = require('../MetricsCollector');
const { PerformanceMonitorSingleton } = require('../PerformanceMonitor');
const { SystemAnalyticsSingleton } = require('../SystemAnalytics');
const { AlertingSystemSingleton } = require('../AlertingSystem');
const { authenticate, requirePermission, validateInput, getRateLimit } = require('../../security/middleware');

const router = express.Router();
const apiRateLimit = getRateLimit('api');

// Initialize monitoring services
const metricsCollector = MetricsCollectorSingleton.getInstance();
const performanceMonitor = PerformanceMonitorSingleton.getInstance();
const systemAnalytics = SystemAnalyticsSingleton.getInstance();
const alertingSystem = AlertingSystemSingleton.getInstance();

/**
 * GET /monitoring/health
 * System health check
 */
router.get('/health', (req, res) => {
    try {
        const health = {
            status: 'healthy',
            timestamp: new Date(),
            services: {
                metricsCollector: 'running',
                performanceMonitor: 'running',
                systemAnalytics: 'running',
                alertingSystem: 'running'
            },
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            version: process.version
        };
        
        res.json({
            success: true,
            data: health
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Health check failed'
        });
    }
});

/**
 * GET /monitoring/metrics
 * Get current metrics data
 */
router.get('/metrics',
    apiRateLimit,
    authenticate,
    requirePermission('monitoring:read'),
    validateInput({
        query: {
            type: {
                required: false,
                type: 'string',
                enum: ['current', 'timeseries', 'stats', 'all']
            },
            timeRange: {
                required: false,
                type: 'string'
            }
        }
    }),
    async (req, res) => {
        try {
            const { type = 'current', timeRange } = req.query;
            
            let timeRangeObj = null;
            if (timeRange) {
                const duration = parseDuration(timeRange);
                timeRangeObj = {
                    start: new Date(Date.now() - duration),
                    end: new Date()
                };
            }
            
            const metrics = metricsCollector.getMetrics(type, timeRangeObj);
            
            res.json({
                success: true,
                data: metrics
            });
            
        } catch (error) {
            console.error('Get metrics error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve metrics'
            });
        }
    }
);

/**
 * GET /monitoring/metrics/timeseries
 * Get time series metrics data
 */
router.get('/metrics/timeseries',
    apiRateLimit,
    authenticate,
    requirePermission('monitoring:read'),
    validateInput({
        query: {
            metric: {
                required: true,
                type: 'string',
                enum: ['system', 'application', 'custom']
            },
            duration: {
                required: false,
                type: 'string'
            }
        }
    }),
    async (req, res) => {
        try {
            const { metric, duration = '1h' } = req.query;
            
            const data = metricsCollector.getTimeSeriesData(metric, duration);
            
            res.json({
                success: true,
                data: {
                    metric,
                    duration,
                    points: data
                }
            });
            
        } catch (error) {
            console.error('Get timeseries error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve time series data'
            });
        }
    }
);

/**
 * GET /monitoring/performance
 * Get performance statistics
 */
router.get('/performance',
    apiRateLimit,
    authenticate,
    requirePermission('monitoring:read'),
    async (req, res) => {
        try {
            const stats = performanceMonitor.getPerformanceStats();
            
            res.json({
                success: true,
                data: stats
            });
            
        } catch (error) {
            console.error('Get performance error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve performance data'
            });
        }
    }
);

/**
 * GET /monitoring/performance/history
 * Get performance history
 */
router.get('/performance/history',
    apiRateLimit,
    authenticate,
    requirePermission('monitoring:read'),
    validateInput({
        query: {
            duration: {
                required: false,
                type: 'string'
            }
        }
    }),
    async (req, res) => {
        try {
            const { duration = '1h' } = req.query;
            
            const history = performanceMonitor.getPerformanceHistory(duration);
            
            res.json({
                success: true,
                data: {
                    duration,
                    history
                }
            });
            
        } catch (error) {
            console.error('Get performance history error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve performance history'
            });
        }
    }
);

/**
 * GET /monitoring/analytics
 * Get system analytics data
 */
router.get('/analytics',
    apiRateLimit,
    authenticate,
    requirePermission('monitoring:read'),
    async (req, res) => {
        try {
            const analytics = systemAnalytics.getAnalyticsData();
            
            res.json({
                success: true,
                data: analytics
            });
            
        } catch (error) {
            console.error('Get analytics error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve analytics data'
            });
        }
    }
);

/**
 * GET /monitoring/analytics/trends
 * Get trend analysis
 */
router.get('/analytics/trends',
    apiRateLimit,
    authenticate,
    requirePermission('monitoring:read'),
    validateInput({
        query: {
            metric: {
                required: false,
                type: 'string'
            }
        }
    }),
    async (req, res) => {
        try {
            const { metric } = req.query;
            
            const trends = systemAnalytics.getTrends(metric);
            
            res.json({
                success: true,
                data: trends
            });
            
        } catch (error) {
            console.error('Get trends error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve trends'
            });
        }
    }
);

/**
 * GET /monitoring/analytics/anomalies
 * Get anomaly detection results
 */
router.get('/analytics/anomalies',
    apiRateLimit,
    authenticate,
    requirePermission('monitoring:read'),
    validateInput({
        query: {
            limit: {
                required: false,
                type: 'integer',
                min: 1,
                max: 100
            }
        }
    }),
    async (req, res) => {
        try {
            const { limit = 20 } = req.query;
            
            const anomalies = systemAnalytics.getAnomalies(limit);
            
            res.json({
                success: true,
                data: {
                    anomalies,
                    total: anomalies.length
                }
            });
            
        } catch (error) {
            console.error('Get anomalies error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve anomalies'
            });
        }
    }
);

/**
 * GET /monitoring/analytics/predictions
 * Get predictive analytics
 */
router.get('/analytics/predictions',
    apiRateLimit,
    authenticate,
    requirePermission('monitoring:read'),
    validateInput({
        query: {
            metric: {
                required: false,
                type: 'string'
            }
        }
    }),
    async (req, res) => {
        try {
            const { metric } = req.query;
            
            const predictions = systemAnalytics.getPredictions(metric);
            
            res.json({
                success: true,
                data: predictions
            });
            
        } catch (error) {
            console.error('Get predictions error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve predictions'
            });
        }
    }
);

/**
 * GET /monitoring/analytics/recommendations
 * Get system recommendations
 */
router.get('/analytics/recommendations',
    apiRateLimit,
    authenticate,
    requirePermission('monitoring:read'),
    validateInput({
        query: {
            priority: {
                required: false,
                type: 'string',
                enum: ['low', 'medium', 'high', 'critical']
            }
        }
    }),
    async (req, res) => {
        try {
            const { priority } = req.query;
            
            const recommendations = systemAnalytics.getRecommendations(priority);
            
            res.json({
                success: true,
                data: {
                    recommendations,
                    total: recommendations.length
                }
            });
            
        } catch (error) {
            console.error('Get recommendations error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve recommendations'
            });
        }
    }
);

/**
 * GET /monitoring/alerts
 * Get active alerts
 */
router.get('/alerts',
    apiRateLimit,
    authenticate,
    requirePermission('monitoring:read'),
    validateInput({
        query: {
            status: {
                required: false,
                type: 'string',
                enum: ['active', 'resolved', 'acknowledged']
            },
            limit: {
                required: false,
                type: 'integer',
                min: 1,
                max: 100
            }
        }
    }),
    async (req, res) => {
        try {
            const { status, limit = 50 } = req.query;
            
            const alerts = alertingSystem.getAlerts(status, limit);
            
            res.json({
                success: true,
                data: {
                    alerts,
                    total: alerts.length
                }
            });
            
        } catch (error) {
            console.error('Get alerts error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve alerts'
            });
        }
    }
);

/**
 * POST /monitoring/alerts/:alertId/acknowledge
 * Acknowledge an alert
 */
router.post('/alerts/:alertId/acknowledge',
    authenticate,
    requirePermission('monitoring:write'),
    async (req, res) => {
        try {
            const { alertId } = req.params;
            const userId = req.user.id;
            
            const result = alertingSystem.acknowledgeAlert(alertId, userId);
            
            if (result.success) {
                res.json({
                    success: true,
                    message: 'Alert acknowledged',
                    alert: result.alert
                });
            } else {
                res.status(404).json({
                    success: false,
                    error: result.error
                });
            }
            
        } catch (error) {
            console.error('Acknowledge alert error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to acknowledge alert'
            });
        }
    }
);

/**
 * POST /monitoring/alerts/:alertId/resolve
 * Resolve an alert
 */
router.post('/alerts/:alertId/resolve',
    authenticate,
    requirePermission('monitoring:write'),
    validateInput({
        body: {
            resolution: {
                required: false,
                type: 'string',
                maxLength: 500
            }
        }
    }),
    async (req, res) => {
        try {
            const { alertId } = req.params;
            const { resolution } = req.body;
            const userId = req.user.id;
            
            const result = alertingSystem.resolveAlert(alertId, userId, resolution);
            
            if (result.success) {
                res.json({
                    success: true,
                    message: 'Alert resolved',
                    alert: result.alert
                });
            } else {
                res.status(404).json({
                    success: false,
                    error: result.error
                });
            }
            
        } catch (error) {
            console.error('Resolve alert error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to resolve alert'
            });
        }
    }
);

/**
 * GET /monitoring/alerts/stats
 * Get alerting statistics
 */
router.get('/alerts/stats',
    apiRateLimit,
    authenticate,
    requirePermission('monitoring:read'),
    async (req, res) => {
        try {
            const stats = alertingSystem.getAlertStats();
            
            res.json({
                success: true,
                data: stats
            });
            
        } catch (error) {
            console.error('Get alert stats error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve alert statistics'
            });
        }
    }
);

/**
 * GET /monitoring/dashboard
 * Get dashboard data (overview)
 */
router.get('/dashboard',
    apiRateLimit,
    authenticate,
    requirePermission('monitoring:read'),
    async (req, res) => {
        try {
            // Gather data from all monitoring services
            const currentMetrics = metricsCollector.getMetrics('current');
            const performanceStats = performanceMonitor.getPerformanceStats();
            const analytics = systemAnalytics.getAnalyticsData();
            const alertStats = alertingSystem.getAlertStats();
            const activeAlerts = alertingSystem.getAlerts('active', 10);
            
            const dashboard = {
                timestamp: new Date(),
                overview: {
                    system: {
                        uptime: process.uptime(),
                        memory: currentMetrics.current?.system?.memory || {},
                        cpu: currentMetrics.current?.system?.cpu || {},
                        status: 'healthy'
                    },
                    performance: {
                        responseTime: performanceStats.health?.responseTime || 0,
                        errorRate: performanceStats.health?.errorRate || 0,
                        throughput: performanceStats.health?.throughput || 0,
                        activeRequests: performanceStats.activeRequests || 0
                    },
                    alerts: {
                        total: alertStats.totalAlerts || 0,
                        active: alertStats.activeAlerts || 0,
                        critical: activeAlerts.filter(a => a.severity === 'critical').length
                    }
                },
                trends: analytics.trends || {},
                recentAlerts: activeAlerts,
                recommendations: analytics.recommendations?.slice(0, 5) || [],
                insights: analytics.insights?.slice(0, 3) || []
            };
            
            res.json({
                success: true,
                data: dashboard
            });
            
        } catch (error) {
            console.error('Get dashboard error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to retrieve dashboard data'
            });
        }
    }
);

/**
 * POST /monitoring/custom-metric
 * Record custom metric
 */
router.post('/custom-metric',
    authenticate,
    requirePermission('monitoring:write'),
    validateInput({
        body: {
            name: {
                required: true,
                type: 'string',
                minLength: 1,
                maxLength: 100
            },
            value: {
                required: true,
                type: 'number'
            },
            type: {
                required: false,
                type: 'string',
                enum: ['counter', 'gauge', 'histogram']
            }
        }
    }),
    async (req, res) => {
        try {
            const { name, value, type = 'gauge' } = req.body;
            
            switch (type) {
                case 'counter':
                    metricsCollector.incrementCounter(name, value);
                    break;
                case 'gauge':
                    metricsCollector.setGauge(name, value);
                    break;
                case 'histogram':
                    metricsCollector.recordLatency(name, value);
                    break;
            }
            
            res.json({
                success: true,
                message: 'Custom metric recorded',
                metric: { name, value, type }
            });
            
        } catch (error) {
            console.error('Record custom metric error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to record custom metric'
            });
        }
    }
);

/**
 * POST /monitoring/event
 * Record custom event
 */
router.post('/event',
    authenticate,
    requirePermission('monitoring:write'),
    validateInput({
        body: {
            name: {
                required: true,
                type: 'string',
                minLength: 1,
                maxLength: 100
            },
            data: {
                required: false,
                type: 'object'
            }
        }
    }),
    async (req, res) => {
        try {
            const { name, data = {} } = req.body;
            
            metricsCollector.recordEvent(name, {
                ...data,
                userId: req.user.id,
                userAgent: req.get('User-Agent'),
                ip: req.ip
            });
            
            res.json({
                success: true,
                message: 'Event recorded',
                event: { name, data }
            });
            
        } catch (error) {
            console.error('Record event error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to record event'
            });
        }
    }
);

// Utility functions
function parseDuration(duration) {
    const units = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000
    };
    
    const match = duration.match(/^(\d+)([smhd])$/);
    if (match) {
        const [, amount, unit] = match;
        return parseInt(amount) * units[unit];
    }
    
    return 60 * 60 * 1000; // Default 1 hour
}

module.exports = router;