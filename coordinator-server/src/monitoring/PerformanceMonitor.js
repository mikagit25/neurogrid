/**
 * Performance Monitor - Real-time performance tracking and analysis
 * Monitors HTTP requests, response times, error rates, and system health
 */

const { EventEmitter } = require('events');
const { MetricsCollectorSingleton } = require('./MetricsCollector');

class PerformanceMonitor extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            trackRequests: options.trackRequests !== false,
            trackErrors: options.trackErrors !== false,
            trackLatency: options.trackLatency !== false,
            slowRequestThreshold: options.slowRequestThreshold || 1000, // 1 second
            errorThreshold: options.errorThreshold || 5, // 5% error rate
            enableAlerting: options.enableAlerting !== false,
            sampleRate: options.sampleRate || 1.0 // Sample 100% of requests
        };
        
        this.metricsCollector = MetricsCollectorSingleton.getInstance();
        
        // Performance tracking
        this.activeRequests = new Map();
        this.requestStats = {
            total: 0,
            success: 0,
            errors: 0,
            totalLatency: 0,
            slowRequests: 0
        };
        
        // Error tracking
        this.errorPatterns = new Map();
        this.errorStats = {
            byStatusCode: new Map(),
            byEndpoint: new Map(),
            byType: new Map()
        };
        
        // Health indicators
        this.healthMetrics = {
            responseTime: {
                current: 0,
                average: 0,
                p95: 0,
                p99: 0
            },
            errorRate: 0,
            throughput: 0,
            memoryUsage: 0,
            cpuUsage: 0
        };
        
        // Alerts
        this.alerts = new Map();
        this.alertHistory = [];
        
        // Performance history
        this.performanceHistory = [];
        this.maxHistorySize = 1000;
        
        // Start monitoring
        this.startMonitoring();
    }

    startMonitoring() {
        // Update health metrics periodically
        this.healthTimer = setInterval(() => {
            this.updateHealthMetrics();
        }, 10000); // Every 10 seconds
        
        // Check for alerts
        this.alertTimer = setInterval(() => {
            this.checkAlerts();
        }, 30000); // Every 30 seconds
        
        console.log('Performance monitoring started');
        this.emit('monitoringStarted');
    }

    stopMonitoring() {
        if (this.healthTimer) {
            clearInterval(this.healthTimer);
        }
        
        if (this.alertTimer) {
            clearInterval(this.alertTimer);
        }
        
        console.log('Performance monitoring stopped');
        this.emit('monitoringStopped');
    }

    // Express middleware for request tracking
    getMiddleware() {
        return (req, res, next) => {
            // Sample requests based on sample rate
            if (Math.random() > this.config.sampleRate) {
                return next();
            }
            
            const requestId = this.generateRequestId();
            const startTime = process.hrtime.bigint();
            const startTimestamp = new Date();
            
            // Track active request
            this.activeRequests.set(requestId, {
                method: req.method,
                url: req.url,
                startTime,
                startTimestamp,
                userAgent: req.get('User-Agent'),
                ip: req.ip || req.connection.remoteAddress
            });
            
            // Add request ID to request object
            req.performanceId = requestId;
            
            // Override res.end to capture response
            const originalEnd = res.end;
            res.end = (...args) => {
                this.handleRequestEnd(requestId, req, res, startTime);
                originalEnd.apply(res, args);
            };
            
            next();
        };
    }

    handleRequestEnd(requestId, req, res, startTime) {
        try {
            const endTime = process.hrtime.bigint();
            const latency = Number(endTime - startTime) / 1000000; // Convert to milliseconds
            
            const requestData = this.activeRequests.get(requestId);
            if (!requestData) return;
            
            // Remove from active requests
            this.activeRequests.delete(requestId);
            
            // Update request stats
            this.updateRequestStats(req, res, latency);
            
            // Record metrics
            if (this.config.trackRequests) {
                this.recordRequest(req, res, latency, requestData);
            }
            
            // Track errors
            if (this.config.trackErrors && res.statusCode >= 400) {
                this.recordError(req, res, latency, requestData);
            }
            
            // Track latency
            if (this.config.trackLatency) {
                this.recordLatency(req, res, latency);
            }
            
            // Check for slow requests
            if (latency > this.config.slowRequestThreshold) {
                this.handleSlowRequest(req, res, latency, requestData);
            }
            
        } catch (error) {
            console.error('Performance monitoring error:', error);
        }
    }

    updateRequestStats(req, res, latency) {
        this.requestStats.total++;
        this.requestStats.totalLatency += latency;
        
        if (res.statusCode < 400) {
            this.requestStats.success++;
        } else {
            this.requestStats.errors++;
        }
        
        if (latency > this.config.slowRequestThreshold) {
            this.requestStats.slowRequests++;
        }
    }

    recordRequest(req, res, latency, requestData) {
        const endpoint = this.normalizeEndpoint(req.url);
        
        // Record in metrics collector
        this.metricsCollector.incrementCounter(`requests_${req.method}_${endpoint}`);
        this.metricsCollector.incrementCounter(`requests_total`);
        
        // Record response status
        this.metricsCollector.incrementCounter(`responses_${res.statusCode}`);
        
        // Emit request event
        this.emit('requestCompleted', {
            requestId: req.performanceId,
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            latency,
            timestamp: new Date(),
            userAgent: requestData.userAgent,
            ip: requestData.ip
        });
    }

    recordError(req, res, latency, requestData) {
        const endpoint = this.normalizeEndpoint(req.url);
        const statusCode = res.statusCode;
        
        // Update error stats
        this.errorStats.byStatusCode.set(statusCode, 
            (this.errorStats.byStatusCode.get(statusCode) || 0) + 1);
        
        this.errorStats.byEndpoint.set(endpoint, 
            (this.errorStats.byEndpoint.get(endpoint) || 0) + 1);
        
        // Determine error type
        let errorType = 'unknown';
        if (statusCode >= 400 && statusCode < 500) {
            errorType = 'client_error';
        } else if (statusCode >= 500) {
            errorType = 'server_error';
        }
        
        this.errorStats.byType.set(errorType, 
            (this.errorStats.byType.get(errorType) || 0) + 1);
        
        // Record in metrics collector
        this.metricsCollector.incrementCounter(`errors_${statusCode}`);
        this.metricsCollector.incrementCounter(`errors_${errorType}`);
        
        // Emit error event
        this.emit('errorRecorded', {
            requestId: req.performanceId,
            method: req.method,
            url: req.url,
            statusCode,
            errorType,
            latency,
            timestamp: new Date(),
            userAgent: requestData.userAgent,
            ip: requestData.ip
        });
    }

    recordLatency(req, res, latency) {
        const endpoint = this.normalizeEndpoint(req.url);
        
        // Record in metrics collector
        this.metricsCollector.recordLatency(`latency_${req.method}_${endpoint}`, latency);
        this.metricsCollector.recordLatency('latency_overall', latency);
    }

    handleSlowRequest(req, res, latency, requestData) {
        this.emit('slowRequest', {
            requestId: req.performanceId,
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            latency,
            threshold: this.config.slowRequestThreshold,
            timestamp: new Date(),
            userAgent: requestData.userAgent,
            ip: requestData.ip
        });
        
        // Record slow request pattern
        const endpoint = this.normalizeEndpoint(req.url);
        const pattern = `${req.method}_${endpoint}`;
        
        if (!this.errorPatterns.has(pattern)) {
            this.errorPatterns.set(pattern, { count: 0, totalLatency: 0 });
        }
        
        const patternData = this.errorPatterns.get(pattern);
        patternData.count++;
        patternData.totalLatency += latency;
    }

    updateHealthMetrics() {
        try {
            // Calculate current metrics
            const currentMetrics = this.metricsCollector.getMetrics('current');
            
            if (currentMetrics.current) {
                // Update response time metrics
                if (this.requestStats.total > 0) {
                    this.healthMetrics.responseTime.average = 
                        this.requestStats.totalLatency / this.requestStats.total;
                }
                
                // Calculate error rate
                if (this.requestStats.total > 0) {
                    this.healthMetrics.errorRate = 
                        (this.requestStats.errors / this.requestStats.total) * 100;
                }
                
                // Update system metrics
                if (currentMetrics.current.system) {
                    const system = currentMetrics.current.system;
                    
                    if (system.memory) {
                        this.healthMetrics.memoryUsage = system.memory.usage;
                    }
                    
                    if (system.cpu && system.cpu.usage) {
                        this.healthMetrics.cpuUsage = system.cpu.usage.total || 0;
                    }
                }
                
                // Calculate throughput (requests per second)
                this.calculateThroughput();
            }
            
            // Add to performance history
            this.addToPerformanceHistory();
            
            // Emit health update
            this.emit('healthMetricsUpdated', this.healthMetrics);
            
        } catch (error) {
            console.error('Health metrics update error:', error);
        }
    }

    calculateThroughput() {
        const now = Date.now();
        const oneMinuteAgo = now - 60000;
        
        // Count requests in the last minute
        const recentRequests = this.performanceHistory.filter(
            entry => entry.timestamp > oneMinuteAgo
        ).length;
        
        this.healthMetrics.throughput = recentRequests / 60; // requests per second
    }

    addToPerformanceHistory() {
        const entry = {
            timestamp: Date.now(),
            responseTime: this.healthMetrics.responseTime.average,
            errorRate: this.healthMetrics.errorRate,
            throughput: this.healthMetrics.throughput,
            memoryUsage: this.healthMetrics.memoryUsage,
            cpuUsage: this.healthMetrics.cpuUsage,
            activeRequests: this.activeRequests.size
        };
        
        this.performanceHistory.push(entry);
        
        // Limit history size
        if (this.performanceHistory.length > this.maxHistorySize) {
            this.performanceHistory = this.performanceHistory.slice(-this.maxHistorySize);
        }
    }

    checkAlerts() {
        if (!this.config.enableAlerting) return;
        
        const alerts = [];
        
        // Check error rate
        if (this.healthMetrics.errorRate > this.config.errorThreshold) {
            alerts.push({
                type: 'high_error_rate',
                severity: 'warning',
                message: `Error rate is ${this.healthMetrics.errorRate.toFixed(2)}%`,
                threshold: this.config.errorThreshold,
                current: this.healthMetrics.errorRate
            });
        }
        
        // Check memory usage
        if (this.healthMetrics.memoryUsage > 90) {
            alerts.push({
                type: 'high_memory_usage',
                severity: 'critical',
                message: `Memory usage is ${this.healthMetrics.memoryUsage.toFixed(2)}%`,
                threshold: 90,
                current: this.healthMetrics.memoryUsage
            });
        }
        
        // Check CPU usage
        if (this.healthMetrics.cpuUsage > 80) {
            alerts.push({
                type: 'high_cpu_usage',
                severity: 'warning',
                message: `CPU usage is ${this.healthMetrics.cpuUsage.toFixed(2)}%`,
                threshold: 80,
                current: this.healthMetrics.cpuUsage
            });
        }
        
        // Check slow requests
        const slowRequestRate = this.requestStats.total > 0 ? 
            (this.requestStats.slowRequests / this.requestStats.total) * 100 : 0;
        
        if (slowRequestRate > 10) {
            alerts.push({
                type: 'high_slow_request_rate',
                severity: 'warning',
                message: `${slowRequestRate.toFixed(2)}% of requests are slow`,
                threshold: 10,
                current: slowRequestRate
            });
        }
        
        // Process alerts
        alerts.forEach(alert => this.processAlert(alert));
    }

    processAlert(alert) {
        const alertKey = `${alert.type}_${alert.severity}`;
        const now = Date.now();
        
        // Check if this alert was recently triggered (debouncing)
        const lastAlert = this.alerts.get(alertKey);
        if (lastAlert && (now - lastAlert.timestamp) < 300000) { // 5 minutes
            return;
        }
        
        // Record alert
        const alertData = {
            ...alert,
            timestamp: now,
            id: this.generateAlertId()
        };
        
        this.alerts.set(alertKey, alertData);
        this.alertHistory.push(alertData);
        
        // Limit alert history
        if (this.alertHistory.length > 100) {
            this.alertHistory = this.alertHistory.slice(-100);
        }
        
        // Emit alert
        this.emit('alert', alertData);
        
        console.warn(`Performance Alert [${alert.severity.toUpperCase()}]: ${alert.message}`);
    }

    // Utility methods
    normalizeEndpoint(url) {
        // Remove query parameters and normalize path
        const path = url.split('?')[0];
        
        // Replace IDs with placeholder
        return path.replace(/\/\d+/g, '/:id')
                  .replace(/\/[a-f0-9-]{36}/g, '/:uuid') // UUIDs
                  .replace(/\/[a-f0-9]{24}/g, '/:objectid'); // MongoDB ObjectIds
    }

    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    generateAlertId() {
        return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Public API methods
    getPerformanceStats() {
        return {
            requests: this.requestStats,
            errors: {
                byStatusCode: Object.fromEntries(this.errorStats.byStatusCode),
                byEndpoint: Object.fromEntries(this.errorStats.byEndpoint),
                byType: Object.fromEntries(this.errorStats.byType)
            },
            health: this.healthMetrics,
            activeRequests: this.activeRequests.size,
            alerts: {
                active: Array.from(this.alerts.values()),
                history: this.alertHistory.slice(-10) // Last 10 alerts
            }
        };
    }

    getPerformanceHistory(duration = '1h') {
        const durationMs = this.parseDuration(duration);
        const cutoff = Date.now() - durationMs;
        
        return this.performanceHistory.filter(entry => entry.timestamp > cutoff);
    }

    parseDuration(duration) {
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

    getTopSlowEndpoints(limit = 10) {
        const endpoints = new Map();
        
        for (const [pattern, data] of this.errorPatterns.entries()) {
            const avgLatency = data.totalLatency / data.count;
            endpoints.set(pattern, {
                endpoint: pattern,
                count: data.count,
                averageLatency: avgLatency,
                totalLatency: data.totalLatency
            });
        }
        
        return Array.from(endpoints.values())
            .sort((a, b) => b.averageLatency - a.averageLatency)
            .slice(0, limit);
    }

    resetStats() {
        this.requestStats = {
            total: 0,
            success: 0,
            errors: 0,
            totalLatency: 0,
            slowRequests: 0
        };
        
        this.errorStats = {
            byStatusCode: new Map(),
            byEndpoint: new Map(),
            byType: new Map()
        };
        
        this.errorPatterns.clear();
        this.performanceHistory = [];
        
        this.emit('statsReset');
    }

    async shutdown() {
        this.stopMonitoring();
        this.removeAllListeners();
    }
}

// Singleton instance
let performanceMonitorInstance = null;

class PerformanceMonitorSingleton {
    static getInstance(options = {}) {
        if (!performanceMonitorInstance) {
            performanceMonitorInstance = new PerformanceMonitor(options);
        }
        return performanceMonitorInstance;
    }
}

module.exports = { PerformanceMonitor, PerformanceMonitorSingleton };