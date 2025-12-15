/**
 * Authorization Manager - Handles role-based access control and permissions
 * Implements RBAC (Role-Based Access Control) with fine-grained permissions
 */

const { EventEmitter } = require('events');

class AuthorizationManager extends EventEmitter {
  constructor(options = {}) {
    super();

    this.config = {
      enableResourceLevelPermissions: options.enableResourceLevelPermissions !== false,
      enableDynamicPermissions: options.enableDynamicPermissions !== false,
      defaultRole: options.defaultRole || 'user',
      adminRole: options.adminRole || 'admin'
    };

    // Role definitions
    this.roles = new Map();
    this.permissions = new Map();
    this.resourcePermissions = new Map();
    this.userPermissions = new Map(); // User-specific permission overrides

    // Permission inheritance hierarchy
    this.roleHierarchy = new Map();

    // Initialize default roles and permissions
    this.initializeDefaultRoles();

    // Statistics
    this.stats = {
      totalRoles: 0,
      totalPermissions: 0,
      authorizationChecks: 0,
      deniedRequests: 0,
      grantedRequests: 0
    };
  }

  initializeDefaultRoles() {
    // Define default permissions
    const defaultPermissions = [
      // System permissions
      'system:read', 'system:write', 'system:admin',

      // User management
      'users:read', 'users:create', 'users:update', 'users:delete',

      // Node management
      'nodes:read', 'nodes:create', 'nodes:update', 'nodes:delete', 'nodes:control',

      // Task management
      'tasks:read', 'tasks:create', 'tasks:update', 'tasks:delete', 'tasks:execute',

      // Model management
      'models:read', 'models:create', 'models:update', 'models:delete', 'models:load', 'models:inference',

      // Resource management
      'resources:read', 'resources:allocate', 'resources:deallocate', 'resources:admin',

      // Monitoring and analytics
      'monitoring:read', 'monitoring:admin', 'analytics:read', 'analytics:admin',

      // Security
      'security:read', 'security:admin', 'audit:read', 'audit:admin',

      // API access
      'api:read', 'api:write', 'api:admin'
    ];

    // Register permissions
    defaultPermissions.forEach(permission => {
      this.registerPermission(permission, {
        description: `Permission for ${permission}`,
        category: permission.split(':')[0]
      });
    });

    // Define default roles
    const defaultRoles = [
      {
        name: 'guest',
        description: 'Read-only access to basic information',
        permissions: ['system:read', 'nodes:read', 'tasks:read']
      },
      {
        name: 'user',
        description: 'Standard user with task execution capabilities',
        permissions: [
          'system:read', 'nodes:read', 'tasks:read', 'tasks:create', 'tasks:execute',
          'models:read', 'models:inference', 'resources:read', 'monitoring:read', 'api:read'
        ]
      },
      {
        name: 'operator',
        description: 'Advanced user with model and resource management',
        permissions: [
          'system:read', 'nodes:read', 'nodes:update', 'tasks:read', 'tasks:create',
          'tasks:execute', 'tasks:update', 'models:read', 'models:load', 'models:inference',
          'resources:read', 'resources:allocate', 'resources:deallocate', 'monitoring:read',
          'api:read', 'api:write'
        ]
      },
      {
        name: 'admin',
        description: 'Full system administrator',
        permissions: ['*'] // All permissions
      }
    ];

    // Register roles
    defaultRoles.forEach(role => {
      this.createRole(role.name, role.description, role.permissions);
    });

    // Set up role hierarchy
    this.setRoleHierarchy('admin', ['operator', 'user', 'guest']);
    this.setRoleHierarchy('operator', ['user', 'guest']);
    this.setRoleHierarchy('user', ['guest']);
  }

  registerPermission(permission, metadata = {}) {
    this.permissions.set(permission, {
      name: permission,
      description: metadata.description || permission,
      category: metadata.category || 'general',
      createdAt: new Date(),
      ...metadata
    });

    this.stats.totalPermissions++;
    this.emit('permissionRegistered', { permission, metadata });
  }

