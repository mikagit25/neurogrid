const express = require('express');
const router = express.Router();

// Mock data storage for demo
let analyticsData = {
    metrics: {
        totalTasks: 7542,
        activeTasks: 23,
        completedTasks: 7519,
        activeNodes: 67,
        totalRevenue: 156789.45,
        successRate: 98.2,
        avgResponseTime: 245
    },
    taskHistory: [],
    nodePerformance: [],
    recentActivities: [],
    systemHealth: {
        apiResponseTime: 45,
        dbQueryTime: 12,
        uptime: 99.94,
        memoryUsage: 67.8,
        cpuUsage: 34.2
    }
};

// Initialize mock data
initializeMockData();

function initializeMockData() {
    // Generate task history for last 24 hours
    const now = new Date();
    for (let i = 23; i >= 0; i--) {
        const hour = new Date(now);
        hour.setHours(hour.getHours() - i);
        analyticsData.taskHistory.push({
            timestamp: hour.toISOString(),
            hour: hour.getHours(),
            tasks: Math.floor(Math.random() * 50) + 10,
            completions: Math.floor(Math.random() * 45) + 5,
            failures: Math.floor(Math.random() * 5),
            avgDuration: Math.floor(Math.random() * 300) + 60
        });
    }

    // Generate node performance data
    for (let i = 1; i <= 10; i++) {
        analyticsData.nodePerformance.push({
            nodeId: `node-${i.toString().padStart(3, '0')}`,
            tasksCompleted: Math.floor(Math.random() * 1000) + 100,
            successRate: 0.85 + Math.random() * 0.14,
            avgResponseTime: Math.floor(Math.random() * 500) + 100,
            earnings: Math.floor(Math.random() * 1000) + 100,
            uptime: 0.95 + Math.random() * 0.05,
            lastSeen: new Date(now - Math.random() * 3600000).toISOString()
        });
    }

    // Generate recent activities
    const activityTypes = [
        { type: 'task_completed', icon: '✅', message: 'Task {taskId} completed successfully' },
        { type: 'node_joined', icon: '🔗', message: 'New node {nodeId} joined the network' },
        { type: 'payment_processed', icon: '💰', message: 'Payment of {amount} NGT processed' },
        { type: 'task_started', icon: '⏳', message: 'Task {taskId} started processing' },
        { type: 'node_offline', icon: '⚠️', message: 'Node {nodeId} went offline' },
        { type: 'system_alert', icon: '🚨', message: 'System alert: {message}' }
    ];

    for (let i = 0; i < 20; i++) {
        const activityType = activityTypes[Math.floor(Math.random() * activityTypes.length)];
        const minutesAgo = Math.floor(Math.random() * 120) + 1;
        const timestamp = new Date(now - minutesAgo * 60000);
        
        let message = activityType.message;
        message = message.replace('{taskId}', `TASK-${Math.floor(Math.random() * 999999).toString().padStart(6, '0')}`);
        message = message.replace('{nodeId}', `node-${Math.floor(Math.random() * 200).toString().padStart(3, '0')}`);
        message = message.replace('{amount}', (Math.random() * 100 + 10).toFixed(1));
        message = message.replace('{message}', 'High memory usage detected');

        analyticsData.recentActivities.push({
            id: `activity-${i}`,
            type: activityType.type,
            icon: activityType.icon,
            message: message,
            timestamp: timestamp.toISOString(),
            timeAgo: formatTimeAgo(minutesAgo)
        });
    }

    // Sort activities by timestamp (newest first)
    analyticsData.recentActivities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function formatTimeAgo(minutes) {
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
}

// Get key metrics
router.get('/metrics', (req, res) => {
    try {
        // Add some real-time variation to metrics
        const metrics = {
            ...analyticsData.metrics,
            totalTasks: analyticsData.metrics.totalTasks + Math.floor(Math.random() * 10),
            activeTasks: Math.floor(Math.random() * 50) + 5,
            activeNodes: analyticsData.metrics.activeNodes + Math.floor(Math.random() * 10) - 5,
            successRate: Math.min(99.9, analyticsData.metrics.successRate + (Math.random() - 0.5) * 2),
            avgResponseTime: Math.max(50, analyticsData.metrics.avgResponseTime + Math.floor((Math.random() - 0.5) * 100))
        };

        res.json({
            success: true,
            data: metrics,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch metrics'
        });
    }
});

// Get task history
router.get('/tasks/history', (req, res) => {
    try {
        const { timeRange = '24h', granularity = 'hourly' } = req.query;
        
        let filteredData = [...analyticsData.taskHistory];
        
        // Filter by time range
        const now = new Date();
        let cutoffTime;
        
        switch (timeRange) {
            case '1h':
                cutoffTime = new Date(now - 3600000);
                break;
            case '24h':
                cutoffTime = new Date(now - 86400000);
                break;
            case '7d':
                cutoffTime = new Date(now - 7 * 86400000);
                break;
            case '30d':
                cutoffTime = new Date(now - 30 * 86400000);
                break;
            default:
                cutoffTime = new Date(now - 86400000);
        }

        filteredData = filteredData.filter(item => new Date(item.timestamp) >= cutoffTime);

        res.json({
            success: true,
            data: filteredData,
            timeRange,
            granularity,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch task history'
        });
    }
});

// Get node performance data
router.get('/nodes/performance', (req, res) => {
    try {
        const { sortBy = 'tasksCompleted', limit = 10 } = req.query;
        
        let sortedNodes = [...analyticsData.nodePerformance];
        
        // Sort by specified field
        sortedNodes.sort((a, b) => {
            if (sortBy === 'successRate' || sortBy === 'uptime') {
                return b[sortBy] - a[sortBy];
            }
            return b[sortBy] - a[sortBy];
        });

        // Apply limit
        if (limit) {
            sortedNodes = sortedNodes.slice(0, parseInt(limit));
        }

        res.json({
            success: true,
            data: sortedNodes,
            sortBy,
            limit: parseInt(limit),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch node performance data'
        });
    }
});

// Get recent activities
router.get('/activities', (req, res) => {
    try {
        const { limit = 20, type } = req.query;
        
        let activities = [...analyticsData.recentActivities];
        
        // Filter by type if specified
        if (type) {
            activities = activities.filter(activity => activity.type === type);
        }

        // Apply limit
        if (limit) {
            activities = activities.slice(0, parseInt(limit));
        }

        // Update time ago for real-time display
        activities = activities.map(activity => ({
            ...activity,
            timeAgo: formatTimeAgo(Math.floor((Date.now() - new Date(activity.timestamp)) / 60000))
        }));

        res.json({
            success: true,
            data: activities,
            limit: parseInt(limit),
            type: type || 'all',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch recent activities'
        });
    }
});

// Get system health
router.get('/health', (req, res) => {
    try {
        // Simulate real-time system health data
        const health = {
            ...analyticsData.systemHealth,
            apiResponseTime: Math.max(20, analyticsData.systemHealth.apiResponseTime + Math.floor((Math.random() - 0.5) * 30)),
            dbQueryTime: Math.max(5, analyticsData.systemHealth.dbQueryTime + Math.floor((Math.random() - 0.5) * 10)),
            memoryUsage: Math.min(95, Math.max(30, analyticsData.systemHealth.memoryUsage + (Math.random() - 0.5) * 10)),
            cpuUsage: Math.min(95, Math.max(5, analyticsData.systemHealth.cpuUsage + (Math.random() - 0.5) * 20)),
            uptime: Math.min(100, analyticsData.systemHealth.uptime + (Math.random() - 0.5) * 0.1)
        };

        // Determine health status
        let status = 'healthy';
        if (health.memoryUsage > 85 || health.cpuUsage > 80 || health.uptime < 99) {
            status = 'warning';
        }
        if (health.memoryUsage > 95 || health.cpuUsage > 90 || health.uptime < 95) {
            status = 'critical';
        }

        res.json({
            success: true,
            data: {
                ...health,
                status,
                checks: {
                    api: health.apiResponseTime < 100 ? 'pass' : 'fail',
                    database: health.dbQueryTime < 50 ? 'pass' : 'fail',
                    memory: health.memoryUsage < 90 ? 'pass' : 'fail',
                    cpu: health.cpuUsage < 85 ? 'pass' : 'fail',
                    uptime: health.uptime > 99 ? 'pass' : 'fail'
                }
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch system health'
        });
    }
});

// Get comprehensive dashboard data
router.get('/dashboard', (req, res) => {
    try {
        const { timeRange = '24h' } = req.query;
        
        // Get metrics
        const metrics = {
            ...analyticsData.metrics,
            totalTasks: analyticsData.metrics.totalTasks + Math.floor(Math.random() * 10),
            activeTasks: Math.floor(Math.random() * 50) + 5,
            activeNodes: analyticsData.metrics.activeNodes + Math.floor(Math.random() * 10) - 5
        };

        // Get task history
        const now = new Date();
        let cutoffTime = new Date(now - 86400000); // Default 24h
        
        switch (timeRange) {
            case '1h':
                cutoffTime = new Date(now - 3600000);
                break;
            case '7d':
                cutoffTime = new Date(now - 7 * 86400000);
                break;
            case '30d':
                cutoffTime = new Date(now - 30 * 86400000);
                break;
        }

        const taskHistory = analyticsData.taskHistory.filter(
            item => new Date(item.timestamp) >= cutoffTime
        );

        // Get top nodes
        const topNodes = analyticsData.nodePerformance
            .sort((a, b) => b.tasksCompleted - a.tasksCompleted)
            .slice(0, 5);

        // Get recent activities
        const recentActivities = analyticsData.recentActivities
            .slice(0, 10)
            .map(activity => ({
                ...activity,
                timeAgo: formatTimeAgo(Math.floor((Date.now() - new Date(activity.timestamp)) / 60000))
            }));

        // Get system health
        const systemHealth = {
            ...analyticsData.systemHealth,
            status: 'healthy',
            apiResponseTime: Math.max(20, analyticsData.systemHealth.apiResponseTime + Math.floor((Math.random() - 0.5) * 30))
        };

        res.json({
            success: true,
            data: {
                metrics,
                taskHistory,
                topNodes,
                recentActivities,
                systemHealth
            },
            timeRange,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to fetch dashboard data'
        });
    }
});

// Simulate adding new data (for real-time updates)
router.post('/simulate', (req, res) => {
    try {
        const { type, count = 1 } = req.body;
        
        switch (type) {
            case 'task_completed':
                analyticsData.metrics.completedTasks += count;
                analyticsData.metrics.totalTasks += count;
                
                // Add to recent activities
                for (let i = 0; i < count; i++) {
                    const taskId = `TASK-${Math.floor(Math.random() * 999999).toString().padStart(6, '0')}`;
                    analyticsData.recentActivities.unshift({
                        id: `activity-${Date.now()}-${i}`,
                        type: 'task_completed',
                        icon: '✅',
                        message: `Task ${taskId} completed successfully`,
                        timestamp: new Date().toISOString(),
                        timeAgo: 'Just now'
                    });
                }
                break;
                
            case 'node_joined':
                analyticsData.metrics.activeNodes += count;
                
                for (let i = 0; i < count; i++) {
                    const nodeId = `node-${Math.floor(Math.random() * 999).toString().padStart(3, '0')}`;
                    analyticsData.recentActivities.unshift({
                        id: `activity-${Date.now()}-${i}`,
                        type: 'node_joined',
                        icon: '🔗',
                        message: `New node ${nodeId} joined the network`,
                        timestamp: new Date().toISOString(),
                        timeAgo: 'Just now'
                    });
                }
                break;
        }

        // Keep only last 50 activities
        analyticsData.recentActivities = analyticsData.recentActivities.slice(0, 50);

        res.json({
            success: true,
            message: `Simulated ${count} ${type} event(s)`,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: 'Failed to simulate data'
        });
    }
});

module.exports = router;