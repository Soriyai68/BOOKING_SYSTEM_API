const Permission = require('../models/permission.model');
const RolePermission = require('../models/rolePermission.model');
const { Role } = require('../data');
const logger = require('../utils/logger');

/**
 * Get current user's permissions
 */
const getUserPermissions = async (req, res) => {
  try {
    const userRole = req.user.role;
    
    // SuperAdmin gets all permissions
    if (userRole === Role.SUPERADMIN) {
      const allPermissions = await Permission.find({ isActive: true });
      return res.json({
        success: true,
        data: {
          role: userRole,
          isSuperAdmin: true,
          permissions: allPermissions.map(p => p.name),
          permissionDetails: allPermissions
        }
      });
    }

    // Get role-specific permissions
    const permissions = await RolePermission.getPermissionsForRole(userRole);

    res.json({
      success: true,
      data: {
        role: userRole,
        isSuperAdmin: false,
        permissions: permissions.map(p => p.name),
        permissionDetails: permissions
      }
    });

  } catch (error) {
    logger.error('Error getting user permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving user permissions'
    });
  }
};

/**
 * Check if current user has specific permission(s)
 */
const checkPermission = async (req, res) => {
  try {
    const { permissions, requireAll = false } = req.body;
    
    if (!permissions || (!Array.isArray(permissions) && typeof permissions !== 'string')) {
      return res.status(400).json({
        success: false,
        message: 'Permissions parameter is required and must be a string or array of strings'
      });
    }

    const userRole = req.user.role;
    const permissionsArray = Array.isArray(permissions) ? permissions : [permissions];

    // SuperAdmin always has all permissions
    if (userRole === Role.SUPERADMIN) {
      return res.json({
        success: true,
        data: {
          hasPermission: true,
          role: userRole,
          checkedPermissions: permissionsArray,
          requireAll
        }
      });
    }

    // Check permissions for the role
    const checkPromises = permissionsArray.map(permission => 
      RolePermission.hasPermission(userRole, permission)
    );

    const results = await Promise.all(checkPromises);

    const hasPermission = requireAll 
      ? results.every(result => result === true)
      : results.some(result => result === true);

    res.json({
      success: true,
      data: {
        hasPermission,
        role: userRole,
        checkedPermissions: permissionsArray,
        requireAll,
        permissionResults: permissionsArray.reduce((acc, permission, index) => {
          acc[permission] = results[index];
          return acc;
        }, {})
      }
    });

  } catch (error) {
    logger.error('Error checking permission:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking permission'
    });
  }
};

/**
 * Get all permissions (admin only)
 */
const getAllPermissions = async (req, res) => {
  try {
    const { module, isActive } = req.query;
    
    const filter = {};
    if (module) filter.module = module;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const permissions = await Permission.find(filter)
      .sort({ module: 1, name: 1 });

    // Group by module
    const groupedPermissions = permissions.reduce((acc, permission) => {
      if (!acc[permission.module]) {
        acc[permission.module] = [];
      }
      acc[permission.module].push(permission);
      return acc;
    }, {});

    res.json({
      success: true,
      data: {
        permissions,
        groupedPermissions,
        modules: Object.keys(groupedPermissions)
      }
    });

  } catch (error) {
    logger.error('Error getting all permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving permissions'
    });
  }
};

/**
 * Get role permissions (admin only)
 */
const getRolePermissions = async (req, res) => {
  try {
    const { role } = req.params;

    if (!Object.values(Role).includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role'
      });
    }

    const permissions = await RolePermission.getPermissionsForRole(role);

    res.json({
      success: true,
      data: {
        role,
        permissions: permissions.map(p => p.name),
        permissionDetails: permissions,
        count: permissions.length
      }
    });

  } catch (error) {
    logger.error('Error getting role permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving role permissions'
    });
  }
};

/**
 * Get permissions for all roles (admin only)
 */
