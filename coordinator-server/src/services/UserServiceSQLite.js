/**
 * User Service для SQLite
 * Адаптированная версия для работы с SQLite вместо PostgreSQL
 */

// Используем SQLite если PostgreSQL недоступен
let db;
try {
  // Пробуем PostgreSQL
  const { db: pgDb } = require('../config/database');
  if (process.env.DB_HOST || process.env.DATABASE_URL) {
    db = pgDb;
  } else {
    throw new Error('PostgreSQL not configured');
  }
} catch (error) {
  console.log('PostgreSQL не настроен, используем SQLite');
  const { db: sqliteDb } = require('../config/sqlite');
  db = sqliteDb;
}

const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

class UserServiceSQLite {
  static async create(userData) {
    const { username, email, password, role = 'user' } = userData;
    
    try {
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      const result = await db.query(`
        INSERT INTO users (username, email, password_hash, role, is_active, email_verified)
        VALUES (?, ?, ?, ?, 1, 0)
      `, [username, email, passwordHash, role]);

      const userId = result.lastID;

      // Получаем созданного пользователя
      const userResult = await db.query(`
        SELECT id, username, email, role, is_active, email_verified, created_at
        FROM users WHERE id = ?
      `, [userId]);

      const user = userResult.rows[0];

      // Создаем начальный баланс пользователя
      await db.query(`
        INSERT INTO user_balances (user_id, balance)
        VALUES (?, ?)
      `, [user.id, parseFloat(process.env.INITIAL_USER_BALANCE) || 10.0]);

      logger.info('User created successfully', {
        userId: user.id,
        email: user.email,
        role: user.role
      });

      return user;

    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        if (error.message.includes('email')) {
          throw new Error('User with this email already exists');
        }
        if (error.message.includes('username')) {
          throw new Error('Username is already taken');
        }
      }
      
      logger.error('Error creating user:', error);
      throw error;
    }
  }

  static async findByEmail(email) {
    try {
      const result = await db.query(`
        SELECT u.*, ub.balance, ub.escrow_balance
        FROM users u
        LEFT JOIN user_balances ub ON u.id = ub.user_id
        WHERE u.email = ?
      `, [email.toLowerCase()]);

      return result.rows[0] || null;

    } catch (error) {
      logger.error('Error finding user by email:', error);
      throw error;
    }
  }

  static async findById(userId) {
    try {
      const result = await db.query(`
        SELECT u.*, ub.balance, ub.escrow_balance
        FROM users u
        LEFT JOIN user_balances ub ON u.id = ub.user_id
        WHERE u.id = ?
      `, [userId]);

      return result.rows[0] || null;

    } catch (error) {
      logger.error('Error finding user by ID:', error);
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

      if (!user.is_active) {
        return {
          success: false,
          error: 'Account is deactivated'
        };
      }

      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      
      if (!isValidPassword) {
        return {
          success: false,
          error: 'Invalid password'
        };
      }

      // Обновляем время последнего входа
      await db.query(`
        UPDATE users SET last_login = datetime('now') WHERE id = ?
      `, [user.id]);

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

  static async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = await this.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      const isValidCurrentPassword = await bcrypt.compare(currentPassword, user.password_hash);
      
      if (!isValidCurrentPassword) {
        return {
          success: false,
          error: 'Current password is incorrect'
        };
      }

      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      await db.query(`
        UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?
      `, [newPasswordHash, userId]);

      logger.info('Password changed successfully', { userId });

      return {
        success: true,
        message: 'Password changed successfully'
      };

    } catch (error) {
      logger.error('Error changing password:', error);
      throw error;
    }
  }

  static async updateProfile(userId, updates) {
    try {
      const allowedFields = ['username', 'profile', 'settings'];
      const updateFields = [];
      const updateValues = [];

      for (const [field, value] of Object.entries(updates)) {
        if (allowedFields.includes(field) && value !== undefined) {
          updateFields.push(`${field} = ?`);
          updateValues.push(field === 'profile' || field === 'settings' ? JSON.stringify(value) : value);
        }
      }

      if (updateFields.length === 0) {
        throw new Error('No valid fields to update');
      }

      updateFields.push('updated_at = datetime("now")');
      updateValues.push(userId);

      const query = `
        UPDATE users 
        SET ${updateFields.join(', ')}
        WHERE id = ?
      `;

      await db.query(query, updateValues);

      // Получаем обновленного пользователя
      const result = await db.query(`
        SELECT id, username, email, role, is_active, profile, settings, updated_at
        FROM users WHERE id = ?
      `, [userId]);

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      return result.rows[0];

    } catch (error) {
      logger.error('Error updating user profile:', error);
      throw error;
    }
  }

  static async getStats(userId) {
    try {
      const result = await db.query(`
        SELECT 
          u.username,
          u.email,
          u.created_at,
          u.last_login,
          ub.balance,
          ub.escrow_balance,
          (SELECT COUNT(*) FROM jobs WHERE user_id = u.id) as total_jobs,
          (SELECT COUNT(*) FROM jobs WHERE user_id = u.id AND status = 'completed') as completed_jobs,
          (SELECT COUNT(*) FROM nodes WHERE user_id = u.id) as owned_nodes,
          (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id = u.id AND transaction_type = 'credit') as total_earned,
          (SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE user_id = u.id AND transaction_type = 'debit') as total_spent
        FROM users u
        LEFT JOIN user_balances ub ON u.id = ub.user_id
        WHERE u.id = ?
      `, [userId]);

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      return result.rows[0];

    } catch (error) {
      logger.error('Error getting user stats:', error);
      throw error;
    }
  }

  static async deactivate(userId) {
    try {
      await db.query(`
        UPDATE users 
        SET is_active = 0, updated_at = datetime('now')
        WHERE id = ?
      `, [userId]);

      const result = await db.query(`
        SELECT id, username, email, is_active, updated_at
        FROM users WHERE id = ?
      `, [userId]);

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      return result.rows[0];

    } catch (error) {
      logger.error('Error deactivating user:', error);
      throw error;
    }
  }

  static async getActiveUsers(limit = 50, offset = 0) {
    try {
      const result = await db.query(`
        SELECT u.id, u.username, u.email, u.role, u.created_at, u.last_login,
               ub.balance
        FROM users u
        LEFT JOIN user_balances ub ON u.id = ub.user_id
        WHERE u.is_active = 1
        ORDER BY u.created_at DESC
        LIMIT ? OFFSET ?
      `, [limit, offset]);

      return result.rows;

    } catch (error) {
      logger.error('Error getting active users:', error);
      throw error;
    }
  }

  static async testConnection() {
    try {
      const result = await db.query('SELECT datetime("now") as timestamp, "sqlite" as database');

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

module.exports = UserServiceSQLite;