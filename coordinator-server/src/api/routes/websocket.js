const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const logger = require('../utils/logger');

// WebSocket manager will be injected
let wsManager = null;

/**
 * Initialize WebSocket routes with manager instance
 */
function initializeWebSocketRoutes(webSocketManager) {
  wsManager = webSocketManager;
  return router;
}

/**
 * @swagger
 * /api/websocket/stats:
 *   get:
 *     summary: Get WebSocket connection statistics
 *     tags: [WebSocket]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: WebSocket statistics retrieved successfully
 */
router.get('/stats', authenticate, (req, res) => {
  try {
    if (!wsManager) {
      return res.status(503).json({
        success: false,
        error: 'WebSocket manager not initialized'
      });
    }

    const stats = wsManager.getStats();

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error('Failed to get WebSocket stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get WebSocket statistics'
    });
  }
});

/**
 * @swagger
 * /api/websocket/broadcast:
 *   post:
 *     summary: Broadcast message to WebSocket room
 *     tags: [WebSocket]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - room
 *               - message
 *             properties:
 *               room:
 *                 type: string
 *               message:
 *                 type: object
 *     responses:
 *       200:
 *         description: Message broadcasted successfully
 */
router.post('/broadcast', authenticate, (req, res) => {
  try {
    if (!wsManager) {
      return res.status(503).json({
        success: false,
        error: 'WebSocket manager not initialized'
      });
    }

    const { room, message } = req.body;

    if (!room || !message) {
      return res.status(400).json({
        success: false,
        error: 'Room and message are required'
      });
    }

    const clientCount = wsManager.broadcastToRoom(room, {
      type: 'broadcast',
      payload: message
    });

    res.json({
      success: true,
      data: {
        room,
        clientCount,
        message: 'Message broadcasted successfully'
      }
    });

    logger.info(`Broadcasted message to room ${room}: ${clientCount} clients`);
  } catch (error) {
    logger.error('Failed to broadcast message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to broadcast message'
    });
  }
});

/**
 * @swagger
 * /api/websocket/notify-user:
 *   post:
 *     summary: Send notification to specific user
 *     tags: [WebSocket]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - notification
 *             properties:
 *               userId:
 *                 type: string
 *               notification:
 *                 type: object
 *                 properties:
 *                   title:
 *                     type: string
 *                   message:
 *                     type: string
 *                   type:
 *                     type: string
 *                     enum: [info, success, warning, error]
 *     responses:
 *       200:
 *         description: Notification sent successfully
 */
router.post('/notify-user', authenticate, (req, res) => {
  try {
    if (!wsManager) {
      return res.status(503).json({
        success: false,
        error: 'WebSocket manager not initialized'
      });
    }

    const { userId, notification } = req.body;

    if (!userId || !notification) {
      return res.status(400).json({
        success: false,
        error: 'UserId and notification are required'
      });
    }

    const sent = wsManager.sendToUser(userId, {
      type: 'notification',
      payload: {
        ...notification,
        id: `notif-${Date.now()}`,
        timestamp: Date.now()
      }
    });

    if (sent) {
      res.json({
        success: true,
        message: 'Notification sent successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'User not found or not connected'
      });
    }
  } catch (error) {
    logger.error('Failed to send user notification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send notification'
    });
  }
});

/**
 * @swagger
 * /api/websocket/rooms:
 *   get:
 *     summary: List all active WebSocket rooms
 *     tags: [WebSocket]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active rooms retrieved successfully
 */
router.get('/rooms', authenticate, (req, res) => {
  try {
    if (!wsManager) {
      return res.status(503).json({
        success: false,
        error: 'WebSocket manager not initialized'
      });
    }

    const stats = wsManager.getStats();

    res.json({
      success: true,
      data: {
        rooms: stats.rooms,
        totalRooms: stats.rooms.length,
        totalClients: stats.metrics.activeConnections
      }
    });
  } catch (error) {
    logger.error('Failed to get WebSocket rooms:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get WebSocket rooms'
    });
  }
});

/**
 * @swagger
 * /api/websocket/kick-client:
 *   post:
 *     summary: Disconnect a specific client
 *     tags: [WebSocket]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - clientId
 *             properties:
 *               clientId:
 *                 type: string
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Client disconnected successfully
 */
router.post('/kick-client', authenticate, (req, res) => {
  try {
    if (!wsManager) {
      return res.status(503).json({
        success: false,
        error: 'WebSocket manager not initialized'
      });
    }

    const { clientId, reason = 'Disconnected by admin' } = req.body;

    if (!clientId) {
      return res.status(400).json({
        success: false,
        error: 'ClientId is required'
      });
    }

    // Send disconnect message before closing
    const sent = wsManager.sendToClient(clientId, {
      type: 'disconnect',
      payload: { reason }
    });

    if (sent) {
      // Force disconnect
      const client = wsManager.clients.get(clientId);
      if (client && client.ws) {
        client.ws.close(1000, reason);
      }

      res.json({
        success: true,
        message: 'Client disconnected successfully'
      });

      logger.info(`Admin disconnected client ${clientId}: ${reason}`);
    } else {
      res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }
  } catch (error) {
    logger.error('Failed to kick client:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disconnect client'
    });
  }
});

module.exports = { router, initializeWebSocketRoutes };