const getAllRolePermissions = async (req, res) => {
  try {
    const rolePermissions = {};

    for (const role of Object.values(Role)) {
      const permissions = await RolePermission.getPermissionsForRole(role);
      rolePermissions[role] = {
        permissions: permissions.map(p => p.name),
        permissionDetails: permissions,
        count: permissions.length
      };
    }

    res.json({
      success: true,
      data: rolePermissions
    });

  } catch (error) {
    logger.error('Error getting all role permissions:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving role permissions'
    });
  }
};

/**
 * Create new permission (superadmin only)
 */
const createPermission = async (req, res) => {
  try {
    const { name, displayName, description, module } = req.body;

    // Check if permission already exists
    const existingPermission = await Permission.findOne({ name });
    if (existingPermission) {
      return res.status(400).json({
        success: false,
        message: 'Permission already exists'
      });
    }

    const permission = new Permission({
      name,
      displayName,
      description,
      module
    });

    await permission.save();

    logger.info('Permission created', {
      permissionId: permission._id,
      name: permission.name,
      createdBy: req.user.userId
    });

    res.status(201).json({
      success: true,
      data: permission,
      message: 'Permission created successfully'
    });

  } catch (error) {
    logger.error('Error creating permission:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating permission'
    });
  }
};

/**
 * Assign permission to role (superadmin only)
 */
const assignPermissionToRole = async (req, res) => {
  try {
    const { role, permissionId } = req.body;

    if (!Object.values(Role).includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role'
      });
    }

    // Check if permission exists
    const permission = await Permission.findById(permissionId);
    if (!permission) {
      return res.status(404).json({
        success: false,
        message: 'Permission not found'
      });
    }

    // Check if assignment already exists
    const existingAssignment = await RolePermission.findOne({ role, permission: permissionId });
    if (existingAssignment) {
      if (existingAssignment.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Permission already assigned to role'
        });
      } else {
        // Reactivate existing assignment
        existingAssignment.isActive = true;
        await existingAssignment.save();
        
        return res.json({
          success: true,
          data: existingAssignment,
          message: 'Permission assignment reactivated'
        });
      }
    }

    // Create new assignment
    const rolePermission = new RolePermission({
      role,
      permission: permissionId
    });

    await rolePermission.save();

    logger.info('Permission assigned to role', {
      rolePermissionId: rolePermission._id,
      role,
      permissionId,
      assignedBy: req.user.userId
    });

    res.status(201).json({
      success: true,
      data: rolePermission,
      message: 'Permission assigned to role successfully'
    });

  } catch (error) {
    logger.error('Error assigning permission to role:', error);
    res.status(500).json({
      success: false,
      message: 'Error assigning permission to role'
    });
  }
};

/**
 * Remove permission from role (superadmin only)
 */
const removePermissionFromRole = async (req, res) => {
  try {
    const { role, permissionId } = req.body;

    if (!Object.values(Role).includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role'
      });
    }

    // Find and deactivate the assignment
    const rolePermission = await RolePermission.findOne({ role, permission: permissionId });
    
    if (!rolePermission || !rolePermission.isActive) {
      return res.status(404).json({
        success: false,
        message: 'Permission assignment not found'
      });
    }

    rolePermission.isActive = false;
    await rolePermission.save();

    logger.info('Permission removed from role', {
      rolePermissionId: rolePermission._id,
      role,
      permissionId,
      removedBy: req.user.userId
    });

    res.json({
      success: true,
      message: 'Permission removed from role successfully'
    });

  } catch (error) {
    logger.error('Error removing permission from role:', error);
    res.status(500).json({
      success: false,
      message: 'Error removing permission from role'
    });
  }
};

module.exports = {
  getUserPermissions,
  checkPermission,
  getAllPermissions,
  getRolePermissions,
  getAllRolePermissions,
  createPermission,
  assignPermissionToRole,
  removePermissionFromRole
};