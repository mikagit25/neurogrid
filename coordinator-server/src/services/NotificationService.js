const crypto = require('crypto');
const logger = require('../utils/logger');

/**
 * Notification Service - Enhanced multi-channel notification system
 * Supports web, email, SMS, and push notifications with advanced features
 */
class NotificationService {
  constructor() {
    this.notifications = new Map(); // In-memory storage for demo
    this.templates = new Map();
    this.userPreferences = new Map();
    this.channels = new Map();
    this.statistics = {
      total: 0,
      sent: 0,
      delivered: 0,
      failed: 0,
      read: 0
    };

    this.initializeTemplates();
    this.initializeChannels();
  }

  /**
   * Initialize notification templates
   */
  initializeTemplates() {
    const templates = [
      {
        id: 'task_completed',
        type: 'task_completion',
        priority: 'medium',
        title: 'Task Completed',
        body: 'Your task "{{taskName}}" has been completed successfully. Results are now available.',
        channels: ['web', 'email'],
        variables: ['taskName', 'taskId', 'results']
      },
      {
        id: 'task_failed',
        type: 'task_failure',
        priority: 'high',
        title: 'Task Failed',
        body: 'Your task "{{taskName}}" has failed. Error: {{error}}',
        channels: ['web', 'email', 'push'],
        variables: ['taskName', 'taskId', 'error']
      },
      {
        id: 'node_online',
        type: 'node_event',
        priority: 'low',
        title: 'Node Online',
        body: 'Node {{nodeName}} is now online and ready to process tasks.',
        channels: ['web'],
        variables: ['nodeName', 'nodeId', 'capabilities']
      },
      {
        id: 'node_offline',
        type: 'node_event',
        priority: 'medium',
        title: 'Node Offline',
        body: 'Node {{nodeName}} has gone offline. {{reason}}',
        channels: ['web', 'email'],
        variables: ['nodeName', 'nodeId', 'reason']
      },
      {
        id: 'payment_received',
        type: 'payment',
        priority: 'medium',
        title: 'Payment Received',
        body: 'You have received {{amount}} tokens for completing task {{taskId}}.',
        channels: ['web', 'email'],
        variables: ['amount', 'taskId', 'balance']
      },
      {
        id: 'payment_failed',
        type: 'payment',
        priority: 'high',
        title: 'Payment Failed',
        body: 'Payment processing failed for task {{taskId}}. Error: {{error}}',
        channels: ['web', 'email', 'push'],
        variables: ['taskId', 'amount', 'error']
      },
      {
        id: 'system_maintenance',
        type: 'system_alert',
        priority: 'urgent',
        title: 'System Maintenance',
        body: 'Scheduled maintenance will begin at {{startTime}} and is expected to last {{duration}}.',
        channels: ['web', 'email', 'sms', 'push'],
        variables: ['startTime', 'duration', 'affectedServices']
      },
      {
        id: 'support_ticket_update',
        type: 'support',
        priority: 'medium',
        title: 'Support Ticket Update',
        body: 'Your support ticket #{{ticketId}} has been updated. Status: {{status}}',
        channels: ['web', 'email'],
        variables: ['ticketId', 'status', 'response']
      },
      {
        id: 'welcome',
        type: 'user_onboarding',
        priority: 'medium',
        title: 'Welcome to NeuroGrid',
        body: 'Welcome {{userName}}! Your account has been created successfully. Start earning by processing AI tasks.',
        channels: ['web', 'email'],
        variables: ['userName', 'accountType', 'activationLink']
      }
    ];

    templates.forEach(template => {
      this.templates.set(template.id, template);
    });

    logger.info('Notification templates initialized', { count: templates.length });
  }

  /**
   * Initialize notification channels
   */
  initializeChannels() {
    this.channels.set('web', {
      name: 'Web Notifications',
      enabled: true,
      handler: this.sendWebNotification.bind(this)
    });

    this.channels.set('email', {
      name: 'Email',
      enabled: true,
      handler: this.sendEmailNotification.bind(this)
    });

    this.channels.set('sms', {
      name: 'SMS',
      enabled: false, // Requires SMS service setup
      handler: this.sendSMSNotification.bind(this)
    });

    this.channels.set('push', {
      name: 'Push Notifications',
      enabled: false, // Requires push service setup
      handler: this.sendPushNotification.bind(this)
    });
  }

