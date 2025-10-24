const EventEmitter = require('events');
const os = require('os');
const logger = require('../utils/logger');

class HealthMonitor extends EventEmitter {
    constructor(config, dependencies = {}) {
        super();
        this.config = config;
        this.dependencies = dependencies;
        
        // Health check configuration
        this.checkInterval = config?.get('HEALTH_CHECK_INTERVAL') || 30000; // 30 seconds
        this.alertThresholds = {
            cpu: config?.get('CPU_ALERT_THRESHOLD') || 80,
            memory: config?.get('MEMORY_ALERT_THRESHOLD') || 85,
            diskSpace: config?.get('DISK_SPACE_ALERT_THRESHOLD') || 90,
            responseTime: config?.get('RESPONSE_TIME_ALERT_THRESHOLD') || 5000,
            errorRate: config?.get('ERROR_RATE_ALERT_THRESHOLD') || 5,
            dbConnections: config?.get('DB_CONNECTIONS_ALERT_THRESHOLD') || 80
        };

        // Health status tracking
        this.healthStatus = {
            overall: 'healthy',
            components: {},
            lastCheck: new Date(),
            uptime: process.uptime(),
            version: require('../../package.json').version
        };

        // Performance metrics tracking
        this.performanceMetrics = {
            responseTime: [],
            errorRate: 0,
            requestCount: 0,
            errorCount: 0,
            lastReset: Date.now()
        };

        // Alert state tracking
        this.alertStates = new Map();
        this.alertCooldowns = new Map();

        // Start monitoring
        this.startMonitoring();
    }

    startMonitoring() {
        // Run health checks periodically
        this.healthCheckInterval = setInterval(() => {
            this.runHealthChecks();
        }, this.checkInterval);

        // Reset performance metrics hourly
        this.metricsResetInterval = setInterval(() => {
            this.resetPerformanceMetrics();
        }, 60 * 60 * 1000); // 1 hour

        logger.info('Health monitoring started', {
            interval: this.checkInterval,
            thresholds: this.alertThresholds
        });
    }

    async runHealthChecks() {
        try {
            const checks = await Promise.allSettled([
                this.checkSystemHealth(),
                this.checkDatabaseHealth(),
                this.checkRedisHealth(),
                this.checkExternalServices(),
                this.checkDiskSpace(),
                this.checkMemoryUsage(),
                this.checkCpuUsage(),
                this.checkResponseTime(),
                this.checkErrorRate()
            ]);

            // Process check results
            const results = {};
            const checkNames = [
                'system', 'database', 'redis', 'external', 
                'disk', 'memory', 'cpu', 'responseTime', 'errorRate'
            ];

            checks.forEach((check, index) => {
                const name = checkNames[index];
                if (check.status === 'fulfilled') {
                    results[name] = check.value;
                } else {
                    results[name] = {
                        status: 'unhealthy',
                        error: check.reason.message,
                        timestamp: new Date()
                    };
                }
            });

            // Update health status
            this.updateHealthStatus(results);

            // Check for alerts
            this.checkAlerts(results);

            // Emit health check event
            this.emit('healthCheck', {
                status: this.healthStatus.overall,
                components: results,
                timestamp: new Date()
            });

        } catch (error) {
            logger.error('Health check failed', {
                error: error.message,
                stack: error.stack
            });
        }
    }

