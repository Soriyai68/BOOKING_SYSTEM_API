const express = require('express');
const { Role } = require("../data");
const { userSchema } = require('../schemas');
const middlewares = require('../middlewares');
const UserController = require('../controllers/user.controller');

const router = express.Router();

// GET /api/users/stats - Get user statistics (Admin/SuperAdmin only)
router.get('/stats',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  UserController.getStats
);

// GET /api/users/deleted - Get deleted/deactivated users (Admin/SuperAdmin only)
router.get('/deleted',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(userSchema.paginationSchema, 'query'),
  UserController.getDeleted
);

// POST /api/users/search - Advanced user search (Admin/SuperAdmin only)
router.post('/search',
  middlewares.authenticate,
  // middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(userSchema.advancedSearchSchema),
  UserController.search
);

// GET /api/users/role/:role - Get users by role (Admin/SuperAdmin only)
router.get('/role/:role',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(userSchema.roleParamSchema, 'params'),
  middlewares.validator(userSchema.paginationSchema, 'query'),
  UserController.getUsersByRole
);

// GET /api/users/phone/:phone - Get user by phone (Admin/SuperAdmin only)
router.get('/phone/:phone',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(userSchema.phoneParamSchema, 'params'),
  UserController.getUserByPhone
);

// PUT /api/users/:id/restore - Restore deleted user (Admin/SuperAdmin only)
router.put('/:id/restore',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(userSchema.userIdParamSchema, 'params'),
  UserController.restore
);

// PUT /api/users/:id/last-login - Update last login timestamp
router.put('/:id/last-login',
  middlewares.authenticate,
  middlewares.validator(userSchema.userIdParamSchema, 'params'),
  UserController.updateLastLogin
);

// DELETE /api/users/:id/force - Permanently delete user (SuperAdmin only)
router.delete('/:id/force-delete',
  middlewares.authenticate,
  middlewares.authorize(Role.SUPERADMIN),
  middlewares.validator(userSchema.userIdParamSchema, 'params'),
  UserController.forceDelete
);

// 1. GET ALL USERS - Get all users with pagination and filtering (Admin/SuperAdmin only)
router.get('/',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.USER, Role.CASHIER),
  middlewares.validator(userSchema.getAllUsersQuerySchema, 'query'),
  UserController.getAll
);

// 2. CREATE USER - Create new user (Admin/SuperAdmin only)
router.post('/',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(userSchema.createUserSchema),
  UserController.create
);

// 3. GET BY ID - Get user by ID
router.get('/:id',
  middlewares.authenticate,
  middlewares.validator(userSchema.userIdParamSchema, 'params'),
  UserController.getById
);

// 4. UPDATE USER - Update user by ID
router.put('/:id',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(userSchema.userIdParamSchema, 'params'),
  middlewares.validator(userSchema.updateUserSchema),
  UserController.update
);

// 5. SOFT DELETE - Deactivate user (Admin/SuperAdmin only)
router.delete('/:id',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(userSchema.userIdParamSchema, 'params'),
  UserController.delete
);

module.exports = router;