  createRole(name, description, permissions = []) {
    const role = {
      name,
      description,
      permissions: new Set(permissions),
      createdAt: new Date(),
      isActive: true
    };

    this.roles.set(name, role);
    this.stats.totalRoles++;

    this.emit('roleCreated', { role: { ...role, permissions: Array.from(role.permissions) } });

    return { success: true, role: { ...role, permissions: Array.from(role.permissions) } };
  }

  updateRole(name, updates) {
    const role = this.roles.get(name);
    if (!role) {
      return { success: false, error: 'Role not found' };
    }

    if (updates.permissions) {
      role.permissions = new Set(updates.permissions);
    }

    if (updates.description) {
      role.description = updates.description;
    }

    if (updates.isActive !== undefined) {
      role.isActive = updates.isActive;
    }

    this.emit('roleUpdated', { role: { ...role, permissions: Array.from(role.permissions) } });

    return { success: true, role: { ...role, permissions: Array.from(role.permissions) } };
  }

  deleteRole(name) {
    if (!this.roles.has(name)) {
      return { success: false, error: 'Role not found' };
    }

    // Don't allow deletion of admin role
    if (name === this.config.adminRole) {
      return { success: false, error: 'Cannot delete admin role' };
    }

    this.roles.delete(name);
    this.roleHierarchy.delete(name);

    // Remove from other role hierarchies
    for (const [roleName, children] of this.roleHierarchy.entries()) {
      const index = children.indexOf(name);
      if (index > -1) {
        children.splice(index, 1);
      }
    }

    this.stats.totalRoles--;
    this.emit('roleDeleted', { name });

    return { success: true, message: 'Role deleted successfully' };
  }

  setRoleHierarchy(parentRole, childRoles) {
    this.roleHierarchy.set(parentRole, childRoles);
    this.emit('roleHierarchyUpdated', { parentRole, childRoles });
  }

  hasPermission(userRoles, requiredPermission, resource = null, context = {}) {
    this.stats.authorizationChecks++;

    try {
      // Handle wildcard permission (admin)
      if (this.hasWildcardPermission(userRoles)) {
        this.stats.grantedRequests++;
        return true;
      }

      // Get all effective permissions for user roles
      const effectivePermissions = this.getEffectivePermissions(userRoles);

      // Check direct permission
      if (effectivePermissions.has(requiredPermission)) {
        this.stats.grantedRequests++;
        return true;
      }

      // Check resource-level permissions
      if (resource && this.config.enableResourceLevelPermissions) {
        const resourcePermission = this.checkResourcePermission(userRoles, requiredPermission, resource);
        if (resourcePermission) {
          this.stats.grantedRequests++;
          return true;
        }
      }

      // Check dynamic permissions
      if (this.config.enableDynamicPermissions) {
        const dynamicPermission = this.checkDynamicPermission(userRoles, requiredPermission, resource, context);
        if (dynamicPermission) {
          this.stats.grantedRequests++;
          return true;
        }
      }

      this.stats.deniedRequests++;
      this.emit('accessDenied', { userRoles, requiredPermission, resource, context });
      return false;

    } catch (error) {
      this.stats.deniedRequests++;
      console.error('Authorization check error:', error);
      return false;
    }
  }

  hasWildcardPermission(userRoles) {
    const roles = Array.isArray(userRoles) ? userRoles : [userRoles];

    for (const roleName of roles) {
      const role = this.roles.get(roleName);
      if (role && role.permissions.has('*')) {
        return true;
      }
    }

    return false;
  }

  getEffectivePermissions(userRoles) {
    const roles = Array.isArray(userRoles) ? userRoles : [userRoles];
    const effectivePermissions = new Set();

    // Collect permissions from all roles including inherited ones
    for (const roleName of roles) {
      const rolePermissions = this.getRolePermissions(roleName, true); // Include inherited
      rolePermissions.forEach(permission => effectivePermissions.add(permission));
    }

    return effectivePermissions;
  }

