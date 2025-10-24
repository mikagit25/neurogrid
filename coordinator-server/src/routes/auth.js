/**
 * Enhanced Authentication Routes
 * Новые маршруты для аутентификации, использующие AuthService
 * Работают параллельно с существующими маршрутами
 */

const express = require('express');
const router = express.Router();
const authService = require('../services/AuthService');
const { 
  authenticateToken, 
  requireAdmin, 
  requireOwnership, 
  requireActiveAccount,
  createUserRateLimit,
  logUserAction 
} = require('../middleware/auth');
const logger = require('../utils/logger');

// Rate limiting
const loginRateLimit = createUserRateLimit(15 * 60 * 1000, 5); // 5 попыток за 15 минут
const registerRateLimit = createUserRateLimit(60 * 60 * 1000, 3); // 3 регистрации в час

/**
 * POST /api/v2/auth/register
 * Регистрация нового пользователя
 */
router.post('/register', registerRateLimit, logUserAction('register'), async (req, res) => {
  try {
    const { email, password, username, role } = req.body;

    // Базовая валидация
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    // Валидация email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    const result = await authService.registerUser({
      email: email.toLowerCase().trim(),
      password,
      username: username?.trim(),
      role: role || 'user'
    });

    if (result.success) {
      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        user: result.user,
        tokens: result.tokens
      });
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    logger.error('Registration route error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/v2/auth/login
 * Аутентификация пользователя
 */
router.post('/login', loginRateLimit, logUserAction('login'), async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Email and password are required'
      });
    }

    const result = await authService.authenticateUser(
      email.toLowerCase().trim(),
      password
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'Authentication successful',
        user: result.user,
        tokens: result.tokens
      });
    } else {
      res.status(401).json(result);
    }

  } catch (error) {
    logger.error('Login route error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/v2/auth/refresh
 * Обновление access токена
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        error: 'Refresh token is required'
      });
    }

    const result = await authService.refreshAccessToken(refreshToken);

    if (result.success) {
      res.json({
        success: true,
        message: 'Token refreshed successfully',
        tokens: result.tokens
      });
    } else {
      res.status(401).json(result);
    }

  } catch (error) {
    logger.error('Token refresh route error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/v2/auth/me
 * Получить информацию о текущем пользователе
 */
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const statsResult = await authService.getUserStats(userId);

    res.json({
      success: true,
      user: req.user,
      stats: statsResult.success ? statsResult.stats : null
    });

  } catch (error) {
    logger.error('Get current user route error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * PUT /api/v2/auth/profile
 * Обновить профиль пользователя
 */
router.put('/profile', authenticateToken, requireActiveAccount, logUserAction('update_profile'), async (req, res) => {
  try {
    const userId = req.user.id;
    const updates = req.body;

    // Удаляем поля, которые нельзя обновлять через этот эндпоинт
    delete updates.id;
    delete updates.email;
    delete updates.password;
    delete updates.password_hash;
    delete updates.role;
    delete updates.is_active;
    delete updates.created_at;

    const result = await authService.updateUserProfile(userId, updates);

    if (result.success) {
      res.json({
        success: true,
        message: 'Profile updated successfully',
        user: result.user
      });
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    logger.error('Update profile route error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * PUT /api/v2/auth/change-password
 * Изменить пароль пользователя
 */
router.put('/change-password', authenticateToken, requireActiveAccount, logUserAction('change_password'), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required'
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        error: 'New password must be different from current password'
      });
    }

    const result = await authService.changePassword(
      req.user.id,
      currentPassword,
      newPassword
    );

    if (result.success) {
      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    logger.error('Change password route error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/v2/auth/users/:userId
 * Получить информацию о пользователе (только для владельца или админа)
 */
router.get('/users/:userId', authenticateToken, requireOwnership('userId'), async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = await authService.getUserById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const statsResult = await authService.getUserStats(userId);

    res.json({
      success: true,
      user,
      stats: statsResult.success ? statsResult.stats : null
    });

  } catch (error) {
    logger.error('Get user route error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * GET /api/v2/auth/users
 * Получить список активных пользователей (только для админов)
 */
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    if (limit > 100) {
      return res.status(400).json({
        success: false,
        error: 'Limit cannot exceed 100'
      });
    }

    const result = await authService.getActiveUsers(limit, offset);

    if (result.success) {
      res.json({
        success: true,
        users: result.users,
        pagination: {
          limit,
          offset,
          count: result.users.length
        }
      });
    } else {
      res.status(500).json(result);
    }

  } catch (error) {
    logger.error('Get users route error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * DELETE /api/v2/auth/users/:userId/deactivate
 * Деактивировать пользователя (только админы)
 */
router.delete('/users/:userId/deactivate', authenticateToken, requireAdmin, logUserAction('deactivate_user'), async (req, res) => {
  try {
    const userId = req.params.userId;

    // Нельзя деактивировать самого себя
    if (userId === req.user.id.toString()) {
      return res.status(400).json({
        success: false,
        error: 'Cannot deactivate your own account'
      });
    }

    const result = await authService.deactivateUser(userId);

    if (result.success) {
      logger.info('User deactivated by admin', {
        deactivatedUserId: userId,
        adminId: req.user.id
      });

      res.json({
        success: true,
        message: 'User deactivated successfully',
        user: result.user
      });
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    logger.error('Deactivate user route error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

/**
 * POST /api/v2/auth/verify-token
 * Проверить валидность токена
 */
router.post('/verify-token', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Token is required'
      });
    }

    const verification = authService.verifyToken(token);

    if (verification.valid) {
      const user = await authService.getUserById(verification.decoded.id);
      
      res.json({
        success: true,
        valid: true,
        user: user,
        decoded: verification.decoded
      });
    } else {
      res.json({
        success: true,
        valid: false,
        error: verification.error
      });
    }

  } catch (error) {
    logger.error('Verify token route error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;