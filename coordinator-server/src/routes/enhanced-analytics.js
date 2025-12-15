const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const logger = require('../utils/logger');

// Real-time metrics storage (in production would use Redis)
const realtimeMetrics = new Map();
const websocketClients = new Map();

/**
 * @swagger
 * /api/v2/analytics/realtime/nodes:
 *   get:
 *     summary: Get real-time node metrics
 *     tags: [Real-time Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Real-time node metrics retrieved successfully
 */
router.get('/realtime/nodes', authenticate, async (req, res) => {
  try {
    const nodes = Array.from(realtimeMetrics.values())
      .filter(metric => metric.type === 'node' && metric.timestamp > Date.now() - 60000)
      .map(metric => ({
        nodeId: metric.nodeId,
        status: metric.data.status,
        cpuUsage: metric.data.cpuUsage,
        memoryUsage: metric.data.memoryUsage,
        vramUsage: metric.data.vramUsage,
        temperature: metric.data.temperature,
        activeTasks: metric.data.activeTasks,
        reputation: metric.data.reputation,
        lastUpdate: metric.timestamp
      }));

    res.json({
      success: true,
      data: {
        nodes,
        totalNodes: nodes.length,
        onlineNodes: nodes.filter(n => n.status === 'online').length,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    logger.error('Failed to get real-time node metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get real-time node metrics'
    });
  }
});

/**
 * @swagger
 * /api/v2/analytics/realtime/network:
 *   get:
 *     summary: Get real-time network metrics
 *     tags: [Real-time Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Real-time network metrics retrieved successfully
 */
router.get('/realtime/network', authenticate, async (req, res) => {
  try {
    const now = Date.now();
    const recentMetrics = Array.from(realtimeMetrics.values())
      .filter(metric => metric.timestamp > now - 300000); // Last 5 minutes

    const networkMetrics = {
      totalNodes: recentMetrics.filter(m => m.type === 'node').length,
      activeNodes: recentMetrics.filter(m => m.type === 'node' && m.data.status === 'online').length,
      totalTasks: recentMetrics.reduce((sum, m) => sum + (m.data.activeTasks || 0), 0),
      networkLoad: calculateNetworkLoad(recentMetrics),
      avgResponseTime: calculateAvgResponseTime(recentMetrics),
      throughput: calculateThroughput(recentMetrics),
      errorRate: calculateErrorRate(recentMetrics),
      timestamp: now
    };

    res.json({
      success: true,
      data: networkMetrics
    });
  } catch (error) {
    logger.error('Failed to get real-time network metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get real-time network metrics'
    });
  }
});

/**
 * @swagger
 * /api/v2/analytics/alerts:
 *   get:
 *     summary: Get system alerts and warnings
 *     tags: [Real-time Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: System alerts retrieved successfully
 */
router.get('/alerts', authenticate, async (req, res) => {
  try {
    const alerts = generateSystemAlerts();

    res.json({
      success: true,
      data: {
        alerts,
        count: alerts.length,
        critical: alerts.filter(a => a.severity === 'critical').length,
        warning: alerts.filter(a => a.severity === 'warning').length,
        info: alerts.filter(a => a.severity === 'info').length
      }
    });
  } catch (error) {
    logger.error('Failed to get system alerts:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system alerts'
    });
  }
});

/**
 * @swagger
 * /api/v2/analytics/performance/network:
 *   get:
 *     summary: Get network performance analytics
 *     tags: [Performance Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [1h, 24h, 7d, 30d]
 *           default: 24h
 *         description: Time range for performance data
 *     responses:
 *       200:
 *         description: Network performance data retrieved successfully
 */
router.get('/performance/network', authenticate, async (req, res) => {
  try {
    const timeRange = req.query.timeRange || '24h';
    const timeRangeMs = parseTimeRange(timeRange);
    
    const performanceData = await generateNetworkPerformanceData(timeRangeMs);

    res.json({
      success: true,
      data: performanceData
    });
  } catch (error) {
    logger.error('Failed to get network performance data:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get network performance data'
    });
  }
});

