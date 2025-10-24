const express = require('express');
const HealthMonitor = require('../services/HealthMonitor');
const AlertingSystem = require('../services/AlertingSystem');
const MetricsCollector = require('../services/MetricsCollector');
const logger = require('../utils/logger');

class MonitoringController {
    constructor(config, dependencies = {}) {
        this.config = config;
        this.dependencies = dependencies;

        // Initialize monitoring services
        this.healthMonitor = new HealthMonitor(config, dependencies);
        this.alertingSystem = new AlertingSystem(config, dependencies);
        this.metricsCollector = new MetricsCollector(config);

        // Connect health monitor to alerting system
        this.healthMonitor.on('alert', (alert) => {
            this.alertingSystem.processAlert(alert);
        });

        this.healthMonitor.on('alertResolved', (alert) => {
            this.alertingSystem.resolveAlert(alert.id);
        });

        // Add performance tracking middleware to health monitor
        this.performanceMiddleware = this.healthMonitor.createMiddleware();

        logger.info('Monitoring controller initialized');
    }

    // Express routes
    createRoutes() {
        const router = express.Router();

        // Health check endpoints
        router.get('/health', this.getHealthStatus.bind(this));
        router.get('/health/detailed', this.getDetailedHealthStatus.bind(this));
        router.get('/health/live', this.getLivenessProbe.bind(this));
        router.get('/health/ready', this.getReadinessProbe.bind(this));

        // Metrics endpoints
        router.get('/metrics', this.getMetrics.bind(this));
        router.get('/metrics/prometheus', this.getPrometheusMetrics.bind(this));

        // Add alerting routes
        router.use(this.alertingSystem.createRoutes());

        // System information
        router.get('/system/info', this.getSystemInfo.bind(this));
        router.get('/system/performance', this.getPerformanceMetrics.bind(this));

        return router;
    }

    // Health check handlers
    async getHealthStatus(req, res) {
        try {
            const health = this.healthMonitor.getHealthStatus();
            const statusCode = health.overall === 'healthy' ? 200 : 503;
            
            res.status(statusCode).json(health);
        } catch (error) {
            logger.error('Health status check failed', { error: error.message });
            res.status(500).json({
                overall: 'unhealthy',
                error: error.message,
                timestamp: new Date()
            });
        }
    }

    async getDetailedHealthStatus(req, res) {
        try {
            const health = this.healthMonitor.getDetailedHealthStatus();
            const statusCode = health.overall === 'healthy' ? 200 : 503;
            
            res.status(statusCode).json(health);
        } catch (error) {
            logger.error('Detailed health status check failed', { error: error.message });
            res.status(500).json({
                overall: 'unhealthy',
                error: error.message,
                timestamp: new Date()
            });
        }
    }

    // Kubernetes-style probes
    async getLivenessProbe(req, res) {
        // Liveness probe - is the application running?
        try {
            const uptime = process.uptime();
            
            if (uptime < 1) {
                return res.status(503).json({
                    status: 'starting',
                    uptime: uptime
                });
            }

            res.status(200).json({
                status: 'alive',
                uptime: uptime,
                timestamp: new Date()
            });
        } catch (error) {
            res.status(500).json({
                status: 'dead',
                error: error.message
            });
        }
    }

    async getReadinessProbe(req, res) {
        // Readiness probe - is the application ready to serve traffic?
        try {
            const health = this.healthMonitor.getHealthStatus();
            
            // Check critical components
            const criticalComponents = ['database', 'system'];
            const criticalHealthy = criticalComponents.every(component => {
                const componentHealth = health.components[component];
                return componentHealth && componentHealth.status === 'healthy';
            });

            if (!criticalHealthy) {
                return res.status(503).json({
                    status: 'not_ready',
                    reason: 'Critical components unhealthy',
                    components: health.components
                });
            }

            res.status(200).json({
                status: 'ready',
                components: health.components,
                timestamp: new Date()
            });
        } catch (error) {
            res.status(500).json({
                status: 'not_ready',
                error: error.message
            });
        }
    }

    // Metrics handlers
    async getMetrics(req, res) {
        try {
            const metrics = {
                health: this.healthMonitor.getHealthStatus(),
                alerts: this.alertingSystem.getAlertStats(),
                performance: this.healthMonitor.performanceMetrics,
                system: {
                    uptime: process.uptime(),
                    memory: process.memoryUsage(),
                    cpu: process.cpuUsage(),
                    version: process.version,
                    platform: process.platform
                },
                timestamp: new Date()
            };

            res.json(metrics);
        } catch (error) {
            logger.error('Failed to get metrics', { error: error.message });
            res.status(500).json({ error: error.message });
        }
    }