  getRolePermissions(roleName, includeInherited = false) {
    const permissions = new Set();
    const role = this.roles.get(roleName);

    if (!role || !role.isActive) {
      return permissions;
    }

    // Add direct permissions
    role.permissions.forEach(permission => permissions.add(permission));

    // Add inherited permissions if requested
    if (includeInherited) {
      const childRoles = this.roleHierarchy.get(roleName) || [];
      for (const childRole of childRoles) {
        const childPermissions = this.getRolePermissions(childRole, true);
        childPermissions.forEach(permission => permissions.add(permission));
      }
    }

    return permissions;
  }

  checkResourcePermission(userRoles, permission, resource) {
    const resourceKey = `${resource.type}:${resource.id}`;
    const resourcePerms = this.resourcePermissions.get(resourceKey);

    if (!resourcePerms) {
      return false;
    }

    const roles = Array.isArray(userRoles) ? userRoles : [userRoles];

    for (const role of roles) {
      if (resourcePerms.roles && resourcePerms.roles.includes(role)) {
        if (resourcePerms.permissions.includes(permission)) {
          return true;
        }
      }
    }

    return false;
  }

  async checkDynamicPermission(userRoles, permission, resource, context) {
    // Placeholder for dynamic permission checking
    // This could integrate with external systems, time-based rules, etc.

    // Example: Time-based permissions
    if (context.timeRestricted) {
      const now = new Date();
      const hour = now.getHours();

      // Only allow certain operations during business hours
      if (permission.includes('admin') && (hour < 9 || hour > 17)) {
        return false;
      }
    }

    // Example: Resource ownership
    if (resource && context.userId) {
      if (resource.ownerId === context.userId) {
        // Owners have additional permissions
        const ownerPermissions = ['read', 'update'];
        const permissionAction = permission.split(':')[1];
        if (ownerPermissions.includes(permissionAction)) {
          return true;
        }
      }
    }

    return false;
  }

  // Resource-level permission management
  setResourcePermissions(resourceType, resourceId, permissions) {
    const resourceKey = `${resourceType}:${resourceId}`;

    this.resourcePermissions.set(resourceKey, {
      resourceType,
      resourceId,
      ...permissions,
      createdAt: new Date()
    });

    this.emit('resourcePermissionsSet', { resourceType, resourceId, permissions });

    return { success: true };
  }

  removeResourcePermissions(resourceType, resourceId) {
    const resourceKey = `${resourceType}:${resourceId}`;

    if (this.resourcePermissions.delete(resourceKey)) {
      this.emit('resourcePermissionsRemoved', { resourceType, resourceId });
      return { success: true };
    }

    return { success: false, error: 'Resource permissions not found' };
  }

  // User-specific permission overrides
  setUserPermissions(userId, permissions) {
    this.userPermissions.set(userId, {
      userId,
      permissions,
      createdAt: new Date()
    });

    this.emit('userPermissionsSet', { userId, permissions });

    return { success: true };
  }

  getUserPermissions(userId) {
    return this.userPermissions.get(userId);
  }

  removeUserPermissions(userId) {
    if (this.userPermissions.delete(userId)) {
      this.emit('userPermissionsRemoved', { userId });
      return { success: true };
    }

    return { success: false, error: 'User permissions not found' };
  }

