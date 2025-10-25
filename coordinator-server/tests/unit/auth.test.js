const { AuthManager } = require('../../src/utils/auth');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { models } = require('../../src/models');
const testUtils = require('../utils/testUtils');

describe('AuthManager', () => {
  let authManager;
  let testUser;

  beforeEach(async () => {
    authManager = new AuthManager();
    testUser = await testUtils.createTestUser({
      username: 'authtest',
      email: 'authtest@example.com'
    });
  });

  describe('User Authentication', () => {
    test('should authenticate user with valid credentials', async () => {
      const result = await authManager.authenticateUser('authtest@example.com', 'password123');

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user.id).toBe(testUser.id);
      expect(result.token).toBeDefined();
    });

    test('should fail authentication with invalid password', async () => {
      const result = await authManager.authenticateUser('authtest@example.com', 'wrongpassword');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });

    test('should fail authentication with non-existent user', async () => {
      const result = await authManager.authenticateUser('nonexistent@example.com', 'password123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid credentials');
    });

    test('should fail authentication with inactive user', async () => {
      await models.User.update(testUser.id, { is_active: false });

      const result = await authManager.authenticateUser('authtest@example.com', 'password123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Account is inactive');
    });
  });

  describe('JWT Token Management', () => {
    test('should generate valid JWT token', () => {
      const token = authManager.generateToken(testUser.id, testUser.role);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');

      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'test-jwt-secret');
      expect(decoded.userId).toBe(testUser.id);
      expect(decoded.role).toBe(testUser.role);
    });

    test('should validate valid JWT token', () => {
      const token = authManager.generateToken(testUser.id, testUser.role);
      const result = authManager.validateToken(token);

      expect(result.valid).toBe(true);
      expect(result.decoded.userId).toBe(testUser.id);
      expect(result.decoded.role).toBe(testUser.role);
    });

    test('should reject invalid JWT token', () => {
      const result = authManager.validateToken('invalid.token.here');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should reject expired JWT token', () => {
      const expiredToken = jwt.sign(
        { userId: testUser.id, role: testUser.role },
        process.env.JWT_SECRET || 'test-jwt-secret',
        { expiresIn: '-1h' }
      );

      const result = authManager.validateToken(expiredToken);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('expired');
    });
  });

  describe('API Key Management', () => {
    test('should create API key', async () => {
      const result = await authManager.createApiKey(testUser.id, 'Test API Key', ['jobs:read']);

      expect(result.success).toBe(true);
      expect(result.apiKey).toBeDefined();
      expect(result.apiKey.key).toBeDefined();
      expect(result.apiKey.name).toBe('Test API Key');
    });

    test('should validate API key', async () => {
      const { apiKey } = await authManager.createApiKey(testUser.id, 'Test API Key');
      const result = await authManager.validateApiKey(apiKey.key);

      expect(result.valid).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user.id).toBe(testUser.id);
    });

    test('should reject invalid API key', async () => {
      const result = await authManager.validateApiKey('invalid-api-key');

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('User Registration', () => {
    test('should register new user', async () => {
      const userData = {
        username: testUtils.randomUsername(),
        email: testUtils.randomEmail(),
        password: 'newpassword123'
      };

      const result = await authManager.registerUser(userData);

      expect(result.success).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user.username).toBe(userData.username);
      expect(result.user.email).toBe(userData.email);
    });

    test('should reject duplicate username', async () => {
      const userData = {
        username: testUser.username,
        email: testUtils.randomEmail(),
        password: 'newpassword123'
      };

      const result = await authManager.registerUser(userData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    test('should reject duplicate email', async () => {
      const userData = {
        username: testUtils.randomUsername(),
        email: testUser.email,
        password: 'newpassword123'
      };

      const result = await authManager.registerUser(userData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });
  });
});
