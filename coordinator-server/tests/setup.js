require('jest-extended');

// Setup mocks
jest.mock('../src/config/database', () => require('./__mocks__/database'));
jest.mock('../src/utils/logger', () => require('./__mocks__/logger'));

const logger = require('../src/utils/logger');
const { db } = require('../src/config/database');

// Test database configuration
const testDbConfig = {
  user: process.env.TEST_DB_USER || 'neurogrid_test',
  host: process.env.TEST_DB_HOST || 'localhost',
  database: process.env.TEST_DB_NAME || 'neurogrid_test',
  password: process.env.TEST_DB_PASSWORD || 'neurogrid_test_password',
  port: parseInt(process.env.TEST_DB_PORT) || 5433
};

// Test environment setup
beforeAll(async () => {
  logger.info('Test environment initialized');
});

afterAll(async () => {
  logger.info('Test environment cleanup completed');
});

// Clear all mocks between tests
afterEach(() => {
  jest.clearAllMocks();
});

// Global test cleanup
afterAll(async () => {
  try {
    // Clean up database connections
    await db.close();
    console.log('Test database connections closed');
  } catch (error) {
    console.error('Error during test cleanup:', error);
  }
});

// Reset database state between tests
beforeEach(async () => {
  try {
    // Clean up test data (preserve schema)
    await cleanTestData();
  } catch (error) {
    console.error('Error cleaning test data:', error);
  }
});

/**
 * Clean test data between tests
 */
async function cleanTestData() {
  const tables = [
    'audit_logs',
    'system_metrics',
    'notifications',
    'transactions',
    'user_balances',
    'job_queue',
    'jobs',
    'models',
    'nodes',
    'api_keys',
    'users'
  ];

  // Disable foreign key checks temporarily
  await db.query('SET session_replication_role = replica;');

  // Truncate tables in reverse dependency order
  for (const table of tables) {
    await db.query(`TRUNCATE TABLE ${table} RESTART IDENTITY CASCADE;`);
  }

  // Re-enable foreign key checks
  await db.query('SET session_replication_role = DEFAULT;');
}

// Test utilities
global.testUtils = {
  /**
   * Create test user
   */
  async createTestUser(userData = {}) {
    const bcrypt = require('bcryptjs');
    const defaultUser = {
      username: 'testuser',
      email: 'test@example.com',
      password_hash: await bcrypt.hash('password123', 10),
      role: 'user',
      is_active: true,
      email_verified: true
    };

    const user = { ...defaultUser, ...userData };
    const result = await db.query(`
      INSERT INTO users (username, email, password_hash, role, is_active, email_verified)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [user.username, user.email, user.password_hash, user.role, user.is_active, user.email_verified]);

    return result.rows[0];
  },

  /**
   * Create test node
   */
  async createTestNode(userId, nodeData = {}) {
    const defaultNode = {
      name: 'Test Node',
      description: 'Test node for testing',
      status: 'online',
      node_type: 'compute',
      capabilities: JSON.stringify({ gpu: true, cpu_cores: 8 }),
      hardware_info: JSON.stringify({ ram: '16GB', gpu: 'RTX 3080' }),
      is_verified: true
    };

    const node = { ...defaultNode, ...nodeData };
    const result = await db.query(`
      INSERT INTO nodes (user_id, name, description, status, node_type, capabilities, hardware_info, is_verified)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [userId, node.name, node.description, node.status, node.node_type, node.capabilities, node.hardware_info, node.is_verified]);

    return result.rows[0];
  },

  /**
   * Create test job
   */
  async createTestJob(userId, jobData = {}) {
    const defaultJob = {
      title: 'Test Job',
      description: 'Test job for testing',
      job_type: 'ml_training',
      status: 'pending',
      priority: 5,
      requirements: JSON.stringify({ gpu_memory: '8GB' }),
      parameters: JSON.stringify({ epochs: 10 })
    };

    const job = { ...defaultJob, ...jobData };
    const result = await db.query(`
      INSERT INTO jobs (user_id, title, description, job_type, status, priority, requirements, parameters)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [userId, job.title, job.description, job.job_type, job.status, job.priority, job.requirements, job.parameters]);

    return result.rows[0];
  },

  /**
   * Create test API key
   */
  async createTestApiKey(userId, keyData = {}) {
    const crypto = require('crypto');
    const key = crypto.randomBytes(32).toString('hex');
    const keyHash = crypto.createHash('sha256').update(key).digest('hex');

    const defaultApiKey = {
      name: 'Test API Key',
      permissions: JSON.stringify(['jobs:read', 'jobs:create']),
      is_active: true
    };

    const apiKey = { ...defaultApiKey, ...keyData };
    const result = await db.query(`
      INSERT INTO api_keys (user_id, name, key_hash, permissions, is_active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [userId, apiKey.name, keyHash, apiKey.permissions, apiKey.is_active]);

    return { ...result.rows[0], key };
  },

  /**
   * Generate JWT token for testing
   */
  generateTestToken(userId, role = 'user') {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
      { userId, role },
      process.env.JWT_SECRET || 'test-jwt-secret',
      { expiresIn: '1h' }
    );
  },

  /**
   * Wait for async operations
   */
  async wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Generate random test data
   */
  randomString(length = 10) {
    return Math.random().toString(36).substring(2, length + 2);
  },

  randomEmail() {
    return `test-${this.randomString()}@example.com`;
  },

  randomUsername() {
    return `testuser_${this.randomString()}`;
  }
};

// Mock external services for testing
jest.mock('../src/services/WebSocketManager', () => {
  return {
    WebSocketManager: class {
      static getInstance() {
        return {
          broadcast: jest.fn(),
          sendToUser: jest.fn(),
          sendToChannel: jest.fn()
        };
      }
    }
  };
});

// Suppress console logs during tests unless explicitly needed
if (process.env.TEST_VERBOSE !== 'true') {
  global.console = {
    ...console,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  };
}
