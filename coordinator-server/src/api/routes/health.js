/**
 * Health Check API Routes
 * Comprehensive system health monitoring
 */

const express = require('express');
const router = express.Router();
const db = require('../models');
const logger = require('../utils/logger');

/**
 * @swagger
 * /health:
 *   get:
 *     summary: System health check
 *     description: Returns comprehensive system health status
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: System is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: "OK"
 *                 uptime:
 *                   type: number
 *                   example: 3600
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 *                 services:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: object
 *                     redis:
 *                       type: object
 *                     nodeNetwork:
 *                       type: object
 *       503:
 *         description: System is unhealthy
 */
router.get('/health', async (req, res) => {
  const startTime = Date.now();

  try {
    const health = {
      status: 'OK',
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        rss: Math.round(process.memoryUsage().rss / 1024 / 1024)
      },
      services: {}
    };

    // Check database connection
    try {
      if (db && db.sequelize) {
        await db.sequelize.authenticate();
        health.services.database = {
          status: 'OK',
          type: 'PostgreSQL',
          responseTime: Date.now() - startTime
        };
      } else {
        // SQLite or no DB
        health.services.database = {
          status: 'OK',
          type: 'SQLite',
          responseTime: Date.now() - startTime
        };
      }
    } catch (error) {
      health.services.database = {
        status: 'ERROR',
        error: error.message,
        responseTime: Date.now() - startTime
      };
      health.status = 'DEGRADED';
    }

    // Check Redis connection (if configured)
    try {
      const redis = require('../config/redis');
      if (redis && redis.ping) {
        await redis.ping();
        health.services.redis = {
          status: 'OK',
          responseTime: Date.now() - startTime
        };
      }
    } catch (error) {
      health.services.redis = {
        status: 'ERROR',
        error: error.message,
        responseTime: Date.now() - startTime
      };
      // Redis is optional, don't mark as degraded
    }

    // Check node network status
    try {
      // Simulate node network check
      const activeNodes = await getActiveNodes();
      health.services.nodeNetwork = {
        status: activeNodes.length > 0 ? 'OK' : 'WARNING',
        activeNodes: activeNodes.length,
        totalNodes: 2, // Mock data
        responseTime: Date.now() - startTime
      };
    } catch (error) {
      health.services.nodeNetwork = {
        status: 'ERROR',
        error: error.message,
        responseTime: Date.now() - startTime
      };
      health.status = 'DEGRADED';
    }

    // Calculate total response time
    health.responseTime = Date.now() - startTime;

    // Determine overall status
    const hasErrors = Object.values(health.services).some(service => service.status === 'ERROR');
    if (hasErrors && health.status !== 'DEGRADED') {
      health.status = 'ERROR';
    }

    const statusCode = health.status === 'OK' ? 200 : 503;
    res.status(statusCode).json(health);

    // Log health check
    logger.info('Health check completed', {
      status: health.status,
      responseTime: health.responseTime,
      services: Object.keys(health.services)
    });

  } catch (error) {
    logger.error('Health check failed', { error: error.message });
    res.status(503).json({
      status: 'ERROR',
      error: 'Health check failed',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime())
    });
  }
});

/**
 * @swagger
 * /health/ready:
 *   get:
 *     summary: Readiness check
 *     description: Check if service is ready to handle requests
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is ready
 *       503:
 *         description: Service is not ready
 */
router.get('/health/ready', async (req, res) => {
  try {
    // Check critical services
    const checks = [
      checkDatabaseConnection(),
      checkRequiredEnvVars()
    ];

    const results = await Promise.allSettled(checks);
    const failures = results.filter(result => result.status === 'rejected');

    if (failures.length > 0) {
      return res.status(503).json({
        ready: false,
        failures: failures.map(f => f.reason)
      });
    }

    res.json({
      ready: true,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      ready: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /health/live:
 *   get:
 *     summary: Liveness check
 *     description: Check if service is alive (simple ping)
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is alive
 */
router.get('/health/live', (req, res) => {
  res.json({
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
  });
});

// Helper functions
async function getActiveNodes() {
  // Mock implementation - replace with real node discovery
  return [
    { id: 'node_1', status: 'online', gpu: 'RTX 4090' },
    { id: 'node_2', status: 'online', gpu: 'RTX 3090' }
  ];
}

async function checkDatabaseConnection() {
  if (db && db.sequelize) {
    await db.sequelize.authenticate();
  }
  return true;
}

async function checkRequiredEnvVars() {
  const required = ['NODE_ENV', 'PORT'];
  const missing = required.filter(env => !process.env[env]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  return true;
}

module.exports = router;
