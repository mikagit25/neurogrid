const { db } = require('../src/config/database');
const logger = require('../src/utils/logger');

// Setup test database
beforeAll(async () => {
  // Set test environment
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test_user:test_pass@localhost:5432/test_neurogrid';
  
  try {
    // Initialize test database
    await db.initialize();
    console.log('✅ Test database initialized');
  } catch (error) {
    console.error('❌ Failed to initialize test database:', error);
    throw error;
  }
});

// Cleanup after all tests
afterAll(async () => {
  try {
    await db.close();
    console.log('✅ Test database connections closed');
  } catch (error) {
    console.error('❌ Error closing test database:', error);
  }
});

// Clean up between tests
beforeEach(async () => {
  // Clear any test data if needed
});

afterEach(async () => {
  // Cleanup test artifacts
  jest.clearAllMocks();
});

// Global test utilities
global.testUtils = {
  delay: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  createTestUser: () => ({
    id: 'test-user-' + Date.now(),
    username: 'testuser',
    email: 'test@neurogrid.com',
    role: 'user',
    created_at: new Date()
  }),
  
  createTestNode: () => ({
    id: 'test-node-' + Date.now(),
    node_id: 'node-' + Math.random().toString(36).substr(2, 9),
    status: 'online',
    capabilities: ['gpu', 'cpu'],
    region: 'us-east-1',
    ip_address: '192.168.1.100',
    created_at: new Date()
  }),
  
  createTestTask: () => ({
    id: 'test-task-' + Date.now(),
    title: 'Test AI Task',
    description: 'Test task description',
    type: 'ai_training',
    status: 'pending',
    budget: 100,
    created_at: new Date()
  })
};

// Suppress console.log in tests unless explicitly needed
if (process.env.TEST_VERBOSE !== 'true') {
  console.log = jest.fn();
}

// Mock logger in tests
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));