const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');
const helmet = require('helmet');
const { body, param, query, validationResult } = require('express-validator');

const logger = require('../utils/logger');
const User = require('../models/User');
const { AuthenticationManagerSingleton } = require('../security/AuthenticationManager');
const inputValidator = require('./validation');

// Create authentication manager instance
const authManager = AuthenticationManagerSingleton.getInstance();

class SecurityMiddleware {
  constructor(config) {
    this.config = config;
    this.authConfig = config.getAuthConfig();
    this.rateLimitConfig = config.getRateLimitConfig();

    this.setupRateLimiters();
    this.setupSecurityHeaders();
  }

  setupRateLimiters() {
    // General API rate limiter
    this.generalRateLimit = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: this.rateLimitConfig.general,
      message: {
        success: false,
        error: 'Too many requests, please try again later',
        retryAfter: '15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
      handler: (req, res) => {
        logger.warn('Rate limit exceeded', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          path: req.path
        });
        res.status(429).json({
          success: false,
          error: 'Too many requests, please try again later',
          retryAfter: '15 minutes'
        });
      }
    });

    // Authentication rate limiter (stricter)
    this.authRateLimit = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: this.rateLimitConfig.auth,
      message: {
        success: false,
        error: 'Too many authentication attempts, please try again later',
        retryAfter: '15 minutes'
      },
      standardHeaders: true,
      legacyHeaders: false,
      skipSuccessfulRequests: true,
      handler: (req, res) => {
        logger.warn('Auth rate limit exceeded', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          email: req.body?.email
        });
        res.status(429).json({
          success: false,
          error: 'Too many authentication attempts, please try again later',
          retryAfter: '15 minutes'
        });
      }
    });

    // API rate limiter for authenticated users
    this.apiRateLimit = rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: this.rateLimitConfig.api,
      message: {
        success: false,
        error: 'API rate limit exceeded, please upgrade your plan',
        retryAfter: '1 hour'
      },
      keyGenerator: (req) => {
        return req.user?.id || req.ip;
      },
      handler: (req, res) => {
        logger.warn('API rate limit exceeded', {
          userId: req.user?.id,
          ip: req.ip,
          path: req.path
        });
        res.status(429).json({
          success: false,
          error: 'API rate limit exceeded, please upgrade your plan',
          retryAfter: '1 hour'
        });
      }
    });

    // Brute force protection for login attempts
    this.bruteForceProtection = rateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 5, // 5 attempts per hour per IP/email combination
      keyGenerator: (req) => {
        return `${req.ip}:${req.body?.email || 'unknown'}`;
      },
      skipSuccessfulRequests: true,
      handler: (req, res) => {
        logger.error('Brute force attack detected', {
          ip: req.ip,
          email: req.body?.email,
          userAgent: req.get('User-Agent')
        });
        res.status(429).json({
          success: false,
          error: 'Account temporarily locked due to too many failed login attempts',
          retryAfter: '1 hour'
        });
      }
    });
  }

  setupSecurityHeaders() {
    this.securityHeaders = helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'ws:', 'wss:'],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: this.config.get('NODE_ENV') === 'production' ? [] : null
        }
      },
      crossOriginEmbedderPolicy: false,
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    });
  }

  // JWT Authentication
  authenticate(options = {}) {
    return async (req, res, next) => {
      try {
        const token = this.extractToken(req);

        if (!token) {
          if (options.optional) {
            return next();
          }
          return res.status(401).json({
            success: false,
            error: 'Access token required'
          });
        }

        const decoded = jwt.verify(token, this.authConfig.jwtSecret);
        const user = await User.findByPk(decoded.userId, {
          attributes: { exclude: ['password'] }
        });

        if (!user) {
          return res.status(401).json({
            success: false,
            error: 'Invalid token - user not found'
          });
        }

        if (!user.isActive) {
          return res.status(401).json({
            success: false,
            error: 'Account is deactivated'
          });
        }

        req.user = user;
        req.token = decoded;
        next();

      } catch (error) {
        logger.warn('Authentication failed', {
          error: error.message,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });

        if (error.name === 'JsonWebTokenError') {
          return res.status(401).json({
            success: false,
            error: 'Invalid token'
          });
        }

        if (error.name === 'TokenExpiredError') {
          return res.status(401).json({
            success: false,
            error: 'Token expired'
          });
        }

        return res.status(500).json({
          success: false,
          error: 'Authentication error'
        });
      }
    };
  }

  // Role-based authorization
  authorize(roles = []) {
    if (typeof roles === 'string') {
      roles = [roles];
    }

    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      if (roles.length === 0) {
        return next();
      }

      if (!roles.includes(req.user.role)) {
        logger.warn('Authorization failed', {
          userId: req.user.id,
          userRole: req.user.role,
          requiredRoles: roles,
          path: req.path
        });

        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
      }

      next();
    };
  }

  // API Key authentication
  authenticateApiKey() {
    return async (req, res, next) => {
      try {
        const apiKey = req.get('X-API-Key') || req.query.apiKey;

        if (!apiKey) {
          return res.status(401).json({
            success: false,
            error: 'API key required'
          });
        }

        // Hash the provided API key to compare with stored hash
        const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');

        const user = await User.findOne({
          where: { apiKeyHash: hashedKey, isActive: true },
          attributes: { exclude: ['password', 'apiKeyHash'] }
        });

        if (!user) {
          logger.warn('Invalid API key attempt', {
            ip: req.ip,
            userAgent: req.get('User-Agent')
          });

          return res.status(401).json({
            success: false,
            error: 'Invalid API key'
          });
        }

        req.user = user;
        req.apiKeyAuth = true;
        next();

      } catch (error) {
        logger.error('API key authentication error', error);
        return res.status(500).json({
          success: false,
          error: 'Authentication error'
        });
      }
    };
  }

  // Extract JWT token from request
  extractToken(req) {
    const authHeader = req.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check cookie for web clients
    if (req.cookies && req.cookies.accessToken) {
      return req.cookies.accessToken;
    }

    return null;
  }

  // Input sanitization middleware
  sanitizeInput() {
    return (req, res, next) => {
      req.body = inputValidator.sanitize(req.body);
      req.query = inputValidator.sanitize(req.query);
      req.params = inputValidator.sanitize(req.params);
      next();
    };
  }

  // Rate limiters getters
  get rateLimiters() {
    return {
      general: this.generalRateLimit,
      auth: this.authRateLimit,
      api: this.apiRateLimit,
      bruteForce: this.bruteForceProtection
    };
  }
}

