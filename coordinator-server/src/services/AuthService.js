/**
 * Enhanced Authentication Service
 * Новый сервис аутентификации, использующий модели базы данных
 * Работает параллельно с существующим AuthManager
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const UserServiceSQLite = require('./UserServiceSQLite');
const logger = require('../utils/logger');

// JWT Configuration
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');
const JWT_EXPIRE = process.env.JWT_EXPIRE || '24h';
const REFRESH_TOKEN_EXPIRE = process.env.REFRESH_TOKEN_EXPIRE || '7d';

class AuthService {
  constructor() {
    this.name = 'AuthService';
  }

  /**
   * Зарегистрировать нового пользователя
   */
  async registerUser(userData) {
    try {
      const { email, password, username, role = 'user' } = userData;

      // Валидация пароля
      if (!this.validatePassword(password)) {
        throw new Error('Password must be at least 8 characters with uppercase, lowercase and number');
      }

      // Проверяем существование пользователя
      const existingUser = await UserServiceSQLite.findByEmail(email);
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Создаем пользователя
      const newUser = await UserServiceSQLite.create({
        username: username || email.split('@')[0],
        email,
        password,
        role
      });

      // Генерируем токены
      const tokens = this.generateTokens(newUser);

      logger.info('User registered successfully', {
        userId: newUser.id,
        email: newUser.email,
        service: this.name
      });

      return {
        success: true,
        user: this.sanitizeUser(newUser),
        tokens
      };

    } catch (error) {
      logger.error('Registration error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Аутентификация пользователя
   */
  async authenticateUser(email, password) {
    try {
      const result = await UserServiceSQLite.verifyPassword(email, password);

      if (!result.success) {
        return result;
      }

      const tokens = this.generateTokens(result.user);

      logger.info('User authenticated successfully', {
        userId: result.user.id,
        email: result.user.email,
        service: this.name
      });

      return {
        success: true,
        user: this.sanitizeUser(result.user),
        tokens
      };

    } catch (error) {
      logger.error('Authentication error:', error);
      return {
        success: false,
        error: 'Authentication failed'
      };
    }
  }

  /**
   * Получить пользователя по ID
   */
  async getUserById(userId) {
    try {
      const user = await UserServiceSQLite.findById(userId);
      if (!user) {
        return null;
      }

      return this.sanitizeUser(user);
    } catch (error) {
      logger.error('Error getting user by ID:', error);
      return null;
    }
  }

  /**
   * Обновить профиль пользователя
   */
  async updateUserProfile(userId, updates) {
    try {
      const updatedUser = await UserServiceSQLite.updateProfile(userId, updates);

      logger.info('User profile updated', {
        userId,
        service: this.name
      });

      return {
        success: true,
        user: this.sanitizeUser(updatedUser)
      };

    } catch (error) {
      logger.error('Error updating user profile:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Изменить пароль пользователя
   */
  async changePassword(userId, currentPassword, newPassword) {
    try {
      if (!this.validatePassword(newPassword)) {
        throw new Error('New password must be at least 8 characters with uppercase, lowercase and number');
      }

      const result = await UserServiceSQLite.changePassword(userId, currentPassword, newPassword);

      logger.info('Password changed successfully', {
        userId,
        service: this.name
      });

      return result;

    } catch (error) {
      logger.error('Error changing password:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Генерация JWT токенов
   */
  generateTokens(user) {
    const payload = {
      id: user.id,
      email: user.email,
      role: user.role
    };

    const accessToken = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRE,
      issuer: 'neurogrid-auth',
      subject: user.id.toString()
    });

    const refreshToken = jwt.sign(
      { id: user.id, type: 'refresh' },
      JWT_SECRET,
      {
        expiresIn: REFRESH_TOKEN_EXPIRE,
        issuer: 'neurogrid-auth',
        subject: user.id.toString()
      }
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: JWT_EXPIRE
    };
  }

  /**
   * Верификация JWT токена
   */
  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET, {
        issuer: 'neurogrid-auth'
      });

      return {
        valid: true,
        decoded
      };
    } catch (error) {
      logger.debug('Token verification failed:', error.message);
      return {
        valid: false,
        error: error.message
      };
    }
  }

  /**
   * Обновление access токена через refresh токен
   */
  async refreshAccessToken(refreshToken) {
    try {
      const decoded = jwt.verify(refreshToken, JWT_SECRET);

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid refresh token');
      }

      const user = await UserServiceSQLite.findById(decoded.id);
      if (!user) {
        throw new Error('User not found');
      }

      const tokens = this.generateTokens(user);

      logger.info('Token refreshed successfully', {
        userId: user.id,
        service: this.name
      });

      return {
        success: true,
        tokens
      };

    } catch (error) {
      logger.error('Token refresh error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Получить статистику пользователя
   */
  async getUserStats(userId) {
    try {
      const stats = await UserServiceSQLite.getStats(userId);
      return {
        success: true,
        stats
      };
    } catch (error) {
      logger.error('Error getting user stats:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Валидация пароля
   */
  validatePassword(password) {
    if (!password || password.length < 8) {
      return false;
    }

    // Проверяем наличие заглавной буквы, строчной буквы и цифры
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);

    return hasUpperCase && hasLowerCase && hasNumbers;
  }

  /**
   * Очистка пользовательских данных (убираем пароль и другие чувствительные данные)
   */
  sanitizeUser(user) {
    const { password_hash, ...sanitizedUser } = user;
    return sanitizedUser;
  }

  /**
   * Деактивация пользователя
   */
  async deactivateUser(userId) {
    try {
      const result = await UserServiceSQLite.deactivate(userId);

      logger.info('User deactivated', {
        userId,
        service: this.name
      });

      return {
        success: true,
        user: this.sanitizeUser(result)
      };

    } catch (error) {
      logger.error('Error deactivating user:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Получить активных пользователей (для админки)
   */
  async getActiveUsers(limit = 50, offset = 0) {
    try {
      const users = await UserServiceSQLite.getActiveUsers(limit, offset);

      return {
        success: true,
        users: users.map(user => this.sanitizeUser(user))
      };

    } catch (error) {
      logger.error('Error getting active users:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Создаем singleton экземпляр
const authService = new AuthService();

module.exports = authService;
