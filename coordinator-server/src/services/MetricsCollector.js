const promClient = require('prom-client');
const os = require('os');
const EventEmitter = require('events');
const logger = require('../utils/logger');

class MetricsCollector extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.register = new promClient.Registry();
        
        // Add default metrics
        promClient.collectDefaultMetrics({ register: this.register });
        
        // Initialize custom metrics
        this.initializeMetrics();
        
        // Start collection intervals
        this.startCollection();
    }

    initializeMetrics() {
        // HTTP metrics
        this.httpRequestsTotal = new promClient.Counter({
            name: 'http_requests_total',
            help: 'Total number of HTTP requests',
            labelNames: ['method', 'path', 'status_code', 'user_id'],
            registers: [this.register]
        });

        this.httpRequestDuration = new promClient.Histogram({
            name: 'http_request_duration_seconds',
            help: 'Duration of HTTP requests in seconds',
            labelNames: ['method', 'path', 'status_code'],
            buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10],
            registers: [this.register]
        });

        // Authentication metrics
        this.authAttemptsTotal = new promClient.Counter({
            name: 'auth_attempts_total',
            help: 'Total number of authentication attempts',
            labelNames: ['method', 'result', 'ip'],
            registers: [this.register]
        });

        this.activeSessionsGauge = new promClient.Gauge({
            name: 'active_sessions_total',
            help: 'Number of active user sessions',
            registers: [this.register]
        });

        // Database metrics
        this.databaseConnectionsGauge = new promClient.Gauge({
            name: 'database_connections_active',
            help: 'Number of active database connections',
            registers: [this.register]
        });

        this.databaseQueryDuration = new promClient.Histogram({
            name: 'database_query_duration_seconds',
            help: 'Duration of database queries in seconds',
            labelNames: ['operation', 'table'],
            buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
            registers: [this.register]
        });

        this.databaseErrorsTotal = new promClient.Counter({
            name: 'database_errors_total',
            help: 'Total number of database errors',
            labelNames: ['operation', 'error_type'],
            registers: [this.register]
        });

        // Task/Job metrics
        this.tasksTotal = new promClient.Counter({
            name: 'tasks_total',
            help: 'Total number of tasks processed',
            labelNames: ['status', 'type', 'priority'],
            registers: [this.register]
        });

        this.taskDuration = new promClient.Histogram({
            name: 'task_duration_seconds',
            help: 'Duration of task processing in seconds',
            labelNames: ['type', 'status'],
            buckets: [1, 5, 15, 30, 60, 300, 600, 1800, 3600],
            registers: [this.register]
        });

        this.activeTasksGauge = new promClient.Gauge({
            name: 'active_tasks_total',
            help: 'Number of currently active tasks',
            labelNames: ['type', 'priority'],
            registers: [this.register]
        });

        this.taskQueueSizeGauge = new promClient.Gauge({
            name: 'task_queue_size',
            help: 'Number of tasks in queue',
            labelNames: ['priority'],
            registers: [this.register]
        });

        // Node metrics
        this.nodesTotal = new promClient.Gauge({
            name: 'compute_nodes_total',
            help: 'Total number of compute nodes',
            labelNames: ['status', 'type'],
            registers: [this.register]
        });

        this.nodeResourceUtilization = new promClient.Gauge({
            name: 'node_resource_utilization',
            help: 'Resource utilization of compute nodes',
            labelNames: ['node_id', 'resource_type'],
            registers: [this.register]
        });

        // Payment metrics
        this.paymentsTotal = new promClient.Counter({
            name: 'payments_total',
            help: 'Total number of payment transactions',
            labelNames: ['method', 'status', 'currency'],
            registers: [this.register]
        });

        this.paymentAmountTotal = new promClient.Counter({
            name: 'payment_amount_total',
            help: 'Total payment amount processed',
            labelNames: ['method', 'currency'],
            registers: [this.register]
        });

        // Security metrics
        this.securityEventsTotal = new promClient.Counter({
            name: 'security_events_total',
            help: 'Total number of security events',
            labelNames: ['type', 'severity', 'source_ip'],
            registers: [this.register]
        });

        this.rateLimitHitsTotal = new promClient.Counter({
            name: 'rate_limit_hits_total',
            help: 'Total number of rate limit hits',
            labelNames: ['endpoint', 'limit_type'],
            registers: [this.register]
        });

        // System metrics
        this.systemResourceUsage = new promClient.Gauge({
            name: 'system_resource_usage',
            help: 'System resource usage',
            labelNames: ['resource_type'],
            registers: [this.register]
        });

        this.applicationErrors = new promClient.Counter({
            name: 'application_errors_total',
            help: 'Total number of application errors',
            labelNames: ['error_type', 'component'],
            registers: [this.register]
        });

        // WebSocket metrics
        this.websocketConnectionsGauge = new promClient.Gauge({
            name: 'websocket_connections_active',
            help: 'Number of active WebSocket connections',
            registers: [this.register]
        });

        this.websocketMessagesTotal = new promClient.Counter({
            name: 'websocket_messages_total',
            help: 'Total number of WebSocket messages',
            labelNames: ['direction', 'message_type'],
            registers: [this.register]
        });

        // Business metrics
        this.userRegistrationsTotal = new promClient.Counter({
            name: 'user_registrations_total',
            help: 'Total number of user registrations',
            labelNames: ['source'],
            registers: [this.register]
        });

        this.activeUsersGauge = new promClient.Gauge({
            name: 'active_users_total',
            help: 'Number of active users',
            labelNames: ['time_window'],
            registers: [this.register]
        });

        this.revenueTotal = new promClient.Counter({
            name: 'revenue_total',
            help: 'Total revenue generated',
            labelNames: ['currency', 'source'],
            registers: [this.register]
        });
    }

    startCollection() {
        const interval = this.config?.get('METRICS_INTERVAL') || 60000; // 1 minute default

        // Collect system metrics
        setInterval(() => {
            this.collectSystemMetrics();
        }, interval);

        // Collect database metrics
        setInterval(() => {
            this.collectDatabaseMetrics();
        }, interval);

        // Collect business metrics
        setInterval(() => {
            this.collectBusinessMetrics();
        }, interval * 5); // Every 5 minutes
    }

    collectSystemMetrics() {
        try {
            // CPU usage
            const cpuUsage = process.cpuUsage();
            this.systemResourceUsage.set(
                { resource_type: 'cpu_user' },
                cpuUsage.user / 1000000 // Convert to seconds
            );
            this.systemResourceUsage.set(
                { resource_type: 'cpu_system' },
                cpuUsage.system / 1000000
            );

            // Memory usage
            const memUsage = process.memoryUsage();
            this.systemResourceUsage.set({ resource_type: 'memory_rss' }, memUsage.rss);
            this.systemResourceUsage.set({ resource_type: 'memory_heap_total' }, memUsage.heapTotal);
            this.systemResourceUsage.set({ resource_type: 'memory_heap_used' }, memUsage.heapUsed);

            // System load
            const loadAvg = os.loadavg();
            this.systemResourceUsage.set({ resource_type: 'load_1m' }, loadAvg[0]);
            this.systemResourceUsage.set({ resource_type: 'load_5m' }, loadAvg[1]);
            this.systemResourceUsage.set({ resource_type: 'load_15m' }, loadAvg[2]);

            // Free memory
            const freeMem = os.freemem();
            const totalMem = os.totalmem();
            this.systemResourceUsage.set({ resource_type: 'memory_free' }, freeMem);
            this.systemResourceUsage.set({ resource_type: 'memory_usage_percent' }, 
                ((totalMem - freeMem) / totalMem) * 100);

        } catch (error) {
            logger.error('Failed to collect system metrics', { error: error.message });
        }
    }

    async collectDatabaseMetrics() {
        try {
            // This would integrate with your database connection pool
            // For now, we'll use placeholder values
            const activeConnections = 5; // Get from connection pool
            this.databaseConnectionsGauge.set(activeConnections);

        } catch (error) {
            logger.error('Failed to collect database metrics', { error: error.message });
        }
    }

    async collectBusinessMetrics() {
        try {
            // These would query your database for business metrics
            // Active users in different time windows
            this.activeUsersGauge.set({ time_window: '1h' }, 100); // Placeholder
            this.activeUsersGauge.set({ time_window: '24h' }, 500); // Placeholder
            this.activeUsersGauge.set({ time_window: '7d' }, 2000); // Placeholder

        } catch (error) {
            logger.error('Failed to collect business metrics', { error: error.message });
        }
    }

    // HTTP request tracking
    recordHttpRequest(method, path, statusCode, duration, userId = null) {
        const labels = { method, path, status_code: statusCode };
        if (userId) labels.user_id = userId;

        this.httpRequestsTotal.inc(labels);
        this.httpRequestDuration.observe(
            { method, path, status_code: statusCode },
            duration / 1000 // Convert to seconds
        );
    }

    // Authentication tracking
    recordAuthAttempt(method, result, ip) {
        this.authAttemptsTotal.inc({ method, result, ip });
    }

    updateActiveSessions(count) {
        this.activeSessionsGauge.set(count);
    }

    // Database operation tracking
    recordDatabaseQuery(operation, table, duration) {
        this.databaseQueryDuration.observe(
            { operation, table },
            duration / 1000 // Convert to seconds
        );
    }

    recordDatabaseError(operation, errorType) {
        this.databaseErrorsTotal.inc({ operation, error_type: errorType });
    }

    // Task tracking
    recordTask(status, type, priority, duration = null) {
        this.tasksTotal.inc({ status, type, priority });
        
        if (duration !== null) {
            this.taskDuration.observe(
                { type, status },
                duration / 1000 // Convert to seconds
            );
        }
    }

    updateActiveTasksCount(type, priority, count) {
        this.activeTasksGauge.set({ type, priority }, count);
    }

    updateTaskQueueSize(priority, size) {
        this.taskQueueSizeGauge.set({ priority }, size);
    }

    // Node tracking
    updateNodesCount(status, type, count) {
        this.nodesTotal.set({ status, type }, count);
    }

    updateNodeResourceUtilization(nodeId, resourceType, utilization) {
        this.nodeResourceUtilization.set({ node_id: nodeId, resource_type: resourceType }, utilization);
    }

    // Payment tracking
    recordPayment(method, status, currency, amount = 0) {
        this.paymentsTotal.inc({ method, status, currency });
        
        if (amount > 0) {
            this.paymentAmountTotal.inc({ method, currency }, amount);
        }
    }

    // Security event tracking
    recordSecurityEvent(type, severity, sourceIp) {
        this.securityEventsTotal.inc({ type, severity, source_ip: sourceIp });
    }

    recordRateLimitHit(endpoint, limitType) {
        this.rateLimitHitsTotal.inc({ endpoint, limit_type: limitType });
    }

    // Error tracking
    recordError(errorType, component) {
        this.applicationErrors.inc({ error_type: errorType, component });
    }

    // WebSocket tracking
    updateWebSocketConnections(count) {
        this.websocketConnectionsGauge.set(count);
    }

    recordWebSocketMessage(direction, messageType) {
        this.websocketMessagesTotal.inc({ direction, message_type: messageType });
    }

    // Business metrics
    recordUserRegistration(source = 'web') {
        this.userRegistrationsTotal.inc({ source });
    }

    recordRevenue(amount, currency, source) {
        this.revenueTotal.inc({ currency, source }, amount);
    }

    // Get metrics for Prometheus scraping
    async getMetrics() {
        return this.register.metrics();
    }

    // Get registry for external use
    getRegistry() {
        return this.register;
    }

    // Health check metrics
    getHealthMetrics() {
        return {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            cpu: process.cpuUsage(),
            loadAvg: os.loadavg(),
            freeMemory: os.freemem(),
            totalMemory: os.totalmem(),
            platform: os.platform(),
            nodeVersion: process.version
        };
    }

    // Create middleware for automatic HTTP metrics collection
    createMiddleware() {
        return (req, res, next) => {
            const start = Date.now();

            // Override res.end to capture metrics
            const originalEnd = res.end;
            res.end = (...args) => {
                const duration = Date.now() - start;
                
                this.recordHttpRequest(
                    req.method,
                    req.route?.path || req.path,
                    res.statusCode,
                    duration,
                    req.user?.id
                );

                originalEnd.apply(res, args);
            };

            next();
        };
    }

    // Cleanup and shutdown
    shutdown() {
        this.register.clear();
        this.removeAllListeners();
    }
}

module.exports = MetricsCollector;