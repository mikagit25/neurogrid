/**
 * Authentication Routes - Login, logout, user management, and security operations
 */

const express = require('express');
const { AuthenticationManagerSingleton } = require('../AuthenticationManager');
const { AuthorizationManagerSingleton } = require('../AuthorizationManager');
const { authenticate, requirePermission, validateInput, getRateLimit } = require('../middleware');

const router = express.Router();
const authManager = AuthenticationManagerSingleton.getInstance();
const authzManager = AuthorizationManagerSingleton.getInstance();

// Rate limiting for authentication routes
const authRateLimit = getRateLimit('auth');
const apiRateLimit = getRateLimit('api');

// Login validation schema
const loginSchema = {
  body: {
    username: {
      required: true,
      type: 'string',
      minLength: 3,
      maxLength: 50
    },
    password: {
      required: true,
      type: 'string',
      minLength: 1
    },
    mfaToken: {
      required: false,
      type: 'string',
      minLength: 6,
      maxLength: 6
    }
  }
};

// User creation validation schema
const createUserSchema = {
  body: {
    username: {
      required: true,
      type: 'string',
      minLength: 3,
      maxLength: 50,
      format: 'alphanumeric'
    },
    password: {
      required: true,
      type: 'string',
      format: 'password'
    },
    email: {
      required: true,
      type: 'string',
      format: 'email'
    },
    role: {
      required: false,
      type: 'string',
      enum: ['guest', 'user', 'operator', 'admin']
    }
  }
};

// Routes

/**
 * POST /auth/login
 * User login with username and password
 */
router.post('/login',
  authRateLimit,
  validateInput(loginSchema),
  async (req, res) => {
    try {
      const { username, password, mfaToken } = req.body;

      const result = await authManager.authenticateUser(username, password, mfaToken);

      if (result.success) {
        // Set secure cookie
        res.cookie('token', result.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 24 * 60 * 60 * 1000 // 24 hours
        });

        res.json({
          success: true,
          user: result.user,
          token: result.token,
          expiresAt: result.expiresAt,
          requiresPasswordChange: result.requiresPasswordChange
        });
      } else {
        res.status(401).json(result);
      }

    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({
        success: false,
        error: 'Authentication service error'
      });
    }
  }
);

/**
 * POST /auth/logout
 * User logout - invalidate session
 */
router.post('/logout',
  authenticate,
  async (req, res) => {
    try {
      if (req.sessionId) {
        await authManager.destroySession(req.sessionId);
      }

      // Clear cookie
      res.clearCookie('token');

      res.json({
        success: true,
        message: 'Logged out successfully'
      });

    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        error: 'Logout service error'
      });
    }
  }
);

/**
 * POST /auth/refresh
 * Refresh access token using refresh token
 */
router.post('/refresh',
  authRateLimit,
  validateInput({
    body: {
      refreshToken: {
        required: true,
        type: 'string'
      }
    }
  }),
  async (req, res) => {
    try {
      const { refreshToken } = req.body;

      const result = await authManager.refreshSession(refreshToken);

      if (result.success) {
        // Update cookie
        res.cookie('token', result.token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 24 * 60 * 60 * 1000
        });

        res.json({
          success: true,
          token: result.token,
          refreshToken: result.refreshToken,
          expiresAt: result.expiresAt
        });
      } else {
        res.status(401).json(result);
      }

    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(500).json({
        success: false,
        error: 'Token refresh service error'
      });
    }
  }
);

/**
 * GET /auth/me
 * Get current user information
 */
router.get('/me',
  authenticate,
  async (req, res) => {
    try {
      res.json({
        success: true,
        user: req.user,
        permissions: authzManager.analyzeUserPermissions([req.user.role], req.user.id)
      });

    } catch (error) {
      console.error('Get user info error:', error);
      res.status(500).json({
        success: false,
        error: 'User service error'
      });
    }
  }
);

/**
 * POST /auth/change-password
 * Change user password
 */
router.post('/change-password',
  authenticate,
  validateInput({
    body: {
      currentPassword: {
        required: true,
        type: 'string'
      },
      newPassword: {
        required: true,
        type: 'string',
        format: 'password'
      }
    }
  }),
  async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const username = req.user.username;

      // Verify current password
      const authResult = await authManager.authenticateUser(username, currentPassword);
      if (!authResult.success) {
        return res.status(401).json({
          success: false,
          error: 'Current password is incorrect'
        });
      }

      // Update password
      const updateResult = await authManager.updateUser(username, {
        password: newPassword,
        requirePasswordChange: false
      });

      if (updateResult.success) {
        res.json({
          success: true,
          message: 'Password changed successfully'
        });
      } else {
        res.status(500).json(updateResult);
      }

    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        error: 'Password change service error'
      });
    }
  }
);

/**
 * MFA Routes
 */

/**
 * POST /auth/mfa/enable
 * Enable Multi-Factor Authentication
 */
