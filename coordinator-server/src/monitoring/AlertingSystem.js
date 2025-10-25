/**
 * Alerting System - Real-time alert management and notification system
 * Handles alert generation, escalation, and multi-channel notifications
 */

const { EventEmitter } = require('events');
const { MetricsCollectorSingleton } = require('./MetricsCollector');
const { PerformanceMonitorSingleton } = require('./PerformanceMonitor');
const { SystemAnalyticsSingleton } = require('./SystemAnalytics');

class AlertingSystem extends EventEmitter {
  constructor(options = {}) {
    super();

    this.config = {
      enableEmailAlerts: options.enableEmailAlerts || false,
      enableSlackAlerts: options.enableSlackAlerts || false,
      enableWebhookAlerts: options.enableWebhookAlerts || false,
      enableSmsAlerts: options.enableSmsAlerts || false,
      alertCooldown: options.alertCooldown || 5 * 60 * 1000, // 5 minutes
      escalationTimeout: options.escalationTimeout || 30 * 60 * 1000, // 30 minutes
      maxAlertsPerHour: options.maxAlertsPerHour || 20,
      enableAlertGrouping: options.enableAlertGrouping !== false,
      enableAlertSuppression: options.enableAlertSuppression !== false
    };

    // Initialize monitoring services
    this.metricsCollector = MetricsCollectorSingleton.getInstance();
    this.performanceMonitor = PerformanceMonitorSingleton.getInstance();
    this.systemAnalytics = SystemAnalyticsSingleton.getInstance();

    // Alert management
    this.alerts = new Map();
    this.alertHistory = [];
    this.suppressedAlerts = new Set();
    this.alertGroups = new Map();
    this.escalatedAlerts = new Map();

    // Alert rules
    this.alertRules = new Map();
    this.setupDefaultRules();

    // Notification channels
    this.notificationChannels = new Map();
    this.setupNotificationChannels();

    // Statistics
    this.stats = {
      totalAlerts: 0,
      activeAlerts: 0,
      suppressedAlerts: 0,
      escalatedAlerts: 0,
      alertsThisHour: 0,
      lastReset: new Date()
    };

    // Rate limiting
    this.hourlyAlertCount = 0;
    this.alertRateResetTimer = null;

    this.startAlerting();
  }

  startAlerting() {
    // Listen to monitoring events
    this.performanceMonitor.on('alert', (alert) => {
      this.processAlert('performance', alert);
    });

    this.systemAnalytics.on('analysisComplete', (analysis) => {
      this.checkAnalyticsAlerts(analysis);
    });

    this.metricsCollector.on('metricsCollected', (data) => {
      this.checkMetricsAlerts(data);
    });

    // Start alert rate limiter reset timer
    this.alertRateResetTimer = setInterval(() => {
      this.hourlyAlertCount = 0;
      this.stats.alertsThisHour = 0;
      this.stats.lastReset = new Date();
    }, 60 * 60 * 1000); // Every hour

    // Check for alert escalations
    this.escalationTimer = setInterval(() => {
      this.checkEscalations();
    }, 5 * 60 * 1000); // Every 5 minutes

    console.log('Alerting system started');
    this.emit('alertingStarted');
  }

  stopAlerting() {
    if (this.alertRateResetTimer) {
      clearInterval(this.alertRateResetTimer);
    }

    if (this.escalationTimer) {
      clearInterval(this.escalationTimer);
    }

    console.log('Alerting system stopped');
    this.emit('alertingStopped');
  }