// Legacy exports for backward compatibility
const authenticate = (options = {}) => {
  return async (req, res, next) => {
    try {
      const { optional = false, apiKeyOnly = false } = options;

      const user = null;
      let authMethod = null;

      // Try API Key authentication first
      const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
      if (apiKey && apiKey.startsWith('ng_')) {
        // Legacy API key validation
        authMethod = 'api-key';
      }

      // Try JWT authentication if no API key or if not API key only
      if (!user && !apiKeyOnly) {
        const token = req.headers['authorization']?.replace('Bearer ', '');
        if (token && !token.startsWith('ng_')) {
          try {
            // Legacy JWT validation
            authMethod = 'jwt';
          } catch (error) {
            if (!optional) {
              return res.status(401).json({
                success: false,
                error: 'Invalid or expired token',
                code: 'INVALID_TOKEN'
              });
            }
          }
        }
      }

      if (!user && !optional) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      if (user && !user.isActive) {
        return res.status(401).json({
          success: false,
          error: 'Account deactivated',
          code: 'ACCOUNT_DEACTIVATED'
        });
      }

      // Attach user and auth info to request
      req.user = user;
      req.authMethod = authMethod;
      req.isAuthenticated = !!user;

      // Log authentication
      if (user) {
        logger.info('User authenticated', {
          userId: user.id,
          method: authMethod,
          ip: req.ip,
          endpoint: req.path
        });
      }

      next();
    } catch (error) {
      logger.error('Authentication error', error);
      res.status(500).json({
        success: false,
        error: 'Authentication service error',
        code: 'AUTH_ERROR'
      });
    }
  };
};

// Authorization middleware
const authorize = (permissions = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    // Convert single permission to array
    const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];

    // Check if user has any of the required permissions
    const hasPermission = requiredPermissions.some(permission =>
      authManager.hasPermission(req.user, permission)
    );

    if (!hasPermission) {
      logger.warn('Access denied', {
        userId: req.user.id,
        requiredPermissions,
        userPermissions: req.user.permissions,
        endpoint: req.path
      });

      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
        code: 'INSUFFICIENT_PERMISSIONS',
        required: requiredPermissions
      });
    }

    next();
  };
};

