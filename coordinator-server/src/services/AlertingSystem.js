const express = require('express');
const logger = require('../utils/logger');

class AlertingSystem {
    constructor(config, dependencies = {}) {
        this.config = config;
        this.dependencies = dependencies;
        
        // Alert channels configuration
        this.channels = {
            email: {
                enabled: config?.get('ALERT_EMAIL_ENABLED') || false,
                smtp: {
                    host: config?.get('SMTP_HOST'),
                    port: config?.get('SMTP_PORT') || 587,
                    secure: config?.get('SMTP_SECURE') || false,
                    auth: {
                        user: config?.get('SMTP_USER'),
                        pass: config?.get('SMTP_PASS')
                    }
                },
                from: config?.get('ALERT_EMAIL_FROM'),
                to: config?.get('ALERT_EMAIL_TO')?.split(',') || []
            },
            slack: {
                enabled: config?.get('ALERT_SLACK_ENABLED') || false,
                webhookUrl: config?.get('SLACK_WEBHOOK_URL'),
                channel: config?.get('SLACK_CHANNEL') || '#alerts',
                username: config?.get('SLACK_USERNAME') || 'NeuroGrid Alerts'
            },
            webhook: {
                enabled: config?.get('ALERT_WEBHOOK_ENABLED') || false,
                urls: config?.get('ALERT_WEBHOOK_URLS')?.split(',') || []
            },
            sms: {
                enabled: config?.get('ALERT_SMS_ENABLED') || false,
                service: config?.get('SMS_SERVICE') || 'twilio',
                credentials: {
                    accountSid: config?.get('TWILIO_ACCOUNT_SID'),
                    authToken: config?.get('TWILIO_AUTH_TOKEN'),
                    from: config?.get('TWILIO_FROM_NUMBER')
                },
                to: config?.get('ALERT_SMS_TO')?.split(',') || []
            }
        };

        // Alert rules and escalation
        this.alertRules = {
            severity: {
                low: {
                    channels: ['email'],
                    cooldown: 30 * 60 * 1000, // 30 minutes
                    escalation: null
                },
                medium: {
                    channels: ['email', 'slack'],
                    cooldown: 15 * 60 * 1000, // 15 minutes
                    escalation: {
                        after: 30 * 60 * 1000, // 30 minutes
                        to: 'high'
                    }
                },
                high: {
                    channels: ['email', 'slack', 'sms'],
                    cooldown: 5 * 60 * 1000, // 5 minutes
                    escalation: {
                        after: 15 * 60 * 1000, // 15 minutes
                        to: 'critical'
                    }
                },
                critical: {
                    channels: ['email', 'slack', 'sms', 'webhook'],
                    cooldown: 2 * 60 * 1000, // 2 minutes
                    escalation: null
                }
            },
            components: {
                database: { defaultSeverity: 'high' },
                authentication: { defaultSeverity: 'high' },
                payment: { defaultSeverity: 'medium' },
                api: { defaultSeverity: 'medium' },
                system: { defaultSeverity: 'low' }
            }
        };

        // Active alerts tracking
        this.activeAlerts = new Map();
        this.alertHistory = [];
        this.escalationTimers = new Map();

        // Initialize notification services
        this.initializeServices();
    }

    async initializeServices() {
        try {
            // Initialize email service
            if (this.channels.email.enabled) {
                const nodemailer = require('nodemailer');
                this.emailTransporter = nodemailer.createTransporter(this.channels.email.smtp);
                
                // Verify email connection
                await this.emailTransporter.verify();
                logger.info('Email alerting service initialized');
            }

            // Initialize Slack service
            if (this.channels.slack.enabled) {
                const axios = require('axios');
                this.slackClient = axios.create({
                    timeout: 10000
                });
                logger.info('Slack alerting service initialized');
            }

            // Initialize SMS service
            if (this.channels.sms.enabled && this.channels.sms.service === 'twilio') {
                const twilio = require('twilio');
                this.twilioClient = twilio(
                    this.channels.sms.credentials.accountSid,
                    this.channels.sms.credentials.authToken
                );
                logger.info('SMS alerting service initialized');
            }

            logger.info('Alerting system initialized', {
                enabledChannels: Object.entries(this.channels)
                    .filter(([, config]) => config.enabled)
                    .map(([name]) => name)
            });

        } catch (error) {
            logger.error('Failed to initialize alerting services', {
                error: error.message,
                stack: error.stack
            });
        }
    }

