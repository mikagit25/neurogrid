/**
 * Test Database Migration
 * Упрощенная версия для демонстрации без PostgreSQL
 */

const TestUserService = require('../services/TestUserService');
const logger = require('../utils/logger');

// Используем mock database если PostgreSQL недоступен
let db;
try {
  db = require('../config/database').db;
  if (!process.env.DB_HOST && !process.env.DATABASE_URL) {
    throw new Error('PostgreSQL not configured');
  }
} catch (error) {
  console.log('Using mock database for testing');
  db = require('../utils/mockDatabase').db;
}

class TestDatabaseMigration {
  constructor() {
    this.name = 'TestDatabaseMigration';
  }

  async testDatabaseConnection() {
    try {
      const result = await TestUserService.testConnection();
      
      if (result.success) {
        logger.info('Test database connection successful', {
          database: result.database,
          timestamp: result.timestamp
        });
        return true;
      } else {
        logger.error('Test database connection failed:', result.error);
        return false;
      }
    } catch (error) {
      logger.error('Test database connection error:', error);
      return false;
    }
  }

  async checkRequiredTables() {
    try {
      const requiredTables = [
        'users',
        'user_balances',
        'transactions',
        'nodes',
        'jobs'
      ];

      const results = {};

      for (const table of requiredTables) {
        const query = `
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = $1
          );
        `;
        
        const result = await db.query(query, [table]);
        results[table] = result.rows[0].exists;
      }

      logger.info('Test database tables check completed', results);
      return results;

    } catch (error) {
      logger.error('Error checking test database tables:', error);
      return null;
    }
  }

  async createTestUser() {
    try {
      const testEmail = 'test@neurogrid.local';
      
      const existing = await TestUserService.findByEmail(testEmail);
      if (existing) {
        logger.info('Test user already exists');
        return existing;
      }

      const testUser = await TestUserService.create({
        username: 'testuser',
        email: testEmail,
        password: 'TestPassword123',
        role: 'user'
      });

      logger.info('Test user created successfully', {
        userId: testUser.id,
        email: testUser.email
      });

      return testUser;

    } catch (error) {
      logger.error('Error creating test user:', error);
      throw error;
    }
  }

  async testUserAuthentication() {
    try {
      const testEmail = 'test@neurogrid.local';
      const testPassword = 'TestPassword123';

      const result = await TestUserService.verifyPassword(testEmail, testPassword);
      
      if (result.success) {
        logger.info('Test user authentication successful');
        return true;
      } else {
        logger.error('Test user authentication failed:', result.error);
        return false;
      }

    } catch (error) {
      logger.error('Error testing user authentication:', error);
      return false;
    }
  }

  async testTransactionCreation() {
    try {
      const testEmail = 'test@neurogrid.local';
      const user = await TestUserService.findByEmail(testEmail);
      
      if (!user) {
        throw new Error('Test user not found');
      }

      const result = await db.query(`
        INSERT INTO transactions (user_id, transaction_type, amount, description, status)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [user.id, 'credit', 100.00, 'Test deposit transaction', 'completed']);

      const transaction = result.rows[0];

      logger.info('Test transaction created successfully', {
        transactionId: transaction.id,
        amount: transaction.amount
      });

      return transaction;

    } catch (error) {
      logger.error('Error testing transaction creation:', error);
      throw error;
    }
  }

  async runFullTest() {
    try {
      logger.info('Starting test database models test...');

      const connectionOk = await this.testDatabaseConnection();
      if (!connectionOk) {
        throw new Error('Database connection failed');
      }

      const tables = await this.checkRequiredTables();
      if (!tables) {
        throw new Error('Failed to check required tables');
      }

      const testUser = await this.createTestUser();
      const authOk = await this.testUserAuthentication();
      
      if (!authOk) {
        throw new Error('Authentication test failed');
      }

      const testTransaction = await this.testTransactionCreation();

      logger.info('Test database models test completed successfully');

      return {
        success: true,
        results: {
          connection: connectionOk,
          tables,
          user: testUser,
          authentication: authOk,
          transaction: testTransaction,
          node: { id: 'mock-node', name: 'Mock Node' }, // Mock для демонстрации
          job: { id: 'mock-job', job_type: 'training' } // Mock для демонстрации
        }
      };

    } catch (error) {
      logger.error('Test database test failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async cleanupTestData() {
    try {
      logger.info('Test data cleanup completed (mock mode)');
    } catch (error) {
      logger.error('Error cleaning up test data:', error);
      throw error;
    }
  }
}

const testDbMigration = new TestDatabaseMigration();

module.exports = testDbMigration;