/**
 * @swagger
 * /api/v2/analytics/performance/nodes:
 *   get:
 *     summary: Get top performing nodes
 *     tags: [Performance Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of top nodes to return
 *       - in: query
 *         name: metric
 *         schema:
 *           type: string
 *           enum: [performance, earnings, reputation, uptime]
 *           default: performance
 *         description: Metric to sort by
 *     responses:
 *       200:
 *         description: Top performing nodes retrieved successfully
 */
router.get('/performance/nodes', authenticate, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const metric = req.query.metric || 'performance';

    const topNodes = await getTopPerformingNodes(limit, metric);

    res.json({
      success: true,
      data: {
        nodes: topNodes,
        sortedBy: metric,
        timestamp: Date.now()
      }
    });
  } catch (error) {
    logger.error('Failed to get top performing nodes:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get top performing nodes'
    });
  }
});

/**
 * @swagger
 * /api/v2/analytics/usage/statistics:
 *   get:
 *     summary: Get detailed usage statistics
 *     tags: [Usage Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Usage statistics retrieved successfully
 */
router.get('/usage/statistics', authenticate, async (req, res) => {
  try {
    const statistics = await generateUsageStatistics();

    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    logger.error('Failed to get usage statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get usage statistics'
    });
  }
});

/**
 * @swagger
 * /api/v2/analytics/metrics/submit:
 *   post:
 *     summary: Submit real-time metrics
 *     tags: [Real-time Analytics]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - nodeId
 *               - metrics
 *             properties:
 *               nodeId:
 *                 type: string
 *               metrics:
 *                 type: object
 *     responses:
 *       201:
 *         description: Metrics submitted successfully
 */
router.post('/metrics/submit', authenticate, async (req, res) => {
  try {
    const { nodeId, metrics } = req.body;
    
    if (!nodeId || !metrics) {
      return res.status(400).json({
        success: false,
        error: 'Missing nodeId or metrics'
      });
    }

    const metricEntry = {
      nodeId,
      type: 'node',
      data: metrics,
      timestamp: Date.now()
    };

    realtimeMetrics.set(`${nodeId}-${Date.now()}`, metricEntry);

    // Clean up old metrics (keep last hour)
    cleanupOldMetrics();

    // Broadcast to WebSocket clients
    broadcastMetrics(metricEntry);

    res.status(201).json({
      success: true,
      message: 'Metrics submitted successfully'
    });
  } catch (error) {
    logger.error('Failed to submit metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to submit metrics'
    });
  }
});

// Helper functions
function calculateNetworkLoad(metrics) {
  const nodeMetrics = metrics.filter(m => m.type === 'node');
  if (nodeMetrics.length === 0) return 0;
  
  const totalCpu = nodeMetrics.reduce((sum, m) => sum + (m.data.cpuUsage || 0), 0);
  return totalCpu / nodeMetrics.length;
}

function calculateAvgResponseTime(metrics) {
  const responseTimes = metrics
    .map(m => m.data.responseTime)
    .filter(rt => rt !== undefined);
  
  if (responseTimes.length === 0) return 0;
  return responseTimes.reduce((sum, rt) => sum + rt, 0) / responseTimes.length;
}

function calculateThroughput(metrics) {
  const taskCounts = metrics
    .map(m => m.data.completedTasks || 0)
    .reduce((sum, count) => sum + count, 0);
  
  return taskCounts;
}

function calculateErrorRate(metrics) {
  const totalTasks = metrics.reduce((sum, m) => sum + (m.data.totalTasks || 0), 0);
  const failedTasks = metrics.reduce((sum, m) => sum + (m.data.failedTasks || 0), 0);
  
  if (totalTasks === 0) return 0;
  return (failedTasks / totalTasks) * 100;
}