  setupDefaultRules() {
    // Performance alerts
    this.addAlertRule('high_response_time', {
      condition: (data) => data.health && data.health.responseTime && data.health.responseTime.average > 2000,
      severity: 'warning',
      message: 'Average response time is above 2 seconds',
      cooldown: 10 * 60 * 1000 // 10 minutes
    });

    this.addAlertRule('high_error_rate', {
      condition: (data) => data.health && data.health.errorRate > 10,
      severity: 'critical',
      message: 'Error rate is above 10%',
      cooldown: 5 * 60 * 1000 // 5 minutes
    });

    this.addAlertRule('high_memory_usage', {
      condition: (data) => data.health && data.health.memoryUsage > 90,
      severity: 'critical',
      message: 'Memory usage is above 90%',
      cooldown: 15 * 60 * 1000 // 15 minutes
    });

    this.addAlertRule('high_cpu_usage', {
      condition: (data) => data.health && data.health.cpuUsage > 85,
      severity: 'warning',
      message: 'CPU usage is above 85%',
      cooldown: 10 * 60 * 1000 // 10 minutes
    });

    this.addAlertRule('low_throughput', {
      condition: (data) => data.health && data.health.throughput < 1,
      severity: 'warning',
      message: 'System throughput is below 1 req/s',
      cooldown: 15 * 60 * 1000 // 15 minutes
    });

    // System metrics alerts
    this.addAlertRule('disk_space_low', {
      condition: (data) => data.metrics && data.metrics.system &&
                      data.metrics.system.disk && data.metrics.system.disk.usage > 85,
      severity: 'warning',
      message: 'Disk space usage is above 85%',
      cooldown: 30 * 60 * 1000 // 30 minutes
    });

    // Analytics alerts
    this.addAlertRule('performance_degradation', {
      condition: (data) => data.trends && data.trends.responseTime &&
                      data.trends.responseTime.direction === 'increasing' &&
                      data.trends.responseTime.strength > 0.7,
      severity: 'warning',
      message: 'Performance is showing a strong degrading trend',
      cooldown: 20 * 60 * 1000 // 20 minutes
    });
  }

  setupNotificationChannels() {
    // Console notification (always enabled)
    this.notificationChannels.set('console', {
      enabled: true,
      send: (alert) => this.sendConsoleNotification(alert)
    });

    // Email notifications
    if (this.config.enableEmailAlerts) {
      this.notificationChannels.set('email', {
        enabled: true,
        send: (alert) => this.sendEmailNotification(alert)
      });
    }

    // Slack notifications
    if (this.config.enableSlackAlerts) {
      this.notificationChannels.set('slack', {
        enabled: true,
        send: (alert) => this.sendSlackNotification(alert)
      });
    }

    // Webhook notifications
    if (this.config.enableWebhookAlerts) {
      this.notificationChannels.set('webhook', {
        enabled: true,
        send: (alert) => this.sendWebhookNotification(alert)
      });
    }

    // SMS notifications
    if (this.config.enableSmsAlerts) {
      this.notificationChannels.set('sms', {
        enabled: true,
        send: (alert) => this.sendSmsNotification(alert)
      });
    }
  }

  addAlertRule(name, rule) {
    this.alertRules.set(name, {
      name,
      ...rule,
      createdAt: new Date(),
      enabled: true,
      triggerCount: 0,
      lastTriggered: null
    });
  }

  removeAlertRule(name) {
    return this.alertRules.delete(name);
  }

  processAlert(source, alertData) {
    try {
      // Check rate limiting
      if (this.hourlyAlertCount >= this.config.maxAlertsPerHour) {
        console.warn('Alert rate limit exceeded, suppressing alert');
        return;
      }

      const alertId = this.generateAlertId();
      const alert = {
        id: alertId,
        source,
        timestamp: new Date(),
        ...alertData,
        status: 'active',
        acknowledged: false,
        escalated: false,
        notificationsSent: []
      };

      // Check if alert should be suppressed
      if (this.shouldSuppressAlert(alert)) {
        this.stats.suppressedAlerts++;
        return;
      }

      // Check for alert grouping
      const groupKey = this.getAlertGroupKey(alert);
      if (this.config.enableAlertGrouping && this.alertGroups.has(groupKey)) {
        this.addToAlertGroup(groupKey, alert);
        return;
      }

      // Store alert
      this.alerts.set(alertId, alert);
      this.alertHistory.push(alert);

      // Update statistics
      this.stats.totalAlerts++;
      this.stats.activeAlerts++;
      this.hourlyAlertCount++;
      this.stats.alertsThisHour++;

      // Send notifications
      this.sendAlertNotifications(alert);

      // Create alert group if grouping is enabled
      if (this.config.enableAlertGrouping) {
        this.createAlertGroup(groupKey, alert);
      }

      // Emit alert event
      this.emit('alertTriggered', alert);

      console.log(`Alert triggered: ${alert.type || alert.message} [${alert.severity}]`);

    } catch (error) {
      console.error('Alert processing error:', error);
      this.emit('alertError', { error: error.message, alertData });
    }
  }

