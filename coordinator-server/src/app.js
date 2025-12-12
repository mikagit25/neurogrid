const express = require('express');
const cors = require('cors');
const helmet = require('helmet'); // eslint-disable-line no-unused-vars
const morgan = require('morgan');
const compression = require('compression');
const http = require('http');

const logger = require('./utils/logger');
const ConfigManager = require('./config/manager');
const { db } = require('./config/database');
const { migrations } = require('./database/migrations');

// Import Redis and caching services
const RedisConfig = require('./config/redis');
const CacheService = require('./services/CacheService');
const CacheMiddleware = require('./middleware/cache');
const SessionConfig = require('./config/session');

// Import middleware
const {
  SecurityMiddleware,
  rateLimiters,
  authenticate,
  errorHandler,
  requestLogger
} = require('./middleware/security');
const AuthenticationService = require('./services/AuthenticationService');

// Import routes
const authRoutes = require('./api/routes/auth'); // eslint-disable-line no-unused-vars
const taskRoutes = require('./api/routes/tasks');
const nodeRoutes = require('./api/routes/nodes');
const tokenRoutes = require('./api/routes/tokens');
const paymentRoutes = require('./api/routes/payments');
const walletRoutes = require('./api/routes/wallets');
const systemRoutes = require('./api/routes/system');
const supportRoutes = require('./api/routes/support');
const analyticsRoutes = require('./api/routes/analytics');
const notificationRoutes = require('./api/routes/notifications');
const profileRoutes = require('./api/routes/profile');
const consensusRoutes = require('./routes/consensus');
const advancedAnalyticsRoutes = require('./routes/analytics');
const deploymentRoutes = require('./routes/deployment');
const reputationRoutes = require('./routes/reputation');
const agentsRoutes = require('./routes/agents');

// Import services
const TaskDispatcher = require('./services/TaskDispatcher');
const NodeManager = require('./services/NodeManager');
const TokenEngine = require('./services/TokenEngine');
const PaymentGateway = require('./services/PaymentGateway');
const { WebSocketManager } = require('./services/WebSocketManager');
const { MonitoringService } = require('./services/MonitoringService');
const WalletModel = require('./models/WalletModel');

// Import security infrastructure
const { AuthenticationManagerSingleton } = require('./security/AuthenticationManager');
const { AuthorizationManagerSingleton } = require('./security/AuthorizationManager');
const { EncryptionManagerSingleton } = require('./security/EncryptionManager');
const securityMiddleware = require('./security/middleware');
const securityRoutes = require('./security/routes');

// Import monitoring infrastructure
const MonitoringController = require('./controllers/MonitoringController');

// Import Swagger documentation
const { setupApiDocs, specs } = require('./config/swagger');

class CoordinatorServer {
  constructor(config) {
    this.config = config;
    this.app = express();
    this.server = null;
    this.port = config.get('PORT', 3001);

    // Initialize Redis and caching
    this.redisConfig = new RedisConfig(config);
    this.cacheService = null;
    this.cacheMiddleware = null;
    this.sessionConfig = null;

    // Initialize legacy services
    this.taskDispatcher = new TaskDispatcher();
    this.nodeManager = new NodeManager();
    this.tokenEngine = new TokenEngine();

    // Initialize new services
    this.paymentGateway = new PaymentGateway();
    this.walletModel = new WalletModel();
    this.wsManager = null;
    this.monitoringService = null;

    // Initialize monitoring infrastructure
    this.monitoringController = new MonitoringController(config, {
      database: db,
      redis: null // Will be set up when Redis is initialized
    });

    // Initialize security services
    this.securityMiddleware = new SecurityMiddleware(config);
    this.authService = new AuthenticationService(config);

    // Initialize new security infrastructure
    this.authManager = AuthenticationManagerSingleton.getInstance({
      jwtSecret: config.get('JWT_SECRET', 'your-jwt-secret-key'),
      enableMFA: config.get('ENABLE_MFA', true),
      enableApiKeys: config.get('ENABLE_API_KEYS', true)
    });
    this.authzManager = AuthorizationManagerSingleton.getInstance();
    this.encryptionManager = EncryptionManagerSingleton.getInstance({
      keyStorePath: config.get('KEY_STORE_PATH', './keystore')
    });

    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
  }

