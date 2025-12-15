/**
 * Real-time Analytics & Monitoring Dashboard
 * Advanced analytics system with WebSocket real-time updates
 */

const EventEmitter = require('events');
const logger = require('../utils/logger');

class RealTimeAnalytics extends EventEmitter {
  constructor(wsManager, dbOptimizer, performanceOptimizer, config = {}) {
    super();
    
    this.wsManager = wsManager;
    this.dbOptimizer = dbOptimizer;
    this.performanceOptimizer = performanceOptimizer;
    
    this.config = {
      updateInterval: config.updateInterval || 5000, // 5 seconds
      retentionPeriod: config.retentionPeriod || 24 * 60 * 60 * 1000, // 24 hours
      alertThresholds: {
        responseTime: config.responseTimeThreshold || 2000, // 2 seconds
        memoryUsage: config.memoryThreshold || 80, // 80%
        cpuUsage: config.cpuThreshold || 85, // 85%
        errorRate: config.errorRateThreshold || 5, // 5%
        activeConnections: config.connectionThreshold || 40 // 40 connections
      },
      ...config
    };

    this.analytics = {
      realTimeMetrics: new Map(),
      historicalData: [],
      alerts: [],
      predictions: {},
      systemHealth: {
        status: 'healthy',
        lastCheck: null,
        issues: []
      }
    };

    this.subscribers = new Set();
    this.isRunning = false;

    this.init();
  }

  init() {
    this.startRealTimeMonitoring();
    this.setupPredictiveAnalytics();
    this.setupAlertSystem();
    
    logger.info('Real-time analytics system initialized', {
      updateInterval: this.config.updateInterval,
      alertThresholds: this.config.alertThresholds
    });
  }

  /**
   * Start real-time monitoring with WebSocket updates
   */
  startRealTimeMonitoring() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    
    this.updateInterval = setInterval(async () => {
      try {
        const metrics = await this.collectMetrics();
        this.processMetrics(metrics);
        this.broadcastUpdate(metrics);
        this.checkAlerts(metrics);
        this.updatePredictions(metrics);
      } catch (error) {
        logger.error('Real-time monitoring error', { error: error.message });
      }
    }, this.config.updateInterval);