    async processAlert(alert) {
        try {
            // Determine alert severity
            const severity = this.determineSeverity(alert);
            const enrichedAlert = {
                ...alert,
                severity,
                id: alert.id || require('crypto').randomUUID(),
                timestamp: alert.timestamp || new Date(),
                hostname: require('os').hostname(),
                environment: this.config?.get('NODE_ENV') || 'unknown'
            };

            // Check if alert should be suppressed
            if (this.shouldSuppressAlert(enrichedAlert)) {
                logger.debug('Alert suppressed', { alertId: enrichedAlert.id });
                return;
            }

            // Store active alert
            this.activeAlerts.set(enrichedAlert.id, enrichedAlert);

            // Send notifications
            await this.sendNotifications(enrichedAlert);

            // Set up escalation if configured
            this.setupEscalation(enrichedAlert);

            // Record in history
            this.alertHistory.push(enrichedAlert);
            if (this.alertHistory.length > 1000) {
                this.alertHistory.shift(); // Keep only last 1000 alerts
            }

            logger.info('Alert processed', {
                alertId: enrichedAlert.id,
                severity: enrichedAlert.severity,
                component: enrichedAlert.component
            });

        } catch (error) {
            logger.error('Failed to process alert', {
                error: error.message,
                alert: alert.id || 'unknown'
            });
        }
    }

    async resolveAlert(alertId, resolution = {}) {
        const alert = this.activeAlerts.get(alertId);
        if (!alert) {
            logger.warn('Attempted to resolve non-existent alert', { alertId });
            return;
        }

        const resolvedAlert = {
            ...alert,
            resolved: true,
            resolvedAt: new Date(),
            resolvedBy: resolution.resolvedBy || 'system',
            resolutionNotes: resolution.notes || 'Automatically resolved'
        };

        // Cancel escalation timer
        if (this.escalationTimers.has(alertId)) {
            clearTimeout(this.escalationTimers.get(alertId));
            this.escalationTimers.delete(alertId);
        }

        // Remove from active alerts
        this.activeAlerts.delete(alertId);

        // Send resolution notifications
        await this.sendResolutionNotifications(resolvedAlert);

        // Update history
        const historyIndex = this.alertHistory.findIndex(a => a.id === alertId);
        if (historyIndex !== -1) {
            this.alertHistory[historyIndex] = resolvedAlert;
        }

        logger.info('Alert resolved', {
            alertId,
            duration: resolvedAlert.resolvedAt - resolvedAlert.timestamp,
            resolvedBy: resolvedAlert.resolvedBy
        });
    }

    determineSeverity(alert) {
        // Check if component has specific severity rules
        const componentRule = this.alertRules.components[alert.component];
        if (componentRule?.defaultSeverity) {
            return componentRule.defaultSeverity;
        }

        // Determine severity based on alert content
        if (alert.severity) {
            return alert.severity;
        }

        // Default severity based on alert characteristics
        if (alert.component === 'database' || alert.component === 'authentication') {
            return 'high';
        }

        if (alert.message?.toLowerCase().includes('critical') || 
            alert.message?.toLowerCase().includes('down')) {
            return 'critical';
        }

        if (alert.message?.toLowerCase().includes('error') || 
            alert.status === 'unhealthy') {
            return 'medium';
        }

        return 'low';
    }

    shouldSuppressAlert(alert) {
        // Check for duplicate active alerts
        const duplicateAlert = Array.from(this.activeAlerts.values())
            .find(a => a.component === alert.component && 
                      a.message === alert.message && 
                      !a.resolved);

        if (duplicateAlert) {
            return true;
        }

        // Check cooldown period
        const recentAlert = this.alertHistory
            .slice(-50) // Check last 50 alerts
            .find(a => a.component === alert.component && 
                      a.message === alert.message &&
                      Date.now() - new Date(a.timestamp).getTime() < this.alertRules.severity[alert.severity]?.cooldown);

        return !!recentAlert;
    }

