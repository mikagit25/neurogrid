const logger = require('../../utils/logger');

/**
 * Simple authentication middleware
 * In production, this would validate JWT tokens
 */
const auth = async (req, res, next) => {
  try {
    // For now, just pass through
    // In production, validate JWT token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      // For development, allow requests without auth
      req.user = { id: 'demo-user', role: 'user' };
      return next();
    }

    // Mock JWT validation
    req.user = { id: 'demo-user', role: 'user' };
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(401).json({ error: 'Authentication failed' });
  }
};

/**
 * Admin authentication middleware
 */
const adminAuth = async (req, res, next) => {
  try {
    await auth(req, res, () => {
      if (req.user && req.user.role === 'admin') {
        next();
      } else {
        res.status(403).json({ error: 'Admin access required' });
      }
    });
  } catch (error) {
    logger.error('Admin authentication error:', error);
    res.status(403).json({ error: 'Admin access required' });
  }
};

module.exports = { auth, adminAuth };