    logger.info('Real-time monitoring started');
  }

  /**
   * Collect comprehensive system metrics
   */
  async collectMetrics() {
    const timestamp = Date.now();
    
    // Performance metrics
    const performanceMetrics = this.performanceOptimizer ? 
      this.performanceOptimizer.getMetrics() : {};

    // Database metrics
    const databaseMetrics = this.dbOptimizer ? 
      this.dbOptimizer.getMetrics() : {};

    // System metrics
    const systemMetrics = this.getSystemMetrics();
    
    // Network metrics
    const networkMetrics = await this.getNetworkMetrics();

    // Task metrics
    const taskMetrics = await this.getTaskMetrics();

    // Node metrics
    const nodeMetrics = await this.getNodeMetrics();

    return {
      timestamp,
      performance: performanceMetrics,
      database: databaseMetrics,
      system: systemMetrics,
      network: networkMetrics,
      tasks: taskMetrics,
      nodes: nodeMetrics,
      health: this.analytics.systemHealth
    };
  }

  /**
   * Get system-level metrics
   */
  getSystemMetrics() {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    return {
      memory: {
        used: memUsage.heapUsed,
        total: memUsage.heapTotal,
        rss: memUsage.rss,
        external: memUsage.external,
        usagePercent: (memUsage.heapUsed / memUsage.heapTotal * 100).toFixed(2)
      },
      cpu: {
        user: cpuUsage.user,
        system: cpuUsage.system,
        uptime: process.uptime()
      },
      process: {
        pid: process.pid,
        version: process.version,
        platform: process.platform
      }
    };
  }

  /**
   * Get network-related metrics
   */
  async getNetworkMetrics() {
    // WebSocket connections
    const wsConnections = this.wsManager ? this.wsManager.getConnectionCount() : 0;
    
    // Active HTTP connections (if available)
    const httpConnections = this.getHttpConnectionCount();

    return {
      websocket: {
        connections: wsConnections,
        subscribers: this.subscribers.size
      },
      http: {
        connections: httpConnections,
        activeRequests: this.performanceOptimizer ? 
          this.performanceOptimizer.metrics.requestCount : 0
      }
    };
  }

  /**
   * Get task execution metrics
   */
  async getTaskMetrics() {
    // This would connect to your task database/system
    // Mock implementation for now
    return {
      active: Math.floor(Math.random() * 20),
      completed: Math.floor(Math.random() * 1000),
      failed: Math.floor(Math.random() * 10),
      avgExecutionTime: Math.floor(Math.random() * 5000) + 1000,
      queue: {
        pending: Math.floor(Math.random() * 50),
        processing: Math.floor(Math.random() * 10)
      }
    };
  }

  /**
   * Get GPU node metrics
   */
  async getNodeMetrics() {
    // This would connect to your node management system
    // Mock implementation for now
    return {
      total: 45,
      online: Math.floor(Math.random() * 40) + 35,
      offline: Math.floor(Math.random() * 10),
      avgUtilization: (Math.random() * 40 + 30).toFixed(2), // 30-70%
      totalGpuMemory: 1250, // GB
      usedGpuMemory: Math.floor(Math.random() * 600) + 400 // 400-1000 GB
    };
  }

  /**
   * Get HTTP connection count
   */
  getHttpConnectionCount() {
    // This is a simplified way to estimate active connections
    // In production, you'd use server.getConnections() or similar
    return Math.floor(Math.random() * 50);
  }

  /**
   * Process and store metrics
   */
  processMetrics(metrics) {
    // Store real-time metrics
    this.analytics.realTimeMetrics.set(metrics.timestamp, metrics);

    // Add to historical data
    this.analytics.historicalData.push(metrics);

    // Cleanup old data
    this.cleanupOldData();

    // Update system health
    this.updateSystemHealth(metrics);
  }

  /**
   * Clean up old historical data
   */
  cleanupOldData() {
    const cutoff = Date.now() - this.config.retentionPeriod;
    
    // Clean real-time metrics
    for (const [timestamp] of this.analytics.realTimeMetrics) {
      if (timestamp < cutoff) {
        this.analytics.realTimeMetrics.delete(timestamp);
      }
    }

    // Clean historical data
    this.analytics.historicalData = this.analytics.historicalData.filter(
      data => data.timestamp > cutoff
    );

    // Clean old alerts
    this.analytics.alerts = this.analytics.alerts.filter(
      alert => alert.timestamp > cutoff
    );
  }

  /**
   * Update system health status
   */
  updateSystemHealth(metrics) {
    const issues = [];
    let status = 'healthy';

    // Check memory usage
    if (parseFloat(metrics.system.memory.usagePercent) > this.config.alertThresholds.memoryUsage) {
      issues.push({
        type: 'memory',
        severity: 'warning',
        message: `High memory usage: ${metrics.system.memory.usagePercent}%`
      });
      status = 'warning';
    }

    // Check database performance
    if (metrics.database && metrics.database.queries) {
      if (metrics.database.queries.averageTime > this.config.alertThresholds.responseTime) {
        issues.push({
          type: 'database',
          severity: 'warning',
          message: `Slow database queries: ${metrics.database.queries.averageTime}ms average`
        });
        status = 'warning';
      }
    }

    // Check node connectivity
    if (metrics.nodes && metrics.nodes.total > 0) {
      const onlinePercent = (metrics.nodes.online / metrics.nodes.total) * 100;
      if (onlinePercent < 70) { // Less than 70% nodes online
        issues.push({
          type: 'network',
          severity: 'error',
          message: `Low node availability: ${onlinePercent.toFixed(1)}%`
        });
        status = 'error';
      }
    }

    this.analytics.systemHealth = {
      status,
      lastCheck: Date.now(),
      issues
    };
  }

  /**
   * Check for alert conditions
   */
  checkAlerts(metrics) {
    const alerts = [];
    
    // Memory alert
    if (parseFloat(metrics.system.memory.usagePercent) > this.config.alertThresholds.memoryUsage) {
      alerts.push(this.createAlert('memory', 'High memory usage', metrics.system.memory));
    }

    // Database performance alert
    if (metrics.database && metrics.database.queries && 
        metrics.database.queries.averageTime > this.config.alertThresholds.responseTime) {
      alerts.push(this.createAlert('database', 'Slow database performance', metrics.database));
    }

    // Node availability alert
    if (metrics.nodes && metrics.nodes.total > 0) {
      const availability = (metrics.nodes.online / metrics.nodes.total) * 100;
      if (availability < 80) {
        alerts.push(this.createAlert('nodes', 'Low node availability', { availability }));
      }
    }

    // Add new alerts
    this.analytics.alerts.push(...alerts);

    // Broadcast critical alerts
    if (alerts.length > 0) {
      this.broadcastAlerts(alerts);
    }
  }

  /**
   * Create alert object
   */
  createAlert(type, message, data) {
    return {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      message,
      data,
      timestamp: Date.now(),
      severity: this.getAlertSeverity(type, data)
    };
  }

  /**
   * Get alert severity based on type and data
   */
  getAlertSeverity(type, data) {
    switch (type) {
      case 'memory':
        return parseFloat(data.usagePercent) > 90 ? 'critical' : 'warning';
      case 'database':
        return data.queries && data.queries.averageTime > 5000 ? 'critical' : 'warning';
      case 'nodes':
        return data.availability < 50 ? 'critical' : 'warning';
      default:
        return 'info';
    }
  }

  /**
   * Setup predictive analytics
   */
  setupPredictiveAnalytics() {
    // Run prediction analysis every minute
    setInterval(() => {
      this.runPredictiveAnalysis();
    }, 60000);
  }

  /**
   * Run predictive analysis on historical data
   */
  runPredictiveAnalysis() {
    if (this.analytics.historicalData.length < 10) return; // Need sufficient data

    try {
      const predictions = {};

      // Predict memory usage trend
      predictions.memory = this.predictTrend(
        this.analytics.historicalData.map(d => parseFloat(d.system.memory.usagePercent))
      );

      // Predict task load
      predictions.taskLoad = this.predictTrend(
        this.analytics.historicalData.map(d => d.tasks.active || 0)
      );

      // Predict node availability
      predictions.nodeAvailability = this.predictTrend(
        this.analytics.historicalData.map(d => d.nodes.online || 0)
      );

      this.analytics.predictions = {
        ...predictions,
        lastUpdated: Date.now()
      };

      logger.debug('Predictive analysis completed', predictions);

    } catch (error) {
      logger.error('Predictive analysis failed', { error: error.message });
    }
  }

  /**
   * Simple trend prediction using linear regression
   */
  predictTrend(values) {
    if (values.length < 5) return { trend: 'insufficient_data' };

    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const nextValue = slope * n + intercept;
    const trendDirection = slope > 0.1 ? 'increasing' : slope < -0.1 ? 'decreasing' : 'stable';

    return {
      trend: trendDirection,
      nextPredicted: nextValue,
      slope,
      confidence: this.calculateConfidence(values, slope, intercept)
    };
  }

  /**
   * Calculate prediction confidence
   */
  calculateConfidence(values, slope, intercept) {
    const predicted = values.map((_, i) => slope * i + intercept);
    const errors = values.map((actual, i) => Math.abs(actual - predicted[i]));
    const avgError = errors.reduce((a, b) => a + b, 0) / errors.length;
    const maxValue = Math.max(...values);
    
    return Math.max(0, 100 - (avgError / maxValue * 100));
  }

  /**
   * Setup alert system
   */
  setupAlertSystem() {
    this.on('alert', (alert) => {
      logger.warn('System alert triggered', alert);
      
      // Here you could integrate with external alert systems
      // like Slack, PagerDuty, email notifications, etc.
    });
  }

  /**
   * Update predictions periodically
   */
  updatePredictions(metrics) {
    // Store for trend analysis
    this.emit('metrics', metrics);
  }

  /**
   * Broadcast real-time updates to WebSocket clients
   */
  broadcastUpdate(metrics) {
    if (!this.wsManager) return;

    const update = {
      type: 'analytics_update',
      timestamp: Date.now(),
      data: {
        realTime: metrics,
        predictions: this.analytics.predictions,
        alerts: this.analytics.alerts.slice(-5), // Last 5 alerts
        health: this.analytics.systemHealth
      }
    };

    // Broadcast to all analytics subscribers
    this.subscribers.forEach(clientId => {
      this.wsManager.sendToClient(clientId, update);
    });
  }

  /**
   * Broadcast alerts to subscribed clients
   */
  broadcastAlerts(alerts) {
    if (!this.wsManager) return;

    const alertUpdate = {
      type: 'system_alerts',
      timestamp: Date.now(),
      alerts: alerts
    };

    this.subscribers.forEach(clientId => {
      this.wsManager.sendToClient(clientId, alertUpdate);
    });

    // Emit for other systems
    alerts.forEach(alert => this.emit('alert', alert));
  }

  /**
   * Subscribe client to real-time updates
   */
  subscribeClient(clientId) {
    this.subscribers.add(clientId);
    
    // Send current state to new subscriber
    const currentState = {
      type: 'analytics_initial_state',
      timestamp: Date.now(),
      data: {
        metrics: Array.from(this.analytics.realTimeMetrics.values()).slice(-10),
        predictions: this.analytics.predictions,
        alerts: this.analytics.alerts.slice(-10),
        health: this.analytics.systemHealth
      }
    };

    if (this.wsManager) {
      this.wsManager.sendToClient(clientId, currentState);
    }

    logger.info('Client subscribed to analytics', { clientId });
  }

  /**
   * Unsubscribe client from updates
   */
  unsubscribeClient(clientId) {
    this.subscribers.delete(clientId);
    logger.info('Client unsubscribed from analytics', { clientId });
  }

  /**
   * Get analytics dashboard data
   */
  getDashboardData() {
    return {
      realTimeMetrics: Array.from(this.analytics.realTimeMetrics.values()).slice(-50),
      historicalSummary: this.getHistoricalSummary(),
      predictions: this.analytics.predictions,
      alerts: this.analytics.alerts.slice(-20),
      systemHealth: this.analytics.systemHealth,
      subscribers: this.subscribers.size
    };
  }

  /**
   * Get historical data summary
   */
  getHistoricalSummary() {
    if (this.analytics.historicalData.length === 0) return null;

    const recent = this.analytics.historicalData.slice(-100);
    
    return {
      memoryUsage: {
        avg: this.average(recent.map(d => parseFloat(d.system.memory.usagePercent))),
        max: Math.max(...recent.map(d => parseFloat(d.system.memory.usagePercent))),
        min: Math.min(...recent.map(d => parseFloat(d.system.memory.usagePercent)))
      },
      responseTime: this.dbOptimizer ? {
        avg: this.average(recent.map(d => d.database?.queries?.averageTime || 0)),
        max: Math.max(...recent.map(d => d.database?.queries?.averageTime || 0))
      } : null,
      nodeAvailability: {
        avg: this.average(recent.map(d => d.nodes.online || 0)),
        min: Math.min(...recent.map(d => d.nodes.online || 0))
      }
    };
  }

  /**
   * Calculate average of array
   */
  average(arr) {
    return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  }

  /**
   * Stop real-time monitoring
   */
  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
    
    this.isRunning = false;
    this.subscribers.clear();
    
    logger.info('Real-time analytics stopped');
  }
}

module.exports = RealTimeAnalytics;