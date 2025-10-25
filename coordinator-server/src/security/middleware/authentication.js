/**
 * Authentication Middleware - JWT token validation and user authentication
 */

const jwt = require('jsonwebtoken');
const { AuthenticationManagerSingleton } = require('../AuthenticationManager');

class AuthenticationMiddleware {
  constructor() {
    this.authManager = AuthenticationManagerSingleton.getInstance();
  }

  // Main authentication middleware
  async authenticate(req, res, next) {
    try {
      const token = this.extractToken(req);

      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'Access token required'
        });
      }

      // Verify token
      const verification = await this.authManager.verifyToken(token);

      if (!verification.valid) {
        return res.status(401).json({
          success: false,
          error: verification.error || 'Invalid token'
        });
      }

      // Add user info to request
      req.user = verification.user;
      req.sessionId = verification.sessionId;

      next();

    } catch (error) {
      console.error('Authentication error:', error);
      return res.status(500).json({
        success: false,
        error: 'Authentication service error'
      });
    }
  }

  // Optional authentication (doesn't fail if no token)
  async optionalAuth(req, res, next) {
    try {
      const token = this.extractToken(req);

      if (token) {
        const verification = await this.authManager.verifyToken(token);
        if (verification.valid) {
          req.user = verification.user;
          req.sessionId = verification.sessionId;
        }
      }

      next();

    } catch (error) {
      console.error('Optional authentication error:', error);
      next(); // Continue even if authentication fails
    }
  }

  // API Key authentication
  async authenticateApiKey(req, res, next) {
    try {
      const apiKey = req.headers['x-api-key'] || req.query.apiKey;

      if (!apiKey) {
        return res.status(401).json({
          success: false,
          error: 'API key required'
        });
      }

      const verification = await this.authManager.verifyApiKey(apiKey);

      if (!verification.valid) {
        return res.status(401).json({
          success: false,
          error: verification.error || 'Invalid API key'
        });
      }

      req.user = verification.user;
      req.apiKeyId = verification.keyId;

      next();

    } catch (error) {
      console.error('API key authentication error:', error);
      return res.status(500).json({
        success: false,
        error: 'Authentication service error'
      });
    }
  }

  // Extract token from various sources
  extractToken(req) {
    // Check Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check query parameter
    if (req.query.token) {
      return req.query.token;
    }

    // Check cookies
    if (req.cookies && req.cookies.token) {
      return req.cookies.token;
    }

    return null;
  }
}

// Export singleton instance
const authMiddleware = new AuthenticationMiddleware();

module.exports = {
  authenticate: authMiddleware.authenticate,
  optionalAuth: authMiddleware.optionalAuth,
  authenticateApiKey: authMiddleware.authenticateApiKey
};
