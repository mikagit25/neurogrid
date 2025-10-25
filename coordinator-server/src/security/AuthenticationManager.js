/**
 * Authentication Manager - Handles user authentication and session management
 * Supports multiple authentication methods: JWT, OAuth2, API Keys, and Multi-Factor Authentication
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const { EventEmitter } = require('events');

class AuthenticationManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.config = {
      jwtSecret: options.jwtSecret || crypto.randomBytes(64).toString('hex'),
      jwtExpiresIn: options.jwtExpiresIn || '24h',
      refreshTokenExpiresIn: options.refreshTokenExpiresIn || '7d',
      bcryptRounds: options.bcryptRounds || 12,
      maxLoginAttempts: options.maxLoginAttempts || 5,
      lockoutTime: options.lockoutTime || 15 * 60 * 1000, // 15 minutes
      enableMFA: options.enableMFA !== false,
      sessionTimeout: options.sessionTimeout || 24 * 60 * 60 * 1000, // 24 hours
      enableApiKeys: options.enableApiKeys !== false,
      apiKeyLength: options.apiKeyLength || 32
    };

    // In-memory stores (in production, use Redis or database)
    this.users = new Map();
    this.sessions = new Map();
    this.refreshTokens = new Map();
    this.apiKeys = new Map();
    this.loginAttempts = new Map();
    this.lockedAccounts = new Map();

    // Statistics
    this.stats = {
      totalLogins: 0,
      successfulLogins: 0,
      failedLogins: 0,
      activeSessions: 0,
      mfaEnabled: 0,
      apiKeysIssued: 0,
      accountsLocked: 0
    };

    // Initialize cleanup intervals
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Every minute

    // Initialize default admin user
    this.initializeDefaultUsers();
  }

  async initializeDefaultUsers() {
    // Create default admin user if none exists
    if (this.users.size === 0) {
      await this.createUser({
        username: 'admin',
        password: 'admin123', // Should be changed on first login
        email: 'admin@neurogrid.local',
        role: 'admin',
        permissions: ['*'], // All permissions
        requirePasswordChange: true
      });

      console.log('Default admin user created: admin/admin123');
    }
  }

  async createUser(userData) {
    try {
      const { username, password, email, role = 'user', permissions = [], requirePasswordChange = false } = userData;

      // Validate input
      if (!username || !password || !email) {
        throw new Error('Username, password, and email are required');
      }

      // Check if user already exists
      if (this.users.has(username)) {
        throw new Error('User already exists');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, this.config.bcryptRounds);

      // Create user object
      const user = {
        id: crypto.randomUUID(),
        username,
        email,
        password: hashedPassword,
        role,
        permissions,
        createdAt: new Date(),
        lastLogin: null,
        isActive: true,
        requirePasswordChange,
        mfaEnabled: false,
        mfaSecret: null,
        loginAttempts: 0,
        lastLoginAttempt: null,
        metadata: userData.metadata || {}
      };

      this.users.set(username, user);

      this.emit('userCreated', { user: this.sanitizeUser(user) });

      return {
        success: true,
        user: this.sanitizeUser(user)
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async authenticateUser(username, password, mfaToken = null) {
    try {
      this.stats.totalLogins++;

      // Check if account is locked
      if (this.isAccountLocked(username)) {
        this.stats.failedLogins++;
        return {
          success: false,
          error: 'Account is temporarily locked due to too many failed attempts',
          lockedUntil: this.lockedAccounts.get(username)
        };
      }

      // Get user
      const user = this.users.get(username);
      if (!user || !user.isActive) {
        this.recordFailedAttempt(username);
        this.stats.failedLogins++;
        return {
          success: false,
          error: 'Invalid credentials'
        };
      }

      // Verify password
      const passwordValid = await bcrypt.compare(password, user.password);
      if (!passwordValid) {
        this.recordFailedAttempt(username);
        this.stats.failedLogins++;
        return {
          success: false,
          error: 'Invalid credentials'
        };
      }

      // Check MFA if enabled
      if (user.mfaEnabled) {
        if (!mfaToken) {
          return {
            success: false,
            error: 'MFA token required',
            requiresMFA: true
          };
        }

        const mfaValid = this.verifyMFAToken(user.mfaSecret, mfaToken);
        if (!mfaValid) {
          this.recordFailedAttempt(username);
          this.stats.failedLogins++;
          return {
            success: false,
            error: 'Invalid MFA token'
          };
        }
      }

      // Clear failed attempts
      this.loginAttempts.delete(username);
      this.lockedAccounts.delete(username);

      // Update user
      user.lastLogin = new Date();
      user.loginAttempts = 0;

      // Create session
      const session = await this.createSession(user);

      this.stats.successfulLogins++;

      this.emit('userAuthenticated', {
        user: this.sanitizeUser(user),
        sessionId: session.id
      });

      return {
        success: true,
        user: this.sanitizeUser(user),
        token: session.token,
        refreshToken: session.refreshToken,
        expiresAt: session.expiresAt,
        requiresPasswordChange: user.requirePasswordChange
      };

    } catch (error) {
      this.stats.failedLogins++;
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createSession(user) {
    const sessionId = crypto.randomUUID();
    const tokenPayload = {
      userId: user.id,
      username: user.username,
      role: user.role,
      permissions: user.permissions,
      sessionId
    };

    const token = jwt.sign(tokenPayload, this.config.jwtSecret, {
      expiresIn: this.config.jwtExpiresIn
    });

    const refreshToken = crypto.randomBytes(32).toString('hex');

    const session = {
      id: sessionId,
      userId: user.id,
      username: user.username,
      token,
      refreshToken,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.config.sessionTimeout),
      lastActivity: new Date(),
      ipAddress: null, // Set by middleware
      userAgent: null, // Set by middleware
      isActive: true
    };

    this.sessions.set(sessionId, session);
    this.refreshTokens.set(refreshToken, {
      sessionId,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    });

    this.stats.activeSessions++;

    return session;
  }

  async verifyToken(token) {
    try {
      const decoded = jwt.verify(token, this.config.jwtSecret);
      const session = this.sessions.get(decoded.sessionId);

      if (!session || !session.isActive) {
        return { valid: false, error: 'Session not found or inactive' };
      }

      if (new Date() > session.expiresAt) {
        await this.destroySession(session.id);
        return { valid: false, error: 'Session expired' };
      }

      // Update last activity
      session.lastActivity = new Date();

      return {
        valid: true,
        user: {
          id: decoded.userId,
          username: decoded.username,
          role: decoded.role,
          permissions: decoded.permissions
        },
        sessionId: decoded.sessionId
      };

    } catch (error) {
      return {
        valid: false,
        error: error.message
      };
    }
  }

  async refreshSession(refreshToken) {
    try {
      const tokenData = this.refreshTokens.get(refreshToken);

      if (!tokenData) {
        return {
          success: false,
          error: 'Invalid refresh token'
        };
      }

      if (new Date() > tokenData.expiresAt) {
        this.refreshTokens.delete(refreshToken);
        return {
          success: false,
          error: 'Refresh token expired'
        };
      }

      const session = this.sessions.get(tokenData.sessionId);
      if (!session) {
        this.refreshTokens.delete(refreshToken);
        return {
          success: false,
          error: 'Session not found'
        };
      }

      const user = Array.from(this.users.values()).find(u => u.id === tokenData.userId);
      if (!user || !user.isActive) {
        return {
          success: false,
          error: 'User not found or inactive'
        };
      }

      // Create new session
      const newSession = await this.createSession(user);

      // Remove old session and refresh token
      await this.destroySession(session.id);
      this.refreshTokens.delete(refreshToken);

      return {
        success: true,
        token: newSession.token,
        refreshToken: newSession.refreshToken,
        expiresAt: newSession.expiresAt
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async destroySession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);

      // Remove associated refresh token
      for (const [token, data] of this.refreshTokens.entries()) {
        if (data.sessionId === sessionId) {
          this.refreshTokens.delete(token);
          break;
        }
      }

      this.stats.activeSessions = Math.max(0, this.stats.activeSessions - 1);

      this.emit('sessionDestroyed', { sessionId });

      return { success: true };
    }

    return { success: false, error: 'Session not found' };
  }

  // MFA (Multi-Factor Authentication) methods
  async enableMFA(username) {
    const user = this.users.get(username);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const secret = speakeasy.generateSecret({
      name: `NeuroGrid (${username})`,
      issuer: 'NeuroGrid'
    });

    user.mfaSecret = secret.base32;

    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

    this.stats.mfaEnabled++;

    return {
      success: true,
      secret: secret.base32,
      qrCode: qrCodeUrl,
      manualEntry: secret.otpauth_url
    };
  }

  async confirmMFA(username, token) {
    const user = this.users.get(username);
    if (!user || !user.mfaSecret) {
      return { success: false, error: 'MFA not initialized' };
    }

    const verified = this.verifyMFAToken(user.mfaSecret, token);

    if (verified) {
      user.mfaEnabled = true;
      return { success: true, message: 'MFA enabled successfully' };
    } else {
      return { success: false, error: 'Invalid MFA token' };
    }
  }

  verifyMFAToken(secret, token) {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 2 // Allow 2 time steps before/after current
    });
  }

  async disableMFA(username, password, mfaToken) {
    const user = this.users.get(username);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Verify password
    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      return { success: false, error: 'Invalid password' };
    }

    // Verify MFA token
    if (user.mfaEnabled && !this.verifyMFAToken(user.mfaSecret, mfaToken)) {
      return { success: false, error: 'Invalid MFA token' };
    }

    user.mfaEnabled = false;
    user.mfaSecret = null;

    this.stats.mfaEnabled = Math.max(0, this.stats.mfaEnabled - 1);

    return { success: true, message: 'MFA disabled successfully' };
  }

  // API Key management
  async generateApiKey(username, name, permissions = [], expiresAt = null) {
    const user = this.users.get(username);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    const apiKey = crypto.randomBytes(this.config.apiKeyLength).toString('hex');
    const keyId = crypto.randomUUID();

    const keyData = {
      id: keyId,
      key: apiKey,
      userId: user.id,
      username,
      name,
      permissions: permissions.length > 0 ? permissions : user.permissions,
      createdAt: new Date(),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      lastUsed: null,
      isActive: true,
      usageCount: 0
    };

    this.apiKeys.set(apiKey, keyData);

    this.stats.apiKeysIssued++;

    this.emit('apiKeyGenerated', { keyId, username, name });

    return {
      success: true,
      apiKey,
      keyId,
      expiresAt: keyData.expiresAt
    };
  }

  async verifyApiKey(apiKey) {
    const keyData = this.apiKeys.get(apiKey);

    if (!keyData || !keyData.isActive) {
      return { valid: false, error: 'Invalid API key' };
    }

    if (keyData.expiresAt && new Date() > keyData.expiresAt) {
      keyData.isActive = false;
      return { valid: false, error: 'API key expired' };
    }

    const user = Array.from(this.users.values()).find(u => u.id === keyData.userId);
    if (!user || !user.isActive) {
      return { valid: false, error: 'Associated user not found or inactive' };
    }

    // Update usage
    keyData.lastUsed = new Date();
    keyData.usageCount++;

    return {
      valid: true,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        permissions: keyData.permissions
      },
      keyId: keyData.id
    };
  }

  async revokeApiKey(keyId) {
    for (const [key, data] of this.apiKeys.entries()) {
      if (data.id === keyId) {
        data.isActive = false;
        this.emit('apiKeyRevoked', { keyId });
        return { success: true, message: 'API key revoked' };
      }
    }

    return { success: false, error: 'API key not found' };
  }

  // Helper methods
  recordFailedAttempt(username) {
    const attempts = this.loginAttempts.get(username) || { count: 0, lastAttempt: new Date() };
    attempts.count++;
    attempts.lastAttempt = new Date();

    this.loginAttempts.set(username, attempts);

    if (attempts.count >= this.config.maxLoginAttempts) {
      this.lockedAccounts.set(username, new Date(Date.now() + this.config.lockoutTime));
      this.stats.accountsLocked++;
      this.emit('accountLocked', { username, attempts: attempts.count });
    }
  }

  isAccountLocked(username) {
    const lockoutTime = this.lockedAccounts.get(username);
    if (!lockoutTime) return false;

    if (new Date() > lockoutTime) {
      this.lockedAccounts.delete(username);
      this.loginAttempts.delete(username);
      return false;
    }

    return true;
  }

  sanitizeUser(user) {
    const { password, mfaSecret, ...sanitized } = user;
    return sanitized;
  }

  cleanup() {
    const now = new Date();

    // Clean up expired sessions
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.destroySession(sessionId);
      }
    }

    // Clean up expired refresh tokens
    for (const [token, data] of this.refreshTokens.entries()) {
      if (now > data.expiresAt) {
        this.refreshTokens.delete(token);
      }
    }

    // Clean up expired API keys
    for (const [key, data] of this.apiKeys.entries()) {
      if (data.expiresAt && now > data.expiresAt) {
        data.isActive = false;
      }
    }

    // Clean up old lockouts
    for (const [username, lockoutTime] of this.lockedAccounts.entries()) {
      if (now > lockoutTime) {
        this.lockedAccounts.delete(username);
        this.loginAttempts.delete(username);
      }
    }
  }

  // API methods
  async getUsers(filters = {}) {
    let users = Array.from(this.users.values());

    if (filters.role) {
      users = users.filter(user => user.role === filters.role);
    }

    if (filters.isActive !== undefined) {
      users = users.filter(user => user.isActive === filters.isActive);
    }

    return users.map(user => this.sanitizeUser(user));
  }

  async updateUser(username, updates) {
    const user = this.users.get(username);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Handle password update
    if (updates.password) {
      updates.password = await bcrypt.hash(updates.password, this.config.bcryptRounds);
    }

    // Update user
    Object.assign(user, updates);

    this.emit('userUpdated', { user: this.sanitizeUser(user) });

    return {
      success: true,
      user: this.sanitizeUser(user)
    };
  }

  async deleteUser(username) {
    const user = this.users.get(username);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Destroy all user sessions
    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.userId === user.id) {
        await this.destroySession(sessionId);
      }
    }

    // Revoke all API keys
    for (const [key, data] of this.apiKeys.entries()) {
      if (data.userId === user.id) {
        data.isActive = false;
      }
    }

    this.users.delete(username);

    this.emit('userDeleted', { username });

    return { success: true, message: 'User deleted successfully' };
  }

  getStats() {
    return {
      ...this.stats,
      totalUsers: this.users.size,
      activeUsers: Array.from(this.users.values()).filter(u => u.isActive).length,
      activeSessions: this.sessions.size,
      activeApiKeys: Array.from(this.apiKeys.values()).filter(k => k.isActive).length,
      lockedAccounts: this.lockedAccounts.size
    };
  }

  async shutdown() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.removeAllListeners();
  }
}

// Singleton instance
let authManagerInstance = null;

class AuthenticationManagerSingleton {
  static getInstance(options = {}) {
    if (!authManagerInstance) {
      authManagerInstance = new AuthenticationManager(options);
    }
    return authManagerInstance;
  }
}

module.exports = { AuthenticationManager, AuthenticationManagerSingleton };