    async getPrometheusMetrics(req, res) {
        try {
            const metrics = await this.metricsCollector.getMetrics();
            res.set('Content-Type', 'text/plain');
            res.send(metrics);
        } catch (error) {
            logger.error('Failed to get Prometheus metrics', { error: error.message });
            res.status(500).send('# Error generating metrics\n');
        }
    }

    // System information handlers
    async getSystemInfo(req, res) {
        try {
            const os = require('os');
            
            const systemInfo = {
                hostname: os.hostname(),
                platform: os.platform(),
                architecture: os.arch(),
                cpus: os.cpus().length,
                totalMemory: Math.round(os.totalmem() / 1024 / 1024), // MB
                freeMemory: Math.round(os.freemem() / 1024 / 1024), // MB
                loadAverage: os.loadavg(),
                uptime: os.uptime(),
                nodeVersion: process.version,
                processUptime: process.uptime(),
                processId: process.pid,
                processTitle: process.title,
                environment: process.env.NODE_ENV || 'unknown',
                timestamp: new Date()
            };

            res.json(systemInfo);
        } catch (error) {
            logger.error('Failed to get system info', { error: error.message });
            res.status(500).json({ error: error.message });
        }
    }

    async getPerformanceMetrics(req, res) {
        try {
            const health = this.healthMonitor.getHealthStatus();
            const performance = {
                requests: {
                    total: this.healthMonitor.performanceMetrics.requestCount,
                    errors: this.healthMonitor.performanceMetrics.errorCount,
                    errorRate: health.performance.errorRate
                },
                responseTime: {
                    average: health.performance.averageResponseTime,
                    samples: this.healthMonitor.performanceMetrics.responseTime.length
                },
                memory: process.memoryUsage(),
                cpu: process.cpuUsage(),
                uptime: process.uptime(),
                timestamp: new Date()
            };

            res.json(performance);
        } catch (error) {
            logger.error('Failed to get performance metrics', { error: error.message });
            res.status(500).json({ error: error.message });
        }
    }

    // Middleware for automatic monitoring
    getPerformanceMiddleware() {
        return this.performanceMiddleware;
    }

    // Update metrics
    recordRequest(req, res, responseTime) {
        const isError = res.statusCode >= 400;
        this.healthMonitor.recordRequest(responseTime, isError);
        
        // Record in metrics collector as well
        this.metricsCollector.recordHttpRequest(
            req.method,
            req.route?.path || req.path,
            res.statusCode,
            responseTime
        );
    }

    recordDatabaseQuery(operation, table, duration, success = true) {
        this.metricsCollector.recordDatabaseQuery(operation, table, duration, success);
    }

    recordAuthenticationEvent(type, success = true, userId = null) {
        this.metricsCollector.recordAuthEvent(type, success, userId);
    }

    recordSecurityEvent(type, severity = 'medium', details = {}) {
        this.metricsCollector.recordSecurityEvent(type, severity, details);
    }

    recordBusinessMetric(metric, value, labels = {}) {
        this.metricsCollector.recordBusinessMetric(metric, value, labels);
    }

    // Alert management
    async triggerAlert(component, severity, message, details = {}) {
        const alert = {
            id: require('crypto').randomUUID(),
            component,
            severity,
            message,
            details,
            timestamp: new Date()
        };

        await this.alertingSystem.processAlert(alert);
        return alert.id;
    }

    async resolveAlert(alertId, resolution = {}) {
        await this.alertingSystem.resolveAlert(alertId, resolution);
    }

    // Configuration updates
    updateConfiguration(newConfig) {
        // Update alert thresholds
        if (newConfig.alertThresholds) {
            Object.assign(this.healthMonitor.alertThresholds, newConfig.alertThresholds);
        }

        // Update check intervals
        if (newConfig.checkInterval) {
            this.healthMonitor.checkInterval = newConfig.checkInterval;
            
            // Restart monitoring with new interval
            if (this.healthMonitor.healthCheckInterval) {
                clearInterval(this.healthMonitor.healthCheckInterval);
                this.healthMonitor.healthCheckInterval = setInterval(
                    () => this.healthMonitor.runHealthChecks(),
                    this.healthMonitor.checkInterval
                );
            }
        }

        logger.info('Monitoring configuration updated', newConfig);
    }

    // Shutdown
    shutdown() {
        this.healthMonitor.shutdown();
        this.alertingSystem.shutdown();
        this.metricsCollector.shutdown();
        
        logger.info('Monitoring controller shutdown complete');
    }
}

module.exports = MonitoringController;