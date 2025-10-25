const express = require('express');
const { authenticate } = require('../../middleware/security');
const CacheMiddleware = require('../../middleware/cache');
const logger = require('../../utils/logger');

const router = express.Router();

// This will be initialized when the app starts
let cacheService = null;
let cacheMiddleware = null;

// Initialize services
function initializeServices(services) {
  cacheService = services.cacheService;
  if (cacheService) {
    cacheMiddleware = new CacheMiddleware(cacheService);
  }
}

/**
 * @swagger
 * /api/cache/demo:
 *   get:
 *     tags:
 *       - Cache Demo
 *     summary: Demonstrate caching functionality
 *     description: Shows how Redis caching works with different TTL values
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: ttl
 *         in: query
 *         schema:
 *           type: integer
 *           default: 60
 *         description: Cache TTL in seconds
 *       - name: key
 *         in: query
 *         schema:
 *           type: string
 *           default: demo
 *         description: Cache key suffix
 *     responses:
 *       200:
 *         description: Cached response with timing information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     cached:
 *                       type: boolean
 *                     processing_time:
 *                       type: number
 *                     cache_key:
 *                       type: string
 */
router.get('/demo', authenticate, async (req, res) => {
  const startTime = Date.now();
  const ttl = parseInt(req.query.ttl) || 60;
  const keySuffix = req.query.key || 'demo';
  const cacheKey = `demo:${req.user.id}:${keySuffix}`;

  try {
    if (!cacheService) {
      return res.json({
        success: true,
        data: {
          message: 'Cache service not available - direct response',
          timestamp: new Date().toISOString(),
          cached: false,
          processing_time: Date.now() - startTime,
          cache_key: cacheKey
        }
      });
    }

    // Try to get from cache
    const cachedData = await cacheService.redis.get(cacheKey);

    if (cachedData) {
      return res.json({
        success: true,
        data: {
          ...cachedData,
          cached: true,
          processing_time: Date.now() - startTime,
          cache_key: cacheKey
        }
      });
    }

    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 100));

    const responseData = {
      message: `Hello ${req.user.username || req.user.email}, this is a cached response!`,
      timestamp: new Date().toISOString(),
      cached: false,
      processing_time: Date.now() - startTime,
      cache_key: cacheKey,
      ttl: ttl,
      expires_at: new Date(Date.now() + ttl * 1000).toISOString()
    };

    // Store in cache
    await cacheService.redis.set(cacheKey, responseData, ttl);

    res.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    logger.error('Cache demo error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Cache demo failed'
    });
  }
});

/**
 * @swagger
 * /api/cache/demo/{key}:
 *   delete:
 *     tags:
 *       - Cache Demo
 *     summary: Clear specific cache key
 *     description: Manually invalidate a cache entry
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: key
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: Cache key suffix to invalidate
 *     responses:
 *       200:
 *         description: Cache key invalidated
 */
router.delete('/demo/:key', authenticate, async (req, res) => {
  try {
    if (!cacheService) {
      return res.json({
        success: true,
        message: 'Cache service not available'
      });
    }

    const cacheKey = `demo:${req.user.id}:${req.params.key}`;
    const deleted = await cacheService.redis.del(cacheKey);

    res.json({
      success: true,
      message: deleted ? 'Cache key invalidated' : 'Cache key not found',
      cache_key: cacheKey,
      deleted: Boolean(deleted)
    });

  } catch (error) {
    logger.error('Cache invalidation error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Cache invalidation failed'
    });
  }
});

/**
 * @swagger
 * /api/cache/nodes:
 *   get:
 *     tags:
 *       - Cache Demo
 *     summary: Get cached node list
 *     description: Demonstrate caching of database queries
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: region
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter by region
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [online, offline, busy]
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: List of nodes (cached or fresh)
 */
router.get('/nodes',
  authenticate,
  cacheMiddleware ? cacheMiddleware.cacheResponse(300) : (req, res, next) => next(),
  async (req, res) => {
    try {
      const { region, status } = req.query;
      const filters = { region, status };

      // This would normally fetch from database
      // For demo purposes, we'll simulate node data
      const simulatedNodes = [
        {
          id: 'node-001',
          name: 'GPU Node Alpha',
          region: region || 'us-west-2',
          status: status || 'online',
          specs: { gpu: 'RTX 4090', memory: '24GB' },
          last_seen: new Date().toISOString()
        },
        {
          id: 'node-002',
          name: 'GPU Node Beta',
          region: region || 'us-east-1',
          status: status || 'online',
          specs: { gpu: 'RTX 3080', memory: '16GB' },
          last_seen: new Date().toISOString()
        }
      ];

      // Add cache metadata to response
      const response = {
        success: true,
        data: {
          nodes: simulatedNodes,
          filters: filters,
          count: simulatedNodes.length,
          timestamp: new Date().toISOString(),
          cache_info: {
            ttl: 300,
            cacheable: req.method === 'GET'
          }
        }
      };

      res.json(response);

    } catch (error) {
      logger.error('Cached nodes endpoint error', { error: error.message });
      res.status(500).json({
        success: false,
        error: 'Failed to fetch nodes'
      });
    }
  }
);

/**
 * @swagger
 * /api/cache/user-data:
 *   get:
 *     tags:
 *       - Cache Demo
 *     summary: Get cached user data
 *     description: Demonstrate user-specific caching
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User data (cached for performance)
 */
router.get('/user-data', authenticate, async (req, res) => {
  try {
    if (!cacheService) {
      return res.json({
        success: true,
        data: {
          user: req.user,
          cached: false,
          message: 'Cache service not available'
        }
      });
    }

    // Use cache service for user data
    const userData = await cacheService.cached(
      `user_data:${req.user.id}`,
      async () => {
        // Simulate database fetch
        await new Promise(resolve => setTimeout(resolve, 50));
        return {
          id: req.user.id,
          email: req.user.email,
          username: req.user.username,
          role: req.user.role,
          profile: req.user.profile || {},
          stats: {
            tasks_completed: Math.floor(Math.random() * 100),
            total_spent: Math.floor(Math.random() * 1000),
            last_login: new Date().toISOString()
          },
          preferences: {
            theme: 'dark',
            notifications: true,
            auto_refresh: true
          }
        };
      },
      1800 // 30 minutes TTL
    );

    res.json({
      success: true,
      data: userData
    });

  } catch (error) {
    logger.error('User data cache error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user data'
    });
  }
});

/**
 * @swagger
 * /api/cache/stats:
 *   get:
 *     tags:
 *       - Cache Demo
 *     summary: Get cache statistics
 *     description: Show cache performance metrics
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cache statistics and health information
 */
router.get('/stats', authenticate, async (req, res) => {
  try {
    if (!cacheService) {
      return res.json({
        success: true,
        data: {
          status: 'unavailable',
          message: 'Cache service not initialized'
        }
      });
    }

    const stats = await cacheService.getStats();
    const health = await cacheService.healthCheck();

    res.json({
      success: true,
      data: {
        stats,
        health,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Cache stats error', { error: error.message });
    res.status(500).json({
      success: false,
      error: 'Failed to get cache stats'
    });
  }
});

module.exports = {
  router,
  initializeServices
};
