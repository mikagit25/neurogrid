/**
 * Dashboard Controller - Real-time monitoring dashboard management
 * Handles WebSocket connections for live monitoring data
 */

const { EventEmitter } = require('events');
const WebSocket = require('ws');
const { MetricsCollectorSingleton } = require('./MetricsCollector');
const { PerformanceMonitorSingleton } = require('./PerformanceMonitor');
const { SystemAnalyticsSingleton } = require('./SystemAnalytics');
const { AlertingSystemSingleton } = require('./AlertingSystem');

class DashboardController extends EventEmitter {
    constructor(options = {}) {
        super();
        
        this.config = {
            updateInterval: options.updateInterval || 5000, // 5 seconds
            enableRealTime: options.enableRealTime !== false,
            maxConnections: options.maxConnections || 100,
            enableAuthentication: options.enableAuthentication !== false
        };
        
        // Initialize monitoring services
        this.metricsCollector = MetricsCollectorSingleton.getInstance();
        this.performanceMonitor = PerformanceMonitorSingleton.getInstance();
        this.systemAnalytics = SystemAnalyticsSingleton.getInstance();
        this.alertingSystem = AlertingSystemSingleton.getInstance();
        
        // WebSocket connections
        this.connections = new Map();
        this.connectionStats = {
            total: 0,
            active: 0,
            maxConcurrent: 0
        };
        
        // Dashboard data cache
        this.dashboardCache = {
            lastUpdate: null,
            data: null
        };
        
        // Update timers
        this.updateTimer = null;
        
        this.setupEventListeners();
        this.startRealTimeUpdates();
    }

    setupEventListeners() {
        // Listen to monitoring events for real-time updates
        this.performanceMonitor.on('alert', (alert) => {
            this.broadcastAlert(alert);
        });
        
        this.alertingSystem.on('alertTriggered', (alert) => {
            this.broadcastAlert(alert);
        });
        
        this.metricsCollector.on('metricsCollected', (data) => {
            this.broadcastMetricsUpdate(data);
        });
        
        this.systemAnalytics.on('analysisComplete', (analysis) => {
            this.broadcastAnalyticsUpdate(analysis);
        });
    }

    startRealTimeUpdates() {
        if (!this.config.enableRealTime) return;
        
        this.updateTimer = setInterval(() => {
            this.updateDashboardData();
        }, this.config.updateInterval);
        
        console.log('Dashboard real-time updates started');
    }

    stopRealTimeUpdates() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
        