  // Permission analysis and reporting
  analyzeUserPermissions(userRoles, userId = null) {
    const roles = Array.isArray(userRoles) ? userRoles : [userRoles];
    const analysis = {
      roles: roles,
      effectivePermissions: [],
      inheritedPermissions: [],
      directPermissions: [],
      userSpecificPermissions: [],
      hasWildcard: false
    };

    // Check for wildcard
    analysis.hasWildcard = this.hasWildcardPermission(roles);

    if (analysis.hasWildcard) {
      analysis.effectivePermissions = ['*'];
      return analysis;
    }

    // Collect all permissions
    const allPermissions = new Set();
    const directPerms = new Set();
    const inheritedPerms = new Set();

    for (const roleName of roles) {
      const role = this.roles.get(roleName);
      if (role && role.isActive) {
        // Direct permissions
        role.permissions.forEach(perm => {
          allPermissions.add(perm);
          directPerms.add(perm);
        });

        // Inherited permissions
        const childRoles = this.roleHierarchy.get(roleName) || [];
        for (const childRole of childRoles) {
          const childPermissions = this.getRolePermissions(childRole, false);
          childPermissions.forEach(perm => {
            allPermissions.add(perm);
            inheritedPerms.add(perm);
          });
        }
      }
    }

    // User-specific permissions
    if (userId) {
      const userPerms = this.getUserPermissions(userId);
      if (userPerms) {
        userPerms.permissions.forEach(perm => {
          allPermissions.add(perm);
          analysis.userSpecificPermissions.push(perm);
        });
      }
    }

    analysis.effectivePermissions = Array.from(allPermissions);
    analysis.directPermissions = Array.from(directPerms);
    analysis.inheritedPermissions = Array.from(inheritedPerms).filter(p => !directPerms.has(p));

    return analysis;
  }

  // Middleware factory for Express.js
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

      if (this.hasPermission(userRoles, permission, resource, context)) {
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

  // API methods
  getRoles(filters = {}) {
    let roles = Array.from(this.roles.values());

    if (filters.isActive !== undefined) {
      roles = roles.filter(role => role.isActive === filters.isActive);
    }

    return roles.map(role => ({
      ...role,
      permissions: Array.from(role.permissions)
    }));
  }

  getPermissions(filters = {}) {
    let permissions = Array.from(this.permissions.values());

    if (filters.category) {
      permissions = permissions.filter(perm => perm.category === filters.category);
    }

    return permissions;
  }

  getStats() {
    return {
      ...this.stats,
      activeRoles: Array.from(this.roles.values()).filter(r => r.isActive).length,
      resourcePermissions: this.resourcePermissions.size,
      userSpecificPermissions: this.userPermissions.size,
      authorizationSuccessRate: this.stats.authorizationChecks > 0 ?
        (this.stats.grantedRequests / this.stats.authorizationChecks) * 100 : 0
    };
  }

  // Permission validation
  validatePermission(permission) {
    // Check permission format (e.g., "resource:action")
    const parts = permission.split(':');
    if (parts.length !== 2) {
      return { valid: false, error: 'Permission must be in format "resource:action"' };
    }

    const [resource, action] = parts;
    if (!resource || !action) {
      return { valid: false, error: 'Resource and action cannot be empty' };
    }

    return { valid: true };
  }

  // Bulk operations
  bulkUpdateRolePermissions(roleName, permissionsToAdd = [], permissionsToRemove = []) {
    const role = this.roles.get(roleName);
    if (!role) {
      return { success: false, error: 'Role not found' };
    }

    // Add permissions
    permissionsToAdd.forEach(permission => {
      role.permissions.add(permission);
    });

    // Remove permissions
    permissionsToRemove.forEach(permission => {
      role.permissions.delete(permission);
    });

    this.emit('rolePermissionsBulkUpdated', {
      roleName,
      added: permissionsToAdd,
      removed: permissionsToRemove
    });

    return {
      success: true,
      role: { ...role, permissions: Array.from(role.permissions) }
    };
  }

  async shutdown() {
    this.removeAllListeners();
  }
}

// Singleton instance
let authzManagerInstance = null;

class AuthorizationManagerSingleton {
  static getInstance(options = {}) {
    if (!authzManagerInstance) {
      authzManagerInstance = new AuthorizationManager(options);
    }
    return authzManagerInstance;
  }
}

module.exports = { AuthorizationManager, AuthorizationManagerSingleton };