  checkAnalyticsAlerts(analysis) {
    try {
      // Check alert rules against analytics data
      for (const [ruleName, rule] of this.alertRules.entries()) {
        if (!rule.enabled) continue;

        // Check cooldown
        if (rule.lastTriggered &&
                    (Date.now() - rule.lastTriggered.getTime()) < (rule.cooldown || this.config.alertCooldown)) {
          continue;
        }

        // Evaluate condition
        if (rule.condition(analysis)) {
          rule.triggerCount++;
          rule.lastTriggered = new Date();

          this.processAlert('analytics', {
            type: ruleName,
            message: rule.message,
            severity: rule.severity,
            data: analysis,
            rule: ruleName
          });
        }
      }

    } catch (error) {
      console.error('Analytics alert check error:', error);
    }
  }

  checkMetricsAlerts(metricsData) {
    try {
      // Check alert rules against metrics data
      for (const [ruleName, rule] of this.alertRules.entries()) {
        if (!rule.enabled) continue;

        // Check cooldown
        if (rule.lastTriggered &&
                    (Date.now() - rule.lastTriggered.getTime()) < (rule.cooldown || this.config.alertCooldown)) {
          continue;
        }

        // Evaluate condition
        if (rule.condition(metricsData)) {
          rule.triggerCount++;
          rule.lastTriggered = new Date();

          this.processAlert('metrics', {
            type: ruleName,
            message: rule.message,
            severity: rule.severity,
            data: metricsData,
            rule: ruleName
          });
        }
      }

    } catch (error) {
      console.error('Metrics alert check error:', error);
    }
  }

  shouldSuppressAlert(alert) {
    if (!this.config.enableAlertSuppression) return false;

    const suppressionKey = `${alert.type}_${alert.severity}`;
    return this.suppressedAlerts.has(suppressionKey);
  }

  getAlertGroupKey(alert) {
    return `${alert.source}_${alert.type || 'unknown'}_${alert.severity}`;
  }

  createAlertGroup(groupKey, alert) {
    this.alertGroups.set(groupKey, {
      key: groupKey,
      alerts: [alert],
      createdAt: new Date(),
      lastUpdated: new Date(),
      count: 1
    });
  }

  addToAlertGroup(groupKey, alert) {
    const group = this.alertGroups.get(groupKey);
    if (group) {
      group.alerts.push(alert);
      group.count++;
      group.lastUpdated = new Date();

      // Send grouped notification if threshold reached
      if (group.count % 5 === 0) { // Every 5th alert in group
        this.sendGroupedAlertNotification(group);
      }
    }
  }

  async sendAlertNotifications(alert) {
    const notifications = [];

    for (const [channelName, channel] of this.notificationChannels.entries()) {
      if (channel.enabled) {
        try {
          await channel.send(alert);
          notifications.push(channelName);
        } catch (error) {
          console.error(`Failed to send ${channelName} notification:`, error);
        }
      }
    }

    alert.notificationsSent = notifications;
  }

  async sendGroupedAlertNotification(group) {
    const groupedAlert = {
      id: this.generateAlertId(),
      type: 'grouped_alert',
      message: `${group.count} similar alerts grouped`,
      severity: group.alerts[0].severity,
      groupKey: group.key,
      alertCount: group.count,
      firstAlert: group.alerts[0],
      lastAlert: group.alerts[group.alerts.length - 1],
      timestamp: new Date()
    };

    await this.sendAlertNotifications(groupedAlert);
  }

  checkEscalations() {
    const now = new Date();

    for (const [alertId, alert] of this.alerts.entries()) {
      if (alert.status === 'active' && !alert.escalated && !alert.acknowledged) {
        const timeSinceAlert = now.getTime() - alert.timestamp.getTime();

        if (timeSinceAlert > this.config.escalationTimeout) {
          this.escalateAlert(alert);
        }
      }
    }
  }

