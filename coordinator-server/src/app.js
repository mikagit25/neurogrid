const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const http = require('http');

const logger = require('./utils/logger');
const { db } = require('./config/database');
const { migrations } = require('./database/migrations');

// Import middleware
const { 
  rateLimiters, 
  authenticate, 
  errorHandler, 
  requestLogger 
} = require('./middleware/security');

// Import routes
const taskRoutes = require('./api/routes/tasks');
const nodeRoutes = require('./api/routes/nodes');
const tokenRoutes = require('./api/routes/tokens');
const paymentRoutes = require('./api/routes/payments');
const walletRoutes = require('./api/routes/wallets');
const systemRoutes = require('./api/routes/system');
const supportRoutes = require('./api/routes/support');
const analyticsRoutes = require('./api/routes/analytics');
const notificationRoutes = require('./api/routes/notifications');

// Import services
const TaskDispatcher = require('./services/TaskDispatcher');
const NodeManager = require('./services/NodeManager');
const TokenEngine = require('./services/TokenEngine');
const PaymentGateway = require('./services/PaymentGateway');
const { WebSocketManager } = require('./services/WebSocketManager');
const { MonitoringService } = require('./services/MonitoringService');
const WalletModel = require('./models/WalletModel');

class CoordinatorServer {
  constructor() {
    this.app = express();
    this.server = null;
    this.port = process.env.PORT || 3001;
    
    // Initialize legacy services
    this.taskDispatcher = new TaskDispatcher();
    this.nodeManager = new NodeManager();
    this.tokenEngine = new TokenEngine();
    
    // Initialize new services
    this.paymentGateway = new PaymentGateway();
    this.walletModel = new WalletModel();
    this.wsManager = null;
    this.monitoringService = null;
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  setupMiddleware() {
    // Security middleware
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "ws:", "wss:"],
        },
      },
      crossOriginEmbedderPolicy: false
    }));

    // CORS configuration
    this.app.use(cors({
      origin: function(origin, callback) {
        const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
          'http://localhost:3000',
          'http://localhost:8080'
        ];
        
        // Allow requests with no origin (mobile apps, etc.)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
          return callback(null, true);
        } else {
          return callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
    }));

    this.app.use(compression());
    this.app.use(morgan('combined', { 
      stream: { write: (msg) => logger.info(msg.trim()) },
      skip: (req, res) => process.env.NODE_ENV === 'production' && req.url === '/health'
    }));

    // Body parsing
    this.app.use(express.json({ 
      limit: '10mb',
      verify: (req, res, buf) => {
        req.rawBody = buf;
      }
    }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Custom middleware
    this.app.use(requestLogger);

    // Rate limiting - different limits for different endpoints
    this.app.use('/api/auth', rateLimiters.auth);
    this.app.use('/api/jobs', rateLimiters.api);
    this.app.use('/api/nodes', rateLimiters.api);
    this.app.use('/api/tasks', rateLimiters.api);
    this.app.use('/api', rateLimiters.general);
  }

  setupRoutes() {
    // Health check endpoint with detailed information
    this.app.get('/health', async (req, res) => {
      try {
        const dbHealth = await db.healthCheck();
        const uptime = process.uptime();
        const memoryUsage = process.memoryUsage();
        
        const healthData = {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: {
            seconds: Math.floor(uptime),
            human: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m ${Math.floor(uptime % 60)}s`
          },
          database: dbHealth,
          memory: {
            rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
            heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
            heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB'
          },
          environment: process.env.NODE_ENV || 'development',
          version: process.env.npm_package_version || '1.0.0'
        };

        // Check if all services are healthy
        if (dbHealth.status !== 'healthy') {
          healthData.status = 'unhealthy';
          return res.status(503).json(healthData);
        }

        res.json(healthData);
      } catch (error) {
        logger.error('Health check failed', { error: error.message });
        res.status(503).json({
          status: 'unhealthy',
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Metrics endpoint (protected)
    this.app.get('/metrics', authenticate, async (req, res) => {
      try {
        if (req.user.role !== 'admin') {
          return res.status(403).json({
            success: false,
            error: 'Access denied'
          });
        }

        const metrics = await this.monitoringService.getMetrics();
        res.json({
          success: true,
          data: metrics
        });
      } catch (error) {
        logger.error('Failed to fetch metrics', { error: error.message });
        res.status(500).json({
          success: false,
          error: 'Failed to fetch metrics'
        });
      }
    });

    // Initialize route services
    const services = {
      taskDispatcher: this.taskDispatcher,
      nodeManager: this.nodeManager,
      tokenEngine: this.tokenEngine,
      paymentGateway: this.paymentGateway,
      walletModel: this.walletModel,
      wsManager: this.wsManager,
      monitoringService: this.monitoringService
    };

    // API routes
    this.app.use('/api/tasks', taskRoutes.router || taskRoutes);
    this.app.use('/api/nodes', nodeRoutes.router || nodeRoutes);
    this.app.use('/api/tokens', tokenRoutes.router || tokenRoutes);
    this.app.use('/api/nodes', require('./api/routes/installer'));
    this.app.use('/api/payments', paymentRoutes.router || paymentRoutes);
    this.app.use('/api/wallets', walletRoutes.router || walletRoutes);
    this.app.use('/api/system', systemRoutes);
    this.app.use('/api/support', supportRoutes);
    this.app.use('/api/analytics', analyticsRoutes);
    this.app.use('/api/notifications', notificationRoutes);

    // Initialize services in routes that need them
    if (taskRoutes.initializeServices) taskRoutes.initializeServices(services);
    if (nodeRoutes.initializeServices) nodeRoutes.initializeServices(services);
    if (tokenRoutes.initializeServices) tokenRoutes.initializeServices(services);
    if (paymentRoutes.initializeServices) paymentRoutes.initializeServices(services);
    if (walletRoutes.initializeServices) walletRoutes.initializeServices(services);

    // Error handler
    this.app.use(errorHandler);

    // 404 handler
    this.app.use('*', (req, res) => {
      logger.warn('Route not found', { 
        method: req.method, 
        url: req.originalUrl, 
        ip: req.ip 
      });
      
      res.status(404).json({
        success: false,
        error: 'Route not found',
        path: req.originalUrl
      });
    });
  }

  setupWebSocket() {
    this.server = http.createServer(this.app);
    
    // Initialize WebSocket manager
    this.wsManager = WebSocketManager.getInstance();
    
    // Setup WebSocket upgrade handling
    this.server.on('upgrade', (request, socket, head) => {
      this.wsManager.handleUpgrade(request, socket, head);
    });
  }



  async initialize() {
    try {
      logger.info('Initializing NeuroGrid Coordinator Server...');

      // Initialize database
      logger.info('Initializing database connection...');
      await db.initialize();

      // Run database migrations
      logger.info('Running database migrations...');
      await migrations.initialize();
      
      // Check if we need to run initial schema
      const status = await migrations.getStatus();
      if (status.applied === 0) {
        logger.info('Setting up initial database schema...');
        await migrations.setupInitialSchema();
      } else {
        logger.info('Running pending migrations...');
        await migrations.migrate();
      }

      // Initialize WebSocket manager
      logger.info('Initializing WebSocket manager...');
      this.wsManager.initialize(this.server);

      // Initialize monitoring service
      logger.info('Initializing monitoring service...');
      this.monitoringService = MonitoringService.getInstance();
      await this.monitoringService.initialize();

      // Initialize legacy services
      logger.info('Initializing legacy services...');
      await this.taskDispatcher.initialize();
      await this.nodeManager.initialize();
      await this.tokenEngine.initialize();

      // Initialize payment services
      logger.info('Initializing payment services...');
      await this.paymentGateway.initialize();
      await this.walletModel.initialize();

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
    logger.info('Starting graceful shutdown...');
    
    try {
      // Stop accepting new connections
      if (this.server) {
        this.server.close(() => {
          logger.info('HTTP server closed');
        });
      }

      // Close WebSocket connections
      if (this.wsManager) {
        this.wsManager.closeAllConnections();
        logger.info('WebSocket connections closed');
      }

      // Stop monitoring service
      if (this.monitoringService) {
        await this.monitoringService.stop();
        logger.info('Monitoring service stopped');
      }

      // Stop legacy services
      if (this.taskDispatcher) {
        await this.taskDispatcher.shutdown();
      }
      if (this.nodeManager) {
        await this.nodeManager.shutdown();
      }
      if (this.tokenEngine) {
        await this.tokenEngine.shutdown();
      }

      // Close database connections
      await db.close();
      logger.info('Database connections closed');

      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown', { error: error.message });
      process.exit(1);
    }
  }
}

// Start server if this file is run directly
if (require.main === module) {
  const server = new CoordinatorServer();
  server.start();
}

module.exports = CoordinatorServer;