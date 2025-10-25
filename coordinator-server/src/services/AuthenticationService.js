const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const { Op } = require('sequelize');
const logger = require('../utils/logger');
const User = require('../models/User');

class AuthenticationService {
  constructor(config) {
    this.config = config;
    this.authConfig = config.getAuthConfig();
    this.loginAttempts = new Map(); // In-memory store for login attempts
    this.suspiciousActivity = new Map(); // Track suspicious activities

    // Clean up old attempts every hour
    setInterval(() => this.cleanupAttempts(), 60 * 60 * 1000);
  }

  // Generate secure JWT token
  generateToken(user, options = {}) {
    const payload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      permissions: user.permissions || [],
      iat: Math.floor(Date.now() / 1000),
      ...options.claims
    };

    const tokenOptions = {
      expiresIn: options.expiresIn || this.authConfig.jwtExpiresIn,
      issuer: 'neurogrid-coordinator',
      audience: 'neurogrid-users',
      subject: user.id.toString()
    };

    return jwt.sign(payload, this.authConfig.jwtSecret, tokenOptions);
  }

  // Generate refresh token
  generateRefreshToken(userId) {
    const token = crypto.randomBytes(64).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    return {
      token,
      hashedToken,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    };
  }

  // Generate API key
  async generateApiKey(userId) {
    const prefix = 'ng_';
    const randomPart = crypto.randomBytes(32).toString('hex');
    const apiKey = `${prefix}${randomPart}`;

    // Hash the API key for storage
    const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');

    // Update user with hashed API key
    await User.update(
      {
        apiKeyHash: hashedKey,
        apiKeyCreatedAt: new Date()
      },
      { where: { id: userId } }
    );

    return apiKey;
  }

  // Verify JWT token
  verifyToken(token, options = {}) {
    try {
      const decoded = jwt.verify(token, this.authConfig.jwtSecret, {
        issuer: 'neurogrid-coordinator',
        audience: 'neurogrid-users',
        ...options
      });

      return decoded;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new Error('Token expired');
      } else if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      } else {
        throw new Error('Token verification failed');
      }
    }
  }

  // Validate API key
  async validateApiKey(apiKey) {
    if (!apiKey || !apiKey.startsWith('ng_')) {
      return null;
    }

    const hashedKey = crypto.createHash('sha256').update(apiKey).digest('hex');

    const user = await User.findOne({
      where: {
        apiKeyHash: hashedKey,
        isActive: true
      },
      attributes: { exclude: ['password', 'apiKeyHash'] }
    });

    if (user) {
      // Update last API key usage
      await User.update(
        { apiKeyLastUsed: new Date() },
        { where: { id: user.id } }
      );
    }

    return user;
  }

  // Enhanced login with security features
  async login(email, password, metadata = {}) {
    const { ip, userAgent, deviceFingerprint } = metadata;
    const attemptKey = `${ip}:${email}`;

    try {
      // Check for too many attempts
      if (this.isBlocked(attemptKey)) {
        this.logSuspiciousActivity(email, ip, 'blocked_login_attempt');
        throw new Error('Too many failed login attempts. Please try again later.');
      }

      // Find user
      const user = await User.findOne({
        where: { email: email.toLowerCase() },
        include: ['loginHistory', 'devices']
      });

      if (!user) {
        this.recordFailedAttempt(attemptKey);
        throw new Error('Invalid email or password');
      }

      // Check if account is locked
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        throw new Error('Account is temporarily locked. Please try again later.');
      }

      // Verify password
      const isValidPassword = await user.validatePassword(password);
      if (!isValidPassword) {
        this.recordFailedAttempt(attemptKey);
        await this.handleFailedLogin(user, ip);
        throw new Error('Invalid email or password');
      }

      // Check if account is active
      if (!user.isActive) {
        throw new Error('Account is deactivated. Please contact support.');
      }

      // Check for 2FA if enabled
      if (user.twoFactorEnabled && !metadata.twoFactorToken) {
        return {
          requiresTwoFactor: true,
          userId: user.id,
          tempToken: this.generateTempToken(user.id)
        };
      }

      // Verify 2FA token if provided
      if (user.twoFactorEnabled && metadata.twoFactorToken) {
        const isValid2FA = this.verifyTwoFactorToken(user.twoFactorSecret, metadata.twoFactorToken);
        if (!isValid2FA) {
          throw new Error('Invalid two-factor authentication code');
        }
      }

      // Check for suspicious login patterns
      await this.checkSuspiciousLogin(user, ip, userAgent, deviceFingerprint);

      // Clear failed attempts
      this.clearFailedAttempts(attemptKey);

      // Update user login info
      await this.updateLoginInfo(user, ip, userAgent, deviceFingerprint);

      // Generate tokens
      const accessToken = this.generateToken(user);
      const refreshTokenData = this.generateRefreshToken(user.id);

      // Store refresh token
      await user.update({
        refreshTokenHash: refreshTokenData.hashedToken,
        refreshTokenExpiresAt: refreshTokenData.expiresAt,
        lastLoginAt: new Date(),
        lastLoginIp: ip,
        failedLoginAttempts: 0,
        lockedUntil: null
      });

      logger.info('User login successful', {
        userId: user.id,
        email: user.email,
        ip,
        userAgent
      });

      return {
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          permissions: user.permissions,
          isActive: user.isActive,
          twoFactorEnabled: user.twoFactorEnabled
        },
        tokens: {
          accessToken,
          refreshToken: refreshTokenData.token,
          expiresIn: this.authConfig.jwtExpiresIn
        }
      };

    } catch (error) {
      logger.warn('Login attempt failed', {
        email,
        ip,
        error: error.message,
        userAgent
      });
      throw error;
    }
  }

  // Refresh access token using refresh token
  async refreshToken(refreshToken, metadata = {}) {
    try {
      const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');

      const user = await User.findOne({
        where: {
          refreshTokenHash: hashedToken,
          refreshTokenExpiresAt: { [Op.gt]: new Date() },
          isActive: true
        }
      });

      if (!user) {
        throw new Error('Invalid or expired refresh token');
      }

      // Generate new tokens
      const accessToken = this.generateToken(user);
      const refreshTokenData = this.generateRefreshToken(user.id);

      // Update refresh token in database
      await user.update({
        refreshTokenHash: refreshTokenData.hashedToken,
        refreshTokenExpiresAt: refreshTokenData.expiresAt
      });

      logger.info('Token refreshed successfully', {
        userId: user.id,
        ip: metadata.ip
      });

      return {
        accessToken,
        refreshToken: refreshTokenData.token,
        expiresIn: this.authConfig.jwtExpiresIn
      };

    } catch (error) {
      logger.warn('Token refresh failed', {
        error: error.message,
        ip: metadata.ip
      });
      throw error;
    }
  }

  // Setup Two-Factor Authentication
  async setupTwoFactor(userId) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `NeuroGrid (${user.email})`,
      issuer: 'NeuroGrid'
    });

    // Generate QR code
    const qrCodeUrl = await qrcode.toDataURL(secret.otpauth_url);

    // Store secret temporarily (will be confirmed later)
    await user.update({
      twoFactorSecret: secret.base32,
      twoFactorEnabled: false // Not enabled until verified
    });

    return {
      secret: secret.base32,
      qrCode: qrCodeUrl,
      backupCodes: this.generateBackupCodes()
    };
  }

  // Verify and enable Two-Factor Authentication
  async enableTwoFactor(userId, token) {
    const user = await User.findByPk(userId);
    if (!user || !user.twoFactorSecret) {
      throw new Error('Two-factor setup not initiated');
    }

    const isValid = this.verifyTwoFactorToken(user.twoFactorSecret, token);
    if (!isValid) {
      throw new Error('Invalid verification code');
    }

    await user.update({ twoFactorEnabled: true });

    logger.info('Two-factor authentication enabled', {
      userId: user.id,
      email: user.email
    });

    return true;
  }

  // Verify Two-Factor Authentication token
  verifyTwoFactorToken(secret, token) {
    return speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token,
      window: 1 // Allow 1 step tolerance
    });
  }

  // Generate backup codes for 2FA
  generateBackupCodes() {
    const codes = [];
    for (let i = 0; i < 10; i++) {
      codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
    }
    return codes;
  }

  // Generate temporary token for 2FA flow
  generateTempToken(userId) {
    return jwt.sign(
      { userId, temp: true },
      this.authConfig.jwtSecret,
      { expiresIn: '5m' }
    );
  }

  // Track failed login attempts
  recordFailedAttempt(key) {
    const attempts = this.loginAttempts.get(key) || { count: 0, firstAttempt: Date.now() };
    attempts.count++;
    attempts.lastAttempt = Date.now();
    this.loginAttempts.set(key, attempts);
  }

  // Clear failed attempts
  clearFailedAttempts(key) {
    this.loginAttempts.delete(key);
  }

  // Check if IP/email is blocked
  isBlocked(key) {
    const attempts = this.loginAttempts.get(key);
    if (!attempts) return false;

    const hourAgo = Date.now() - (60 * 60 * 1000);
    if (attempts.firstAttempt < hourAgo) {
      this.loginAttempts.delete(key);
      return false;
    }

    return attempts.count >= 5; // Block after 5 failed attempts
  }

  // Handle failed login
  async handleFailedLogin(user, ip) {
    const attempts = user.failedLoginAttempts + 1;
    const updates = { failedLoginAttempts: attempts };

    // Lock account after 5 failed attempts
    if (attempts >= 5) {
      updates.lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

      logger.warn('Account locked due to failed login attempts', {
        userId: user.id,
        email: user.email,
        ip,
        attempts
      });
    }

    await user.update(updates);
  }

  // Check for suspicious login patterns
  async checkSuspiciousLogin(user, ip, userAgent, deviceFingerprint) {
    // Check for new device/location
    const recentLogins = await user.getLoginHistory({
      where: {
        createdAt: {
          [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days
        }
      },
      order: [['createdAt', 'DESC']],
      limit: 10
    });

    const isNewLocation = !recentLogins.some(login => login.ip === ip);
    const isNewDevice = deviceFingerprint && !recentLogins.some(login =>
      login.deviceFingerprint === deviceFingerprint
    );

    if (isNewLocation || isNewDevice) {
      logger.info('Login from new location/device detected', {
        userId: user.id,
        ip,
        isNewLocation,
        isNewDevice
      });

      // Could trigger additional security measures here
      // e.g., email notification, require email verification, etc.
    }
  }

  // Update login information
  async updateLoginInfo(user, ip, userAgent, deviceFingerprint) {
    // Create login history record
    await user.createLoginHistory({
      ip,
      userAgent,
      deviceFingerprint,
      success: true
    });

    // Update device information if new
    if (deviceFingerprint) {
      const existingDevice = await user.getDevices({
        where: { fingerprint: deviceFingerprint }
      });

      if (existingDevice.length === 0) {
        await user.createDevice({
          fingerprint: deviceFingerprint,
          userAgent,
          firstSeen: new Date(),
          lastSeen: new Date(),
          trusted: false
        });
      } else {
        await existingDevice[0].update({ lastSeen: new Date() });
      }
    }
  }

  // Log suspicious activity
  logSuspiciousActivity(email, ip, type, details = {}) {
    const key = `${ip}:${email}`;
    const activity = this.suspiciousActivity.get(key) || [];

    activity.push({
      type,
      timestamp: Date.now(),
      details
    });

    this.suspiciousActivity.set(key, activity);

    logger.warn('Suspicious activity detected', {
      email,
      ip,
      type,
      details
    });
  }

  // Clean up old login attempts and suspicious activities
  cleanupAttempts() {
    const hourAgo = Date.now() - (60 * 60 * 1000);

    // Clean up login attempts
    for (const [key, attempts] of this.loginAttempts.entries()) {
      if (attempts.lastAttempt < hourAgo) {
        this.loginAttempts.delete(key);
      }
    }

    // Clean up suspicious activities
    for (const [key, activities] of this.suspiciousActivity.entries()) {
      const recentActivities = activities.filter(activity =>
        activity.timestamp > hourAgo
      );

      if (recentActivities.length === 0) {
        this.suspiciousActivity.delete(key);
      } else {
        this.suspiciousActivity.set(key, recentActivities);
      }
    }
  }

  // Logout user (invalidate tokens)
  async logout(userId, refreshToken) {
    try {
      await User.update(
        {
          refreshTokenHash: null,
          refreshTokenExpiresAt: null
        },
        { where: { id: userId } }
      );

      logger.info('User logged out successfully', { userId });
      return true;
    } catch (error) {
      logger.error('Logout error', { userId, error: error.message });
      throw error;
    }
  }

  // Revoke API key
  async revokeApiKey(userId) {
    try {
      await User.update(
        {
          apiKeyHash: null,
          apiKeyCreatedAt: null,
          apiKeyLastUsed: null
        },
        { where: { id: userId } }
      );

      logger.info('API key revoked', { userId });
      return true;
    } catch (error) {
      logger.error('API key revocation error', { userId, error: error.message });
      throw error;
    }
  }
}

module.exports = AuthenticationService;
