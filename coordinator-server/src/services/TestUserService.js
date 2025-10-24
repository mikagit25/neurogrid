/**
 * Test User Service
 * Версия UserService для тестирования с mock database
 */

// Используем mock database если PostgreSQL недоступен
let db;
try {
  db = require('../config/database').db;
  // Проверяем доступность PostgreSQL
  if (!process.env.DB_HOST && !process.env.DATABASE_URL) {
    throw new Error('PostgreSQL not configured');
  }
} catch (error) {
  console.log('Using mock database for testing');
  db = require('../utils/mockDatabase').db;
}

const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

class TestUserService {
  static async create(userData) {
    const { username, email, password, role = 'user' } = userData;
    
    try {
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      const result = await db.query(`
        INSERT INTO users (username, email, password_hash, role, is_active, email_verified)
        VALUES ($1, $2, $3, $4, true, false)
        RETURNING id, username, email, role, is_active, email_verified, created_at
      `, [username, email, passwordHash, role]);

      const user = result.rows[0];

      await db.query(`
        INSERT INTO user_balances (user_id, balance)
        VALUES ($1, $2)
      `, [user.id, 10.0]);

      logger.info('Test user created successfully', {
        userId: user.id,
        email: user.email,
        role: user.role
      });

      return user;

    } catch (error) {
      logger.error('Error creating test user:', error);
      throw error;
    }
  }

  static async findByEmail(email) {
    try {
      const result = await db.query(`
        SELECT u.*, ub.balance, ub.escrow_balance
        FROM users u
        LEFT JOIN user_balances ub ON u.id = ub.user_id
        WHERE u.email = $1
      `, [email.toLowerCase()]);

      return result.rows[0] || null;

    } catch (error) {
      logger.error('Error finding user by email:', error);
      throw error;
    }
  }

  static async verifyPassword(email, password) {
    try {
      const user = await this.findByEmail(email);
      
      if (!user) {
        return {
          success: false,
          error: 'User not found'
        };
      }

      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      
      if (!isValidPassword) {
        return {
          success: false,
          error: 'Invalid password'
        };
      }

      return {
        success: true,
        user
      };

    } catch (error) {
      logger.error('Error verifying password:', error);
      return {
        success: false,
        error: 'Authentication failed'
      };
    }
  }

  static async testConnection() {
    try {
      const result = await db.query('SELECT NOW() as timestamp, current_database() as database');

      logger.info('Database connection test successful');

      return {
        success: true,
        timestamp: result.rows[0].timestamp,
        database: result.rows[0].database
      };
    } catch (error) {
      logger.error('Database connection test failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = TestUserService;