    async checkSystemHealth() {
        const startTime = Date.now();
        
        try {
            // Basic system checks
            const uptime = process.uptime();
            const memoryUsage = process.memoryUsage();
            const cpuUsage = process.cpuUsage();

            return {
                status: 'healthy',
                uptime: uptime,
                memory: {
                    rss: Math.round(memoryUsage.rss / 1024 / 1024),
                    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024),
                    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024),
                    external: Math.round(memoryUsage.external / 1024 / 1024)
                },
                cpu: {
                    user: cpuUsage.user,
                    system: cpuUsage.system
                },
                loadAverage: os.loadavg(),
                responseTime: Date.now() - startTime,
                timestamp: new Date()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                responseTime: Date.now() - startTime,
                timestamp: new Date()
            };
        }
    }

    async checkDatabaseHealth() {
        const startTime = Date.now();
        
        try {
            const db = this.dependencies.database;
            if (!db) {
                throw new Error('Database dependency not provided');
            }

            // Test database connection
            await db.authenticate();
            
            // Get connection pool status
            const poolStatus = db.connectionManager?.pool ? {
                size: db.connectionManager.pool.size,
                available: db.connectionManager.pool.available,
                using: db.connectionManager.pool.using,
                waiting: db.connectionManager.pool.pending
            } : null;

            return {
                status: 'healthy',
                connectionPool: poolStatus,
                responseTime: Date.now() - startTime,
                timestamp: new Date()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                responseTime: Date.now() - startTime,
                timestamp: new Date()
            };
        }
    }

    async checkRedisHealth() {
        const startTime = Date.now();
        
        try {
            const redis = this.dependencies.redis;
            if (!redis) {
                return {
                    status: 'not_configured',
                    message: 'Redis not configured',
                    timestamp: new Date()
                };
            }

            // Test Redis connection
            const pong = await redis.ping();
            if (pong !== 'PONG') {
                throw new Error('Redis ping failed');
            }

            // Get Redis info
            const info = await redis.info();
            const memoryInfo = info.split('\n')
                .filter(line => line.startsWith('used_memory:'))
                .map(line => line.split(':')[1])[0];

            return {
                status: 'healthy',
                memory: memoryInfo ? parseInt(memoryInfo) : null,
                responseTime: Date.now() - startTime,
                timestamp: new Date()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                responseTime: Date.now() - startTime,
                timestamp: new Date()
            };
        }
    }

    async checkExternalServices() {
        const startTime = Date.now();
        const results = {};

        // Check payment gateways if configured
        if (this.config?.get('STRIPE_ENABLED')) {
            try {
                // This would be a real health check to Stripe
                // For now, we'll simulate it
                results.stripe = {
                    status: 'healthy',
                    responseTime: 150
                };
            } catch (error) {
                results.stripe = {
                    status: 'unhealthy',
                    error: error.message
                };
            }
        }

        return {
            status: Object.values(results).every(r => r.status === 'healthy') ? 'healthy' : 'degraded',
            services: results,
            responseTime: Date.now() - startTime,
            timestamp: new Date()
        };
    }

    checkDiskSpace() {
        try {
            const fs = require('fs');
            const stats = fs.statSync('.');
            
            // This is a simplified check - in production you'd use a proper disk space library
            return {
                status: 'healthy',
                message: 'Disk space check not fully implemented',
                timestamp: new Date()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date()
            };
        }
    }

    checkMemoryUsage() {
        try {
            const totalMem = os.totalmem();
            const freeMem = os.freemem();
            const usedMem = totalMem - freeMem;
            const usagePercent = (usedMem / totalMem) * 100;

            const status = usagePercent > this.alertThresholds.memory ? 'unhealthy' : 'healthy';

            return {
                status,
                total: Math.round(totalMem / 1024 / 1024),
                free: Math.round(freeMem / 1024 / 1024),
                used: Math.round(usedMem / 1024 / 1024),
                usagePercent: Math.round(usagePercent),
                threshold: this.alertThresholds.memory,
                timestamp: new Date()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date()
            };
        }
    }

    checkCpuUsage() {
        try {
            const loadAvg = os.loadavg();
            const cpuCount = os.cpus().length;
            const loadPercent = (loadAvg[0] / cpuCount) * 100;

            const status = loadPercent > this.alertThresholds.cpu ? 'unhealthy' : 'healthy';

            return {
                status,
                loadAverage: loadAvg,
                cpuCount,
                loadPercent: Math.round(loadPercent),
                threshold: this.alertThresholds.cpu,
                timestamp: new Date()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date()
            };
        }
    }

    checkResponseTime() {
        const avgResponseTime = this.getAverageResponseTime();
        const status = avgResponseTime > this.alertThresholds.responseTime ? 'unhealthy' : 'healthy';

        return {
            status,
            averageResponseTime: avgResponseTime,
            threshold: this.alertThresholds.responseTime,
            sampleSize: this.performanceMetrics.responseTime.length,
            timestamp: new Date()
        };
    }

    checkErrorRate() {
        const errorRate = this.calculateErrorRate();
        const status = errorRate > this.alertThresholds.errorRate ? 'unhealthy' : 'healthy';

        return {
            status,
            errorRate,
            threshold: this.alertThresholds.errorRate,
            errorCount: this.performanceMetrics.errorCount,
            requestCount: this.performanceMetrics.requestCount,
            timestamp: new Date()
        };
    }

    updateHealthStatus(results) {
        // Update component statuses
        this.healthStatus.components = results;
        this.healthStatus.lastCheck = new Date();
        this.healthStatus.uptime = process.uptime();

        // Determine overall status
        const componentStatuses = Object.values(results).map(r => r.status);
        
        if (componentStatuses.includes('unhealthy')) {
            this.healthStatus.overall = 'unhealthy';
        } else if (componentStatuses.includes('degraded')) {
            this.healthStatus.overall = 'degraded';
        } else {
            this.healthStatus.overall = 'healthy';
        }

        logger.debug('Health status updated', {
            overall: this.healthStatus.overall,
            componentCount: Object.keys(results).length
        });
    }

    checkAlerts(results) {
        Object.entries(results).forEach(([component, result]) => {
            if (result.status === 'unhealthy') {
                this.triggerAlert(component, 'unhealthy', result);
            } else if (result.status === 'healthy' && this.alertStates.has(component)) {
                this.resolveAlert(component);
            }
        });
    }

    triggerAlert(component, severity, details) {
        const alertKey = `${component}_${severity}`;
        
        // Check if alert is in cooldown
        if (this.alertCooldowns.has(alertKey)) {
            const cooldownEnd = this.alertCooldowns.get(alertKey);
            if (Date.now() < cooldownEnd) {
                return; // Still in cooldown
            }
        }

        // Check if alert is already active
        if (this.alertStates.has(component)) {
            return; // Alert already active
        }

        const alert = {
            id: require('crypto').randomUUID(),
            component,
            severity,
            message: `Component ${component} is ${severity}`,
            details,
            timestamp: new Date(),
            resolved: false
        };

        this.alertStates.set(component, alert);

        logger.error('Health alert triggered', alert);
        this.emit('alert', alert);

        // Send notifications if configured
        this.sendAlertNotification(alert);

        // Set cooldown to prevent spam
        const cooldownDuration = severity === 'unhealthy' ? 5 * 60 * 1000 : 15 * 60 * 1000; // 5 or 15 minutes
        this.alertCooldowns.set(alertKey, Date.now() + cooldownDuration);
    }

    resolveAlert(component) {
        const alert = this.alertStates.get(component);
        if (!alert) return;

        alert.resolved = true;
        alert.resolvedAt = new Date();

        logger.info('Health alert resolved', {
            component,
            alertId: alert.id,
            duration: alert.resolvedAt - alert.timestamp
        });

        this.emit('alertResolved', alert);
        this.alertStates.delete(component);

        // Send resolution notification
        this.sendAlertResolutionNotification(alert);
    }

    async sendAlertNotification(alert) {
        try {
            // This would integrate with your notification system
            // For now, we'll just log it
            logger.error('ALERT NOTIFICATION', {
                component: alert.component,
                severity: alert.severity,
                message: alert.message,
                details: alert.details
            });

            // In a real implementation, you might:
            // - Send email via SMTP
            // - Send to Slack webhook
            // - Send to PagerDuty
            // - Send SMS via Twilio
            // - Post to monitoring dashboard

        } catch (error) {
            logger.error('Failed to send alert notification', {
                error: error.message,
                alert: alert.id
            });
        }
    }

    async sendAlertResolutionNotification(alert) {
        try {
            logger.info('ALERT RESOLUTION NOTIFICATION', {
                component: alert.component,
                alertId: alert.id,
                resolvedAt: alert.resolvedAt
            });
        } catch (error) {
            logger.error('Failed to send alert resolution notification', {
                error: error.message,
                alert: alert.id
            });
        }
    }

    // Performance tracking methods
    recordRequest(responseTime, isError = false) {
        this.performanceMetrics.requestCount++;
        
        if (isError) {
            this.performanceMetrics.errorCount++;
        }

        // Keep only last 100 response times for average calculation
        this.performanceMetrics.responseTime.push(responseTime);
        if (this.performanceMetrics.responseTime.length > 100) {
            this.performanceMetrics.responseTime.shift();
        }
    }

    getAverageResponseTime() {
        const times = this.performanceMetrics.responseTime;
        if (times.length === 0) return 0;
        
        return times.reduce((sum, time) => sum + time, 0) / times.length;
    }

    calculateErrorRate() {
        if (this.performanceMetrics.requestCount === 0) return 0;
        
        return (this.performanceMetrics.errorCount / this.performanceMetrics.requestCount) * 100;
    }

    resetPerformanceMetrics() {
        this.performanceMetrics = {
            responseTime: [],
            errorRate: 0,
            requestCount: 0,
            errorCount: 0,
            lastReset: Date.now()
        };

        logger.debug('Performance metrics reset');
    }

    // Public methods
    getHealthStatus() {
        return {
            ...this.healthStatus,
            alerts: Array.from(this.alertStates.values()),
            performance: {
                averageResponseTime: this.getAverageResponseTime(),
                errorRate: this.calculateErrorRate(),
                requestCount: this.performanceMetrics.requestCount,
                errorCount: this.performanceMetrics.errorCount
            }
        };
    }

    getDetailedHealthStatus() {
        return {
            ...this.getHealthStatus(),
            system: {
                platform: os.platform(),
                architecture: os.arch(),
                nodeVersion: process.version,
                pid: process.pid,
                uptime: process.uptime(),
                cpuUsage: process.cpuUsage(),
                memoryUsage: process.memoryUsage()
            },
            thresholds: this.alertThresholds
        };
    }

    // Middleware for automatic request tracking
    createMiddleware() {
        return (req, res, next) => {
            const start = Date.now();

            res.on('finish', () => {
                const responseTime = Date.now() - start;
                const isError = res.statusCode >= 400;
                
                this.recordRequest(responseTime, isError);
            });

            next();
        };
    }

    // Shutdown
    shutdown() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        
        if (this.metricsResetInterval) {
            clearInterval(this.metricsResetInterval);
        }

        this.removeAllListeners();
        logger.info('Health monitor shutdown complete');
    }
}

module.exports = HealthMonitor;