/**
 * NeuroGrid Metrics and Monitoring System
 * 
 * Prometheus-compatible metrics for monitoring
 * application performance, AI tasks, and system health.
 */

const promClient = require('prom-client');
const logger = require('./logger');

// Create a Registry which registers the metrics
const register = new promClient.Registry();

// Add a default label which is added to all metrics
register.setDefaultLabels({
    app: 'neurogrid',
    version: process.env.npm_package_version || '1.0.0'
});

// Enable the collection of default metrics
promClient.collectDefaultMetrics({ register });

// === HTTP Metrics ===
const httpRequestDuration = new promClient.Histogram({
    name: 'neurogrid_http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

const httpRequestsTotal = new promClient.Counter({
    name: 'neurogrid_http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code']
});

// === WebSocket Metrics ===
const activeConnections = new promClient.Gauge({
    name: 'neurogrid_active_websocket_connections',
    help: 'Number of active WebSocket connections'
});

const websocketMessages = new promClient.Counter({
    name: 'neurogrid_websocket_messages_total',
    help: 'Total number of WebSocket messages',
    labelNames: ['direction'] // 'incoming' or 'outgoing'
});

// === AI Task Metrics ===
const tasksProcessed = new promClient.Counter({
    name: 'neurogrid_tasks_processed_total',
    help: 'Total number of AI tasks processed',
    labelNames: ['model', 'task_type', 'status'] // 'success' or 'error'
});

const taskDuration = new promClient.Histogram({
    name: 'neurogrid_task_duration_seconds',
    help: 'Duration of AI task processing in seconds',
    labelNames: ['model', 'task_type'],
    buckets: [0.5, 1, 2, 5, 10, 30, 60, 120, 300] // up to 5 minutes
});

const activeModels = new promClient.Gauge({
    name: 'neurogrid_active_models',
    help: 'Number of currently active AI models',
    labelNames: ['model_type'] // 'text', 'image', 'code'
});

// === System Metrics ===
const systemMemoryUsage = new promClient.Gauge({
    name: 'neurogrid_memory_usage_bytes',
    help: 'Current memory usage in bytes'
});

const systemUptime = new promClient.Gauge({
    name: 'neurogrid_uptime_seconds',
    help: 'Application uptime in seconds'
});

const errorRate = new promClient.Counter({
    name: 'neurogrid_errors_total',
    help: 'Total number of errors',
    labelNames: ['error_type', 'component']
});

// === Economy Metrics ===
const neuroTokensDistributed = new promClient.Counter({
    name: 'neurogrid_neuro_tokens_distributed_total',
    help: 'Total NEURO tokens distributed in rewards',
    labelNames: ['reward_type'] // 'staking', 'task_completion', 'referral'
});

const userBalances = new promClient.Gauge({
    name: 'neurogrid_user_balances_neuro',
    help: 'Current NEURO token balances by user',
    labelNames: ['user_id']
});

// Register all metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestsTotal);
register.registerMetric(activeConnections);
register.registerMetric(websocketMessages);
register.registerMetric(tasksProcessed);
register.registerMetric(taskDuration);
register.registerMetric(activeModels);
register.registerMetric(systemMemoryUsage);
register.registerMetric(systemUptime);
register.registerMetric(errorRate);
register.registerMetric(neuroTokensDistributed);
register.registerMetric(userBalances);

// === Middleware Functions ===

// HTTP Request metrics middleware
const metricsMiddleware = (req, res, next) => {
    const start = process.hrtime.bigint();
    
    res.on('finish', () => {
        const end = process.hrtime.bigint();
        const duration = Number(end - start) / 1e9; // Convert to seconds
        
        const labels = {
            method: req.method,
            route: req.route?.path || req.path,
            status_code: res.statusCode
        };
        
        httpRequestDuration.labels(labels).observe(duration);
        httpRequestsTotal.labels(labels).inc();
    });
    
    next();
};

// === Helper Functions ===

// Record AI task metrics
const recordAITask = (model, taskType, duration, status) => {
    const labels = { model, task_type: taskType };
    
    taskDuration.labels(labels).observe(duration / 1000); // Convert ms to seconds
    tasksProcessed.labels({ ...labels, status }).inc();
    
    logger.debug('AI Task Metrics Recorded', {
        model,
        taskType,
        duration: `${duration}ms`,
        status
    });
};

// Update system metrics
const updateSystemMetrics = () => {
    const memUsage = process.memoryUsage();
    systemMemoryUsage.set(memUsage.heapUsed);
    systemUptime.set(process.uptime());
    
    // Update active models count
    // This would be populated by the actual model manager
    logger.debug('System Metrics Updated', {
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        uptime: `${Math.round(process.uptime())}s`
    });
};

// Record WebSocket metrics
const recordWebSocketEvent = (direction) => {
    websocketMessages.labels({ direction }).inc();
};

const setActiveConnections = (count) => {
    activeConnections.set(count);
};

// Record error metrics
const recordError = (errorType, component, error = null) => {
    errorRate.labels({ error_type: errorType, component }).inc();
    
    logger.error(`Error recorded in ${component}`, {
        errorType,
        component,
        message: error?.message,
        stack: error?.stack
    });
};

// Record NEURO token distribution
const recordTokenDistribution = (amount, rewardType) => {
    neuroTokensDistributed.labels({ reward_type: rewardType }).inc(amount);
    
    logger.info('NEURO Tokens Distributed', {
        amount,
        rewardType,
        timestamp: new Date().toISOString()
    });
};

// Start periodic system metrics updates
const startPeriodicMetrics = () => {
    setInterval(() => {
        updateSystemMetrics();
    }, 30000); // Update every 30 seconds
    
    logger.info('Periodic metrics collection started');
};

module.exports = {
    register,
    metricsMiddleware,
    recordAITask,
    updateSystemMetrics,
    recordWebSocketEvent,
    setActiveConnections,
    recordError,
    recordTokenDistribution,
    startPeriodicMetrics,
    
    // Direct access to specific metrics
    metrics: {
        httpRequestDuration,
        httpRequestsTotal,
        activeConnections,
        websocketMessages,
        tasksProcessed,
        taskDuration,
        activeModels,
        systemMemoryUsage,
        systemUptime,
        errorRate,
        neuroTokensDistributed,
        userBalances
    }
};