    async sendNotifications(alert) {
        const severityConfig = this.alertRules.severity[alert.severity];
        if (!severityConfig) {
            logger.warn('Unknown alert severity', { severity: alert.severity });
            return;
        }

        const channels = severityConfig.channels;
        const notifications = [];

        // Send to each configured channel
        for (const channel of channels) {
            if (this.channels[channel]?.enabled) {
                notifications.push(this.sendToChannel(channel, alert));
            }
        }

        // Wait for all notifications to complete
        const results = await Promise.allSettled(notifications);
        
        // Log results
        results.forEach((result, index) => {
            const channel = channels[index];
            if (result.status === 'fulfilled') {
                logger.debug('Alert notification sent', { 
                    channel, 
                    alertId: alert.id 
                });
            } else {
                logger.error('Alert notification failed', {
                    channel,
                    alertId: alert.id,
                    error: result.reason.message
                });
            }
        });
    }

    async sendToChannel(channel, alert) {
        switch (channel) {
            case 'email':
                return this.sendEmailAlert(alert);
            case 'slack':
                return this.sendSlackAlert(alert);
            case 'sms':
                return this.sendSMSAlert(alert);
            case 'webhook':
                return this.sendWebhookAlert(alert);
            default:
                throw new Error(`Unknown alert channel: ${channel}`);
        }
    }

    async sendEmailAlert(alert) {
        if (!this.emailTransporter) {
            throw new Error('Email service not initialized');
        }

        const subject = `[${alert.severity.toUpperCase()}] ${alert.component} Alert - ${alert.message}`;
        const html = this.generateEmailHTML(alert);

        const mailOptions = {
            from: this.channels.email.from,
            to: this.channels.email.to,
            subject,
            html
        };

        await this.emailTransporter.sendMail(mailOptions);
    }

    async sendSlackAlert(alert) {
        if (!this.slackClient) {
            throw new Error('Slack service not initialized');
        }

        const color = {
            low: '#36a64f',      // Green
            medium: '#ff9500',   // Orange  
            high: '#ff0000',     // Red
            critical: '#800080'   // Purple
        }[alert.severity] || '#36a64f';

        const payload = {
            channel: this.channels.slack.channel,
            username: this.channels.slack.username,
            attachments: [{
                color,
                title: `${alert.severity.toUpperCase()} Alert: ${alert.component}`,
                text: alert.message,
                fields: [
                    {
                        title: 'Component',
                        value: alert.component,
                        short: true
                    },
                    {
                        title: 'Severity',
                        value: alert.severity.toUpperCase(),
                        short: true
                    },
                    {
                        title: 'Time',
                        value: alert.timestamp.toISOString(),
                        short: true
                    },
                    {
                        title: 'Environment',
                        value: alert.environment,
                        short: true
                    }
                ],
                footer: 'NeuroGrid Monitoring',
                ts: Math.floor(alert.timestamp.getTime() / 1000)
            }]
        };

        await this.slackClient.post(this.channels.slack.webhookUrl, payload);
    }

    async sendSMSAlert(alert) {
        if (!this.twilioClient) {
            throw new Error('SMS service not initialized');
        }

        const message = `[${alert.severity.toUpperCase()}] NeuroGrid Alert: ${alert.component} - ${alert.message}`;

        const promises = this.channels.sms.to.map(phoneNumber =>
            this.twilioClient.messages.create({
                body: message,
                from: this.channels.sms.credentials.from,
                to: phoneNumber
            })
        );

        await Promise.all(promises);
    }

    async sendWebhookAlert(alert) {
        const axios = require('axios');
        
        const payload = {
            alert,
            timestamp: new Date().toISOString(),
            source: 'neurogrid-coordinator'
        };

        const promises = this.channels.webhook.urls.map(url =>
            axios.post(url, payload, { timeout: 10000 })
        );

        await Promise.all(promises);
    }

    async sendResolutionNotifications(alert) {
        // Send resolution notifications to the same channels as the original alert
        const severityConfig = this.alertRules.severity[alert.severity];
        if (!severityConfig) return;

        const channels = severityConfig.channels;
        const notifications = [];

        for (const channel of channels) {
            if (this.channels[channel]?.enabled) {
                notifications.push(this.sendResolutionToChannel(channel, alert));
            }
        }

        await Promise.allSettled(notifications);
    }

