const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const logger = require('./logger');

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_EXPIRE = process.env.JWT_EXPIRE || '24h';
const REFRESH_TOKEN_EXPIRE = process.env.REFRESH_TOKEN_EXPIRE || '7d';

// In-memory storage for refresh tokens (use Redis in production)
const refreshTokens = new Map();
const userAccounts = new Map();
const apiKeys = new Map();

class AuthManager {
  constructor() {
    this.initializeDefaultAccounts();
  }

  initializeDefaultAccounts() {
    // Create default admin account
    const adminPassword = this.hashPassword('admin123');
    const adminApiKey = this.generateApiKey();

    userAccounts.set('admin', {
      id: 'admin',
      email: 'admin@neurogrid.io',
      password: adminPassword,
      role: 'admin',
      permissions: ['*'],
      apiKey: adminApiKey,
      createdAt: new Date().toISOString(),
      lastLogin: null,
      isActive: true
    });

    // Create default user account
    const userPassword = this.hashPassword('user123');
    const userApiKey = this.generateApiKey();

    userAccounts.set('user', {
      id: 'user',
      email: 'user@neurogrid.io',
      password: userPassword,
      role: 'user',
      permissions: ['read:own', 'write:own'],
      apiKey: userApiKey,
      createdAt: new Date().toISOString(),
      lastLogin: null,
      isActive: true
    });

    logger.info('Default accounts initialized', {
      adminApiKey,
      userApiKey
    });
  }

  // Password hashing
  hashPassword(password) {
    return bcrypt.hashSync(password, 12);
  }

  verifyPassword(password, hash) {
    return bcrypt.compareSync(password, hash);
  }

  // JWT token management
  generateTokens(user) {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions
    };

    const accessToken = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRE,
      issuer: 'neurogrid',
      audience: 'neurogrid-api'
    });

    const refreshToken = jwt.sign(
      { id: user.id, type: 'refresh' },
      JWT_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRE }
    );

    // Store refresh token
    refreshTokens.set(refreshToken, {
      userId: user.id,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });

    return { accessToken, refreshToken };
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  refreshAccessToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, JWT_SECRET);

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid refresh token');
      }

      const tokenData = refreshTokens.get(refreshToken);
      if (!tokenData || tokenData.userId !== decoded.id) {
        throw new Error('Invalid refresh token');
      }

      const user = userAccounts.get(decoded.id);
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      // Generate new tokens
      const tokens = this.generateTokens(user);

      // Remove old refresh token
      refreshTokens.delete(refreshToken);

      return tokens;
    } catch (error) {
      throw new Error('Invalid refresh token');
    }
  }

  // API Key management
  generateApiKey() {
    const key = 'ng_' + crypto.randomBytes(32).toString('hex');
    return key;
  }

  validateApiKey(apiKey) {
    // Find user by API key
    for (const [userId, user] of userAccounts.entries()) {
      if (user.apiKey === apiKey && user.isActive) {
        return user;
      }
    }
    return null;
  }

  // User management
  createUser(userData) {
    const { email, password, role = 'user', permissions = ['read:own', 'write:own'] } = userData;

    // Check if user exists
    for (const user of userAccounts.values()) {
      if (user.email === email) {
        throw new Error('User already exists');
      }
    }

    const userId = crypto.randomUUID();
    const hashedPassword = this.hashPassword(password);
    const apiKey = this.generateApiKey();

    const user = {
      id: userId,
      email,
      password: hashedPassword,
      role,
      permissions,
      apiKey,
      createdAt: new Date().toISOString(),
      lastLogin: null,
      isActive: true
    };

    userAccounts.set(userId, user);
    logger.info('User created', { userId, email, role });

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      apiKey: user.apiKey,
      createdAt: user.createdAt
    };
  }

  authenticateUser(email, password) {
    // Find user by email
    for (const user of userAccounts.values()) {
      if (user.email === email && user.isActive) {
        if (this.verifyPassword(password, user.password)) {
          // Update last login
          user.lastLogin = new Date().toISOString();

          logger.info('User authenticated', { userId: user.id, email });
          return user;
        }
      }
    }
    throw new Error('Invalid credentials');
  }

  getUserById(userId) {
    return userAccounts.get(userId);
  }

  updateUser(userId, updates) {
    const user = userAccounts.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Handle password update
    if (updates.password) {
      updates.password = this.hashPassword(updates.password);
    }

    // Handle API key regeneration
    if (updates.regenerateApiKey) {
      updates.apiKey = this.generateApiKey();
      delete updates.regenerateApiKey;
    }

    Object.assign(user, updates, { updatedAt: new Date().toISOString() });
    logger.info('User updated', { userId, updates: Object.keys(updates) });

    return user;
  }

  deactivateUser(userId) {
    const user = userAccounts.get(userId);
    if (!user) {
      throw new Error('User not found');
    }

    user.isActive = false;
    user.deactivatedAt = new Date().toISOString();

    // Revoke all refresh tokens for this user
    for (const [token, data] of refreshTokens.entries()) {
      if (data.userId === userId) {
        refreshTokens.delete(token);
      }
    }

    logger.info('User deactivated', { userId });
    return user;
  }

  // Permission checking
  hasPermission(user, permission) {
    if (!user || !user.permissions) return false;

    // Admin has all permissions
    if (user.permissions.includes('*')) return true;

    // Check specific permission
    return user.permissions.includes(permission);
  }

  canAccessResource(user, resource, action = 'read') {
    if (!user) return false;

    const permission = `${action}:${resource}`;
    const ownPermission = `${action}:own`;

    return this.hasPermission(user, permission) ||
               this.hasPermission(user, ownPermission) ||
               this.hasPermission(user, '*');
  }

  // Session management
  createSession(user, req) {
    const sessionId = crypto.randomUUID();
    const session = {
      id: sessionId,
      userId: user.id,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      isActive: true
    };

    // Store session (in production, use Redis)
    // For now, we'll just log it
    logger.info('Session created', { sessionId, userId: user.id });

    return sessionId;
  }

  // Rate limiting helpers
  getRateLimitKey(identifier, endpoint) {
    return `rate_limit:${identifier}:${endpoint}`;
  }

  // Security utilities
  sanitizeUser(user) {
    if (!user) return null;

    const { password, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  generateSecureToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Cleanup expired tokens
  cleanupExpiredTokens() {
    const now = new Date();

    for (const [token, data] of refreshTokens.entries()) {
      if (new Date(data.expiresAt) < now) {
        refreshTokens.delete(token);
      }
    }
  }

  // Get system stats
  getAuthStats() {
    return {
      totalUsers: userAccounts.size,
      activeUsers: Array.from(userAccounts.values()).filter(u => u.isActive).length,
      activeRefreshTokens: refreshTokens.size,
      adminUsers: Array.from(userAccounts.values()).filter(u => u.role === 'admin').length
    };
  }
}

// Singleton instance
const authManager = new AuthManager();

// Cleanup expired tokens every hour
setInterval(() => {
  authManager.cleanupExpiredTokens();
}, 60 * 60 * 1000);

module.exports = authManager;