// Resource-based authorization
const authorizeResource = (resource, action = 'read') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
        code: 'AUTH_REQUIRED'
      });
    }

    const canAccess = authManager.canAccessResource(req.user, resource, action);

    if (!canAccess) {
      logger.warn('Resource access denied', {
        userId: req.user.id,
        resource,
        action,
        endpoint: req.path
      });

      return res.status(403).json({
        success: false,
        error: `Cannot ${action} ${resource}`,
        code: 'RESOURCE_ACCESS_DENIED'
      });
    }

    next();
  };
};

// Rate limiting configurations
const createRateLimit = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100,
    message = 'Too many requests',
    skipSuccessfulRequests = false,
    keyGenerator = null
  } = options;

  return rateLimit({
    windowMs,
    max,
    message: {
      success: false,
      error: message,
      code: 'RATE_LIMIT_EXCEEDED'
    },
    skipSuccessfulRequests,
    keyGenerator: keyGenerator || ((req) => {
      // Use user ID if authenticated, otherwise IP
      return req.user?.id || req.ip;
    }),
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        userId: req.user?.id,
        ip: req.ip,
        endpoint: req.path
      });

      res.status(429).json({
        success: false,
        error: message,
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: Math.round(windowMs / 1000)
      });
    }
  });
};

// Pre-configured rate limiters
const rateLimiters = {
  // General API rate limit
  api: createRateLimit({
    max: 1000,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: 'API rate limit exceeded'
  }),

  // Authentication endpoints
  auth: createRateLimit({
    max: 10,
    windowMs: 15 * 60 * 1000, // 15 minutes
    message: 'Too many authentication attempts',
    keyGenerator: (req) => req.ip // Always use IP for auth
  }),

  // Task submission
  tasks: createRateLimit({
    max: 50,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: 'Task submission rate limit exceeded'
  }),

  // Support tickets
  support: createRateLimit({
    max: 20,
    windowMs: 60 * 60 * 1000, // 1 hour
    message: 'Support ticket rate limit exceeded'
  })
};

// Validation helpers
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      code: 'VALIDATION_ERROR',
      details: errors.array()
    });
  }
  next();
};

// Common validation schemas
const validations = {
  // User registration/login
  email: body('email').isEmail().normalizeEmail(),
  password: body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),

  // Pagination
  limit: query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  offset: query('offset').optional().isInt({ min: 0 }).toInt(),

  // Common IDs
  uuid: param('id').isUUID(),

  // Task validation
  taskType: body('type').isIn(['ml_inference', 'data_processing', 'compute']),
  priority: body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),

  // Support ticket validation
  subject: body('subject').isLength({ min: 5, max: 100 }).trim(),
  description: body('description').isLength({ min: 10, max: 2000 }).trim(),
  ticketPriority: body('priority').isIn(['low', 'medium', 'high', 'urgent'])
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    requestId: req.requestId,
    userId: req.user?.id,
    endpoint: req.path
  });

  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(err.status || 500).json({
    success: false,
    error: isDevelopment ? err.message : 'Internal server error',
    code: err.code || 'INTERNAL_ERROR',
    requestId: req.requestId,
    ...(isDevelopment && { stack: err.stack })
  });
};

// Request logging middleware
const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // Generate request ID
  req.requestId = require('crypto').randomUUID();

  // Log request
  logger.info('Request started', {
    requestId: req.requestId,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: req.user?.id
  });

  // Override res.json to log response
  const originalJson = res.json;
  res.json = function(data) {
    const duration = Date.now() - startTime;

    logger.info('Request completed', {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      userId: req.user?.id
    });

    return originalJson.call(this, data);
  };

  next();
};

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:8080',
      'https://neurogrid.io'
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-User-ID']
};

// Security headers middleware
const securityHeaders = (req, res, next) => {
  // Remove powered by header
  res.removeHeader('X-Powered-By');

  // Set security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // CSP for API
  res.setHeader('Content-Security-Policy', "default-src 'none'");

  next();
};

// Input sanitization
const sanitizeInput = (req, res, next) => {
  // Basic XSS prevention for string inputs
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      return obj.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }
    if (Array.isArray(obj)) {
      return obj.map(sanitize);
    }
    if (obj && typeof obj === 'object') {
      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = sanitize(value);
      }
      return sanitized;
    }
    return obj;
  };

  req.body = sanitize(req.body);
  req.query = sanitize(req.query);
  req.params = sanitize(req.params);

  next();
};

module.exports = {
  SecurityMiddleware,
  authenticate,
  authorize,
  rateLimiters,
  validations,
  validateRequest,
  requestLogger,
  errorHandler
};
