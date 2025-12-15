const WebSocket = require('ws');
const EventEmitter = require('events');
const { AuthenticationManagerSingleton } = require('../security/AuthenticationManager');
const logger = require('../utils/logger');

// Create authentication manager instance
const authManager = AuthenticationManagerSingleton.getInstance();

class WebSocketManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.port = options.port || 8080;
    this.jwtSecret = options.jwtSecret || process.env.JWT_SECRET || 'fallback-secret';
    this.pingInterval = options.pingInterval || 30000; // 30 seconds
    this.maxConnections = options.maxConnections || 1000;

    // Connection pools by type
    this.connections = {
      nodes: new Map(),      // nodeId -> connection
      users: new Map(),      // userId -> connection
      admins: new Map(),     // sessionId -> connection
      anonymous: new Map()   // connectionId -> connection
    };

    // Message routing
    this.rooms = new Map();  // roomName -> Set of connectionIds
    this.subscribers = new Map(); // topic -> Set of connectionIds

    // Legacy compatibility
    this.clients = new Map(); // userId -> Set of WebSocket connections
    this.subscriptions = new Map(); // connectionId -> Set of subscriptions
    this.channels = new Map(); // channel -> Set of connectionIds

    this.wss = null;
    this.server = null;
    this.heartbeatInterval = null;
    this.pingTimer = null;

    // Enhanced statistics
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      messagesSent: 0,
      messagesReceived: 0,
      errors: 0,
      startTime: new Date(),
      byType: {
        nodes: 0,
        users: 0,
        admins: 0,
        anonymous: 0
      }
    };

    logger.info('Enhanced WebSocket Manager initialized', {
      port: this.port,
      maxConnections: this.maxConnections
    });
  }

  initialize(server) {
    try {
      this.server = server;

      // Create WebSocket server
      this.wss = new WebSocket.Server({
        server: server,
        path: '/ws',
        verifyClient: this.verifyClient.bind(this),
        maxPayload: 1024 * 1024 // 1MB max message size
      });

      this.wss.on('connection', this.handleConnection.bind(this));
      this.wss.on('error', this.handleServerError.bind(this));

      // Start periodic ping to keep connections alive
      this.startHeartbeat();
      this.startPingInterval();

      logger.info('Enhanced WebSocket server initialized', {
        path: '/ws',
        maxPayload: '1MB',
        maxConnections: this.maxConnections
      });

      return this;
    } catch (error) {
      logger.error('Failed to initialize WebSocket server', { error: error.message });
      throw error;
    }
  }

  verifyClient(info) {
    try {
      // Check connection limits
      if (this.stats.activeConnections >= this.maxConnections) {
        logger.warn('WebSocket connection rejected: max connections reached', {
          current: this.stats.activeConnections,
          max: this.maxConnections
        });
        return false;
      }

      // Basic origin check (can be enhanced based on requirements)
      const origin = info.origin;
      if (process.env.NODE_ENV === 'production' && origin) {
        const allowedOrigins = [
          'https://neurogrid.ai',
          'https://app.neurogrid.ai',
          'https://admin.neurogrid.ai'
        ];

        if (!allowedOrigins.includes(origin)) {
          logger.warn('WebSocket connection rejected: invalid origin', { origin });
          return false;
        }
      }

      return true;
    } catch (error) {
      logger.error('Error verifying WebSocket client', { error: error.message });
      return false;
    }
  }

  handleConnection(ws, request) {
    const connectionId = this.generateConnectionId();
    const clientIP = request.socket.remoteAddress;
    const userAgent = request.headers['user-agent'];

    // Initialize connection metadata
    ws.connectionId = connectionId;
    ws.connectedAt = new Date();
    ws.isAlive = true;
    ws.clientIP = clientIP;
    ws.userAgent = userAgent;
    ws.type = 'anonymous';
    ws.authenticated = false;
    ws.subscriptions = new Set(); // Legacy compatibility
    ws.userId = null; // Legacy compatibility

    // Update statistics
    this.stats.totalConnections++;
    this.stats.activeConnections++;
    this.stats.byType.anonymous++;

    logger.info('New WebSocket connection', {
      connectionId,
      clientIP,
      userAgent,
      activeConnections: this.stats.activeConnections
    });

    // Add to anonymous connections initially
    this.connections.anonymous.set(connectionId, ws);

    // Set up event handlers
    ws.on('message', (data) => this.handleMessage(ws, data));
    ws.on('close', (code, reason) => this.handleDisconnection(ws, code, reason));
    ws.on('error', (error) => this.handleConnectionError(ws, error));
    ws.on('pong', () => { ws.isAlive = true; });

    // Send welcome message
    this.sendToConnection(ws, {
      type: 'welcome',
      connectionId: connectionId,
      timestamp: new Date().toISOString(),
      serverVersion: '1.0.0'
    });

    this.emit('connection', { connectionId, ws, clientIP });

    // Set up pong handler for heartbeat
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Send welcome message
    this.sendToConnection(connectionId, {
      type: 'connected',
      data: {
        connectionId,
        timestamp: new Date().toISOString(),
        serverVersion: process.env.npm_package_version || '1.0.0'
      }
    });
  }

  handleMessage(ws, message) {
    try {
      const data = JSON.parse(message);
      this.stats.messagesReceived++;

      logger.debug('WebSocket message received', {
        connectionId: ws.connectionId,
        type: data.type,
        userId: ws.userId
      });

      switch (data.type) {
      case 'authenticate':
        this.handleAuthentication(ws, data);
        break;
      case 'subscribe':
        this.handleSubscription(ws, data);
        break;
      case 'unsubscribe':
        this.handleUnsubscription(ws, data);
        break;
      case 'ping':
        this.handlePing(ws, data);
        break;
      case 'node_register':
        this.handleNodeRegister(ws, data);
        break;
      case 'node_heartbeat':
        this.handleNodeHeartbeat(ws, data);
        break;
      case 'task_result':
        this.handleTaskResult(ws, data);
        break;
      default:
        this.sendError(ws, 'Unknown message type', 'UNKNOWN_MESSAGE_TYPE');
      }
    } catch (error) {
      logger.error('WebSocket message parsing error', {
        connectionId: ws.connectionId,
        error: error.message,
        message: message.toString()
      });
      this.sendError(ws, 'Invalid message format', 'INVALID_MESSAGE_FORMAT');
    }
  }

  handleAuthentication(ws, data) {
    try {
      const { token, apiKey } = data.payload || {};
      let user = null;

      // Try API key authentication
      if (apiKey && apiKey.startsWith('ng_')) {
        user = authManager.validateApiKey(apiKey);
      }

      // Try JWT authentication
      if (!user && token) {
        try {
          const decoded = authManager.verifyToken(token);
          user = authManager.getUserById(decoded.id);
        } catch (error) {
          this.sendError(ws, 'Invalid token', 'INVALID_TOKEN');
          return;
        }
      }

      if (!user) {
        this.sendError(ws, 'Authentication failed', 'AUTH_FAILED');
        return;
      }

      if (!user.isActive) {
        this.sendError(ws, 'Account deactivated', 'ACCOUNT_DEACTIVATED');
        return;
      }

      // Set user info
      ws.userId = user.id;
      ws.userRole = user.role;

      // Add to user connections
      if (!this.clients.has(user.id)) {
        this.clients.set(user.id, new Set());
      }
      this.clients.get(user.id).add(ws);

      logger.info('WebSocket user authenticated', {
        connectionId: ws.connectionId,
        userId: user.id,
        role: user.role
      });

      this.sendToConnection(ws.connectionId, {
        type: 'authenticated',
        data: {
          userId: user.id,
          role: user.role,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('WebSocket authentication error', {
        connectionId: ws.connectionId,
        error: error.message
      });
      this.sendError(ws, 'Authentication error', 'AUTH_ERROR');
    }
  }

  handleSubscription(ws, data) {
    const { channels = [] } = data.payload || {};

    channels.forEach(channel => {
      // Validate channel access
      if (!this.canAccessChannel(ws, channel)) {
        this.sendError(ws, `Access denied to channel: ${channel}`, 'CHANNEL_ACCESS_DENIED');
        return;
      }

      // Add to subscriptions
      ws.subscriptions.add(channel);

      if (!this.subscriptions.has(ws.connectionId)) {
        this.subscriptions.set(ws.connectionId, new Set());
      }
      this.subscriptions.get(ws.connectionId).add(channel);

      // Add to channel
      if (!this.channels.has(channel)) {
        this.channels.set(channel, new Set());
      }
      this.channels.get(channel).add(ws.connectionId);
    });

    logger.info('WebSocket subscriptions updated', {
      connectionId: ws.connectionId,
      userId: ws.userId,
      channels: Array.from(ws.subscriptions)
    });

    this.sendToConnection(ws.connectionId, {
      type: 'subscribed',
      data: {
        channels: Array.from(ws.subscriptions),
        timestamp: new Date().toISOString()
      }
    });
  }

  handleUnsubscription(ws, data) {
    const { channels = [] } = data.payload || {};

    channels.forEach(channel => {
      ws.subscriptions.delete(channel);

      if (this.subscriptions.has(ws.connectionId)) {
        this.subscriptions.get(ws.connectionId).delete(channel);
      }

      if (this.channels.has(channel)) {
        this.channels.get(channel).delete(ws.connectionId);
      }
    });

    this.sendToConnection(ws.connectionId, {
      type: 'unsubscribed',
      data: {
        channels,
        timestamp: new Date().toISOString()
      }
    });
  }

  handlePing(ws, data) {
    this.sendToConnection(ws.connectionId, {
      type: 'pong',
      data: {
        timestamp: new Date().toISOString(),
        original: data.payload
      }
    });
  }

  handleNodeRegister(ws, data) {
    // Handle node registration
    logger.info('Node registration via WebSocket', {
      connectionId: ws.connectionId,
      nodeData: data.payload
    });

    // Forward to node manager (implement as needed)
    this.broadcast('node_events', {
      type: 'node_registered',
      data: data.payload
    });
  }

  handleNodeHeartbeat(ws, data) {
    // Handle node heartbeat
    logger.debug('Node heartbeat via WebSocket', {
      connectionId: ws.connectionId,
      nodeId: data.payload?.nodeId
    });
  }

  handleTaskResult(ws, data) {
    // Handle task result
    logger.info('Task result via WebSocket', {
      connectionId: ws.connectionId,
      taskId: data.payload?.taskId
    });

    // Broadcast task completion
    this.broadcast('task_events', {
      type: 'task_completed',
      data: data.payload
    });
  }

  handleDisconnection(ws, code, reason) {
    this.stats.activeConnections--;

    logger.info('WebSocket connection closed', {
      connectionId: ws.connectionId,
      userId: ws.userId,
      code,
      reason: reason?.toString(),
      duration: Date.now() - ws.connectedAt.getTime()
    });

    // Remove from user connections
    if (ws.userId && this.clients.has(ws.userId)) {
      const userConnections = this.clients.get(ws.userId);
      userConnections.delete(ws);

      if (userConnections.size === 0) {
        this.clients.delete(ws.userId);
      }
    }

    // Clean up subscriptions
    if (this.subscriptions.has(ws.connectionId)) {
      const userSubscriptions = this.subscriptions.get(ws.connectionId);
      userSubscriptions.forEach(channel => {
        if (this.channels.has(channel)) {
          this.channels.get(channel).delete(ws.connectionId);
        }
      });
      this.subscriptions.delete(ws.connectionId);
    }
  }

  canAccessChannel(ws, channel) {
    // Basic channel access control
    const publicChannels = ['system', 'announcements'];
    const userChannels = ['notifications', 'task_events'];
    const adminChannels = ['admin', 'system_events', 'security'];

    if (publicChannels.includes(channel)) {
      return true;
    }

    if (!ws.userId) {
      return false;
    }

    if (userChannels.includes(channel)) {
      return true;
    }

    if (adminChannels.includes(channel) && ws.userRole === 'admin') {
      return true;
    }

    // User-specific channels
    if (channel.startsWith(`user:${ws.userId}`)) {
      return true;
    }

    return false;
  }

  // Messaging methods
  sendToConnection(connectionIdOrWs, message) {
    try {
      let ws;

      if (typeof connectionIdOrWs === 'string') {
        // Find connection by ID
        for (const userConnections of this.clients.values()) {
          for (const connection of userConnections) {
            if (connection.connectionId === connectionIdOrWs) {
              ws = connection;
              break;
            }
          }
          if (ws) break;
        }
      } else {
        ws = connectionIdOrWs;
      }

      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
        this.stats.messagesSent++;
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to send WebSocket message', {
        error: error.message,
        connectionId: connectionIdOrWs.connectionId || connectionIdOrWs
      });
      return false;
    }
  }

  sendToUser(userId, message) {
    if (!this.clients.has(userId)) {
      return 0;
    }

    const userConnections = this.clients.get(userId);
    let sent = 0;

    userConnections.forEach(ws => {
      if (this.sendToConnection(ws, message)) {
        sent++;
      }
    });

    return sent;
  }

  broadcast(channel, message) {
    if (!this.channels.has(channel)) {
      return 0;
    }

    const channelConnections = this.channels.get(channel);
    let sent = 0;

    channelConnections.forEach(connectionId => {
      if (this.sendToConnection(connectionId, {
        type: 'broadcast',
        channel,
        data: message,
        timestamp: new Date().toISOString()
      })) {
        sent++;
      }
    });

    logger.debug('Broadcast sent', { channel, recipients: sent });
    return sent;
  }

  sendError(ws, message, code = 'WEBSOCKET_ERROR') {
    this.sendToConnection(ws, {
      type: 'error',
      error: {
        message,
        code,
        timestamp: new Date().toISOString()
      }
    });
  }

  // Notification integration
  sendNotification(userId, notification) {
    const message = {
      type: 'notification',
      data: notification
    };

    // Send to user's connections
    const userSent = this.sendToUser(userId, message);

    // Also broadcast to user's notification channel
    const channelSent = this.broadcast(`user:${userId}:notifications`, notification);

    logger.info('Notification sent via WebSocket', {
      userId,
      notificationId: notification.id,
      connectionsSent: userSent,
      channelSent
    });

    return userSent + channelSent;
  }

  // System events
  sendSystemEvent(event, data) {
    return this.broadcast('system_events', {
      type: event,
      data,
      timestamp: new Date().toISOString()
    });
  }

  sendTaskUpdate(taskId, status, data = {}) {
    return this.broadcast('task_events', {
      type: 'task_update',
      data: {
        taskId,
        status,
        ...data,
        timestamp: new Date().toISOString()
      }
    });
  }

  sendNodeEvent(event, nodeData) {
    return this.broadcast('node_events', {
      type: event,
      data: {
        ...nodeData,
        timestamp: new Date().toISOString()
      }
    });
  }

  // Utility methods
  generateConnectionId() {
    return 'ws_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (!this.wss) return;

      this.wss.clients.forEach(ws => {
        if (!ws.isAlive) {
          logger.warn('WebSocket connection terminated (no pong)', {
            connectionId: ws.connectionId,
            userId: ws.userId
          });
          return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();
      });
    }, 30000); // 30 seconds
  }

  getStats() {
    return {
      ...this.stats,
      activeConnections: this.stats.activeConnections,
      authenticatedUsers: this.clients.size,
      totalChannels: this.channels.size,
      totalSubscriptions: this.subscriptions.size
    };
  }

  getConnectedUsers() {
    return Array.from(this.clients.keys());
  }

  getUserConnectionCount(userId) {
    return this.clients.has(userId) ? this.clients.get(userId).size : 0;
  }

  // Admin methods
  disconnectUser(userId, reason = 'Admin action') {
    if (!this.clients.has(userId)) {
      return 0;
    }

    const userConnections = this.clients.get(userId);
    let disconnected = 0;

    userConnections.forEach(ws => {
      this.sendToConnection(ws, {
        type: 'disconnect',
        data: {
          reason,
          timestamp: new Date().toISOString()
        }
      });
      ws.close(1000, reason);
      disconnected++;
    });

    logger.info('User disconnected by admin', { userId, reason, connections: disconnected });
    return disconnected;
  }

  shutdown() {
    logger.info('Shutting down WebSocket server');

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.wss) {
      // Send shutdown notice to all clients
      this.wss.clients.forEach(ws => {
        this.sendToConnection(ws, {
          type: 'server_shutdown',
          data: {
            message: 'Server is shutting down',
            timestamp: new Date().toISOString()
          }
        });
      });

      // Close all connections
      this.wss.close();
    }

    // Clear all data structures
    this.clients.clear();
    this.subscriptions.clear();
    this.channels.clear();
  }
}

// Singleton instance
const webSocketManager = new WebSocketManager();

module.exports = webSocketManager;
