const WebSocket = require('ws');
const logger = require('../utils/logger');
const authManager = require('../utils/auth');

/**
 * Enhanced WebSocket Manager with Real-time Features
 * Supports notifications, analytics, live updates, and advanced channel management
 */
class EnhancedWebSocketManager {
  constructor() {
    this.wss = null;
    this.clients = new Map(); // userId -> Set of WebSocket connections
    this.subscriptions = new Map(); // connectionId -> Set of subscriptions
    this.channels = new Map(); // channel -> Set of connectionIds
    this.rooms = new Map(); // roomId -> Set of connectionIds
    this.userSessions = new Map(); // userId -> session data
    this.heartbeatInterval = null;
    this.metricsInterval = null;

    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      messagesSent: 0,
      messagesReceived: 0,
      broadcastsSent: 0,
      notificationsSent: 0,
      dataTransferred: 0,
      uptime: Date.now()
    };

    this.rateLimits = new Map(); // connectionId -> rate limit data
    this.messageQueue = new Map(); // connectionId -> message queue for offline users

    // Real-time data streams
    this.liveStreams = new Map(); // streamId -> stream config
    this.initializeLiveStreams();
  }

  initialize(server) {
    this.wss = new WebSocket.Server({
      server,
      path: '/ws',
      verifyClient: this.verifyClient.bind(this),
      maxPayload: 1024 * 1024 // 1MB max payload
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    this.startHeartbeat();
    this.startMetricsCollection();
    this.startLiveStreams();

    logger.info('Enhanced WebSocket server initialized');
  }

  initializeLiveStreams() {
    // System metrics stream
    this.liveStreams.set('system_metrics', {
      interval: 5000, // 5 seconds
      channel: 'system_metrics',
      generator: this.generateSystemMetrics.bind(this),
      active: false
    });

    // Task queue stream
    this.liveStreams.set('task_queue', {
      interval: 3000, // 3 seconds
      channel: 'task_queue',
      generator: this.generateTaskQueueMetrics.bind(this),
      active: false
    });

    // Node status stream
    this.liveStreams.set('node_status', {
      interval: 10000, // 10 seconds
      channel: 'node_status',
      generator: this.generateNodeStatusMetrics.bind(this),
      active: false
    });

    // Analytics stream
    this.liveStreams.set('analytics', {
      interval: 15000, // 15 seconds
      channel: 'analytics',
      generator: this.generateAnalyticsMetrics.bind(this),
      active: false
    });
  }

  startLiveStreams() {
    this.liveStreams.forEach((stream, streamId) => {
      stream.intervalId = setInterval(async () => {
        if (stream.active && this.channels.has(stream.channel)) {
          try {
            const data = await stream.generator();
            this.broadcast(stream.channel, {
              type: 'live_update',
              stream: streamId,
              data,
              timestamp: new Date().toISOString()
            });
          } catch (error) {
            logger.error(`Error generating live stream data for ${streamId}:`, error);
          }
        }
      }, stream.interval);
    });
  }

  async generateSystemMetrics() {
    const process = require('process');
    const os = require('os');

    return {
      cpu: {
        usage: Math.random() * 100,
        loadAverage: os.loadavg()
      },
      memory: {
        used: Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
        total: Math.round((os.totalmem() / 1024 / 1024) * 100) / 100,
        free: Math.round((os.freemem() / 1024 / 1024) * 100) / 100,
        usage: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100)
      },
      connections: {
        active: this.stats.activeConnections,
        total: this.stats.totalConnections,
        authenticated: this.clients.size
      },
      uptime: Date.now() - this.stats.uptime
    };
  }

  async generateTaskQueueMetrics() {
    // Mock task queue data - replace with real data from task manager
    return {
      pending: Math.floor(Math.random() * 50),
      processing: Math.floor(Math.random() * 20),
      completed: Math.floor(Math.random() * 1000) + 500,
      failed: Math.floor(Math.random() * 10),
      throughput: Math.floor(Math.random() * 5) + 1,
      avgProcessingTime: Math.floor(Math.random() * 300) + 60
    };
  }

  async generateNodeStatusMetrics() {
    // Mock node status data - replace with real data from node manager
    const nodes = [];
    for (let i = 1; i <= 10; i++) {
      nodes.push({
        id: `node-${i.toString().padStart(3, '0')}`,
        status: Math.random() > 0.1 ? 'online' : 'offline',
        load: Math.floor(Math.random() * 100),
        tasks: Math.floor(Math.random() * 10),
        uptime: Math.floor(Math.random() * 86400)
      });
    }

    return {
      nodes,
      summary: {
        total: nodes.length,
        online: nodes.filter(n => n.status === 'online').length,
        offline: nodes.filter(n => n.status === 'offline').length,
        avgLoad: Math.floor(nodes.reduce((sum, n) => sum + n.load, 0) / nodes.length)
      }
    };
  }

  async generateAnalyticsMetrics() {
    // Mock analytics data - replace with real data from analytics service
    return {
      tasksToday: Math.floor(Math.random() * 500) + 100,
      revenueToday: Math.floor(Math.random() * 1000) + 500,
      activeUsers: Math.floor(Math.random() * 100) + 50,
      successRate: Math.floor(Math.random() * 20) + 80,
      trends: {
        tasks: Math.random() > 0.5 ? 'up' : 'down',
        revenue: Math.random() > 0.5 ? 'up' : 'down',
        users: Math.random() > 0.5 ? 'up' : 'down'
      }
    };
  }

  verifyClient(info) {
    // Enhanced verification with rate limiting
    const ip = info.req.socket.remoteAddress;
    const now = Date.now();

    // Simple rate limiting per IP
    if (!this.rateLimits.has(ip)) {
      this.rateLimits.set(ip, { count: 0, resetTime: now + 60000 });
    }

    const rateLimit = this.rateLimits.get(ip);
    if (now > rateLimit.resetTime) {
      rateLimit.count = 0;
      rateLimit.resetTime = now + 60000;
    }

    if (rateLimit.count > 10) { // Max 10 connections per IP per minute
      logger.warn('WebSocket connection rate limited', { ip });
      return false;
    }

    rateLimit.count++;
    return true;
  }

  handleConnection(ws, req) {
    const connectionId = this.generateConnectionId();
    const ip = req.socket.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // Initialize enhanced connection
    ws.connectionId = connectionId;
    ws.isAlive = true;
    ws.userId = null;
    ws.subscriptions = new Set();
    ws.rooms = new Set();
    ws.connectedAt = new Date();
    ws.lastActivity = new Date();
    ws.messageCount = 0;
    ws.metadata = {
      ip,
      userAgent,
      version: req.headers['sec-websocket-version']
    };

    this.stats.totalConnections++;
    this.stats.activeConnections++;

    logger.info('Enhanced WebSocket connection established', {
      connectionId,
      ip,
      userAgent,
      totalConnections: this.stats.totalConnections
    });

    // Set up enhanced message handler
    ws.on('message', (message) => {
      ws.lastActivity = new Date();
      ws.messageCount++;
      this.handleMessage(ws, message);
    });

    // Set up close handler
    ws.on('close', (code, reason) => {
      this.handleDisconnection(ws, code, reason);
    });

    // Set up error handler
    ws.on('error', (error) => {
      logger.error('Enhanced WebSocket connection error', {
        connectionId,
        error: error.message,
        stack: error.stack
      });
    });

    // Set up pong handler for heartbeat
    ws.on('pong', () => {
      ws.isAlive = true;
      ws.lastActivity = new Date();
    });

    // Send enhanced welcome message
    this.sendToConnection(connectionId, {
      type: 'connected',
      data: {
        connectionId,
        timestamp: new Date().toISOString(),
        serverVersion: process.env.npm_package_version || '1.0.0',
        features: {
          notifications: true,
          liveUpdates: true,
          analytics: true,
          rooms: true,
          fileTransfer: false
        },
        availableChannels: this.getAvailableChannels(),
        availableStreams: Array.from(this.liveStreams.keys())
      }
    });
  }

  handleMessage(ws, message) {
    try {
      this.stats.messagesReceived++;
      this.stats.dataTransferred += message.length;

      const data = JSON.parse(message);

      // Rate limiting per connection
      if (!this.checkRateLimit(ws, data.type)) {
        this.sendError(ws, 'Rate limit exceeded', 'RATE_LIMIT_EXCEEDED');
        return;
      }

      logger.debug('Enhanced WebSocket message received', {
        connectionId: ws.connectionId,
        type: data.type,
        userId: ws.userId,
        size: message.length
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
      case 'join_room':
        this.handleJoinRoom(ws, data);
        break;
      case 'leave_room':
        this.handleLeaveRoom(ws, data);
        break;
      case 'start_stream':
        this.handleStartStream(ws, data);
        break;
      case 'stop_stream':
        this.handleStopStream(ws, data);
        break;
      case 'ping':
        this.handlePing(ws, data);
        break;
      case 'get_stats':
        this.handleGetStats(ws, data);
        break;
      case 'request_history':
        this.handleRequestHistory(ws, data);
        break;
      default:
        // Forward to base WebSocket manager for compatibility
        this.handleLegacyMessage(ws, data);
      }
    } catch (error) {
      logger.error('Enhanced WebSocket message parsing error', {
        connectionId: ws.connectionId,
        error: error.message,
        message: message.toString().substring(0, 100)
      });
      this.sendError(ws, 'Invalid message format', 'INVALID_MESSAGE_FORMAT');
    }
  }

  checkRateLimit(ws, messageType) {
    const now = Date.now();
    const key = `${ws.connectionId}-${messageType}`;

    if (!this.rateLimits.has(key)) {
      this.rateLimits.set(key, { count: 0, resetTime: now + 60000 });
    }

    const limit = this.rateLimits.get(key);
    if (now > limit.resetTime) {
      limit.count = 0;
      limit.resetTime = now + 60000;
    }

    // Different limits for different message types
    const limits = {
      authenticate: 5,
      subscribe: 20,
      ping: 120,
      default: 60
    };

    const maxCount = limits[messageType] || limits.default;

    if (limit.count >= maxCount) {
      return false;
    }

    limit.count++;
    return true;
  }

  handleJoinRoom(ws, data) {
    const { room } = data.payload || {};

    if (!room) {
      this.sendError(ws, 'Room name required', 'ROOM_NAME_REQUIRED');
      return;
    }

    // Check room access permissions
    if (!this.canAccessRoom(ws, room)) {
      this.sendError(ws, `Access denied to room: ${room}`, 'ROOM_ACCESS_DENIED');
      return;
    }

    // Add to room
    ws.rooms.add(room);

    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set());
    }
    this.rooms.get(room).add(ws.connectionId);

    logger.info('User joined room', {
      connectionId: ws.connectionId,
      userId: ws.userId,
      room,
      roomSize: this.rooms.get(room).size
    });

    this.sendToConnection(ws.connectionId, {
      type: 'room_joined',
      data: {
        room,
        members: this.rooms.get(room).size,
        timestamp: new Date().toISOString()
      }
    });

    // Notify other room members
    this.broadcastToRoom(room, {
      type: 'user_joined_room',
      data: {
        room,
        userId: ws.userId,
        connectionId: ws.connectionId,
        timestamp: new Date().toISOString()
      }
    }, ws.connectionId);
  }

  handleLeaveRoom(ws, data) {
    const { room } = data.payload || {};

    if (!room || !ws.rooms.has(room)) {
      this.sendError(ws, 'Not in specified room', 'NOT_IN_ROOM');
      return;
    }

    this.leaveRoom(ws, room);
  }

  leaveRoom(ws, room) {
    ws.rooms.delete(room);

    if (this.rooms.has(room)) {
      this.rooms.get(room).delete(ws.connectionId);

      if (this.rooms.get(room).size === 0) {
        this.rooms.delete(room);
      }
    }

    this.sendToConnection(ws.connectionId, {
      type: 'room_left',
      data: {
        room,
        timestamp: new Date().toISOString()
      }
    });

    // Notify other room members
    if (this.rooms.has(room)) {
      this.broadcastToRoom(room, {
        type: 'user_left_room',
        data: {
          room,
          userId: ws.userId,
          connectionId: ws.connectionId,
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  handleStartStream(ws, data) {
    const { stream } = data.payload || {};

    if (!stream || !this.liveStreams.has(stream)) {
      this.sendError(ws, 'Invalid stream', 'INVALID_STREAM');
      return;
    }

    const streamConfig = this.liveStreams.get(stream);

    // Check stream access permissions
    if (!this.canAccessStream(ws, stream)) {
      this.sendError(ws, `Access denied to stream: ${stream}`, 'STREAM_ACCESS_DENIED');
      return;
    }

    // Subscribe to stream channel
    this.handleSubscription(ws, {
      payload: { channels: [streamConfig.channel] }
    });

    // Activate stream if not already active
    if (!streamConfig.active) {
      streamConfig.active = true;
      logger.info('Live stream activated', { stream });
    }

    this.sendToConnection(ws.connectionId, {
      type: 'stream_started',
      data: {
        stream,
        channel: streamConfig.channel,
        interval: streamConfig.interval,
        timestamp: new Date().toISOString()
      }
    });
  }

  handleStopStream(ws, data) {
    const { stream } = data.payload || {};

    if (!stream || !this.liveStreams.has(stream)) {
      this.sendError(ws, 'Invalid stream', 'INVALID_STREAM');
      return;
    }

    const streamConfig = this.liveStreams.get(stream);

    // Unsubscribe from stream channel
    this.handleUnsubscription(ws, {
      payload: { channels: [streamConfig.channel] }
    });

    // Check if any other connections are subscribed to this stream
    const hasSubscribers = this.channels.has(streamConfig.channel) &&
                          this.channels.get(streamConfig.channel).size > 0;

    if (!hasSubscribers && streamConfig.active) {
      streamConfig.active = false;
      logger.info('Live stream deactivated', { stream });
    }

    this.sendToConnection(ws.connectionId, {
      type: 'stream_stopped',
      data: {
        stream,
        timestamp: new Date().toISOString()
      }
    });
  }

  handleGetStats(ws, data) {
    const stats = this.getEnhancedStats();

    this.sendToConnection(ws.connectionId, {
      type: 'stats',
      data: stats,
      timestamp: new Date().toISOString()
    });
  }

  handleRequestHistory(ws, data) {
    const { channel, limit = 50 } = data.payload || {};

    // Mock history data - replace with real history from database
    const history = [];
    for (let i = 0; i < Math.min(limit, 20); i++) {
      history.push({
        id: `msg-${Date.now()}-${i}`,
        type: 'broadcast',
        channel,
        data: {
          message: `Historical message ${i + 1}`,
          value: Math.floor(Math.random() * 100)
        },
        timestamp: new Date(Date.now() - i * 60000).toISOString()
      });
    }

    this.sendToConnection(ws.connectionId, {
      type: 'history',
      data: {
        channel,
        messages: history,
        total: history.length
      },
      timestamp: new Date().toISOString()
    });
  }

  // Enhanced utility methods
  canAccessRoom(ws, room) {
    const publicRooms = ['general', 'announcements'];
    const userRooms = ['support'];
    const adminRooms = ['admin', 'system'];

    if (publicRooms.includes(room)) {
      return true;
    }

    if (!ws.userId) {
      return false;
    }

    if (userRooms.includes(room)) {
      return true;
    }

    if (adminRooms.includes(room) && ws.userRole === 'admin') {
      return true;
    }

    // User-specific rooms
    if (room.startsWith(`user:${ws.userId}`)) {
      return true;
    }

    return false;
  }

  canAccessStream(ws, stream) {
    const publicStreams = ['system_metrics'];
    const userStreams = ['task_queue', 'analytics'];
    const adminStreams = ['node_status'];

    if (publicStreams.includes(stream)) {
      return true;
    }

    if (!ws.userId) {
      return false;
    }

    if (userStreams.includes(stream)) {
      return true;
    }

    if (adminStreams.includes(stream) && ws.userRole === 'admin') {
      return true;
    }

    return false;
  }

  broadcastToRoom(room, message, excludeConnectionId = null) {
    if (!this.rooms.has(room)) {
      return 0;
    }

    const roomConnections = this.rooms.get(room);
    let sent = 0;

    roomConnections.forEach(connectionId => {
      if (connectionId !== excludeConnectionId) {
        if (this.sendToConnection(connectionId, {
          type: 'room_broadcast',
          room,
          data: message,
          timestamp: new Date().toISOString()
        })) {
          sent++;
        }
      }
    });

    logger.debug('Room broadcast sent', { room, recipients: sent });
    return sent;
  }

  getEnhancedStats() {
    const now = Date.now();
    return {
      ...this.stats,
      uptime: now - this.stats.uptime,
      connections: {
        active: this.stats.activeConnections,
        total: this.stats.totalConnections,
        authenticated: this.clients.size
      },
      channels: {
        total: this.channels.size,
        subscriptions: this.subscriptions.size
      },
      rooms: {
        total: this.rooms.size,
        members: Array.from(this.rooms.values()).reduce((sum, room) => sum + room.size, 0)
      },
      streams: {
        total: this.liveStreams.size,
        active: Array.from(this.liveStreams.values()).filter(s => s.active).length
      },
      performance: {
        messagesPerSecond: this.stats.messagesSent / ((now - this.stats.uptime) / 1000),
        dataTransferredMB: Math.round(this.stats.dataTransferred / 1024 / 1024 * 100) / 100,
        avgConnectionDuration: this.calculateAvgConnectionDuration()
      }
    };
  }

  calculateAvgConnectionDuration() {
    if (this.stats.activeConnections === 0) return 0;

    let totalDuration = 0;
    let count = 0;

    for (const userConnections of this.clients.values()) {
      for (const ws of userConnections) {
        totalDuration += Date.now() - ws.connectedAt.getTime();
        count++;
      }
    }

    return count > 0 ? Math.round(totalDuration / count / 1000) : 0; // in seconds
  }

  getAvailableChannels() {
    return [
      'system',
      'announcements',
      'notifications',
      'task_events',
      'node_events',
      'system_metrics',
      'task_queue',
      'analytics'
    ];
  }

  startMetricsCollection() {
    this.metricsInterval = setInterval(() => {
      // Clean up old rate limit entries
      const now = Date.now();
      for (const [key, limit] of this.rateLimits.entries()) {
        if (now > limit.resetTime + 300000) { // 5 minutes after reset
          this.rateLimits.delete(key);
        }
      }

      // Log periodic stats
      const stats = this.getEnhancedStats();
      logger.debug('WebSocket metrics', {
        activeConnections: stats.connections.active,
        messagesPerSecond: stats.performance.messagesPerSecond.toFixed(2),
        dataTransferredMB: stats.performance.dataTransferredMB
      });
    }, 60000); // Every minute
  }

  // Enhanced authentication method
  async handleAuthentication(ws, data) {
    try {
      const { token, apiKey, sessionId } = data.payload || {};
      let user = null;

      // Try session authentication first
      if (sessionId && this.userSessions.has(sessionId)) {
        const session = this.userSessions.get(sessionId);
        if (session.expiresAt > Date.now()) {
          user = session.user;
        } else {
          this.userSessions.delete(sessionId);
        }
      }

      // Try API key authentication
      if (!user && apiKey && apiKey.startsWith('ng_')) {
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

      // Create or update session
      const newSessionId = sessionId || this.generateSessionId();
      this.userSessions.set(newSessionId, {
        user,
        connectionId: ws.connectionId,
        createdAt: new Date(),
        expiresAt: Date.now() + 3600000, // 1 hour
        lastActivity: new Date()
      });

      // Add to user connections
      if (!this.clients.has(user.id)) {
        this.clients.set(user.id, new Set());
      }
      this.clients.get(user.id).add(ws);

      // Process queued messages
      this.processQueuedMessages(user.id, ws);

      logger.info('Enhanced WebSocket user authenticated', {
        connectionId: ws.connectionId,
        userId: user.id,
        role: user.role,
        sessionId: newSessionId
      });

      this.sendToConnection(ws.connectionId, {
        type: 'authenticated',
        data: {
          userId: user.id,
          role: user.role,
          sessionId: newSessionId,
          permissions: this.getUserPermissions(user),
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Enhanced WebSocket authentication error', {
        connectionId: ws.connectionId,
        error: error.message
      });
      this.sendError(ws, 'Authentication error', 'AUTH_ERROR');
    }
  }

  processQueuedMessages(userId, ws) {
    if (!this.messageQueue.has(userId)) {
      return;
    }

    const messages = this.messageQueue.get(userId);
    messages.forEach(message => {
      this.sendToConnection(ws, message);
    });

    this.messageQueue.delete(userId);
    logger.info('Processed queued messages', { userId, count: messages.length });
  }

  getUserPermissions(user) {
    const basePermissions = ['notifications', 'task_events'];
    const adminPermissions = ['system_events', 'node_events', 'admin'];

    return user.role === 'admin'
      ? [...basePermissions, ...adminPermissions]
      : basePermissions;
  }

  generateSessionId() {
    return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 16);
  }

  // Queue message for offline user
  queueMessage(userId, message) {
    if (!this.messageQueue.has(userId)) {
      this.messageQueue.set(userId, []);
    }

    const queue = this.messageQueue.get(userId);
    queue.push({
      ...message,
      queued: true,
      queuedAt: new Date().toISOString()
    });

    // Keep only last 50 messages per user
    if (queue.length > 50) {
      queue.splice(0, queue.length - 50);
    }
  }

  // Enhanced notification sending with queueing
  async sendNotification(userId, notification) {
    const message = {
      type: 'notification',
      data: notification
    };

    // Try to send to active connections
    const userSent = this.sendToUser(userId, message);

    // If user is not connected, queue the message
    if (userSent === 0) {
      this.queueMessage(userId, message);
      logger.info('Notification queued for offline user', {
        userId,
        notificationId: notification.id
      });
    } else {
      this.stats.notificationsSent++;
      logger.info('Notification sent via WebSocket', {
        userId,
        notificationId: notification.id,
        connectionsSent: userSent
      });
    }

    return userSent;
  }

  // Method delegation to base WebSocket manager for compatibility
  handleLegacyMessage(ws, data) {
    // Add legacy message handling here if needed
    logger.debug('Legacy message type', { type: data.type });
  }

  // Override base methods with enhanced functionality
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
        const messageStr = JSON.stringify(message);
        ws.send(messageStr);
        this.stats.messagesSent++;
        this.stats.dataTransferred += messageStr.length;
        return true;
      }
      return false;
    } catch (error) {
      logger.error('Failed to send enhanced WebSocket message', {
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

    this.stats.broadcastsSent++;
    logger.debug('Enhanced broadcast sent', { channel, recipients: sent });
    return sent;
  }

  handleDisconnection(ws, code, reason) {
    this.stats.activeConnections--;

    logger.info('Enhanced WebSocket connection closed', {
      connectionId: ws.connectionId,
      userId: ws.userId,
      code,
      reason: reason?.toString(),
      duration: Date.now() - ws.connectedAt.getTime(),
      messageCount: ws.messageCount
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

          // Check if stream should be deactivated
          const streamEntry = Array.from(this.liveStreams.entries())
            .find(([_, stream]) => stream.channel === channel);

          if (streamEntry && this.channels.get(channel).size === 0) {
            streamEntry[1].active = false;
            logger.info('Live stream deactivated due to no subscribers', {
              stream: streamEntry[0]
            });
          }
        }
      });
      this.subscriptions.delete(ws.connectionId);
    }

    // Clean up rooms
    ws.rooms.forEach(room => {
      this.leaveRoom(ws, room);
    });
  }

  // Enhanced shutdown
  shutdown() {
    logger.info('Shutting down Enhanced WebSocket server');

    // Stop intervals
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    // Stop live streams
    this.liveStreams.forEach(stream => {
      if (stream.intervalId) {
        clearInterval(stream.intervalId);
      }
    });

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
    this.rooms.clear();
    this.userSessions.clear();
    this.rateLimits.clear();
    this.messageQueue.clear();
    this.liveStreams.clear();
  }

  // Additional utility methods
  generateConnectionId() {
    return 'ews_' + Date.now() + '_' + Math.random().toString(36).substr(2, 12);
  }

  startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      if (!this.wss) return;

      this.wss.clients.forEach(ws => {
        if (!ws.isAlive) {
          logger.warn('Enhanced WebSocket connection terminated (no pong)', {
            connectionId: ws.connectionId,
            userId: ws.userId,
            duration: Date.now() - ws.connectedAt.getTime()
          });
          return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();
      });

      // Update session activity
      this.userSessions.forEach((session, sessionId) => {
        if (Date.now() > session.expiresAt) {
          this.userSessions.delete(sessionId);
          logger.debug('Session expired', { sessionId });
        }
      });
    }, 30000); // 30 seconds
  }

  // Legacy compatibility methods
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

      // Check if this activates a live stream
      const streamEntry = Array.from(this.liveStreams.entries())
        .find(([_, stream]) => stream.channel === channel);

      if (streamEntry && !streamEntry[1].active) {
        streamEntry[1].active = true;
        logger.info('Live stream activated', { stream: streamEntry[0] });
      }
    });

    logger.info('Enhanced WebSocket subscriptions updated', {
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
        original: data.payload,
        serverTime: Date.now()
      }
    });
  }

  canAccessChannel(ws, channel) {
    // Basic channel access control
    const publicChannels = ['system', 'announcements'];
    const userChannels = ['notifications', 'task_events', 'system_metrics', 'task_queue', 'analytics'];
    const adminChannels = ['admin', 'system_events', 'security', 'node_events'];

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
}

// Create singleton instance
const enhancedWebSocketManager = new EnhancedWebSocketManager();

module.exports = {
  WebSocketManager: enhancedWebSocketManager,
  getInstance: () => enhancedWebSocketManager
};
