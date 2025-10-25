/**
 * Authorization Middleware - Role-based access control and permissions
 */

const { AuthorizationManagerSingleton } = require('../AuthorizationManager');

class AuthorizationMiddleware {
  constructor() {
    this.authzManager = AuthorizationManagerSingleton.getInstance();
  }

  // Check specific permission
  requirePermission(permission, options = {}) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const userRoles = req.user.role ? [req.user.role] : [];
      const resource = options.getResource ? options.getResource(req) : null;
      const context = {
        userId: req.user.id,
        ...options.getContext ? options.getContext(req) : {}
      };

      if (this.authzManager.hasPermission(userRoles, permission, resource, context)) {
        next();
      } else {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          required: permission
        });
      }
    };
  }

  // Check multiple permissions (OR logic)
  requireAnyPermission(permissions, options = {}) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      const userRoles = req.user.role ? [req.user.role] : [];
      const resource = options.getResource ? options.getResource(req) : null;
      const context = {
        userId: req.user.id,
        ...options.getContext ? options.getContext(req) : {}
      };

      const hasPermission = permissions.some(permission =>
        this.authzManager.hasPermission(userRoles, permission, resource, context)
      );

      if (hasPermission) {
        next();
      } else {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          required: permissions
        });
      }
    };
  }

  // Check role
  requireRole(role) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      if (req.user.role === role || req.user.role === 'admin') {
        next();
      } else {
        res.status(403).json({
          success: false,
          error: 'Insufficient role',
          required: role,
          current: req.user.role
        });
      }
    };
  }

  // Check multiple roles (OR logic)
  requireAnyRole(roles) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      if (roles.includes(req.user.role) || req.user.role === 'admin') {
        next();
      } else {
        res.status(403).json({
          success: false,
          error: 'Insufficient role',
          required: roles,
          current: req.user.role
        });
      }
    };
  }

  // Resource ownership check
  requireOwnership(getResourceOwnerId) {
    return (req, res, next) => {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      try {
        const resourceOwnerId = getResourceOwnerId(req);

        // Admin can access everything
        if (req.user.role === 'admin') {
          return next();
        }

        // Check ownership
        if (req.user.id === resourceOwnerId) {
          next();
        } else {
          res.status(403).json({
            success: false,
            error: 'Access denied: resource ownership required'
          });
        }

      } catch (error) {
        res.status(400).json({
          success: false,
          error: 'Invalid resource identifier'
        });
      }
    };
  }

  // Admin only access
  requireAdmin(req, res, next) {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (req.user.role === 'admin') {
      next();
    } else {
      res.status(403).json({
        success: false,
        error: 'Administrator access required'
      });
    }
  }
}

// Export singleton instance
const authzMiddleware = new AuthorizationMiddleware();

module.exports = {
  requirePermission: authzMiddleware.requirePermission,
  requireAnyPermission: authzMiddleware.requireAnyPermission,
  requireRole: authzMiddleware.requireRole,
  requireAnyRole: authzMiddleware.requireAnyRole,
  requireOwnership: authzMiddleware.requireOwnership,
  requireAdmin: authzMiddleware.requireAdmin
};