    async sendResolutionToChannel(channel, alert) {
        switch (channel) {
            case 'email':
                return this.sendEmailResolution(alert);
            case 'slack':
                return this.sendSlackResolution(alert);
            case 'sms':
                return this.sendSMSResolution(alert);
            case 'webhook':
                return this.sendWebhookResolution(alert);
        }
    }

    async sendEmailResolution(alert) {
        const subject = `[RESOLVED] ${alert.component} Alert - ${alert.message}`;
        const html = this.generateResolutionEmailHTML(alert);

        const mailOptions = {
            from: this.channels.email.from,
            to: this.channels.email.to,
            subject,
            html
        };

        await this.emailTransporter.sendMail(mailOptions);
    }

    async sendSlackResolution(alert) {
        const payload = {
            channel: this.channels.slack.channel,
            username: this.channels.slack.username,
            attachments: [{
                color: '#36a64f', // Green for resolution
                title: `✅ RESOLVED: ${alert.component}`,
                text: `Alert "${alert.message}" has been resolved`,
                fields: [
                    {
                        title: 'Duration',
                        value: this.formatDuration(alert.resolvedAt - alert.timestamp),
                        short: true
                    },
                    {
                        title: 'Resolved By',
                        value: alert.resolvedBy,
                        short: true
                    }
                ],
                footer: 'NeuroGrid Monitoring',
                ts: Math.floor(alert.resolvedAt.getTime() / 1000)
            }]
        };

        await this.slackClient.post(this.channels.slack.webhookUrl, payload);
    }

    async sendSMSResolution(alert) {
        // Only send SMS for high/critical alerts to avoid spam
        if (alert.severity === 'high' || alert.severity === 'critical') {
            const message = `✅ RESOLVED: ${alert.component} alert has been resolved after ${this.formatDuration(alert.resolvedAt - alert.timestamp)}`;

            const promises = this.channels.sms.to.map(phoneNumber =>
                this.twilioClient.messages.create({
                    body: message,
                    from: this.channels.sms.credentials.from,
                    to: phoneNumber
                })
            );

            await Promise.all(promises);
        }
    }

    async sendWebhookResolution(alert) {
        const axios = require('axios');
        
        const payload = {
            alert,
            type: 'resolution',
            timestamp: new Date().toISOString(),
            source: 'neurogrid-coordinator'
        };

        const promises = this.channels.webhook.urls.map(url =>
            axios.post(url, payload, { timeout: 10000 })
        );

        await Promise.all(promises);
    }

    setupEscalation(alert) {
        const severityConfig = this.alertRules.severity[alert.severity];
        if (!severityConfig?.escalation) return;

        const timer = setTimeout(async () => {
            if (this.activeAlerts.has(alert.id)) {
                logger.warn('Escalating alert', {
                    alertId: alert.id,
                    from: alert.severity,
                    to: severityConfig.escalation.to
                });

                // Create escalated alert
                const escalatedAlert = {
                    ...alert,
                    severity: severityConfig.escalation.to,
                    escalated: true,
                    originalSeverity: alert.severity,
                    escalatedAt: new Date()
                };

                // Update active alert
                this.activeAlerts.set(alert.id, escalatedAlert);

                // Send escalated notifications
                await this.sendNotifications(escalatedAlert);

                // Setup next escalation if exists
                this.setupEscalation(escalatedAlert);
            }
        }, severityConfig.escalation.after);

        this.escalationTimers.set(alert.id, timer);
    }

    generateEmailHTML(alert) {
        return `
        <html>
        <body style="font-family: Arial, sans-serif;">
            <div style="background-color: ${this.getSeverityColor(alert.severity)}; color: white; padding: 20px;">
                <h1>${alert.severity.toUpperCase()} Alert</h1>
            </div>
            <div style="padding: 20px;">
                <h2>${alert.component} - ${alert.message}</h2>
                <table style="border-collapse: collapse; width: 100%;">
                    <tr>
                        <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Component:</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${alert.component}</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Severity:</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${alert.severity.toUpperCase()}</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Time:</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${alert.timestamp.toISOString()}</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Environment:</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${alert.environment}</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Hostname:</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${alert.hostname}</td>
                    </tr>
                </table>
                ${alert.details ? `
                <h3>Details:</h3>
                <pre style="background-color: #f5f5f5; padding: 10px; border-radius: 4px;">${JSON.stringify(alert.details, null, 2)}</pre>
                ` : ''}
            </div>
        </body>
        </html>
        `;
    }