function generateSystemAlerts() {
  const alerts = [];
  const now = Date.now();
  
  // Check for high CPU usage
  const recentNodes = Array.from(realtimeMetrics.values())
    .filter(m => m.type === 'node' && m.timestamp > now - 60000);
  
  const highCpuNodes = recentNodes.filter(m => m.data.cpuUsage > 90);
  if (highCpuNodes.length > 0) {
    alerts.push({
      id: `high-cpu-${now}`,
      type: 'performance',
      severity: 'warning',
      message: `${highCpuNodes.length} nodes reporting high CPU usage (>90%)`,
      timestamp: now,
      nodes: highCpuNodes.map(n => n.nodeId)
    });
  }

  // Check for offline nodes
  const offlineNodes = recentNodes.filter(m => m.data.status !== 'online');
  if (offlineNodes.length > 5) {
    alerts.push({
      id: `offline-nodes-${now}`,
      type: 'availability',
      severity: 'critical',
      message: `${offlineNodes.length} nodes are offline`,
      timestamp: now,
      nodes: offlineNodes.map(n => n.nodeId)
    });
  }

  return alerts;
}

function parseTimeRange(timeRange) {
  const ranges = {
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000
  };
  
  return ranges[timeRange] || ranges['24h'];
}

async function generateNetworkPerformanceData(timeRangeMs) {
  const now = Date.now();
  const startTime = now - timeRangeMs;
  
  // Generate mock performance data (in production, query from database)
  const intervals = 20;
  const intervalSize = timeRangeMs / intervals;
  
  const performanceData = [];
  for (let i = 0; i < intervals; i++) {
    const timestamp = startTime + (i * intervalSize);
    performanceData.push({
      timestamp,
      activeNodes: Math.floor(Math.random() * 50) + 10,
      totalTasks: Math.floor(Math.random() * 1000) + 500,
      avgResponseTime: Math.floor(Math.random() * 200) + 50,
      throughput: Math.floor(Math.random() * 100) + 20,
      errorRate: Math.random() * 5
    });
  }
  
  return {
    data: performanceData,
    timeRange: timeRangeMs,
    intervals
  };
}

async function getTopPerformingNodes(limit, metric) {
  const nodeData = Array.from(realtimeMetrics.values())
    .filter(m => m.type === 'node')
    .reduce((acc, m) => {
      if (!acc[m.nodeId]) {
        acc[m.nodeId] = {
          nodeId: m.nodeId,
          performance: 0,
          earnings: 0,
          reputation: 0,
          uptime: 0,
          lastUpdate: 0
        };
      }
      
      // Use the most recent data for each node
      if (m.timestamp > acc[m.nodeId].lastUpdate) {
        acc[m.nodeId] = {
          ...acc[m.nodeId],
          performance: m.data.performance || Math.random() * 100,
          earnings: m.data.earnings || Math.random() * 1000,
          reputation: m.data.reputation || Math.random() * 5,
          uptime: m.data.uptime || Math.random() * 100,
          lastUpdate: m.timestamp
        };
      }
      
      return acc;
    }, {});

  return Object.values(nodeData)
    .sort((a, b) => b[metric] - a[metric])
    .slice(0, limit);
}

async function generateUsageStatistics() {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  
  return {
    daily: {
      tasksCompleted: Math.floor(Math.random() * 5000) + 1000,
      averageTaskDuration: Math.floor(Math.random() * 300) + 60,
      uniqueUsers: Math.floor(Math.random() * 200) + 50,
      totalEarnings: Math.floor(Math.random() * 10000) + 2000
    },
    weekly: {
      tasksCompleted: Math.floor(Math.random() * 30000) + 10000,
      averageTaskDuration: Math.floor(Math.random() * 350) + 80,
      uniqueUsers: Math.floor(Math.random() * 1000) + 300,
      totalEarnings: Math.floor(Math.random() * 50000) + 15000
    },
    monthly: {
      tasksCompleted: Math.floor(Math.random() * 100000) + 50000,
      averageTaskDuration: Math.floor(Math.random() * 400) + 100,
      uniqueUsers: Math.floor(Math.random() * 5000) + 1000,
      totalEarnings: Math.floor(Math.random() * 200000) + 80000
    },
    timestamp: now
  };
}

function cleanupOldMetrics() {
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  
  for (const [key, metric] of realtimeMetrics) {
    if (metric.timestamp < oneHourAgo) {
      realtimeMetrics.delete(key);
    }
  }
}

function broadcastMetrics(metricEntry) {
  // This would integrate with WebSocket manager in real implementation
  logger.info(`Broadcasting metrics for node ${metricEntry.nodeId}`);
}

module.exports = router;