  setupMiddleware() {
    // New security infrastructure
    this.app.use(securityMiddleware.helmet);
    this.app.use(securityMiddleware.sanitizeInput);

    // Enhanced security headers (fallback)
    if (this.securityMiddleware) {
      this.app.use(this.securityMiddleware.securityHeaders);
      this.app.use(this.securityMiddleware.sanitizeInput());
    }

    // CORS configuration
    const corsConfig = this.config.getCorsConfig();
    this.app.use(cors({
      origin: function(origin, callback) {
        const allowedOrigins = corsConfig.origin.length > 0 ? corsConfig.origin : [
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

    // Session management (must be before body parsing)
    if (this.sessionConfig) {
      this.app.use(this.sessionConfig.getSessionMiddleware());
    }

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

    // Add performance monitoring middleware
    this.app.use(this.monitoringController.getPerformanceMiddleware());

    // Add caching middleware
    if (this.cacheMiddleware) {
      this.app.use(this.cacheMiddleware.sessionCache());
      this.app.use(this.cacheMiddleware.authCache());
    }

    // Enhanced rate limiting with security middleware
    if (this.securityMiddleware) {
      this.app.use('/api/auth/login', this.securityMiddleware.rateLimiters.bruteForce);
      this.app.use('/api/auth', this.securityMiddleware.rateLimiters.auth);
      this.app.use('/api', this.securityMiddleware.rateLimiters.api);
      this.app.use(this.securityMiddleware.rateLimiters.general);
    } else {
      // Fallback to legacy rate limiters
      this.app.use('/api/auth', rateLimiters.auth);
      this.app.use('/api/jobs', rateLimiters.api);
      this.app.use('/api/nodes', rateLimiters.api);
      this.app.use('/api/tasks', rateLimiters.api);
      this.app.use('/api', rateLimiters.general);
    }
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

        // Add cache metrics if available
        if (this.cacheService) {
          const cacheStats = await this.cacheService.getStats();
          metrics.cache = cacheStats;
        }

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

    // Cache management endpoints (admin only)
    this.app.get('/api/admin/cache/stats', authenticate, async (req, res) => {
      try {
        if (req.user.role !== 'admin') {
          return res.status(403).json({
            success: false,
            error: 'Access denied'
          });
        }

        if (!this.cacheService) {
          return res.json({
            success: true,
            data: { status: 'unavailable', message: 'Cache service not initialized' }
          });
        }

        const stats = await this.cacheService.getStats();
        const health = await this.cacheService.healthCheck();

        res.json({
          success: true,
          data: { stats, health }
        });
      } catch (error) {
        logger.error('Failed to get cache stats', { error: error.message });
        res.status(500).json({
          success: false,
          error: 'Failed to get cache stats'
        });
      }
    });

    this.app.post('/api/admin/cache/invalidate', authenticate, async (req, res) => {
      try {
        if (req.user.role !== 'admin') {
          return res.status(403).json({
            success: false,
            error: 'Access denied'
          });
        }

        if (!this.cacheService) {
          return res.status(503).json({
            success: false,
            error: 'Cache service not available'
          });
        }

        const { pattern, tags } = req.body;
        let invalidated = 0;

        if (pattern) {
          invalidated = await this.cacheService.redis.invalidatePattern(pattern);
        } else if (tags && Array.isArray(tags)) {
          invalidated = await this.cacheService.invalidateByTags(tags);
        }

        logger.info('Cache invalidation requested by admin', {
          userId: req.user.id,
          pattern,
          tags,
          invalidated
        });

        res.json({
          success: true,
          data: { invalidated, pattern, tags }
        });
      } catch (error) {
        logger.error('Cache invalidation failed', { error: error.message });
        res.status(500).json({
          success: false,
          error: 'Cache invalidation failed'
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

    // API Documentation
    // Setup API documentation
    setupApiDocs(this.app);

    // JSON schema endpoint
    this.app.get('/api-docs.json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(specs);
    });

    // Monitoring routes (must be before authentication to allow health checks)
    this.app.use('/api/monitoring', this.monitoringController.createRoutes());

    // API routes
    this.app.use('/api/auth', securityRoutes.auth); // New security-enhanced auth routes
    this.app.use('/api/tasks', taskRoutes.router || taskRoutes);
    this.app.use('/api/nodes', nodeRoutes.router || nodeRoutes);
    this.app.use('/api/tokens', require('./routes/tokens')); // Basic tokenization routes
    this.app.use('/api/nodes', require('./api/routes/installer'));
    this.app.use('/api/payments', paymentRoutes.router || paymentRoutes);
    this.app.use('/api/wallets', walletRoutes.router || walletRoutes);
    this.app.use('/api/system', systemRoutes);
    this.app.use('/api/support', supportRoutes);
    this.app.use('/api/analytics', analyticsRoutes);
    this.app.use('/api/notifications', notificationRoutes);
    this.app.use('/api/profile', profileRoutes.router || profileRoutes);
    this.app.use('/api/consensus', consensusRoutes);
    this.app.use('/api/advanced-analytics', advancedAnalyticsRoutes);
    this.app.use('/api/reputation', reputationRoutes);
    this.app.use('/api/agents', agentsRoutes);
    this.app.use('/api/deployment', deploymentRoutes);

    // Cache demo routes (for testing and demonstration)
    const cacheDemo = require('./api/routes/cache-demo');
    this.app.use('/api/cache', cacheDemo.router);

    // Initialize services in routes that need them
    if (taskRoutes.initializeServices) taskRoutes.initializeServices(services);
    if (nodeRoutes.initializeServices) nodeRoutes.initializeServices(services);
    if (tokenRoutes.initializeServices) tokenRoutes.initializeServices(services);
    if (paymentRoutes.initializeServices) paymentRoutes.initializeServices(services);
    if (walletRoutes.initializeServices) walletRoutes.initializeServices(services);
    if (profileRoutes.initializeServices) profileRoutes.initializeServices(services);
    if (cacheDemo.initializeServices) cacheDemo.initializeServices(services);

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

      // Initialize Redis (optional - will continue without if Redis is unavailable)
      logger.info('Initializing Redis connection...');
      try {
        await this.redisConfig.initialize();
        this.cacheService = new CacheService(this.redisConfig);
        this.cacheMiddleware = new CacheMiddleware(this.cacheService);
        this.sessionConfig = new SessionConfig(this.config, this.redisConfig);
        logger.info('Redis and caching services initialized successfully');
      } catch (error) {
        logger.warn('Redis not available, continuing without caching', {
          error: error.message
        });
        // Initialize fallback session config without Redis
        this.sessionConfig = new SessionConfig(this.config, null);
      }

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

      // Start monitoring controller services
      logger.info('Starting monitoring infrastructure...');
      // Monitoring controller services start automatically on initialization

      // Initialize legacy services
      logger.info('Initializing legacy services...');
      // await this.taskDispatcher.initialize();
      // await this.nodeManager.initialize();
      // await this.tokenEngine.initialize();

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

      // Stop monitoring services
      if (this.monitoringService) {
        await this.monitoringService.stop();
        logger.info('Monitoring service stopped');
      }

      if (this.monitoringController) {
        this.monitoringController.shutdown();
        logger.info('Monitoring controller stopped');
      }

      // Stop legacy services
      if (this.taskDispatcher && this.taskDispatcher.shutdown) {
        await this.taskDispatcher.shutdown();
      }
      if (this.nodeManager && this.nodeManager.shutdown) {
        await this.nodeManager.shutdown();
      }
      if (this.tokenEngine && this.tokenEngine.shutdown) {
        await this.tokenEngine.shutdown();
      }

      // Close Redis connections
      if (this.redisConfig) {
        await this.redisConfig.disconnect();
        logger.info('Redis connections closed');
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

// Initialize and start server
async function initializeServer() {
  try {
    logger.info('Initializing NeuroGrid Coordinator Server...');

    // Load configuration
    const config = await ConfigManager.create();
    logger.info('Configuration loaded and validated');

    // Create and start server
    const server = new CoordinatorServer(config);
    await server.start();

    return server;
  } catch (error) {
    logger.error('Failed to initialize server:', error);
    process.exit(1);
  }
}

// Start server if this file is run directly
if (require.main === module) {
  initializeServer();
}

module.exports = { CoordinatorServer, initializeServer };
