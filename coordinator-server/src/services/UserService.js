/**
 * Enhanced User Model v2
 * Улучшенная модель пользователя для замены AuthManager
 * Работает с существующей конфигурацией базы данных
 */

const { db } = require('../config/database');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

class UserService {
  /**
   * Создать нового пользователя
   */
  static async create(userData) {
    const { username, email, password, role = 'user' } = userData;

    try {
      // Хэшируем пароль
      const saltRounds = 12;
      const passwordHash = await bcrypt.hash(password, saltRounds);

      const result = await db.query(`
        INSERT INTO users (username, email, password_hash, role, is_active, email_verified)
        VALUES ($1, $2, $3, $4, true, false)
        RETURNING id, username, email, role, is_active, email_verified, created_at
      `, [username, email, passwordHash, role]);

      const user = result.rows[0];

      // Создаем начальный баланс пользователя
      await db.query(`
        INSERT INTO user_balances (user_id, balance)
        VALUES ($1, $2)
      `, [user.id, parseFloat(process.env.INITIAL_USER_BALANCE) || 10.0]);

      logger.info('User created successfully', {
        userId: user.id,
        email: user.email,
        role: user.role
      });

      return user;

    } catch (error) {
      if (error.code === '23505') { // Unique constraint violation
        if (error.constraint === 'users_email_key') {
          throw new Error('User with this email already exists');
        }
        if (error.constraint === 'users_username_key') {
          throw new Error('Username is already taken');
        }
      }

      logger.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * Найти пользователя по email
   */
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

  /**
   * Найти пользователя по ID
   */
  static async findById(userId) {
    try {
      const result = await db.query(`
        SELECT u.*, ub.balance, ub.escrow_balance
        FROM users u
        LEFT JOIN user_balances ub ON u.id = ub.user_id
        WHERE u.id = $1
      `, [userId]);

      return result.rows[0] || null;

    } catch (error) {
      logger.error('Error finding user by ID:', error);
      throw error;
    }
  }

  /**
   * Проверить пароль пользователя
   */
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
        UPDATE users SET last_login = NOW() WHERE id = $1
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

  /**
   * Изменить пароль пользователя
   */
  static async changePassword(userId, currentPassword, newPassword) {
    try {
      const user = await this.findById(userId);

      if (!user) {
        throw new Error('User not found');
      }

      // Проверяем текущий пароль
      const isValidCurrentPassword = await bcrypt.compare(currentPassword, user.password_hash);

      if (!isValidCurrentPassword) {
        return {
          success: false,
          error: 'Current password is incorrect'
        };
      }

      // Хэшируем новый пароль
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      await db.query(`
        UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2
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

  /**
   * Обновить профиль пользователя
   */
  static async updateProfile(userId, updates) {
    try {
      const allowedFields = ['username', 'profile', 'settings'];
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      for (const [field, value] of Object.entries(updates)) {
        if (allowedFields.includes(field) && value !== undefined) {
          updateFields.push(`${field} = $${paramIndex++}`);
          updateValues.push(field === 'profile' || field === 'settings' ? JSON.stringify(value) : value);
        }
      }

      if (updateFields.length === 0) {
        throw new Error('No valid fields to update');
      }

      const query = `
        UPDATE users 
        SET ${updateFields.join(', ')}, updated_at = NOW()
        WHERE id = $${paramIndex}
        RETURNING id, username, email, role, is_active, profile, settings, updated_at
      `;

      const result = await db.query(query, [...updateValues, userId]);

      if (result.rows.length === 0) {
        throw new Error('User not found');
      }

      return result.rows[0];

    } catch (error) {
      logger.error('Error updating user profile:', error);
      throw error;
    }
  }

  /**
   * Получить статистику пользователя
   */
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
          (SELECT SUM(amount) FROM transactions WHERE user_id = u.id AND transaction_type = 'credit') as total_earned,
          (SELECT SUM(amount) FROM transactions WHERE user_id = u.id AND transaction_type = 'debit') as total_spent
        FROM users u
        LEFT JOIN user_balances ub ON u.id = ub.user_id
        WHERE u.id = $1
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

  /**
   * Деактивировать пользователя
   */
  static async deactivate(userId) {
    try {
      const result = await db.query(`
        UPDATE users 
        SET is_active = false, updated_at = NOW()
        WHERE id = $1
        RETURNING id, username, email, is_active, updated_at
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

  /**
   * Получить активных пользователей
   */
  static async getActiveUsers(limit = 50, offset = 0) {
    try {
      const result = await db.query(`
        SELECT u.id, u.username, u.email, u.role, u.created_at, u.last_login,
               ub.balance
        FROM users u
        LEFT JOIN user_balances ub ON u.id = ub.user_id
        WHERE u.is_active = true
        ORDER BY u.created_at DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]);

      return result.rows;

    } catch (error) {
      logger.error('Error getting active users:', error);
      throw error;
    }
  }

  /**
   * Тестирование подключения к базе данных
   */
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

module.exports = UserService;