    generateResolutionEmailHTML(alert) {
        return `
        <html>
        <body style="font-family: Arial, sans-serif;">
            <div style="background-color: #36a64f; color: white; padding: 20px;">
                <h1>✅ Alert Resolved</h1>
            </div>
            <div style="padding: 20px;">
                <h2>${alert.component} - ${alert.message}</h2>
                <p>This alert has been resolved.</p>
                <table style="border-collapse: collapse; width: 100%;">
                    <tr>
                        <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Duration:</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${this.formatDuration(alert.resolvedAt - alert.timestamp)}</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Resolved By:</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${alert.resolvedBy}</td>
                    </tr>
                    <tr>
                        <td style="border: 1px solid #ddd; padding: 8px; font-weight: bold;">Resolution Notes:</td>
                        <td style="border: 1px solid #ddd; padding: 8px;">${alert.resolutionNotes}</td>
                    </tr>
                </table>
            </div>
        </body>
        </html>
        `;
    }

    getSeverityColor(severity) {
        const colors = {
            low: '#36a64f',      // Green
            medium: '#ff9500',   // Orange
            high: '#ff0000',     // Red
            critical: '#800080'   // Purple
        };
        return colors[severity] || '#36a64f';
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);

        if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    // API methods
    getActiveAlerts() {
        return Array.from(this.activeAlerts.values());
    }

    getAlertHistory(limit = 100) {
        return this.alertHistory.slice(-limit);
    }

    getAlertStats() {
        const now = Date.now();
        const last24h = now - 24 * 60 * 60 * 1000;
        
        const recent = this.alertHistory.filter(a => 
            new Date(a.timestamp).getTime() > last24h
        );

        return {
            active: this.activeAlerts.size,
            total24h: recent.length,
            bySeverity24h: {
                low: recent.filter(a => a.severity === 'low').length,
                medium: recent.filter(a => a.severity === 'medium').length,
                high: recent.filter(a => a.severity === 'high').length,
                critical: recent.filter(a => a.severity === 'critical').length
            },
            byComponent24h: recent.reduce((acc, alert) => {
                acc[alert.component] = (acc[alert.component] || 0) + 1;
                return acc;
            }, {})
        };
    }

    // Express routes for alert management
    createRoutes() {
        const router = express.Router();

        // Get active alerts
        router.get('/alerts/active', (req, res) => {
            res.json(this.getActiveAlerts());
        });

        // Get alert history
        router.get('/alerts/history', (req, res) => {
            const limit = parseInt(req.query.limit) || 100;
            res.json(this.getAlertHistory(limit));
        });

        // Get alert statistics
        router.get('/alerts/stats', (req, res) => {
            res.json(this.getAlertStats());
        });

        // Manually resolve alert
        router.post('/alerts/:id/resolve', async (req, res) => {
            try {
                await this.resolveAlert(req.params.id, {
                    resolvedBy: req.user?.username || 'manual',
                    notes: req.body.notes || 'Manually resolved'
                });
                res.json({ success: true });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        // Test alert (for testing notification channels)
        router.post('/alerts/test', async (req, res) => {
            try {
                const testAlert = {
                    id: require('crypto').randomUUID(),
                    component: 'test',
                    severity: req.body.severity || 'low',
                    message: 'Test alert from admin panel',
                    timestamp: new Date(),
                    details: { test: true }
                };

                await this.processAlert(testAlert);
                res.json({ success: true, alertId: testAlert.id });
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });

        return router;
    }

    // Shutdown
    shutdown() {
        // Clear all escalation timers
        for (const timer of this.escalationTimers.values()) {
            clearTimeout(timer);
        }
        this.escalationTimers.clear();

        // Close email transporter
        if (this.emailTransporter) {
            this.emailTransporter.close();
        }

        logger.info('Alerting system shutdown complete');
    }
}

module.exports = AlertingSystem;