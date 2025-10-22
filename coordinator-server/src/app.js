const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const WebSocket = require('ws');
const http = require('http');

const logger = require('./utils/logger');
const { initializeDatabase } = require('./config/database');
const { initializeRedis } = require('./config/redis');

// Import routes
const taskRoutes = require('./api/routes/tasks');
const nodeRoutes = require('./api/routes/nodes');
const tokenRoutes = require('./api/routes/tokens');
const systemRoutes = require('./api/routes/system');
const supportRoutes = require('./api/routes/support');

// Import services
const TaskDispatcher = require('./services/TaskDispatcher');
const NodeManager = require('./services/NodeManager');
const TokenEngine = require('./services/TokenEngine');

class CoordinatorServer {
  constructor() {
    this.app = express();
    this.server = null;
    this.wss = null;
    this.port = process.env.PORT || 3001;
    
    // Initialize services
    this.taskDispatcher = new TaskDispatcher();
    this.nodeManager = new NodeManager();
    this.tokenEngine = new TokenEngine();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  setupMiddleware() {
    // Security and basic middleware
    this.app.use(helmet());
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    }));
    this.app.use(compression());
    this.app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: parseInt(process.env.API_RATE_LIMIT) || 100,
      message: { error: 'Too many requests, please try again later' }
    });
    this.app.use('/api', limiter);

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      req.requestId = require('uuid').v4();
      logger.info(`${req.method} ${req.path}`, { requestId: req.requestId });
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '0.1.0',
        uptime: process.uptime()
      });
    });

    // Initialize route services
    const services = {
      taskDispatcher: this.taskDispatcher,
      nodeManager: this.nodeManager,
      tokenEngine: this.tokenEngine
    };

    // API routes
    this.app.use('/api/tasks', taskRoutes.router || taskRoutes);
    this.app.use('/api/nodes', nodeRoutes.router || nodeRoutes);
    this.app.use('/api/tokens', tokenRoutes.router || tokenRoutes);
    this.app.use('/api/system', systemRoutes);
    this.app.use('/api/support', supportRoutes);

    // Initialize services in routes that need them
    if (taskRoutes.initializeServices) taskRoutes.initializeServices(services);
    if (nodeRoutes.initializeServices) nodeRoutes.initializeServices(services);
    if (tokenRoutes.initializeServices) tokenRoutes.initializeServices(services);

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        path: req.originalUrl,
        method: req.method
      });
    });

    // Error handler
    this.app.use((err, req, res, next) => {
      logger.error('Unhandled error:', err);
      res.status(500).json({
        error: 'Internal server error',
        requestId: req.requestId
      });
    });
  }

  setupWebSocket() {
    this.server = http.createServer(this.app);
    
    this.wss = new WebSocket.Server({ 
      server: this.server,
      path: '/ws'
    });

    this.wss.on('connection', (ws, req) => {
      logger.info('WebSocket connection established', { ip: req.socket.remoteAddress });
      
      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message);
          await this.handleWebSocketMessage(ws, data);
        } catch (error) {
          logger.error('WebSocket message error:', error);
          ws.send(JSON.stringify({ error: 'Invalid message format' }));
        }
      });

      ws.on('close', () => {
        logger.info('WebSocket connection closed');
      });

      ws.on('error', (error) => {
        logger.error('WebSocket error:', error);
      });
    });
  }

  async handleWebSocketMessage(ws, data) {
    const { type, payload } = data;

    switch (type) {
      case 'node_register':
        await this.nodeManager.registerNode(payload, ws);
        break;
      case 'node_heartbeat':
        await this.nodeManager.processHeartbeat(payload);
        break;
      case 'task_result':
        await this.taskDispatcher.processTaskResult(payload);
        break;
      case 'task_status':
        const status = await this.taskDispatcher.getTaskStatus(payload.taskId);
        ws.send(JSON.stringify({ type: 'task_status_response', data: status }));
        break;
      default:
        ws.send(JSON.stringify({ error: `Unknown message type: ${type}` }));
    }
  }

  async initialize() {
    try {
      // Initialize database connections
      await initializeDatabase();
      await initializeRedis();

      // Initialize services
      await this.taskDispatcher.initialize();
      await this.nodeManager.initialize();
      await this.tokenEngine.initialize();

      logger.info('All services initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize services:', error);
      throw error;
    }
  }

  async start() {
    try {
      await this.initialize();
      
      this.server.listen(this.port, () => {
        logger.info(`NeuroGrid Coordinator Server running on port ${this.port}`);
        logger.info(`WebSocket server running on ws://localhost:${this.port}/ws`);
      });

      // Graceful shutdown
      process.on('SIGTERM', () => this.shutdown());
      process.on('SIGINT', () => this.shutdown());

    } catch (error) {
      logger.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  async shutdown() {
    logger.info('Shutting down server...');
    
    // Close WebSocket server
    if (this.wss) {
      this.wss.close();
    }

    // Close HTTP server
    if (this.server) {
      this.server.close(() => {
        logger.info('Server stopped');
        process.exit(0);
      });
    }
  }
}

// Start server if this file is run directly
if (require.main === module) {
  const server = new CoordinatorServer();
  server.start();
}

module.exports = CoordinatorServer;