        console.log('Dashboard real-time updates stopped');
    }

    async updateDashboardData() {
        try {
            const dashboardData = await this.generateDashboardData();
            
            this.dashboardCache = {
                lastUpdate: new Date(),
                data: dashboardData
            };
            
            // Broadcast to all connected clients
            this.broadcast('dashboard_update', dashboardData);
            
        } catch (error) {
            console.error('Dashboard update error:', error);
        }
    }

    async generateDashboardData() {
        const [currentMetrics, performanceStats, analytics, alertStats] = await Promise.all([
            this.metricsCollector.getMetrics('current'),
            this.performanceMonitor.getPerformanceStats(),
            this.systemAnalytics.getAnalyticsData(),
            this.alertingSystem.getAlertStats()
        ]);
        
        const activeAlerts = this.alertingSystem.getAlerts('active', 10);
        
        return {
            timestamp: new Date(),
            system: {
                uptime: process.uptime(),
                memory: {
                    usage: currentMetrics.current?.system?.memory?.usage || 0,
                    total: currentMetrics.current?.system?.memory?.total || 0,
                    free: currentMetrics.current?.system?.memory?.free || 0
                },
                cpu: {
                    usage: currentMetrics.current?.system?.cpu?.usage?.total || 0,
                    cores: currentMetrics.current?.system?.cpu?.cores || 0
                },
                loadAverage: currentMetrics.current?.system?.cpu?.loadAverage || []
            },
            performance: {
                responseTime: {
                    current: performanceStats.health?.responseTime?.current || 0,
                    average: performanceStats.health?.responseTime?.average || 0
                },
                errorRate: performanceStats.health?.errorRate || 0,
                throughput: performanceStats.health?.throughput || 0,
                activeRequests: performanceStats.activeRequests || 0,
                requests: {
                    total: performanceStats.requests?.total || 0,
                    success: performanceStats.requests?.success || 0,
                    errors: performanceStats.requests?.errors || 0
                }
            },
            alerts: {
                total: alertStats.totalAlerts || 0,
                active: alertStats.activeAlerts || 0,
                critical: activeAlerts.filter(a => a.severity === 'critical').length,
                warning: activeAlerts.filter(a => a.severity === 'warning').length,
                recent: activeAlerts.slice(0, 5)
            },
            analytics: {
                trends: analytics.trends || {},
                anomalies: analytics.anomalies?.slice(0, 3) || [],
                recommendations: analytics.recommendations?.slice(0, 3) || [],
                insights: analytics.insights?.slice(0, 2) || []
            },
            connections: {
                dashboard: this.connectionStats.active,
                maxConcurrent: this.connectionStats.maxConcurrent
            }
        };
    }

    // WebSocket management
    handleConnection(ws, req) {
        const connectionId = this.generateConnectionId();
        const connection = {
            id: connectionId,
            ws,
            connectedAt: new Date(),
            lastActivity: new Date(),
            authenticated: false,
            user: null,
            subscriptions: new Set(['dashboard']) // Default subscription
        };
        
        // Check connection limit
        if (this.connections.size >= this.config.maxConnections) {
            ws.close(1008, 'Connection limit exceeded');
            return;
        }
        
        this.connections.set(connectionId, connection);
        this.updateConnectionStats();
        
        // Setup connection handlers
        ws.on('message', (message) => {
            this.handleMessage(connectionId, message);
        });
        
        ws.on('close', () => {
            this.handleDisconnection(connectionId);
        });
        
        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
            this.handleDisconnection(connectionId);
        });
        
        // Send initial data
        this.sendToConnection(connectionId, 'connected', {
            connectionId,
            timestamp: new Date(),
            dashboardData: this.dashboardCache.data
        });
        
        console.log(`Dashboard connection established: ${connectionId}`);
        this.emit('connectionEstablished', { connectionId, connection });
    }

    handleMessage(connectionId, message) {
        try {
            const connection = this.connections.get(connectionId);
            if (!connection) return;
            
            connection.lastActivity = new Date();
            
            const data = JSON.parse(message);
            
            switch (data.type) {
                case 'authenticate':
                    this.handleAuthentication(connectionId, data.payload);
                    break;
                    
                case 'subscribe':
                    this.handleSubscription(connectionId, data.payload);
                    break;
                    
                case 'unsubscribe':
                    this.handleUnsubscription(connectionId, data.payload);
                    break;
                    
                case 'ping':
                    this.sendToConnection(connectionId, 'pong', { timestamp: new Date() });
                    break;
                    
                case 'request_data':
                    this.handleDataRequest(connectionId, data.payload);
                    break;
                    
                default:
                    console.warn('Unknown message type:', data.type);
            }
            
        } catch (error) {
            console.error('Message handling error:', error);
            this.sendToConnection(connectionId, 'error', {
                message: 'Invalid message format'
            });
        }
    }

    handleAuthentication(connectionId, payload) {
        const connection = this.connections.get(connectionId);
        if (!connection) return;
        
        // In production, validate JWT token here
        // For now, we'll accept any token
        if (payload.token) {
            connection.authenticated = true;
            connection.user = payload.user || { id: 'unknown' };
            
            this.sendToConnection(connectionId, 'authenticated', {
                success: true,
                user: connection.user
            });
        } else {
            this.sendToConnection(connectionId, 'authentication_failed', {
                success: false,
                error: 'Invalid token'
            });
        }
    }

    handleSubscription(connectionId, payload) {
        const connection = this.connections.get(connectionId);
        if (!connection) return;
        
        const { channels } = payload;
        
        if (Array.isArray(channels)) {
            channels.forEach(channel => {
                if (this.isValidChannel(channel)) {
                    connection.subscriptions.add(channel);
                }
            });
        }
        
        this.sendToConnection(connectionId, 'subscribed', {
            channels: Array.from(connection.subscriptions)
        });
    }

    handleUnsubscription(connectionId, payload) {
        const connection = this.connections.get(connectionId);
        if (!connection) return;
        
        const { channels } = payload;
        
        if (Array.isArray(channels)) {
            channels.forEach(channel => {
                connection.subscriptions.delete(channel);
            });
        }
        
        this.sendToConnection(connectionId, 'unsubscribed', {
            channels: Array.from(connection.subscriptions)
        });
    }

    async handleDataRequest(connectionId, payload) {
        const connection = this.connections.get(connectionId);
        if (!connection) return;
        
        const { dataType, params = {} } = payload;
        
        try {
            let data = null;
            
            switch (dataType) {
                case 'dashboard':
                    data = await this.generateDashboardData();
                    break;
                    
                case 'metrics':
                    data = this.metricsCollector.getMetrics(params.type, params.timeRange);
                    break;
                    
                case 'performance':
                    data = this.performanceMonitor.getPerformanceStats();
                    break;
                    
                case 'analytics':
                    data = this.systemAnalytics.getAnalyticsData();
                    break;
                    
                case 'alerts':
                    data = this.alertingSystem.getAlerts(params.status, params.limit);
                    break;
                    
                default:
                    throw new Error('Unknown data type');
            }
            
            this.sendToConnection(connectionId, 'data_response', {
                dataType,
                data,
                timestamp: new Date()
            });
            
        } catch (error) {
            this.sendToConnection(connectionId, 'data_error', {
                dataType,
                error: error.message
            });
        }
    }

    handleDisconnection(connectionId) {
        const connection = this.connections.get(connectionId);
        if (connection) {
            this.connections.delete(connectionId);
            this.updateConnectionStats();
            
            console.log(`Dashboard connection closed: ${connectionId}`);
            this.emit('connectionClosed', { connectionId, connection });
        }
    }

    // Broadcasting methods
    broadcast(type, data, channel = 'dashboard') {
        const message = JSON.stringify({
            type,
            data,
            timestamp: new Date(),
            channel
        });
        
        for (const [connectionId, connection] of this.connections.entries()) {
            if (connection.subscriptions.has(channel) && connection.ws.readyState === WebSocket.OPEN) {
                try {
                    connection.ws.send(message);
                } catch (error) {
                    console.error('Broadcast error:', error);
                    this.handleDisconnection(connectionId);
                }
            }
        }
    }

    sendToConnection(connectionId, type, data) {
        const connection = this.connections.get(connectionId);
        if (connection && connection.ws.readyState === WebSocket.OPEN) {
            try {
                const message = JSON.stringify({
                    type,
                    data,
                    timestamp: new Date()
                });
                
                connection.ws.send(message);
                return true;
            } catch (error) {
                console.error('Send error:', error);
                this.handleDisconnection(connectionId);
                return false;
            }
        }
        
        return false;
    }

    broadcastAlert(alert) {
        this.broadcast('alert', alert, 'alerts');
        this.broadcast('alert', alert, 'dashboard'); // Also send to main dashboard
    }

    broadcastMetricsUpdate(metrics) {
        this.broadcast('metrics_update', metrics, 'metrics');
    }

    broadcastAnalyticsUpdate(analysis) {
        this.broadcast('analytics_update', analysis, 'analytics');
    }

    // Utility methods
    generateConnectionId() {
        return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    isValidChannel(channel) {
        const validChannels = ['dashboard', 'metrics', 'performance', 'analytics', 'alerts'];
        return validChannels.includes(channel);
    }

    updateConnectionStats() {
        this.connectionStats.active = this.connections.size;
        this.connectionStats.total++;
        
        if (this.connectionStats.active > this.connectionStats.maxConcurrent) {
            this.connectionStats.maxConcurrent = this.connectionStats.active;
        }
    }

    // API methods
    getConnectionStats() {
        return {
            ...this.connectionStats,
            connections: Array.from(this.connections.values()).map(conn => ({
                id: conn.id,
                connectedAt: conn.connectedAt,
                lastActivity: conn.lastActivity,
                authenticated: conn.authenticated,
                subscriptions: Array.from(conn.subscriptions)
            }))
        };
    }

    getDashboardData() {
        return this.dashboardCache.data;
    }

    async shutdown() {
        this.stopRealTimeUpdates();
        
        // Close all WebSocket connections
        for (const [connectionId, connection] of this.connections.entries()) {
            if (connection.ws.readyState === WebSocket.OPEN) {
                connection.ws.close(1001, 'Server shutdown');
            }
        }
        
        this.connections.clear();
        this.removeAllListeners();
    }
}

// Singleton instance
let dashboardControllerInstance = null;

class DashboardControllerSingleton {
    static getInstance(options = {}) {
        if (!dashboardControllerInstance) {
            dashboardControllerInstance = new DashboardController(options);
        }
        return dashboardControllerInstance;
    }
}

module.exports = { DashboardController, DashboardControllerSingleton };