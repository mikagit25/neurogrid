const EventEmitter = require('events');
const logger = require('../utils/logger');

/**
 * Enhanced WebSocket Manager with Room Support and Real-time Analytics
 */
class EnhancedWebSocketManager extends EventEmitter {
  constructor() {
    super();
    this.clients = new Map();
    this.rooms = new Map();
    this.userSessions = new Map();
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      messagesPerSecond: 0,
      roomsActive: 0,
      lastReset: Date.now()
    };

    // Start metrics collection
    this.startMetricsCollection();
  }

  /**
   * Handle new WebSocket connection with authentication
   */
  handleConnection(ws, req) {
    const clientId = this.generateClientId();
    const client = {
      ws,
      id: clientId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      connectedAt: new Date(),
      lastActivity: new Date(),
      rooms: new Set(),
      userId: null,
      authenticated: false,
      permissions: new Set(['read']),
      messageCount: 0,
      subscriptions: new Set()
    };

    this.clients.set(clientId, client);
    this.metrics.totalConnections++;
    this.metrics.activeConnections++;

    logger.info(`New WebSocket connection: ${clientId}`, {
      clientId,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    // Set up event handlers
    ws.on('message', (data) => this.handleMessage(clientId, data));
    ws.on('close', () => this.handleDisconnection(clientId));
    ws.on('error', (error) => this.handleError(clientId, error));
    ws.on('pong', () => this.handlePong(clientId));

    // Send welcome message
    this.sendToClient(clientId, {
      type: 'connection',
      payload: {
        clientId,
        message: 'Connected to NeuroGrid coordinator',
        serverTime: Date.now(),
        version: '1.0.0'
      }
    });

    // Start keepalive
    this.startKeepalive(clientId);

    this.emit('clientConnected', client);
    return clientId;
  }

  /**
   * Handle incoming messages
   */
  async handleMessage(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.lastActivity = new Date();
    client.messageCount++;

    try {
      const message = JSON.parse(data.toString());

      logger.debug(`Received message from ${clientId}:`, message);

      switch (message.type) {
      case 'authenticate':
        await this.handleAuthentication(clientId, message.payload);
        break;
      case 'joinRoom':
        this.joinRoom(clientId, message.payload.room, message.payload.options);
        break;
      case 'leaveRoom':
        this.leaveRoom(clientId, message.payload.room);
        break;
      case 'subscribe':
        this.handleSubscription(clientId, message.payload);
        break;
      case 'unsubscribe':
        this.handleUnsubscription(clientId, message.payload);
        break;
      case 'ping':
        this.sendToClient(clientId, { type: 'pong', payload: { timestamp: Date.now() } });
        break;
      case 'submitMetrics':
        await this.handleMetricsSubmission(clientId, message.payload);
        break;
      case 'requestData':
        await this.handleDataRequest(clientId, message.payload);
        break;
      default:
        this.sendToClient(clientId, {
          type: 'error',
          payload: { message: 'Unknown message type', type: message.type }
        });
      }
    } catch (error) {
      logger.error(`Error processing message from ${clientId}:`, error);
      this.sendToClient(clientId, {
        type: 'error',
        payload: { message: 'Invalid message format' }
      });
    }
  }

  /**
   * Handle client authentication
   */
  async handleAuthentication(clientId, payload) {
    const client = this.clients.get(clientId);
    if (!client) return;

    try {
      const { token, userId } = payload;

      // TODO: Validate JWT token
      // For now, simple validation
      if (token && userId) {
        client.authenticated = true;
        client.userId = userId;
        client.permissions.add('write');

        // Store user session
        this.userSessions.set(userId, clientId);

        // Auto-join user to personal room
        this.joinRoom(clientId, `user:${userId}`, { personal: true });

        this.sendToClient(clientId, {
          type: 'authSuccess',
          payload: {
            message: 'Authentication successful',
            userId,
            permissions: Array.from(client.permissions)
          }
        });

        logger.info(`Client ${clientId} authenticated as user ${userId}`);
      } else {
        throw new Error('Invalid credentials');
      }
    } catch (error) {
      this.sendToClient(clientId, {
        type: 'authError',
        payload: { message: 'Authentication failed' }
      });
      logger.warn(`Authentication failed for client ${clientId}: ${error.message}`);
    }
  }

  /**
   * Handle room subscription
   */
  joinRoom(clientId, roomName, options = {}) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Check permissions
    if (this.requiresPermission(roomName, 'read') && !client.permissions.has('read')) {
      this.sendToClient(clientId, {
        type: 'error',
        payload: { message: 'Insufficient permissions for room access' }
      });
      return;
    }

    // Add client to room
    if (!this.rooms.has(roomName)) {
      this.rooms.set(roomName, new Set());
    }

    this.rooms.get(roomName).add(clientId);
    client.rooms.add(roomName);

    this.sendToClient(clientId, {
      type: 'joinedRoom',
      payload: {
        room: roomName,
        memberCount: this.rooms.get(roomName).size,
        options
      }
    });

    logger.info(`Client ${clientId} joined room ${roomName}`);
    this.emit('clientJoinedRoom', client, roomName);
  }

  /**
   * Handle room unsubscription
   */
  leaveRoom(clientId, roomName) {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (this.rooms.has(roomName)) {
      this.rooms.get(roomName).delete(clientId);
      if (this.rooms.get(roomName).size === 0) {
        this.rooms.delete(roomName);
      }
    }

    client.rooms.delete(roomName);

    this.sendToClient(clientId, {
      type: 'leftRoom',
      payload: { room: roomName }
    });

    logger.info(`Client ${clientId} left room ${roomName}`);
    this.emit('clientLeftRoom', client, roomName);
  }

  /**
   * Handle data subscriptions (analytics, metrics, etc.)
   */
  handleSubscription(clientId, payload) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const { subscription, interval = 5000 } = payload;

    client.subscriptions.add(subscription);

    // Start sending periodic updates
    switch (subscription) {
    case 'realtime-metrics':
      this.startRealtimeMetrics(clientId, interval);
      break;
    case 'network-stats':
      this.startNetworkStats(clientId, interval);
      break;
    case 'node-updates':
      this.startNodeUpdates(clientId, interval);
      break;
    }

    this.sendToClient(clientId, {
      type: 'subscribed',
      payload: { subscription, interval }
    });
  }

  /**
   * Handle metrics submission from nodes
   */
  async handleMetricsSubmission(clientId, payload) {
    const client = this.clients.get(clientId);
    if (!client || !client.permissions.has('write')) {
      this.sendToClient(clientId, {
        type: 'error',
        payload: { message: 'Insufficient permissions' }
      });
      return;
    }

    const { nodeId, metrics } = payload;

    // Broadcast metrics to analytics room
    this.broadcastToRoom('analytics', {
      type: 'nodeMetrics',
      payload: { nodeId, metrics, timestamp: Date.now() }
    });

    // Store metrics in real-time cache (would use Redis in production)
    this.emit('metricsReceived', { nodeId, metrics, clientId });

    this.sendToClient(clientId, {
      type: 'metricsAcknowledged',
      payload: { nodeId, timestamp: Date.now() }
    });
  }

  /**
   * Broadcast message to all clients in a room
   */
  broadcastToRoom(roomName, message) {
    const room = this.rooms.get(roomName);
    if (!room) return;

    const messageStr = JSON.stringify({
      ...message,
      timestamp: Date.now()
    });

    let successCount = 0;
    room.forEach(clientId => {
      const client = this.clients.get(clientId);
      if (client && client.ws.readyState === 1) {
        client.ws.send(messageStr);
        successCount++;
      } else {
        room.delete(clientId);
      }
    });

    logger.debug(`Broadcasted to room ${roomName}: ${successCount} clients`);
    return successCount;
  }

  /**
   * Send message to specific client
   */
  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== 1) return false;

    try {
      client.ws.send(JSON.stringify({
        ...message,
        timestamp: Date.now()
      }));
      return true;
    } catch (error) {
      logger.error(`Error sending message to client ${clientId}:`, error);
      return false;
    }
  }

  /**
   * Send message to specific user
   */
  sendToUser(userId, message) {
    const clientId = this.userSessions.get(userId);
    if (clientId) {
      return this.sendToClient(clientId, message);
    }
    return false;
  }

  /**
   * Handle client disconnection
   */
  handleDisconnection(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Remove from all rooms
    client.rooms.forEach(roomName => {
      if (this.rooms.has(roomName)) {
        this.rooms.get(roomName).delete(clientId);
        if (this.rooms.get(roomName).size === 0) {
          this.rooms.delete(roomName);
        }
      }
    });

    // Remove user session
    if (client.userId) {
      this.userSessions.delete(client.userId);
    }

    // Clean up client
    this.clients.delete(clientId);
    this.metrics.activeConnections--;

    logger.info(`Client disconnected: ${clientId}`, {
      sessionDuration: Date.now() - client.connectedAt.getTime(),
      messageCount: client.messageCount
    });

    this.emit('clientDisconnected', client);
  }

  /**
   * Start real-time metrics updates for a client
   */
  startRealtimeMetrics(clientId, interval) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const intervalId = setInterval(() => {
      if (!this.clients.has(clientId)) {
        clearInterval(intervalId);
        return;
      }

      const metrics = {
        activeClients: this.metrics.activeConnections,
        totalRooms: this.rooms.size,
        messagesPerSecond: this.metrics.messagesPerSecond,
        serverUptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        timestamp: Date.now()
      };

      this.sendToClient(clientId, {
        type: 'realtimeMetrics',
        payload: metrics
      });
    }, interval);

    // Store interval for cleanup
    client.intervals = client.intervals || [];
    client.intervals.push(intervalId);
  }

  /**
   * Generate unique client ID
   */
  generateClientId() {
    return `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Start metrics collection
   */
  startMetricsCollection() {
    setInterval(() => {
      this.metrics.roomsActive = this.rooms.size;
      this.metrics.lastReset = Date.now();
    }, 1000);
  }

  /**
   * Start keepalive for client
   */
  startKeepalive(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const keepaliveId = setInterval(() => {
      if (!this.clients.has(clientId)) {
        clearInterval(keepaliveId);
        return;
      }

      if (client.ws.readyState === 1) {
        client.ws.ping();
      } else {
        this.handleDisconnection(clientId);
        clearInterval(keepaliveId);
      }
    }, 30000);
  }

  /**
   * Check if room requires specific permission
   */
  requiresPermission(roomName, permission) {
    const protectedRooms = {
      'admin': 'admin',
      'analytics': 'read',
      'nodes': 'read'
    };
    return protectedRooms[roomName] === permission;
  }

  /**
   * Get connection statistics
   */
  getStats() {
    return {
      metrics: this.metrics,
      rooms: Array.from(this.rooms.keys()).map(roomName => ({
        name: roomName,
        memberCount: this.rooms.get(roomName).size
      })),
      clients: Array.from(this.clients.values()).map(client => ({
        id: client.id,
        userId: client.userId,
        authenticated: client.authenticated,
        connectedAt: client.connectedAt,
        messageCount: client.messageCount,
        rooms: Array.from(client.rooms)
      }))
    };
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    // Close all connections
    this.clients.forEach(client => {
      if (client.ws.readyState === 1) {
        client.ws.close();
      }
    });

    this.clients.clear();
    this.rooms.clear();
    this.userSessions.clear();
  }
}

module.exports = EnhancedWebSocketManager;