router.post('/mfa/enable',
  authenticate,
  async (req, res) => {
    try {
      const result = await authManager.enableMFA(req.user.username);

      if (result.success) {
        res.json({
          success: true,
          secret: result.secret,
          qrCode: result.qrCode,
          manualEntry: result.manualEntry
        });
      } else {
        res.status(500).json(result);
      }

    } catch (error) {
      console.error('MFA enable error:', error);
      res.status(500).json({
        success: false,
        error: 'MFA service error'
      });
    }
  }
);

/**
 * POST /auth/mfa/confirm
 * Confirm MFA setup with token
 */
router.post('/mfa/confirm',
  authenticate,
  validateInput({
    body: {
      token: {
        required: true,
        type: 'string',
        minLength: 6,
        maxLength: 6
      }
    }
  }),
  async (req, res) => {
    try {
      const { token } = req.body;
      const result = await authManager.confirmMFA(req.user.username, token);

      res.json(result);

    } catch (error) {
      console.error('MFA confirm error:', error);
      res.status(500).json({
        success: false,
        error: 'MFA confirmation service error'
      });
    }
  }
);

/**
 * POST /auth/mfa/disable
 * Disable Multi-Factor Authentication
 */
router.post('/mfa/disable',
  authenticate,
  validateInput({
    body: {
      password: {
        required: true,
        type: 'string'
      },
      mfaToken: {
        required: true,
        type: 'string',
        minLength: 6,
        maxLength: 6
      }
    }
  }),
  async (req, res) => {
    try {
      const { password, mfaToken } = req.body;
      const result = await authManager.disableMFA(req.user.username, password, mfaToken);

      res.json(result);

    } catch (error) {
      console.error('MFA disable error:', error);
      res.status(500).json({
        success: false,
        error: 'MFA disable service error'
      });
    }
  }
);

/**
 * API Key Routes
 */

/**
 * POST /auth/api-keys
 * Generate new API key
 */
router.post('/api-keys',
  authenticate,
  requirePermission('api:admin'),
  validateInput({
    body: {
      name: {
        required: true,
        type: 'string',
        minLength: 1,
        maxLength: 100
      },
      permissions: {
        required: false,
        type: 'array'
      },
      expiresAt: {
        required: false,
        type: 'string'
      }
    }
  }),
  async (req, res) => {
    try {
      const { name, permissions, expiresAt } = req.body;

      const result = await authManager.generateApiKey(
        req.user.username,
        name,
        permissions,
        expiresAt
      );

      if (result.success) {
        res.json({
          success: true,
          apiKey: result.apiKey,
          keyId: result.keyId,
          expiresAt: result.expiresAt
        });
      } else {
        res.status(500).json(result);
      }

    } catch (error) {
      console.error('API key generation error:', error);
      res.status(500).json({
        success: false,
        error: 'API key service error'
      });
    }
  }
);

/**
 * DELETE /auth/api-keys/:keyId
 * Revoke API key
 */
router.delete('/api-keys/:keyId',
  authenticate,
  requirePermission('api:admin'),
  async (req, res) => {
    try {
      const { keyId } = req.params;
      const result = await authManager.revokeApiKey(keyId);

      res.json(result);

    } catch (error) {
      console.error('API key revocation error:', error);
      res.status(500).json({
        success: false,
        error: 'API key revocation service error'
      });
    }
  }
);

/**
 * User Management Routes (Admin only)
 */

/**
 * POST /auth/users
 * Create new user (Admin only)
 */
router.post('/users',
  authenticate,
  requirePermission('users:create'),
  validateInput(createUserSchema),
  async (req, res) => {
    try {
      const { username, password, email, role } = req.body;

      const result = await authManager.createUser({
        username,
        password,
        email,
        role: role || 'user'
      });

      if (result.success) {
        res.status(201).json({
          success: true,
          user: result.user
        });
      } else {
        res.status(400).json(result);
      }

    } catch (error) {
      console.error('User creation error:', error);
      res.status(500).json({
        success: false,
        error: 'User creation service error'
      });
    }
  }
);

/**
 * GET /auth/users
 * List users (Admin only)
 */
router.get('/users',
  apiRateLimit,
  authenticate,
  requirePermission('users:read'),
  async (req, res) => {
    try {
      const { role, isActive } = req.query;
      const filters = {};

      if (role) filters.role = role;
      if (isActive !== undefined) filters.isActive = isActive === 'true';

      const users = await authManager.getUsers(filters);

      res.json({
        success: true,
        users,
        total: users.length
      });

    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({
        success: false,
        error: 'User service error'
      });
    }
  }
);

/**
 * GET /auth/stats
 * Get authentication statistics (Admin only)
 */
router.get('/stats',
  authenticate,
  requirePermission('system:read'),
  async (req, res) => {
    try {
      const authStats = authManager.getStats();
      const authzStats = authzManager.getStats();

      res.json({
        success: true,
        stats: {
          authentication: authStats,
          authorization: authzStats
        }
      });

    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({
        success: false,
        error: 'Statistics service error'
      });
    }
  }
);

module.exports = router;