  escalateAlert(alert) {
    alert.escalated = true;
    alert.escalatedAt = new Date();

    this.escalatedAlerts.set(alert.id, alert);
    this.stats.escalatedAlerts++;

    // Send escalation notifications
    const escalationAlert = {
      ...alert,
      type: 'escalated_alert',
      message: `ESCALATED: ${alert.message}`,
      severity: 'critical'
    };

    this.sendAlertNotifications(escalationAlert);
    this.emit('alertEscalated', alert);

    console.warn(`Alert escalated: ${alert.id}`);
  }

  // Notification methods
  sendConsoleNotification(alert) {
    const timestamp = alert.timestamp.toISOString();
    const severity = alert.severity.toUpperCase();
    const message = alert.message;

    console.log(`[${timestamp}] ALERT [${severity}]: ${message}`);

    if (alert.data) {
      console.log('Alert data:', JSON.stringify(alert.data, null, 2));
    }
  }

  async sendEmailNotification(alert) {
    // Placeholder for email notification
    // In production, integrate with email service (SendGrid, AWS SES, etc.)
    console.log(`Email notification would be sent for alert: ${alert.id}`);
  }

  async sendSlackNotification(alert) {
    // Placeholder for Slack notification
    // In production, integrate with Slack API
    console.log(`Slack notification would be sent for alert: ${alert.id}`);
  }

  async sendWebhookNotification(alert) {
    // Placeholder for webhook notification
    // In production, send HTTP POST to configured webhook URL
    console.log(`Webhook notification would be sent for alert: ${alert.id}`);
  }

  async sendSmsNotification(alert) {
    // Placeholder for SMS notification
    // In production, integrate with SMS service (Twilio, AWS SNS, etc.)
    console.log(`SMS notification would be sent for alert: ${alert.id}`);
  }

  // Alert management methods
  acknowledgeAlert(alertId, userId = null) {
    const alert = this.alerts.get(alertId);
    if (alert && alert.status === 'active') {
      alert.acknowledged = true;
      alert.acknowledgedAt = new Date();
      alert.acknowledgedBy = userId;

      this.emit('alertAcknowledged', alert);

      return { success: true, alert };
    }

    return { success: false, error: 'Alert not found or already resolved' };
  }

  resolveAlert(alertId, userId = null, resolution = null) {
    const alert = this.alerts.get(alertId);
    if (alert && alert.status === 'active') {
      alert.status = 'resolved';
      alert.resolvedAt = new Date();
      alert.resolvedBy = userId;
      alert.resolution = resolution;

      this.stats.activeAlerts--;

      this.emit('alertResolved', alert);

      return { success: true, alert };
    }

    return { success: false, error: 'Alert not found or already resolved' };
  }

  suppressAlert(alertType, duration = 60 * 60 * 1000) { // 1 hour default
    const suppressionKey = alertType;
    this.suppressedAlerts.add(suppressionKey);

    // Auto-remove suppression after duration
    setTimeout(() => {
      this.suppressedAlerts.delete(suppressionKey);
    }, duration);

    this.emit('alertSuppressed', { alertType, duration });

    return { success: true, suppressionKey };
  }

  // Utility methods
  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public API methods
  getAlerts(status = null, limit = 50) {
    let alerts = Array.from(this.alerts.values());

    if (status) {
      alerts = alerts.filter(alert => alert.status === status);
    }

    return alerts
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  getAlertHistory(limit = 100) {
    return this.alertHistory
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  getAlertStats() {
    return {
      ...this.stats,
      alertRules: this.alertRules.size,
      notificationChannels: this.notificationChannels.size,
      alertGroups: this.alertGroups.size,
      uptime: Date.now() - this.stats.lastReset.getTime()
    };
  }

  getAlertRules() {
    return Array.from(this.alertRules.values());
  }

  async shutdown() {
    this.stopAlerting();
    this.removeAllListeners();
  }
}

// Singleton instance
let alertingSystemInstance = null;

class AlertingSystemSingleton {
  static getInstance(options = {}) {
    if (!alertingSystemInstance) {
      alertingSystemInstance = new AlertingSystem(options);
    }
    return alertingSystemInstance;
  }
}

module.exports = { AlertingSystem, AlertingSystemSingleton };
