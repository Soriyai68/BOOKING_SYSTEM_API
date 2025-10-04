const express = require('express');
const { Role } = require('../data');
const { screenSchema } = require('../schemas');
const middlewares = require('../middlewares');
const ScreenController = require('../controllers/screen.controller');

const router = express.Router();

// GET /api/screens/stats - Get screen statistics (Admin/SuperAdmin only)
router.get('/stats',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  ScreenController.getStats
);

// GET /api/screens/deleted - Get deleted/deactivated screens (Admin/SuperAdmin only)
router.get('/deleted',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(screenSchema.paginationSchema, 'query'),
  ScreenController.listDeleted
);

// GET /api/screens/with-seat-counts - Get screens with actual seat counts
router.get('/with-seat-counts',
  middlewares.authenticate,
  ScreenController.getScreensWithSeatCounts
);

// GET /api/screens/type/:type - Get screens by type
router.get('/type/:type',
  middlewares.authenticate,
  middlewares.validator(screenSchema.screenTypeParamSchema, 'params'),
  middlewares.validator(screenSchema.paginationSchema, 'query'),
  ScreenController.getScreensByType
);

// GET /api/screens/theater/:theaterId - Get screens by theater
router.get('/theater/:theaterId',
  middlewares.authenticate,
  middlewares.validator(screenSchema.theaterIdParamSchema, 'params'),
  ScreenController.getScreensByTheater
);

// PUT /api/screens/:id/restore - Restore deleted screen (Admin/SuperAdmin only)
router.put('/:id/restore',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(screenSchema.screenIdParamSchema, 'params'),
  ScreenController.restore
);

// PUT /api/screens/:id/status - Update screen status
router.put('/:id/status',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(screenSchema.screenIdParamSchema, 'params'),
  middlewares.validator(screenSchema.updateStatusSchema),
  ScreenController.updateStatus
);

// PUT /api/screens/:id/capacity - Update screen capacity
router.put('/:id/capacity',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(screenSchema.screenIdParamSchema, 'params'),
  middlewares.validator(screenSchema.updateCapacitySchema),
  ScreenController.updateCapacity
);

// DELETE /api/screens/:id/force-delete - Permanently delete screen (Admin/SuperAdmin only)
router.delete('/:id/force-delete',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(screenSchema.screenIdParamSchema, 'params'),
  ScreenController.forceDelete
);

// 1. GET ALL SCREENS - Get all screens with pagination and filtering
router.get('/',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.USER),
  middlewares.validator(screenSchema.getAllScreensQuerySchema, 'query'),
  ScreenController.getAll
);

// 2. CREATE SCREEN - Create new screen (Admin/SuperAdmin only)
router.post('/',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(screenSchema.createScreenSchema),
  ScreenController.create
);

// 3. GET BY ID - Get screen by ID
router.get('/:id',
  middlewares.authenticate,
  middlewares.validator(screenSchema.screenIdParamSchema, 'params'),
  ScreenController.getById
);

// 4. UPDATE SCREEN - Update screen by ID (Admin/SuperAdmin only)
router.put('/:id',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(screenSchema.screenIdParamSchema, 'params'),
  middlewares.validator(screenSchema.updateScreenSchema),
  ScreenController.update
);

// 5. SOFT DELETE - Deactivate screen (Admin/SuperAdmin only)
router.delete('/:id',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(screenSchema.screenIdParamSchema, 'params'),
  ScreenController.delete
);

module.exports = router;