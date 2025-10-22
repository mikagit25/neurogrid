const express = require('express');
const router = express.Router();

// In-memory storage for notifications (in production, use database)
let notifications = [];
let userNotificationSettings = new Map();
let notificationTemplates = new Map();

// Initialize default notification templates
initializeNotificationTemplates();

function initializeNotificationTemplates() {
    notificationTemplates.set('task_completed', {
        title: 'Task Completed',
        message: 'Your task {{taskId}} has been completed successfully',
        type: 'success',
        priority: 'medium',
        channels: ['web', 'email']
    });

    notificationTemplates.set('task_failed', {
        title: 'Task Failed',
        message: 'Your task {{taskId}} has failed: {{error}}',
        type: 'error',
        priority: 'high',
        channels: ['web', 'email', 'sms']
    });

    notificationTemplates.set('node_joined', {
        title: 'New Node Joined',
        message: 'Node {{nodeId}} has joined your network',
        type: 'info',
        priority: 'low',
        channels: ['web']
    });

    notificationTemplates.set('payment_processed', {
        title: 'Payment Processed',
        message: 'Payment of {{amount}} NGT has been processed',
        type: 'success',
        priority: 'medium',
        channels: ['web', 'email']
    });

    notificationTemplates.set('system_alert', {
        title: 'System Alert',
        message: '{{message}}',
        type: 'warning',
        priority: 'high',
        channels: ['web', 'email']
    });

    notificationTemplates.set('support_ticket_update', {
        title: 'Support Ticket Update',
        message: 'Your support ticket {{ticketId}} has been updated',
        type: 'info',
        priority: 'medium',
        channels: ['web', 'email']
    });
}

// Generate unique notification ID
function generateNotificationId() {
    return 'notif-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
}

// Template variable replacement
function replaceTemplateVariables(template, variables) {
    let message = template;
    for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        message = message.replace(regex, value);
    }
    return message;
}

// Create notification
function createNotification(userId, templateId, variables = {}, options = {}) {
    const template = notificationTemplates.get(templateId);
    if (!template) {
        throw new Error(`Unknown notification template: ${templateId}`);
    }

    const notification = {
        id: generateNotificationId(),
        userId: userId,
        templateId: templateId,
        title: replaceTemplateVariables(template.title, variables),
        message: replaceTemplateVariables(template.message, variables),
        type: options.type || template.type,
        priority: options.priority || template.priority,
        channels: options.channels || template.channels,
        data: variables,
        status: 'unread',
        createdAt: new Date().toISOString(),
        readAt: null,
        expiresAt: options.expiresAt || null,
        actions: options.actions || []
    };

    notifications.unshift(notification);

    // Keep only last 1000 notifications per user
    const userNotifications = notifications.filter(n => n.userId === userId);
    if (userNotifications.length > 1000) {
        notifications = notifications.filter(n => 
            n.userId !== userId || userNotifications.indexOf(n) < 1000
        );
    }

    return notification;
}

