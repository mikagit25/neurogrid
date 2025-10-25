/**
 * Enhanced Authentication Middleware
 * Новый middleware для аутентификации, использующий AuthService
 * Может работать параллельно с существующим middleware
 */

const authService = require('../services/AuthService');
const logger = require('../utils/logger');

/**
 * Основной middleware для проверки JWT токена
 */
const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Access token required'
      });
    }

    // Верифицируем токен
    const verification = authService.verifyToken(token);

    if (!verification.valid) {
      return res.status(403).json({
        success: false,
        error: 'Invalid or expired token'
      });
    }

    // Получаем полную информацию о пользователе
    const user = await authService.getUserById(verification.decoded.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        error: 'User account is deactivated'
      });
    }

    // Добавляем пользователя в request
    req.user = user;
    req.token = verification.decoded;

    next();

  } catch (error) {
    logger.error('Authentication middleware error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Middleware для проверки роли пользователя
 */
const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const userRole = req.user.role;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(userRole)) {
      logger.warn('Access denied - insufficient role', {
        userId: req.user.id,
        userRole,
        requiredRoles: allowedRoles
      });

      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions'
      });
    }

    next();
  };
};

/**
 * Middleware для админов
 */
const requireAdmin = requireRole(['admin', 'super_admin']);

/**
 * Middleware для операторов и админов
 */
const requireOperator = requireRole(['operator', 'admin', 'super_admin']);

/**
 * Опциональная аутентификация - не блокирует запрос если токен отсутствует
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      req.user = null;
      return next();
    }

    const verification = authService.verifyToken(token);

    if (verification.valid) {
      const user = await authService.getUserById(verification.decoded.id);
      req.user = user && user.is_active ? user : null;
    } else {
      req.user = null;
    }

    next();

  } catch (error) {
    logger.error('Optional auth middleware error:', error);
    req.user = null;
    next();
  }
};

/**
 * Middleware для ограничения доступа к собственным ресурсам
 */
const requireOwnership = (paramName = 'userId') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    const resourceUserId = req.params[paramName];
    const currentUserId = req.user.id;

    // Админы могут обращаться к любым ресурсам
    if (req.user.role === 'admin' || req.user.role === 'super_admin') {
      return next();
    }

    // Проверяем владение ресурсом
    if (resourceUserId !== currentUserId.toString()) {
      logger.warn('Access denied - resource ownership violation', {
        userId: currentUserId,
        resourceUserId,
        endpoint: req.path
      });

      return res.status(403).json({
        success: false,
        error: 'Access denied - you can only access your own resources'
      });
    }

    next();
  };
};

/**
 * Middleware для проверки статуса аккаунта
 */
const requireActiveAccount = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required'
    });
  }

  if (!req.user.is_active) {
    return res.status(403).json({
      success: false,
      error: 'Account is deactivated'
    });
  }

  if (!req.user.email_verified) {
    return res.status(403).json({
      success: false,
      error: 'Email verification required'
    });
  }

  next();
};

/**
 * Rate limiting по пользователю
 */
const createUserRateLimit = (windowMs, maxRequests) => {
  const requests = new Map();

  return (req, res, next) => {
    if (!req.user) {
      return next();
    }

    const userId = req.user.id;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Получаем или создаем массив запросов для пользователя
    if (!requests.has(userId)) {
      requests.set(userId, []);
    }

    const userRequests = requests.get(userId);

    // Удаляем старые запросы
    const recentRequests = userRequests.filter(time => time > windowStart);
    requests.set(userId, recentRequests);

    // Проверяем лимит
    if (recentRequests.length >= maxRequests) {
      logger.warn('Rate limit exceeded', {
        userId,
        requests: recentRequests.length,
        limit: maxRequests
      });

      return res.status(429).json({
        success: false,
        error: 'Too many requests, please try again later'
      });
    }

    // Добавляем текущий запрос
    recentRequests.push(now);
    requests.set(userId, recentRequests);

    next();
  };
};

/**
 * Логирование пользовательских действий
 */
const logUserAction = (action) => {
  return (req, res, next) => {
    if (req.user) {
      logger.info('User action', {
        userId: req.user.id,
        email: req.user.email,
        action,
        endpoint: req.path,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
    }

    next();
  };
};

module.exports = {
  authenticateToken,
  requireRole,
  requireAdmin,
  requireOperator,
  optionalAuth,
  requireOwnership,
  requireActiveAccount,
  createUserRateLimit,
  logUserAction
};