  /**
   * Create a new notification
   */
  async createNotification(options) {
    try {
      const {
        userId,
        type,
        templateId,
        title,
        body,
        priority = 'medium',
        channels = ['web'],
        variables = {},
        metadata = {},
        scheduleAt = null
      } = options;

      if (!userId) {
        throw new Error('User ID is required');
      }

      const notificationId = crypto.randomUUID();
      let finalTitle = title;
      let finalBody = body;

      // Use template if provided
      if (templateId) {
        const template = this.templates.get(templateId);
        if (!template) {
          throw new Error(`Template ${templateId} not found`);
        }

        finalTitle = this.renderTemplate(template.title, variables);
        finalBody = this.renderTemplate(template.body, variables);
      }

      const notification = {
        id: notificationId,
        userId,
        type: type || 'general',
        templateId,
        title: finalTitle,
        body: finalBody,
        priority,
        channels,
        variables,
        metadata,
        status: scheduleAt ? 'scheduled' : 'pending',
        isRead: false,
        createdAt: new Date().toISOString(),
        scheduledAt: scheduleAt,
        sentAt: null,
        readAt: null,
        deliveryStatus: {},
        attempts: 0,
        maxAttempts: 3
      };

      this.notifications.set(notificationId, notification);
      this.statistics.total++;

      logger.info('Notification created', {
        id: notificationId,
        userId,
        type,
        priority,
        channels
      });

      // Send immediately if not scheduled
      if (!scheduleAt) {
        await this.processNotification(notificationId);
      }

      return notification;

    } catch (error) {
      logger.error('Error creating notification:', error);
      throw error;
    }
  }

  /**
   * Process and send a notification
   */
  async processNotification(notificationId) {
    try {
      const notification = this.notifications.get(notificationId);
      if (!notification) {
        throw new Error('Notification not found');
      }

      if (notification.status !== 'pending' && notification.status !== 'scheduled') {
        return notification;
      }

      // Check user preferences
      const userPrefs = this.getUserPreferences(notification.userId);
      const allowedChannels = notification.channels.filter(channel =>
        userPrefs.channels[channel]?.enabled !== false
      );

      notification.status = 'sending';
      notification.attempts++;
      notification.sentAt = new Date().toISOString();

      // Send to each allowed channel
      const sendPromises = allowedChannels.map(async (channel) => {
        try {
          const channelConfig = this.channels.get(channel);
          if (!channelConfig || !channelConfig.enabled) {
            notification.deliveryStatus[channel] = {
              status: 'disabled',
              timestamp: new Date().toISOString()
            };
            return;
          }

          await channelConfig.handler(notification, userPrefs);
          notification.deliveryStatus[channel] = {
            status: 'delivered',
            timestamp: new Date().toISOString()
          };

        } catch (error) {
          notification.deliveryStatus[channel] = {
            status: 'failed',
            error: error.message,
            timestamp: new Date().toISOString()
          };
          logger.error(`Failed to send notification via ${channel}:`, error);
        }
      });

      await Promise.allSettled(sendPromises);

      // Update final status
      const hasSuccess = Object.values(notification.deliveryStatus)
        .some(status => status.status === 'delivered');

      notification.status = hasSuccess ? 'sent' : 'failed';

      if (hasSuccess) {
        this.statistics.sent++;
        this.statistics.delivered++;
      } else {
        this.statistics.failed++;
      }

      logger.info('Notification processed', {
        id: notificationId,
        status: notification.status,
        channels: allowedChannels,
        deliveryStatus: notification.deliveryStatus
      });

      return notification;

    } catch (error) {
      logger.error('Error processing notification:', error);
      throw error;
    }
  }

  /**
   * Web notification handler
   */
  async sendWebNotification(notification, userPrefs) {
    // In a real implementation, this would send to WebSocket connections
    logger.info('Web notification sent', {
      id: notification.id,
      userId: notification.userId,
      title: notification.title
    });

    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  /**
   * Email notification handler
   */
  async sendEmailNotification(notification, userPrefs) {
    // In a real implementation, this would use an email service like SendGrid
    logger.info('Email notification sent', {
      id: notification.id,
      userId: notification.userId,
      to: userPrefs.email || 'user@example.com',
      subject: notification.title
    });

    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  /**
   * SMS notification handler
   */
  async sendSMSNotification(notification, userPrefs) {
    // In a real implementation, this would use an SMS service like Twilio
    logger.info('SMS notification sent', {
      id: notification.id,
      userId: notification.userId,
      to: userPrefs.phone || '+1234567890',
      message: notification.body
    });

    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 300));
  }

  /**
   * Push notification handler
   */
  async sendPushNotification(notification, userPrefs) {
    // In a real implementation, this would use a push service like FCM
    logger.info('Push notification sent', {
      id: notification.id,
      userId: notification.userId,
      title: notification.title
    });

    // Simulate delay
    await new Promise(resolve => setTimeout(resolve, 150));
  }

