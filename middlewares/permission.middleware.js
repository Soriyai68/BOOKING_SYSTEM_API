const RolePermission = require('../models/rolePermission.model');
const { Role } = require('../data');
const logger = require('../utils/logger');

/**
 * Permission middleware factory
 * @param {string|string[]} requiredPermissions - Single permission string or array of permissions
 * @param {object} options - Options for permission checking
 * @param {boolean} options.requireAll - If true, user must have ALL permissions. If false, user needs ANY permission
 * @returns {Function} Express middleware function
 */
function requirePermission(requiredPermissions, options = {}) {
  const { requireAll = false } = options;

  return async (req, res, next) => {
    try {
      // Ensure user is authenticated
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      }

      const userRole = req.user.role;

      // SuperAdmin always has access
      if (userRole === Role.SUPERADMIN) {
        return next();
      }

      // Normalize permissions to array
      const permissions = Array.isArray(requiredPermissions)
        ? requiredPermissions
        : [requiredPermissions];

      // Check if role has required permissions
      const hasPermissions = await checkRolePermissions(userRole, permissions, requireAll);

      if (!hasPermissions) {
        logger.warn('Permission denied', {
          userId: req.user.userId,
          userRole,
          requiredPermissions: permissions,
          requireAll,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });

        return res.status(403).json({
          success: false,
          message: 'Insufficient permissions to access this resource',
          required: permissions
        });
      }

      // Store checked permissions in request for logging/audit
      req.checkedPermissions = permissions;
      next();

    } catch (error) {
      logger.error('Permission middleware error:', error);
      res.status(500).json({
        success: false,
        message: 'Error checking permissions'
      });
    }
  };
}

/**
 * Check if a role has specific permissions
 * @param {string} role - User role
 * @param {string[]} permissions - Array of permission names to check
 * @param {boolean} requireAll - If true, role must have ALL permissions
 * @returns {Promise<boolean>} True if role has required permissions
 */
async function checkRolePermissions(role, permissions, requireAll = false) {
  try {
    if (!permissions || permissions.length === 0) {
      return true; // No permissions required
    }

    // Use the static method from RolePermission model
    const checkPromises = permissions.map(permission =>
      RolePermission.hasPermission(role, permission)
    );

    const results = await Promise.all(checkPromises);

    if (requireAll) {
      // User must have ALL permissions
      return results.every(result => result === true);
    } else {
      // User needs ANY of the permissions
      return results.some(result => result === true);
    }

  } catch (error) {
    logger.error('Error checking role permissions:', error);
    return false;
  }
}

/**
 * Get all permissions for a role
 * @param {string} role - User role
 * @returns {Promise<Array>} Array of permission objects
 */
async function getRolePermissions(role) {
  try {
    return await RolePermission.getPermissionsForRole(role);
  } catch (error) {
    logger.error('Error getting role permissions:', error);
    return [];
  }
}

/**
 * Middleware to add user permissions to request object
 */
const loadUserPermissions = async (req, res, next) => {
  try {
    if (!req.user) {
      return next();
    }

    const userRole = req.user.role;

    // SuperAdmin gets a special marker
    if (userRole === Role.SUPERADMIN) {
      req.userPermissions = { isSuperAdmin: true };
      return next();
    }

    // Get user permissions
    const permissions = await getRolePermissions(userRole);
    req.userPermissions = {
      isSuperAdmin: false,
      permissions: permissions.map(p => p.name),
      permissionObjects: permissions
    };

    next();
  } catch (error) {
    logger.error('Error loading user permissions:', error);
    // Continue without permissions rather than failing
    req.userPermissions = { isSuperAdmin: false, permissions: [], permissionObjects: [] };
    next();
  }
};

/**
 * Helper function to check permission in route handlers
 * @param {object} req - Express request object
 * @param {string|string[]} permissions - Permission(s) to check
 * @param {boolean} requireAll - If true, user must have ALL permissions
 * @returns {boolean} True if user has required permissions
 */
function hasPermission(req, permissions, requireAll = false) {
  if (!req.user) return false;

  const userRole = req.user.role;
  if (userRole === Role.SUPERADMIN) return true;

  const userPermissions = req.userPermissions?.permissions || [];
  const permissionsToCheck = Array.isArray(permissions) ? permissions : [permissions];

  if (requireAll) {
    return permissionsToCheck.every(permission => userPermissions.includes(permission));
  } else {
    return permissionsToCheck.some(permission => userPermissions.includes(permission));
  }
}

// Permission constants for easy reference
const PERMISSIONS = {
  // Users
  USERS_VIEW: 'users.view',
  USERS_CREATE: 'users.create',
  USERS_EDIT: 'users.edit',
  USERS_DELETE: 'users.delete',
  USERS_MANAGE: 'users.manage',

  // Theaters
  THEATERS_VIEW: 'theaters.view',
  THEATERS_CREATE: 'theaters.create',
  THEATERS_EDIT: 'theaters.edit',
  THEATERS_DELETE: 'theaters.delete',
  THEATERS_MANAGE: 'theaters.manage',

  // Halls
  HALLS_VIEW: 'halls.view',
  HALLS_CREATE: 'halls.create',
  HALLS_EDIT: 'halls.edit',
  HALLS_DELETE: 'halls.delete',
  HALLS_MANAGE: 'halls.manage',

  // Seats
  SEATS_VIEW: 'seats.view',
  SEATS_CREATE: 'seats.create',
  SEATS_EDIT: 'seats.edit',
  SEATS_DELETE: 'seats.delete',
  SEATS_MANAGE: 'seats.manage',

  // Movies
  MOVIES_VIEW: 'movies.view',
  MOVIES_CREATE: 'movies.create',
  MOVIES_EDIT: 'movies.edit',
  MOVIES_DELETE: 'movies.delete',
  MOVIES_MANAGE: 'movies.manage',

  // Showtimes
  SHOWTIMES_VIEW: 'showtimes.view',
  SHOWTIMES_CREATE: 'showtimes.create',
  SHOWTIMES_EDIT: 'showtimes.edit',
  SHOWTIMES_DELETE: 'showtimes.delete',
  SHOWTIMES_MANAGE: 'showtimes.manage',

  // Bookings
  BOOKINGS_VIEW: 'bookings.view',
  BOOKINGS_CREATE: 'bookings.create',
  BOOKINGS_EDIT: 'bookings.edit',
  BOOKINGS_DELETE: 'bookings.delete',
  BOOKINGS_MANAGE: 'bookings.manage',

  // Promotions
  PROMOTIONS_VIEW: 'promotions.view',
  PROMOTIONS_CREATE: 'promotions.create',
  PROMOTIONS_EDIT: 'promotions.edit',
  PROMOTIONS_DELETE: 'promotions.delete',
  PROMOTIONS_MANAGE: 'promotions.manage',

  // System
  DASHBOARD_VIEW: 'dashboard.view',
  ANALYTICS_VIEW: 'analytics.view',
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_EDIT: 'settings.edit',
  SETTINGS_MANAGE: 'settings.manage',
  SYSTEM_MANAGE: 'system.manage'
};

module.exports = {
  requirePermission,
  checkRolePermissions,
  getRolePermissions,
  loadUserPermissions,
  hasPermission,
  PERMISSIONS
};