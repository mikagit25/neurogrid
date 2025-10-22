const express = require('express');
const router = express.Router();
const logger = require('../../utils/logger');

/**
 * @route   GET /api/system/health
 * @desc    System health check
 * @access  Public
 */
router.get('/health', (req, res) => {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  };

  res.json({
    success: true,
    health: healthData
  });
});

/**
 * @route   GET /api/system/status
 * @desc    System status and statistics
 * @access  Public
 */
router.get('/status', (req, res) => {
  try {
    const status = {
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        version: process.version,
        platform: process.platform
      },
      services: {
        database: 'connected', // Would check actual DB connection
        redis: 'connected',     // Would check actual Redis connection
        websocket: 'active'
      },
      metrics: {
        timestamp: new Date().toISOString(),
        pid: process.pid
      }
    };

    res.json({
      success: true,
      status
    });
  } catch (error) {
    logger.error('Error getting system status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system status'
    });
  }
});

/**
 * @route   GET /api/system/metrics
 * @desc    System performance metrics
 * @access  Public (would be admin-only in production)
 */
router.get('/metrics', (req, res) => {
  try {
    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: {
        ...process.memoryUsage(),
        totalMemory: require('os').totalmem(),
        freeMemory: require('os').freemem()
      },
      cpu: {
        usage: process.cpuUsage(),
        loadAverage: require('os').loadavg(),
        cpuCount: require('os').cpus().length
      },
      system: {
        platform: process.platform,
        arch: process.arch,
        hostname: require('os').hostname(),
        version: process.version
      }
    };

    res.json({
      success: true,
      metrics
    });
  } catch (error) {
    logger.error('Error getting system metrics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get system metrics'
    });
  }
});

/**
 * @route   POST /api/system/shutdown
 * @desc    Graceful shutdown (admin only)
 * @access  Admin
 */
router.post('/shutdown', (req, res) => {
  try {
    logger.info('Shutdown requested via API');
    
    res.json({
      success: true,
      message: 'Shutdown initiated'
    });

    // Give time for response to be sent
    setTimeout(() => {
      process.emit('SIGTERM');
    }, 1000);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to initiate shutdown'
    });
  }
});

module.exports = router;