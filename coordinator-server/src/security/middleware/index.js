/**
 * Security Middleware Index - Central export for all security middleware
 */

const authentication = require('./authentication');
const authorization = require('./authorization');
const validation = require('./validation');

module.exports = {
  // Authentication
  authenticate: authentication.authenticate,
  optionalAuth: authentication.optionalAuth,
  authenticateApiKey: authentication.authenticateApiKey,

  // Authorization
  requirePermission: authorization.requirePermission,
  requireAnyPermission: authorization.requireAnyPermission,
  requireRole: authorization.requireRole,
  requireAnyRole: authorization.requireAnyRole,
  requireOwnership: authorization.requireOwnership,
  requireAdmin: authorization.requireAdmin,

  // Validation
  helmet: validation.helmet,
  validateInput: validation.validateInput,
  sanitizeInput: validation.sanitizeInput,
  getRateLimit: validation.getRateLimit
};
