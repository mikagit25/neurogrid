/**
 * Metrics Collector - Comprehensive system and application metrics collection
 * Collects performance data, resource usage, and custom application metrics
 */

const os = require('os');
const process = require('process');
const { EventEmitter } = require('events');
const fs = require('fs').promises;

class MetricsCollector extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            collectInterval: options.collectInterval || 30000, // 30 seconds
            retentionPeriod: options.retentionPeriod || 7 * 24 * 60 * 60 * 1000, // 7 days
            enableSystemMetrics: options.enableSystemMetrics !== false,
            enableApplicationMetrics: options.enableApplicationMetrics !== false,
            enableCustomMetrics: options.enableCustomMetrics !== false,
            maxDataPoints: options.maxDataPoints || 10000,
            enableRealTime: options.enableRealTime !== false
        };
        
        // Metrics storage
        this.metrics = {
            system: new Map(),
            application: new Map(),
            custom: new Map(),
            events: new Map()
        };
        
        // Time series data
        this.timeSeries = {
            system: [],
            application: [],
            custom: []
        };
        
        // Performance counters
        this.counters = {
            requests: new Map(),
            errors: new Map(),
            latency: new Map(),
            throughput: new Map()
        };
        
        // Statistics
        this.stats = {
            totalDataPoints: 0,
            collectionsCount: 0,
            startTime: new Date(),
            lastCollection: null
        };
        
        // Start collection if enabled
        if (this.config.collectInterval > 0) {
            this.startCollection();
        }
    }

    startCollection() {
        this.collectionTimer = setInterval(() => {
            this.collectMetrics();
        }, this.config.collectInterval);
        
        console.log(`Metrics collection started with ${this.config.collectInterval}ms interval`);
        this.emit('collectionStarted');
    }

    stopCollection() {
        if (this.collectionTimer) {
            clearInterval(this.collectionTimer);
            this.collectionTimer = null;
        }
        
        console.log('Metrics collection stopped');
        this.emit('collectionStopped');
    }

    async collectMetrics() {
        try {
            const timestamp = new Date();
            const metrics = {};
            
            // Collect system metrics
            if (this.config.enableSystemMetrics) {
                metrics.system = await this.collectSystemMetrics();
            }
            
            // Collect application metrics
            if (this.config.enableApplicationMetrics) {
                metrics.application = await this.collectApplicationMetrics();
            }
            
            // Collect custom metrics
            if (this.config.enableCustomMetrics) {
                metrics.custom = await this.collectCustomMetrics();
            }
            
            // Store metrics
            this.storeMetrics(timestamp, metrics);
            
            // Update statistics
            this.stats.collectionsCount++;
            this.stats.lastCollection = timestamp;
            
            // Emit real-time metrics if enabled
            if (this.config.enableRealTime) {
                this.emit('metricsCollected', { timestamp, metrics });
            }
            
            // Cleanup old data
            this.cleanupOldData();
            
        } catch (error) {
            console.error('Metrics collection error:', error);
            this.emit('collectionError', { error: error.message });
        }
    }

    async collectSystemMetrics() {
        const metrics = {
            timestamp: new Date(),
            cpu: {
                usage: await this.getCPUUsage(),
                loadAverage: os.loadavg(),
                cores: os.cpus().length
            },
            memory: {
                total: os.totalmem(),
                free: os.freemem(),
                used: os.totalmem() - os.freemem(),
                usage: ((os.totalmem() - os.freemem()) / os.totalmem()) * 100,
                process: process.memoryUsage()
            },
            disk: await this.getDiskUsage(),
            network: await this.getNetworkStats(),
            uptime: {
                system: os.uptime(),
                process: process.uptime()
            },
            platform: {
                type: os.type(),
                platform: os.platform(),
                arch: os.arch(),
                release: os.release(),
                hostname: os.hostname()
            }
        };
        
        return metrics;
    }

    async collectApplicationMetrics() {
        const metrics = {
            timestamp: new Date(),
            process: {
                pid: process.pid,
                title: process.title,
                version: process.version,
                versions: process.versions,
                memoryUsage: process.memoryUsage(),
                cpuUsage: process.cpuUsage(),
                resourceUsage: process.resourceUsage ? process.resourceUsage() : null
            },
            eventLoop: await this.getEventLoopMetrics(),
            gc: this.getGCMetrics(),
            handles: {
                active: process._getActiveHandles().length,
                requests: process._getActiveRequests().length
            },
            performance: this.getPerformanceMetrics()
        };
        
        return metrics;
    }

    async collectCustomMetrics() {
        const metrics = {
            timestamp: new Date(),
            counters: this.getCounterMetrics(),
            gauges: this.getGaugeMetrics(),
            histograms: this.getHistogramMetrics(),
            business: this.getBusinessMetrics()
        };
        
        return metrics;
    }

    async getCPUUsage() {
        return new Promise((resolve) => {
            const startUsage = process.cpuUsage();
            const startTime = process.hrtime();
            
            setTimeout(() => {
                const endUsage = process.cpuUsage(startUsage);
                const endTime = process.hrtime(startTime);
                
                const totalTime = endTime[0] * 1e6 + endTime[1] / 1e3; // microseconds
                const userPercent = (endUsage.user / totalTime) * 100;
                const systemPercent = (endUsage.system / totalTime) * 100;
                
                resolve({
                    user: userPercent,
                    system: systemPercent,
                    total: userPercent + systemPercent
                });
            }, 100);
        });
    }

    async getDiskUsage() {
        try {
            const stats = await fs.stat('.');
            return {
                available: true,
                // Basic disk info - would need platform-specific implementations for detailed stats
                timestamp: new Date()
            };
        } catch (error) {
            return {
                available: false,
                error: error.message
            };
        }
    }

    async getNetworkStats() {
        const interfaces = os.networkInterfaces();
        const stats = {};
        
        for (const [name, addresses] of Object.entries(interfaces)) {
            stats[name] = {
                addresses: addresses.map(addr => ({
                    address: addr.address,
                    family: addr.family,
                    internal: addr.internal
                }))
            };
        }
        
        return stats;
    }

    async getEventLoopMetrics() {
        if (process.versions.node.split('.')[0] >= '10') {
            const { performance } = require('perf_hooks');
            
            return new Promise((resolve) => {
                const start = performance.now();
                setImmediate(() => {
                    const lag = performance.now() - start;
                    resolve({
                        lag: lag,
                        utilization: Math.min(lag / 10, 1) // Normalize to 0-1
                    });
                });
            });
        }
        
        return { available: false };
    }

    getGCMetrics() {
        if (global.gc && typeof global.gc.getHeapStatistics === 'function') {
            return global.gc.getHeapStatistics();
        }
        
        return { available: false };
    }

    getPerformanceMetrics() {
        const metrics = {
            requests: {
                total: 0,
                perSecond: 0,
                errors: 0,
                errorRate: 0
            },
            responseTime: {
                average: 0,
                p50: 0,
                p95: 0,
                p99: 0
            },
            throughput: {
                requestsPerSecond: 0,
                bytesPerSecond: 0
            }
        };
        
        // Calculate from counters
        for (const [endpoint, count] of this.counters.requests.entries()) {
            metrics.requests.total += count;
        }
        
        for (const [endpoint, count] of this.counters.errors.entries()) {
            metrics.requests.errors += count;
        }
        
        if (metrics.requests.total > 0) {
            metrics.requests.errorRate = (metrics.requests.errors / metrics.requests.total) * 100;
        }
        
        return metrics;
    }

    getCounterMetrics() {
        const counters = {};
        
        for (const [key, value] of this.counters.requests.entries()) {
            counters[`requests_${key}`] = value;
        }
        
        for (const [key, value] of this.counters.errors.entries()) {
            counters[`errors_${key}`] = value;
        }
        
        return counters;
    }

    getGaugeMetrics() {
        const gauges = {};
        
        for (const [key, value] of this.metrics.custom.entries()) {
            if (typeof value === 'number') {
                gauges[key] = value;
            }
        }
        
        return gauges;
    }

    getHistogramMetrics() {
        const histograms = {};
        
        for (const [key, values] of this.counters.latency.entries()) {
            if (Array.isArray(values) && values.length > 0) {
                const sorted = values.sort((a, b) => a - b);
                histograms[key] = {
                    count: values.length,
                    min: Math.min(...values),
                    max: Math.max(...values),
                    avg: values.reduce((a, b) => a + b, 0) / values.length,
                    p50: this.percentile(sorted, 50),
                    p95: this.percentile(sorted, 95),
                    p99: this.percentile(sorted, 99)
                };
            }
        }
        
        return histograms;
    }

    getBusinessMetrics() {
        // Placeholder for business-specific metrics
        return {
            tasks: {
                total: 0,
                completed: 0,
                failed: 0,
                pending: 0
            },
            nodes: {
                total: 0,
                active: 0,
                inactive: 0
            },
            users: {
                total: 0,
                active: 0,
                sessions: 0
            }
        };
    }

    storeMetrics(timestamp, metrics) {
        // Store in time series
        if (metrics.system) {
            this.timeSeries.system.push({ timestamp, data: metrics.system });
        }
        
        if (metrics.application) {
            this.timeSeries.application.push({ timestamp, data: metrics.application });
        }
        
        if (metrics.custom) {
            this.timeSeries.custom.push({ timestamp, data: metrics.custom });
        }
        
        // Update current metrics
        if (metrics.system) {
            this.metrics.system.set('current', metrics.system);
        }
        
        if (metrics.application) {
            this.metrics.application.set('current', metrics.application);
        }
        
        if (metrics.custom) {
            this.metrics.custom.set('current', metrics.custom);
        }
        
        this.stats.totalDataPoints++;
        
        // Limit data points
        this.limitDataPoints();
    }

    limitDataPoints() {
        const maxPoints = this.config.maxDataPoints;
        
        if (this.timeSeries.system.length > maxPoints) {
            this.timeSeries.system = this.timeSeries.system.slice(-maxPoints);
        }
        
        if (this.timeSeries.application.length > maxPoints) {
            this.timeSeries.application = this.timeSeries.application.slice(-maxPoints);
        }
        
        if (this.timeSeries.custom.length > maxPoints) {
            this.timeSeries.custom = this.timeSeries.custom.slice(-maxPoints);
        }
    }

    cleanupOldData() {
        const cutoff = new Date(Date.now() - this.config.retentionPeriod);
        
        this.timeSeries.system = this.timeSeries.system.filter(point => point.timestamp > cutoff);
        this.timeSeries.application = this.timeSeries.application.filter(point => point.timestamp > cutoff);
        this.timeSeries.custom = this.timeSeries.custom.filter(point => point.timestamp > cutoff);
    }

    // Public API methods
    incrementCounter(name, value = 1) {
        const current = this.counters.requests.get(name) || 0;
        this.counters.requests.set(name, current + value);
    }

    recordLatency(name, latency) {
        if (!this.counters.latency.has(name)) {
            this.counters.latency.set(name, []);
        }
        
        const values = this.counters.latency.get(name);
        values.push(latency);
        
        // Limit latency samples
        if (values.length > 1000) {
            this.counters.latency.set(name, values.slice(-1000));
        }
    }

    setGauge(name, value) {
        this.metrics.custom.set(name, value);
    }

    recordEvent(name, data = {}) {
        const timestamp = new Date();
        if (!this.metrics.events.has(name)) {
            this.metrics.events.set(name, []);
        }
        
        const events = this.metrics.events.get(name);
        events.push({ timestamp, data });
        
        // Limit events
        if (events.length > 1000) {
            this.metrics.events.set(name, events.slice(-1000));
        }
    }

    getMetrics(type = 'all', timeRange = null) {
        const result = {};
        
        if (type === 'all' || type === 'current') {
            result.current = {
                system: this.metrics.system.get('current'),
                application: this.metrics.application.get('current'),
                custom: this.metrics.custom.get('current')
            };
        }
        
        if (type === 'all' || type === 'timeseries') {
            let timeSeries = this.timeSeries;
            
            if (timeRange) {
                const { start, end } = timeRange;
                timeSeries = {
                    system: this.timeSeries.system.filter(p => p.timestamp >= start && p.timestamp <= end),
                    application: this.timeSeries.application.filter(p => p.timestamp >= start && p.timestamp <= end),
                    custom: this.timeSeries.custom.filter(p => p.timestamp >= start && p.timestamp <= end)
                };
            }
            
            result.timeSeries = timeSeries;
        }
        
        if (type === 'all' || type === 'stats') {
            result.stats = this.getStats();
        }
        
        return result;
    }

    getTimeSeriesData(metric, duration = '1h') {
        const durationMs = this.parseDuration(duration);
        const cutoff = new Date(Date.now() - durationMs);
        
        const data = this.timeSeries[metric] || [];
        return data.filter(point => point.timestamp > cutoff);
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

    percentile(sortedArray, p) {
        if (sortedArray.length === 0) return 0;
        
        const index = (p / 100) * (sortedArray.length - 1);
        const lower = Math.floor(index);
        const upper = Math.ceil(index);
        
        if (lower === upper) {
            return sortedArray[lower];
        }
        
        const weight = index - lower;
        return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
    }

    getStats() {
        return {
            ...this.stats,
            dataPoints: {
                system: this.timeSeries.system.length,
                application: this.timeSeries.application.length,
                custom: this.timeSeries.custom.length,
                total: this.stats.totalDataPoints
            },
            uptime: Date.now() - this.stats.startTime.getTime(),
            counters: {
                requests: this.counters.requests.size,
                errors: this.counters.errors.size,
                latency: this.counters.latency.size
            },
            events: this.metrics.events.size
        };
    }

    async shutdown() {
        this.stopCollection();
        this.removeAllListeners();
    }
}

// Singleton instance
let metricsCollectorInstance = null;

class MetricsCollectorSingleton {
    static getInstance(options = {}) {
        if (!metricsCollectorInstance) {
            metricsCollectorInstance = new MetricsCollector(options);
        }
        return metricsCollectorInstance;
    }
}

module.exports = { MetricsCollector, MetricsCollectorSingleton };