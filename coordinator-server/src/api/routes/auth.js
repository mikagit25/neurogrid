const express = require('express');
const { body, validationResult } = require('express-validator');

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

const router = express.Router();
const _AuthenticationService = require('../../services/AuthenticationService');
const AuthenticationManager = require('../../security/AuthenticationManager');
const _inputValidator = require('../../middleware/validation');
const { _SecurityMiddleware, authenticate, authorize, rateLimiters } = require('../../middleware/security');
const _User = require('../../models/User');
const _logger = require('../../utils/logger');

// Create authentication manager instance
const authManager = new AuthenticationManager();

// Validation functions
const validations = {
  email: body('email').isEmail().normalizeEmail(),
  password: body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  username: body('username').isLength({ min: 3, max: 50 }).isAlphanumeric()
};

// Middleware to validate request
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// These will be injected by the app (preserved for future use)
let _authService;
let _securityMiddleware;

// Dependency injection
router.setDependencies = (auth, security) => {
  _authService = auth;
  _securityMiddleware = security;
};

// Login endpoint
router.post('/login',
  rateLimiters.auth,
  validations.email,
  validations.password,
  validateRequest,
  async (req, res) => {
    try {
      const { email, password } = req.body;

      // Authenticate user
      const user = authManager.authenticateUser(email, password);

      // Generate tokens
      const tokens = authManager.generateTokens(user);

      // Create session
      const sessionId = authManager.createSession(user, req);

      res.json({
        success: true,
        data: {
          user: authManager.sanitizeUser(user),
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          sessionId
        },
        message: 'Login successful'
      });

    } catch (error) {
      res.status(401).json({
        success: false,
        error: error.message,
        code: 'AUTHENTICATION_FAILED'
      });
    }
  }
);

// Register endpoint
router.post('/register',
  rateLimiters.auth,
  validations.email,
  validations.password,
  validateRequest,
  async (req, res) => {
    try {
      const { email, password, role } = req.body;

      // Create user
      const user = authManager.createUser({
        email,
        password,
        role: role || 'user' // Default to user role
      });

      res.status(201).json({
        success: true,
        data: user,
        message: 'User registered successfully'
      });

    } catch (error) {
      const statusCode = error.message === 'User already exists' ? 409 : 400;
      res.status(statusCode).json({
        success: false,
        error: error.message,
        code: 'REGISTRATION_FAILED'
      });
    }
  }
);

// Refresh token endpoint
router.post('/refresh',
  rateLimiters.auth,
  async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          error: 'Refresh token required',
          code: 'MISSING_REFRESH_TOKEN'
        });
      }

      const tokens = authManager.refreshAccessToken(refreshToken);

      res.json({
        success: true,
        data: tokens,
        message: 'Token refreshed successfully'
      });

    } catch (error) {
      res.status(401).json({
        success: false,
        error: error.message,
        code: 'TOKEN_REFRESH_FAILED'
      });
    }
  }
);

// Logout endpoint
router.post('/logout',
  authenticate(),
  async (req, res) => {
    try {
      const { refreshToken } = req.body;

      // In production, you would invalidate the tokens in your token store
      // For now, we'll just log the logout

      res.json({
        success: true,
        message: 'Logged out successfully'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Logout failed',
        code: 'LOGOUT_FAILED'
      });
    }
  }
);

// Get current user profile
router.get('/me',
  authenticate(),
  async (req, res) => {
    try {
      res.json({
        success: true,
        data: authManager.sanitizeUser(req.user)
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get user profile',
        code: 'PROFILE_ERROR'
      });
    }
  }
);

// Update current user profile
router.put('/me',
  authenticate(),
  validateRequest,
  async (req, res) => {
    try {
      const allowedUpdates = ['email', 'password'];
      const updates = {};

      // Filter allowed updates
      for (const field of allowedUpdates) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No valid updates provided',
          code: 'NO_UPDATES'
        });
      }

      const updatedUser = authManager.updateUser(req.user.id, updates);

      res.json({
        success: true,
        data: authManager.sanitizeUser(updatedUser),
        message: 'Profile updated successfully'
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'UPDATE_FAILED'
      });
    }
  }
);