// Get notifications for user
router.get('/', (req, res) => {
    try {
        const userId = req.headers['x-user-id'] || 'default-user';
        const { 
            status = 'all', 
            type = 'all', 
            priority = 'all',
            limit = 50,
            offset = 0 
        } = req.query;

        let userNotifications = notifications.filter(n => n.userId === userId);

        // Apply filters
        if (status !== 'all') {
            userNotifications = userNotifications.filter(n => n.status === status);
        }

        if (type !== 'all') {
            userNotifications = userNotifications.filter(n => n.type === type);
        }

        if (priority !== 'all') {
            userNotifications = userNotifications.filter(n => n.priority === priority);
        }

        // Filter out expired notifications
        const now = new Date();
        userNotifications = userNotifications.filter(n => 
            !n.expiresAt || new Date(n.expiresAt) > now
        );

        // Apply pagination
        const total = userNotifications.length;
        const paginatedNotifications = userNotifications.slice(
            parseInt(offset), 
            parseInt(offset) + parseInt(limit)
        );

        // Count unread notifications
        const unreadCount = userNotifications.filter(n => n.status === 'unread').length;

        res.json({
            success: true,
            data: {
                notifications: paginatedNotifications,
                pagination: {
                    total,
                    limit: parseInt(limit),
                    offset: parseInt(offset),
                    hasMore: total > parseInt(offset) + parseInt(limit)
                },
                unreadCount
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch notifications'
        });
    }
});

// Create notification
router.post('/', (req, res) => {
    try {
        const userId = req.headers['x-user-id'] || 'default-user';
        const { templateId, variables = {}, options = {} } = req.body;

        if (!templateId) {
            return res.status(400).json({
                success: false,
                error: 'Template ID is required'
            });
        }

        const notification = createNotification(userId, templateId, variables, options);

        res.status(201).json({
            success: true,
            data: notification,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// Mark notification as read
router.patch('/:notificationId/read', (req, res) => {
    try {
        const userId = req.headers['x-user-id'] || 'default-user';
        const { notificationId } = req.params;

        const notification = notifications.find(n => 
            n.id === notificationId && n.userId === userId
        );

        if (!notification) {
            return res.status(404).json({
                success: false,
                error: 'Notification not found'
            });
        }

        notification.status = 'read';
        notification.readAt = new Date().toISOString();

        res.json({
            success: true,
            data: notification,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to mark notification as read'
        });
    }
});

// Mark all notifications as read
router.patch('/read-all', (req, res) => {
    try {
        const userId = req.headers['x-user-id'] || 'default-user';
        const now = new Date().toISOString();

        const updatedCount = notifications
            .filter(n => n.userId === userId && n.status === 'unread')
            .map(n => {
                n.status = 'read';
                n.readAt = now;
                return n;
            }).length;

        res.json({
            success: true,
            data: {
                updatedCount,
                message: `Marked ${updatedCount} notifications as read`
            },
            timestamp: now
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to mark notifications as read'
        });
    }
});

// Delete notification
router.delete('/:notificationId', (req, res) => {
    try {
        const userId = req.headers['x-user-id'] || 'default-user';
        const { notificationId } = req.params;

        const notificationIndex = notifications.findIndex(n => 
            n.id === notificationId && n.userId === userId
        );

        if (notificationIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Notification not found'
            });
        }

        notifications.splice(notificationIndex, 1);

        res.json({
            success: true,
            message: 'Notification deleted successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to delete notification'
        });
    }
});

// Get notification settings
router.get('/settings', (req, res) => {
    try {
        const userId = req.headers['x-user-id'] || 'default-user';
        
        const defaultSettings = {
            email: {
                enabled: true,
                types: ['task_completed', 'task_failed', 'payment_processed', 'system_alert'],
                frequency: 'immediate'
            },
            web: {
                enabled: true,
                types: ['all'],
                frequency: 'immediate'
            },
            sms: {
                enabled: false,
                types: ['task_failed', 'system_alert'],
                frequency: 'immediate'
            },
            push: {
                enabled: true,
                types: ['task_completed', 'task_failed', 'support_ticket_update'],
                frequency: 'immediate'
            }
        };

        const settings = userNotificationSettings.get(userId) || defaultSettings;

        res.json({
            success: true,
            data: settings,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch notification settings'
        });
    }
});

// Update notification settings
router.put('/settings', (req, res) => {
    try {
        const userId = req.headers['x-user-id'] || 'default-user';
        const settings = req.body;

        // Validate settings structure
        const validChannels = ['email', 'web', 'sms', 'push'];
        const validTypes = Array.from(notificationTemplates.keys()).concat(['all']);
        const validFrequencies = ['immediate', 'hourly', 'daily', 'weekly'];

        for (const [channel, config] of Object.entries(settings)) {
            if (!validChannels.includes(channel)) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid channel: ${channel}`
                });
            }

            if (!config.types.every(type => validTypes.includes(type))) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid notification types for ${channel}`
                });
            }

            if (!validFrequencies.includes(config.frequency)) {
                return res.status(400).json({
                    success: false,
                    error: `Invalid frequency for ${channel}`
                });
            }
        }

        userNotificationSettings.set(userId, settings);

        res.json({
            success: true,
            data: settings,
            message: 'Notification settings updated successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to update notification settings'
        });
    }
});

// Get notification templates
router.get('/templates', (req, res) => {
    try {
        const templates = Array.from(notificationTemplates.entries()).map(([id, template]) => ({
            id,
            ...template
        }));

        res.json({
            success: true,
            data: templates,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch notification templates'
        });
    }
});

// Get notification statistics
router.get('/stats', (req, res) => {
    try {
        const userId = req.headers['x-user-id'] || 'default-user';
        const userNotifications = notifications.filter(n => n.userId === userId);

        const stats = {
            total: userNotifications.length,
            unread: userNotifications.filter(n => n.status === 'unread').length,
            byType: {},
            byPriority: {},
            recentActivity: {
                last24h: 0,
                last7d: 0,
                last30d: 0
            }
        };

        const now = new Date();
        const day = 24 * 60 * 60 * 1000;

        userNotifications.forEach(notification => {
            // Count by type
            stats.byType[notification.type] = (stats.byType[notification.type] || 0) + 1;
            
            // Count by priority
            stats.byPriority[notification.priority] = (stats.byPriority[notification.priority] || 0) + 1;
            
            // Recent activity
            const notificationDate = new Date(notification.createdAt);
            const daysDiff = (now - notificationDate) / day;
            
            if (daysDiff <= 1) stats.recentActivity.last24h++;
            if (daysDiff <= 7) stats.recentActivity.last7d++;
            if (daysDiff <= 30) stats.recentActivity.last30d++;
        });

        res.json({
            success: true,
            data: stats,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch notification statistics'
        });
    }
});

// Test notification endpoint (for development)
router.post('/test', (req, res) => {
    try {
        const userId = req.headers['x-user-id'] || 'default-user';
        const { templateId = 'task_completed' } = req.body;

        const testVariables = {
            taskId: 'TASK-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
            nodeId: 'node-' + Math.floor(Math.random() * 100).toString().padStart(3, '0'),
            amount: (Math.random() * 100 + 10).toFixed(2),
            error: 'Connection timeout',
            message: 'System maintenance scheduled for tonight',
            ticketId: 'TICKET-' + Math.random().toString(36).substr(2, 8).toUpperCase()
        };

        const notification = createNotification(userId, templateId, testVariables);

        res.status(201).json({
            success: true,
            data: notification,
            message: 'Test notification created',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;