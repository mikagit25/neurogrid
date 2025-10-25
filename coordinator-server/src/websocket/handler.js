const logger = require('../utils/logger');

/**
 * WebSocket connection handler
 */
class WebSocketHandler {
  constructor() {
    this.clients = new Map();
    this.rooms = new Map();
  }

  /**
   * Handle new WebSocket connection
   */
  handleConnection(ws, req) {
    const clientId = this.generateClientId();

    // Store client connection
    this.clients.set(clientId, {
      ws,
      id: clientId,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      connectedAt: new Date(),
      rooms: new Set()
    });

    logger.info(`New WebSocket connection: ${clientId}`, {
      clientId,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });

    // Set up message handlers
    ws.on('message', (data) => this.handleMessage(clientId, data));
    ws.on('close', () => this.handleDisconnection(clientId));
    ws.on('error', (error) => this.handleError(clientId, error));

    // Send welcome message
    this.sendToClient(clientId, {
      type: 'connection',
      payload: {
        clientId,
        message: 'Connected to NeuroGrid coordinator'
      }
    });

    return clientId;
  }

  /**
   * Handle incoming WebSocket message
   */
  handleMessage(clientId, data) {
    try {
      const message = JSON.parse(data);
      logger.debug(`WebSocket message from ${clientId}:`, message);

      switch (message.type) {
      case 'join_room':
        this.joinRoom(clientId, message.payload.room);
        break;
      case 'leave_room':
        this.leaveRoom(clientId, message.payload.room);
        break;
      case 'ping':
        this.sendToClient(clientId, { type: 'pong', payload: { timestamp: Date.now() } });
        break;
      default:
        logger.warn(`Unknown message type: ${message.type}`, { clientId, message });
      }
    } catch (error) {
      logger.error(`Error parsing WebSocket message from ${clientId}:`, error);
      this.sendToClient(clientId, {
        type: 'error',
        payload: { message: 'Invalid message format' }
      });
    }
  }

  /**
   * Handle WebSocket disconnection
   */
  handleDisconnection(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      // Remove from all rooms
      client.rooms.forEach(room => {
        this.leaveRoom(clientId, room);
      });

      // Remove client
      this.clients.delete(clientId);

      logger.info(`WebSocket disconnected: ${clientId}`, {
        clientId,
        duration: Date.now() - client.connectedAt.getTime()
      });
    }
  }

  /**
   * Handle WebSocket error
   */
  handleError(clientId, error) {
    logger.error(`WebSocket error for ${clientId}:`, error);
  }

  /**
   * Join a room for grouped messaging
   */
  joinRoom(clientId, roomName) {
    const client = this.clients.get(clientId);
    if (!client) return false;

    // Add client to room
    if (!this.rooms.has(roomName)) {
      this.rooms.set(roomName, new Set());
    }
    this.rooms.get(roomName).add(clientId);
    client.rooms.add(roomName);

    logger.debug(`Client ${clientId} joined room: ${roomName}`);

    this.sendToClient(clientId, {
      type: 'room_joined',
      payload: { room: roomName }
    });

    return true;
  }

  /**
   * Leave a room
   */
  leaveRoom(clientId, roomName) {
    const client = this.clients.get(clientId);
    if (!client) return false;

    // Remove from room
    if (this.rooms.has(roomName)) {
      this.rooms.get(roomName).delete(clientId);
      if (this.rooms.get(roomName).size === 0) {
        this.rooms.delete(roomName);
      }
    }
    client.rooms.delete(roomName);

    logger.debug(`Client ${clientId} left room: ${roomName}`);

    this.sendToClient(clientId, {
      type: 'room_left',
      payload: { room: roomName }
    });

    return true;
  }

  /**
   * Send message to specific client
   */
  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (client && client.ws.readyState === 1) { // WebSocket.OPEN
      try {
        client.ws.send(JSON.stringify(message));
        return true;
      } catch (error) {
        logger.error(`Error sending message to client ${clientId}:`, error);
        return false;
      }
    }
    return false;
  }

  /**
   * Broadcast message to all clients in a room
   */
  broadcastToRoom(roomName, message) {
    const room = this.rooms.get(roomName);
    if (!room) return 0;

    let sent = 0;
    room.forEach(clientId => {
      if (this.sendToClient(clientId, message)) {
        sent++;
      }
    });

    logger.debug(`Broadcasted message to ${sent} clients in room: ${roomName}`);
    return sent;
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcastToAll(message) {
    let sent = 0;
    this.clients.forEach((client, clientId) => {
      if (this.sendToClient(clientId, message)) {
        sent++;
      }
    });

    logger.debug(`Broadcasted message to ${sent} clients`);
    return sent;
  }

  /**
   * Get connection statistics
   */
  getStats() {
    return {
      totalConnections: this.clients.size,
      activeRooms: this.rooms.size,
      roomDetails: Array.from(this.rooms.entries()).map(([name, clients]) => ({
        name,
        clientCount: clients.size
      }))
    };
  }

  /**
   * Generate unique client ID
   */
  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clean up inactive connections
   */
  cleanup() {
    const now = Date.now();
    const timeout = 5 * 60 * 1000; // 5 minutes

    this.clients.forEach((client, clientId) => {
      if (client.ws.readyState !== 1) { // Not OPEN
        this.handleDisconnection(clientId);
      }
    });

    logger.debug('WebSocket cleanup completed');
  }
}

module.exports = new WebSocketHandler();
