const express = require('express');
const router = express.Router();
const authenticate = require('../middlewares/auth.middleware');
const authorize = require('../middlewares/authorize.middleware');
const validator = require('../middlewares/validator.middleware');
const { getAllPermissionsQuerySchema } = require('../schemas/permissionSchema');
const { requirePermission, PERMISSIONS } = require('../middlewares/permission.middleware');
const { Role } = require('../data');
const {
  getUserPermissions,
  checkPermission,
  getAllPermissions,
  getRolePermissions,
  getAllRolePermissions,
  createPermission,
  assignPermissionToRole,
  removePermissionFromRole
} = require('../controllers/permission.controller');

// All routes require authentication
router.use(authenticate);

// Get current user's permissions - any authenticated user
router.get('/me', getUserPermissions);

// Check specific permission(s) for current user - any authenticated user
router.post('/check', checkPermission);

// Admin and SuperAdmin only routes
router.get('/all', 
  authorize(Role.ADMIN, Role.SUPERADMIN), 
  validator(getAllPermissionsQuerySchema, 'query'),
  getAllPermissions
);

router.get('/roles', 
  authorize(Role.ADMIN, Role.SUPERADMIN), 
  getAllRolePermissions
);

router.get('/roles/:role', 
  authorize(Role.ADMIN, Role.SUPERADMIN), 
  getRolePermissions
);

// SuperAdmin only routes
router.post('/', 
  authorize(Role.SUPERADMIN), 
  createPermission
);

router.post('/assign', 
  authorize(Role.SUPERADMIN), 
  assignPermissionToRole
);

router.post('/remove', 
  authorize(Role.SUPERADMIN), 
  removePermissionFromRole
);

module.exports = router;