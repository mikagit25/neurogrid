/**
 * Database Migration and Testing Utility
 * Утилита для тестирования новых моделей и постепенной миграции
 */

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

// Импортируем новые сервисы
const UserService = require('../services/UserService');
const { db } = require('../config/database');

class DatabaseMigration {
  constructor() {
    this.name = 'DatabaseMigration';
  }

  /**
   * Тестирование подключения к базе данных
   */
  async testDatabaseConnection() {
    try {
      const result = await UserService.testConnection();
      
      if (result.success) {
        logger.info('Database connection test successful', {
          database: result.database,
          timestamp: result.timestamp
        });
        return true;
      } else {
        logger.error('Database connection test failed:', result.error);
        return false;
      }
    } catch (error) {
      logger.error('Database connection test error:', error);
      return false;
    }
  }

  /**
   * Проверка существования всех необходимых таблиц
   */
  async checkRequiredTables() {
    try {
      const requiredTables = [
        'users',
        'user_profiles', 
        'user_balances',
        'transactions',
        'nodes',
        'node_metrics',
        'jobs',
        'job_queue'
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

      logger.info('Database tables check completed', results);
      return results;

    } catch (error) {
      logger.error('Error checking database tables:', error);
      return null;
    }
  }

  /**
   * Создание тестового пользователя для проверки новых моделей
   */
  async createTestUser() {
    try {
      const testEmail = 'test@neurogrid.local';
      
      // Проверяем, существует ли уже тестовый пользователь
      const existing = await UserService.findByEmail(testEmail);
      if (existing) {
        logger.info('Test user already exists');
        return existing;
      }

      // Создаем тестового пользователя
      const testUser = await UserService.create({
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

  /**
   * Тестирование аутентификации нового пользователя
   */
  async testUserAuthentication() {
    try {
      const testEmail = 'test@neurogrid.local';
      const testPassword = 'TestPassword123';

      const result = await UserService.verifyPassword(testEmail, testPassword);
      
      if (result.success) {
        logger.info('User authentication test successful');
        return true;
      } else {
        logger.error('User authentication test failed:', result.error);
        return false;
      }

    } catch (error) {
      logger.error('Error testing user authentication:', error);
      return false;
    }
  }

  /**
   * Тестирование создания транзакции
   */
  async testTransactionCreation() {
    try {
      const testEmail = 'test@neurogrid.local';
      const user = await UserService.findByEmail(testEmail);
      
      if (!user) {
        throw new Error('Test user not found');
      }

      // Создаем тестовую транзакцию напрямую через SQL
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

  /**
   * Тестирование создания узла
   */
  async testNodeCreation() {
    try {
      const testEmail = 'test@neurogrid.local';
      const user = await UserService.findByEmail(testEmail);
      
      if (!user) {
        throw new Error('Test user not found');
      }

      // Создаем тестовый узел напрямую через SQL
      const result = await db.query(`
        INSERT INTO nodes (user_id, name, status, hardware_info)
        VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [
        user.id, 
        'Test Node', 
        'offline',
        JSON.stringify({
          gpu_count: 1,
          gpu_model: 'Test GPU',
          memory_gb: 8,
          cpu_cores: 4
        })
      ]);

      const node = result.rows[0];

      logger.info('Test node created successfully', {
        nodeId: node.id,
        name: node.name
      });

      return node;

    } catch (error) {
      logger.error('Error testing node creation:', error);
      throw error;
    }
  }

  /**
   * Тестирование создания задачи
   */
  async testJobCreation() {
    try {
      const testEmail = 'test@neurogrid.local';
      const user = await UserService.findByEmail(testEmail);
      
      if (!user) {
        throw new Error('Test user not found');
      }

      // Создаем тестовую задачу напрямую через SQL
      const result = await db.query(`
        INSERT INTO jobs (user_id, title, job_type, status, priority, requirements)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        user.id,
        'Test Training Job',
        'training',
        'pending',
        5,
        JSON.stringify({
          gpu_count: 1,
          memory_gb: 4,
          storage_gb: 10
        })
      ]);

      const job = result.rows[0];

      logger.info('Test job created successfully', {
        jobId: job.id,
        jobType: job.job_type
      });

      return job;

    } catch (error) {
      logger.error('Error testing job creation:', error);
      throw error;
    }
  }

  /**
   * Полное тестирование всех новых моделей
   */
  async runFullTest() {
    try {
      logger.info('Starting full database models test...');

      // 1. Проверяем подключение к БД
      const connectionOk = await this.testDatabaseConnection();
      if (!connectionOk) {
        throw new Error('Database connection failed');
      }

      // 2. Проверяем таблицы
      const tables = await this.checkRequiredTables();
      if (!tables) {
        throw new Error('Failed to check required tables');
      }

      // 3. Создаем тестового пользователя
      const testUser = await this.createTestUser();

      // 4. Тестируем аутентификацию
      const authOk = await this.testUserAuthentication();
      if (!authOk) {
        throw new Error('Authentication test failed');
      }

      // 5. Тестируем транзакции
      const testTransaction = await this.testTransactionCreation();

      // 6. Тестируем узлы
      const testNode = await this.testNodeCreation();

      // 7. Тестируем задачи
      const testJob = await this.testJobCreation();

      logger.info('Full database models test completed successfully');

      return {
        success: true,
        results: {
          connection: connectionOk,
          tables,
          user: testUser,
          authentication: authOk,
          transaction: testTransaction,
          node: testNode,
          job: testJob
        }
      };

    } catch (error) {
      logger.error('Full database test failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Очистка тестовых данных
   */
  async cleanupTestData() {
    try {
      const testEmail = 'test@neurogrid.local';
      const user = await User.findByEmail(testEmail);
      
      if (!user) {
        logger.info('No test user found to cleanup');
        return;
      }

      // Используем транзакцию для удаления связанных данных
      const queries = [
        { text: 'DELETE FROM jobs WHERE user_id = $1', params: [user.id] },
        { text: 'DELETE FROM nodes WHERE user_id = $1', params: [user.id] },
        { text: 'DELETE FROM transactions WHERE user_id = $1', params: [user.id] },
        { text: 'DELETE FROM user_balances WHERE user_id = $1', params: [user.id] },
        { text: 'DELETE FROM users WHERE id = $1', params: [user.id] }
      ];

      await db.transaction(queries);
      
      logger.info('Test data cleaned up successfully');

    } catch (error) {
      logger.error('Error cleaning up test data:', error);
      throw error;
    }
  }

  /**
   * Миграция пользователей из AuthManager в базу данных
   */
  async migrateUsersFromAuthManager(authManager) {
    try {
      if (!authManager || !authManager.users) {
        logger.info('No AuthManager users to migrate');
        return { migrated: 0, errors: 0 };
      }

      let migrated = 0;
      let errors = 0;
      const userEntries = Array.from(authManager.users.entries());

      logger.info(`Starting migration of ${userEntries.length} users from AuthManager`);

      for (const [email, userData] of userEntries) {
        try {
          // Проверяем, существует ли уже пользователь в БД
          const existing = await User.findByEmail(email);
          if (existing) {
            logger.debug(`User ${email} already exists in database, skipping`);
            continue;
          }

          // Создаем пользователя в БД
          await UserService.create({
            username: userData.username || email.split('@')[0],
            email,
            password: userData.password || 'TempPassword123', // Временный пароль
            role: userData.role || 'user'
          });

          migrated++;
          logger.info(`Migrated user: ${email}`);

        } catch (error) {
          errors++;
          logger.error(`Error migrating user ${email}:`, error);
        }
      }

      logger.info(`Migration completed: ${migrated} users migrated, ${errors} errors`);

      return { migrated, errors };

    } catch (error) {
      logger.error('Migration from AuthManager failed:', error);
      throw error;
    }
  }
}

// Создаем singleton экземпляр
const dbMigration = new DatabaseMigration();

module.exports = dbMigration;