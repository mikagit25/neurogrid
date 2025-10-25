const AuthenticationService = require('../../src/services/AuthenticationService');
const { db } = require('../../src/config/database');

// Mock database
jest.mock('../../src/config/database', () => ({
  db: {
    query: jest.fn(),
    initialize: jest.fn(),
    close: jest.fn()
  }
}));

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn().mockResolvedValue(true)
}));

// Mock JWT
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('test_token'),
  verify: jest.fn().mockReturnValue({ userId: 'test-user-123', role: 'user' })
}));

// Mock speakeasy for 2FA
jest.mock('speakeasy', () => ({
  generateSecret: jest.fn().mockReturnValue({
    ascii: 'test_secret',
    base32: 'TEST2FA',
    otpauth_url: 'otpauth://test'
  }),
  totp: {
    verify: jest.fn().mockReturnValue(true)
  }
}));

describe('AuthenticationService', () => {
  let authService;
  let mockConfig;

  beforeEach(() => {
    mockConfig = {
      get: jest.fn((key, defaultValue) => {
        const values = {
          'JWT_SECRET': 'test-secret',
          'JWT_EXPIRES_IN': '24h',
          'API_KEY_SECRET': 'api-secret',
          'BCRYPT_ROUNDS': 10,
          'MAX_LOGIN_ATTEMPTS': 5,
          'LOCKOUT_TIME': 300000,
          'SESSION_TIMEOUT': 3600000
        };
        return values[key] || defaultValue;
      })
    };

    authService = new AuthenticationService(mockConfig);
    jest.clearAllMocks();
  });

  describe('User Registration', () => {
    test('should register a new user successfully', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      // Mock database responses
      db.query
        .mockResolvedValueOnce({ rows: [] }) // Check if user exists
        .mockResolvedValueOnce({
          rows: [{ id: 'user-123', ...userData, password: 'hashed_password' }]
        }); // Insert user

      const result = await authService.registerUser(userData);

      expect(result.success).toBe(true);
      expect(result.user.username).toBe(userData.username);
      expect(result.user.email).toBe(userData.email);
      expect(result.user.password).toBeUndefined(); // Password should be excluded
      expect(db.query).toHaveBeenCalledTimes(2);
    });

    test('should fail registration for existing user', async () => {
      const userData = {
        username: 'existinguser',
        email: 'existing@example.com',
        password: 'password123'
      };

      // Mock user already exists
      db.query.mockResolvedValueOnce({
        rows: [{ id: 'user-456', username: 'existinguser' }]
      });

      const result = await authService.registerUser(userData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('User already exists');
      expect(db.query).toHaveBeenCalledTimes(1);
    });

    test('should validate required fields', async () => {
      const invalidData = {
        username: '',
        email: 'invalid-email',
        password: '123' // Too short
      };

      const result = await authService.registerUser(invalidData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('validation');
    });
  });

  describe('User Authentication', () => {
    test('should authenticate user with valid credentials', async () => {
      const loginData = {
        username: 'testuser',
        password: 'password123'
      };

      // Mock database response
      db.query.mockResolvedValueOnce({
        rows: [{
          id: 'user-123',
          username: 'testuser',
          email: 'test@example.com',
          password: 'hashed_password',
          role: 'user',
          is_verified: true,
          login_attempts: 0,
          locked_until: null
        }]
      });

      const result = await authService.authenticateUser(loginData);

      expect(result.success).toBe(true);
      expect(result.token).toBe('test_token');
      expect(result.user.username).toBe('testuser');
      expect(result.user.password).toBeUndefined();
    });

    test('should fail authentication with invalid credentials', async () => {
      const bcrypt = require('bcrypt');
      bcrypt.compare.mockResolvedValueOnce(false);

      const loginData = {
        username: 'testuser',
        password: 'wrongpassword'
      };

      db.query.mockResolvedValueOnce({
        rows: [{
          id: 'user-123',
          username: 'testuser',
          password: 'hashed_password',
          login_attempts: 0
        }]
      });

      const result = await authService.authenticateUser(loginData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });

    test('should handle account lockout after max attempts', async () => {
      const loginData = {
        username: 'testuser',
        password: 'wrongpassword'
      };

      db.query.mockResolvedValueOnce({
        rows: [{
          id: 'user-123',
          username: 'testuser',
          password: 'hashed_password',
          login_attempts: 5,
          locked_until: new Date(Date.now() + 300000)
        }]
      });

      const result = await authService.authenticateUser(loginData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('locked');
    });
  });

  describe('Two-Factor Authentication', () => {
    test('should enable 2FA for user', async () => {
      const userId = 'user-123';

      db.query.mockResolvedValueOnce({ rows: [] }); // Update user

      const result = await authService.enable2FA(userId);

      expect(result.success).toBe(true);
      expect(result.secret).toBe('TEST2FA');
      expect(result.qrCode).toContain('otpauth://test');
    });

    test('should verify 2FA token', async () => {
      const userId = 'user-123';
      const token = '123456';

      db.query.mockResolvedValueOnce({
        rows: [{
          two_factor_secret: 'test_secret'
        }]
      });

      const result = await authService.verify2FA(userId, token);

      expect(result.success).toBe(true);
    });

    test('should fail 2FA verification with invalid token', async () => {
      const speakeasy = require('speakeasy');
      speakeasy.totp.verify.mockReturnValueOnce(false);

      const userId = 'user-123';
      const token = '000000';

      db.query.mockResolvedValueOnce({
        rows: [{
          two_factor_secret: 'test_secret'
        }]
      });

      const result = await authService.verify2FA(userId, token);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid 2FA token');
    });
  });

  describe('API Key Management', () => {
    test('should generate API key for user', async () => {
      const userId = 'user-123';
      const name = 'Test API Key';

      db.query.mockResolvedValueOnce({
        rows: [{ id: 'key-123', key: 'test_api_key', name }]
      });

      const result = await authService.generateApiKey(userId, name);

      expect(result.success).toBe(true);
      expect(result.apiKey.name).toBe(name);
      expect(result.apiKey.key).toBe('test_api_key');
    });

    test('should validate API key', async () => {
      const apiKey = 'test_api_key';

      db.query.mockResolvedValueOnce({
        rows: [{
          id: 'key-123',
          user_id: 'user-123',
          is_active: true,
          last_used: null
        }]
      });

      const result = await authService.validateApiKey(apiKey);

      expect(result.success).toBe(true);
      expect(result.userId).toBe('user-123');
    });

    test('should fail validation for inactive API key', async () => {
      const apiKey = 'inactive_key';

      db.query.mockResolvedValueOnce({
        rows: [{
          id: 'key-123',
          user_id: 'user-123',
          is_active: false
        }]
      });

      const result = await authService.validateApiKey(apiKey);

      expect(result.success).toBe(false);
      expect(result.error).toBe('API key is inactive');
    });
  });

  describe('Session Management', () => {
    test('should create user session', async () => {
      const sessionData = {
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        userAgent: 'Test Browser'
      };

      db.query.mockResolvedValueOnce({
        rows: [{ id: 'session-123', ...sessionData }]
      });

      const result = await authService.createSession(sessionData);

      expect(result.success).toBe(true);
      expect(result.session.userId).toBe(sessionData.userId);
    });

    test('should validate active session', async () => {
      const sessionId = 'session-123';

      db.query.mockResolvedValueOnce({
        rows: [{
          id: sessionId,
          user_id: 'user-123',
          expires_at: new Date(Date.now() + 3600000),
          is_active: true
        }]
      });

      const result = await authService.validateSession(sessionId);

      expect(result.success).toBe(true);
      expect(result.userId).toBe('user-123');
    });

    test('should fail validation for expired session', async () => {
      const sessionId = 'expired-session';

      db.query.mockResolvedValueOnce({
        rows: [{
          id: sessionId,
          user_id: 'user-123',
          expires_at: new Date(Date.now() - 3600000), // Expired
          is_active: true
        }]
      });

      const result = await authService.validateSession(sessionId);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Session expired');
    });
  });

  describe('Security Features', () => {
    test('should track login history', async () => {
      const loginData = {
        userId: 'user-123',
        ipAddress: '192.168.1.1',
        userAgent: 'Test Browser',
        success: true
      };

      db.query.mockResolvedValueOnce({ rows: [] });

      await authService.trackLoginHistory(loginData);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO login_history'),
        expect.arrayContaining([
          loginData.userId,
          loginData.ipAddress,
          loginData.userAgent,
          loginData.success
        ])
      );
    });

    test('should detect suspicious login activity', async () => {
      const userId = 'user-123';
      const ipAddress = '192.168.1.100';

      // Mock recent failed attempts
      db.query.mockResolvedValueOnce({
        rows: [
          { attempt_time: new Date() },
          { attempt_time: new Date() },
          { attempt_time: new Date() }
        ]
      });

      const isSuspicious = await authService.detectSuspiciousActivity(userId, ipAddress);

      expect(isSuspicious).toBe(true);
    });

    test('should generate secure password reset token', async () => {
      const email = 'test@example.com';

      db.query
        .mockResolvedValueOnce({ rows: [{ id: 'user-123' }] }) // Find user
        .mockResolvedValueOnce({ rows: [] }); // Store token

      const result = await authService.generatePasswordResetToken(email);

      expect(result.success).toBe(true);
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };

      db.query.mockRejectedValueOnce(new Error('Database connection failed'));

      const result = await authService.registerUser(userData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Database error occurred');
    });

    test('should handle invalid input data', async () => {
      const result = await authService.authenticateUser(null);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid input');
    });
  });
});
