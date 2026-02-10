/**
 * Enhanced Authentication Middleware
 * Implements JWT refresh tokens, API key rotation, and advanced security features
 */

const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const redis = require('../config/redis');
const logger = require('../utils/logger');
const { createError } = require('../utils/errors');

class EnhancedAuthMiddleware {
  constructor() {
    this.jwtSecret = process.env.JWT_SECRET;
    this.refreshSecret = process.env.JWT_REFRESH_SECRET;
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '1h';
    this.refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
    
    if (!this.jwtSecret || !this.refreshSecret) {
      throw new Error('JWT secrets must be configured');
    }
  }

  /**
   * Generate access token
   */
  generateAccessToken(payload) {
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.jwtExpiresIn,
      issuer: 'neurogrid',
      subject: payload.userId?.toString()
    });
  }

  /**
   * Generate refresh token
   */
  async generateRefreshToken(user) {
    const payload = {
      userId: user.id,
      email: user.email,
      tokenVersion: user.token_version || 0
    };
    
    const refreshToken = jwt.sign(payload, this.refreshSecret, {
      expiresIn: this.refreshExpiresIn,
      issuer: 'neurogrid',
      subject: user.id.toString()
    });

    // Store in Redis with expiry
    const key = `refresh_token:${user.id}`;
    const expirySeconds = 7 * 24 * 60 * 60; // 7 days
    
    await redis.setex(key, expirySeconds, refreshToken);
    
    logger.info('Generated refresh token for user', {
      userId: user.id,
      expiresIn: this.refreshExpiresIn
    });
    
    return refreshToken;
  }

  /**
   * Verify access token
   */
  async verifyAccessToken(token) {
    try {
      const payload = jwt.verify(token, this.jwtSecret);
      
      // Check if token is blacklisted
      const isBlacklisted = await redis.get(`blacklist:${token}`);
      if (isBlacklisted) {
        throw createError('TOKEN_BLACKLISTED', 'Token has been revoked', 401);
      }
      
      return payload;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw createError('TOKEN_EXPIRED', 'Access token expired', 401);
      } else if (error.name === 'JsonWebTokenError') {
        throw createError('TOKEN_INVALID', 'Invalid access token', 401);
      }
      throw error;
    }
  }

  /**
   * Verify refresh token
   */
  async verifyRefreshToken(token) {
    try {
      const payload = jwt.verify(token, this.refreshSecret);
      
      // Check if token exists in Redis
      const storedToken = await redis.get(`refresh_token:${payload.userId}`);
      if (storedToken !== token) {
        throw createError('REFRESH_TOKEN_INVALID', 'Refresh token not found or expired', 401);
      }
      
      return payload;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw createError('REFRESH_TOKEN_EXPIRED', 'Refresh token expired', 401);
      } else if (error.name === 'JsonWebTokenError') {
        throw createError('REFRESH_TOKEN_INVALID', 'Invalid refresh token', 401);
      }
      throw error;
    }
  }

  /**
   * Rotate API keys for security
   */
  async rotateApiKeys(userId) {
    try {
      const crypto = require('crypto');
      const newApiKey = `ngk_${crypto.randomBytes(32).toString('hex')}`;
      const hashedKey = crypto.createHash('sha256').update(newApiKey).digest('hex');
      
      // Store in database and Redis
      const expiryTime = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
      
      await redis.setex(`api_key:${hashedKey}`, 30 * 24 * 60 * 60, JSON.stringify({
        userId,
        createdAt: new Date().toISOString(),
        expiresAt: expiryTime.toISOString()
      }));
      
      // Invalidate old keys after grace period
      setTimeout(async () => {
        const oldKeys = await redis.keys(`api_key:*:${userId}`);
        if (oldKeys.length > 0) {
          await redis.del(oldKeys);
        }
      }, 5 * 60 * 1000); // 5 minutes grace period
      
      logger.info('API key rotated for user', { userId });
      
      return { apiKey: newApiKey, expiresAt: expiryTime };
    } catch (error) {
      logger.error('Failed to rotate API keys:', error);
      throw createError('KEY_ROTATION_FAILED', 'Failed to rotate API keys', 500);
    }
  }

  /**
   * Authenticate middleware
   */
  authenticate() {
    return async (req, res, next) => {
      try {
        const authHeader = req.headers.authorization;
        const apiKey = req.headers['x-api-key'];
        
        // Check for API key authentication
        if (apiKey) {
          const crypto = require('crypto');
          const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');
          
          const keyData = await redis.get(`api_key:${hashedKey}`);
          if (!keyData) {
            return res.status(401).json({
              success: false,
              error: 'Invalid API key',
              code: 'API_KEY_INVALID'
            });
          }
          
          const { userId, expiresAt } = JSON.parse(keyData);
          if (new Date() > new Date(expiresAt)) {
            return res.status(401).json({
              success: false,
              error: 'API key expired',
              code: 'API_KEY_EXPIRED'
            });
          }
          
          req.user = { id: userId, authType: 'api_key' };
          return next();
        }
        
        // Check for JWT authentication
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({
            success: false,
            error: 'Authorization token required',
            code: 'AUTH_TOKEN_REQUIRED'
          });
        }
        
        const token = authHeader.substring(7);
        const payload = await this.verifyAccessToken(token);
        
        req.user = {
          id: payload.userId,
          email: payload.email,
          role: payload.role,
          authType: 'jwt'
        };
        
        next();
      } catch (error) {
        logger.error('Authentication failed:', error);
        
        return res.status(401).json({
          success: false,
          error: error.message,
          code: error.code || 'AUTH_FAILED'
        });
      }
    };
  }

  /**
   * Refresh token endpoint handler
   */
  async refreshTokenHandler(req, res) {
    try {
      const { refreshToken } = req.body;
      
      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          error: 'Refresh token required',
          code: 'REFRESH_TOKEN_REQUIRED'
        });
      }
      
      const payload = await this.verifyRefreshToken(refreshToken);
      
      // Generate new access token
      const newAccessToken = this.generateAccessToken({
        userId: payload.userId,
        email: payload.email,
        role: payload.role
      });
      
      logger.info('Token refreshed successfully', { userId: payload.userId });
      
      res.json({
        success: true,
        data: {
          accessToken: newAccessToken,
          expiresIn: this.jwtExpiresIn
        }
      });
    } catch (error) {
      logger.error('Token refresh failed:', error);
      
      res.status(401).json({
        success: false,
        error: error.message,
        code: error.code || 'TOKEN_REFRESH_FAILED'
      });
    }
  }

  /**
   * Logout handler - blacklist tokens
   */
  async logoutHandler(req, res) {
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        
        // Add token to blacklist
        const decoded = jwt.decode(token);
        if (decoded && decoded.exp) {
          const ttl = decoded.exp - Math.floor(Date.now() / 1000);
          if (ttl > 0) {
            await redis.setex(`blacklist:${token}`, ttl, '1');
          }
        }
        
        // Remove refresh token
        if (req.user) {
          await redis.del(`refresh_token:${req.user.id}`);
        }
      }
      
      res.json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      logger.error('Logout failed:', error);
      
      res.status(500).json({
        success: false,
        error: 'Logout failed',
        code: 'LOGOUT_FAILED'
      });
    }
  }
}

// Rate limiting configurations
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: {
    success: false,
    error: 'Too many authentication attempts, please try again later',
    code: 'AUTH_RATE_LIMITED'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.API_RATE_LIMIT_MAX) || 1000,
  message: {
    success: false,
    error: 'API rate limit exceeded',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/api/v1/health';
  }
});

const strictApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute for sensitive endpoints
  message: {
    success: false,
    error: 'Strict rate limit exceeded',
    code: 'STRICT_RATE_LIMIT_EXCEEDED'
  }
});

const enhancedAuth = new EnhancedAuthMiddleware();

module.exports = {
  enhancedAuth,
  authLimiter,
  apiLimiter,
  strictApiLimiter
};