// Regenerate API key
router.post('/api-key/regenerate',
  authenticate(),
  async (req, res) => {
    try {
      const updatedUser = authManager.updateUser(req.user.id, {
        regenerateApiKey: true
      });

      res.json({
        success: true,
        data: {
          apiKey: updatedUser.apiKey
        },
        message: 'API key regenerated successfully'
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to regenerate API key',
        code: 'API_KEY_ERROR'
      });
    }
  }
);

// Validate token endpoint (for external services)
router.post('/validate',
  async (req, res) => {
    try {
      const { token, apiKey } = req.body;

      let user = null;
      let tokenType = null;

      if (apiKey) {
        user = authManager.validateApiKey(apiKey);
        tokenType = 'api-key';
      } else if (token) {
        const decoded = authManager.verifyToken(token);
        user = authManager.getUserById(decoded.id);
        tokenType = 'jwt';
      }

      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          error: 'Invalid or expired token',
          code: 'INVALID_TOKEN'
        });
      }

      res.json({
        success: true,
        data: {
          user: authManager.sanitizeUser(user),
          tokenType
        },
        message: 'Token is valid'
      });

    } catch (error) {
      res.status(401).json({
        success: false,
        error: 'Token validation failed',
        code: 'VALIDATION_FAILED'
      });
    }
  }
);

// Admin endpoints
router.get('/users',
  authenticate(),
  authorize(['admin', 'user:read']),
  async (req, res) => {
    try {
      const { limit = 20, offset = 0, role, active } = req.query;

      // Get all users (in production, this would be a database query)
      let users = Array.from(authManager.userAccounts || new Map()).map(([id, user]) => user);

      // Apply filters
      if (role) {
        users = users.filter(user => user.role === role);
      }

      if (active !== undefined) {
        const isActive = active === 'true';
        users = users.filter(user => user.isActive === isActive);
      }

      // Apply pagination
      const total = users.length;
      const paginatedUsers = users.slice(offset, offset + limit);

      res.json({
        success: true,
        data: {
          users: paginatedUsers.map(user => authManager.sanitizeUser(user)),
          pagination: {
            total,
            limit: parseInt(limit),
            offset: parseInt(offset),
            hasMore: total > offset + limit
          }
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get users',
        code: 'USERS_ERROR'
      });
    }
  }
);

// Create user (admin only)
router.post('/users',
  authenticate(),
  authorize(['admin']),
  validations.email,
  validations.password,
  validateRequest,
  async (req, res) => {
    try {
      const { email, password, role, permissions } = req.body;

      const user = authManager.createUser({
        email,
        password,
        role,
        permissions
      });

      res.status(201).json({
        success: true,
        data: user,
        message: 'User created successfully'
      });

    } catch (error) {
      const statusCode = error.message === 'User already exists' ? 409 : 400;
      res.status(statusCode).json({
        success: false,
        error: error.message,
        code: 'USER_CREATION_FAILED'
      });
    }
  }
);

// Update user (admin only)
router.put('/users/:userId',
  authenticate(),
  authorize(['admin']),
  validateRequest,
  async (req, res) => {
    try {
      const { userId } = req.params;
      const updates = req.body;

      const updatedUser = authManager.updateUser(userId, updates);

      res.json({
        success: true,
        data: authManager.sanitizeUser(updatedUser),
        message: 'User updated successfully'
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'USER_UPDATE_FAILED'
      });
    }
  }
);

// Deactivate user (admin only)
router.delete('/users/:userId',
  authenticate(),
  authorize(['admin']),
  async (req, res) => {
    try {
      const { userId } = req.params;

      const deactivatedUser = authManager.deactivateUser(userId);

      res.json({
        success: true,
        data: authManager.sanitizeUser(deactivatedUser),
        message: 'User deactivated successfully'
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
        code: 'USER_DEACTIVATION_FAILED'
      });
    }
  }
);

// Get authentication statistics
router.get('/stats',
  authenticate(),
  authorize(['admin']),
  async (req, res) => {
    try {
      const stats = authManager.getAuthStats();

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get auth statistics',
        code: 'STATS_ERROR'
      });
    }
  }
);

module.exports = router;