  /**
   * Render template with variables
   */
  renderTemplate(template, variables) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] || match;
    });
  }

  /**
   * Get user notifications with filtering and pagination
   */
  async getUserNotifications(userId, options = {}) {
    const {
      status,
      type,
      priority,
      isRead,
      limit = 20,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    let userNotifications = Array.from(this.notifications.values())
      .filter(notification => notification.userId === userId);

    // Apply filters
    if (status) {
      userNotifications = userNotifications.filter(n => n.status === status);
    }
    if (type) {
      userNotifications = userNotifications.filter(n => n.type === type);
    }
    if (priority) {
      userNotifications = userNotifications.filter(n => n.priority === priority);
    }
    if (typeof isRead === 'boolean') {
      userNotifications = userNotifications.filter(n => n.isRead === isRead);
    }

    // Sort
    userNotifications.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      if (sortOrder === 'desc') {
        return bVal > aVal ? 1 : -1;
      }
      return aVal > bVal ? 1 : -1;
    });

    // Paginate
    const total = userNotifications.length;
    const notifications = userNotifications.slice(offset, offset + limit);

    return {
      notifications,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      }
    };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId, userId) {
    const notification = this.notifications.get(notificationId);
    if (!notification) {
      throw new Error('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new Error('Access denied');
    }

    if (!notification.isRead) {
      notification.isRead = true;
      notification.readAt = new Date().toISOString();
      this.statistics.read++;
    }

    return notification;
  }

  /**
   * Delete notification
   */
  async deleteNotification(notificationId, userId) {
    const notification = this.notifications.get(notificationId);
    if (!notification) {
      throw new Error('Notification not found');
    }

    if (notification.userId !== userId) {
      throw new Error('Access denied');
    }

    this.notifications.delete(notificationId);
    return true;
  }

  /**
   * Get user preferences
   */
  getUserPreferences(userId) {
    return this.userPreferences.get(userId) || {
      channels: {
        web: { enabled: true },
        email: { enabled: true },
        sms: { enabled: false },
        push: { enabled: false }
      },
      types: {
        task_completion: { enabled: true },
        task_failure: { enabled: true },
        node_event: { enabled: true },
        payment: { enabled: true },
        system_alert: { enabled: true },
        support: { enabled: true }
      },
      priority: {
        urgent: { enabled: true },
        high: { enabled: true },
        medium: { enabled: true },
        low: { enabled: false }
      },
      quietHours: {
        enabled: false,
        start: '22:00',
        end: '08:00',
        timezone: 'UTC'
      }
    };
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(userId, preferences) {
    const currentPrefs = this.getUserPreferences(userId);
    const updatedPrefs = { ...currentPrefs, ...preferences };
    this.userPreferences.set(userId, updatedPrefs);

    logger.info('User notification preferences updated', { userId });
    return updatedPrefs;
  }

  /**
   * Get notification statistics
   */
  async getStatistics(userId = null) {
    if (userId) {
      const userNotifications = Array.from(this.notifications.values())
        .filter(n => n.userId === userId);

      return {
        total: userNotifications.length,
        unread: userNotifications.filter(n => !n.isRead).length,
        byStatus: this.groupBy(userNotifications, 'status'),
        byType: this.groupBy(userNotifications, 'type'),
        byPriority: this.groupBy(userNotifications, 'priority')
      };
    }

    return {
      ...this.statistics,
      byStatus: this.groupBy(Array.from(this.notifications.values()), 'status'),
      byType: this.groupBy(Array.from(this.notifications.values()), 'type'),
      byPriority: this.groupBy(Array.from(this.notifications.values()), 'priority')
    };
  }

  /**
   * Get available templates
   */
  getTemplates() {
    return Array.from(this.templates.values());
  }

  /**
   * Bulk operations
   */
  async markAllAsRead(userId) {
    const userNotifications = Array.from(this.notifications.values())
      .filter(n => n.userId === userId && !n.isRead);

    const timestamp = new Date().toISOString();
    userNotifications.forEach(notification => {
      notification.isRead = true;
      notification.readAt = timestamp;
    });

    this.statistics.read += userNotifications.length;
    return userNotifications.length;
  }

  async deleteAllRead(userId) {
    const toDelete = Array.from(this.notifications.entries())
      .filter(([id, n]) => n.userId === userId && n.isRead);

    toDelete.forEach(([id]) => {
      this.notifications.delete(id);
    });

    return toDelete.length;
  }

  /**
   * Utility method for grouping
   */
  groupBy(array, key) {
    return array.reduce((groups, item) => {
      const value = item[key];
      groups[value] = (groups[value] || 0) + 1;
      return groups;
    }, {});
  }

  /**
   * Send notification using template
   */
  async sendTemplateNotification(userId, templateId, variables = {}, options = {}) {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template ${templateId} not found`);
    }

    return this.createNotification({
      userId,
      templateId,
      type: template.type,
      priority: template.priority,
      channels: template.channels,
      variables,
      ...options
    });
  }
}

module.exports = NotificationService;
