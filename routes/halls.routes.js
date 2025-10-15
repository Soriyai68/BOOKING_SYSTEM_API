const express = require('express');
const { Role } = require('../data');
const { hallSchema } = require('../schemas');
const middlewares = require('../middlewares');
const HallController = require('../controllers/hall.controller');

const router = express.Router();

// GET /api/halls/stats - Get hall statistics (Admin/SuperAdmin only)
router.get('/stats',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  HallController.getStats
);

// GET /api/halls/deleted - Get deleted/deactivated halls (Admin/SuperAdmin only)
router.get('/deleted',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(hallSchema.paginationSchema, 'query'),
  HallController.listDeleted
);

// GET /api/halls/with-seat-counts - Get halls with actual seat counts
router.get('/with-seat-counts',
  middlewares.authenticate,
  HallController.getHallsWithSeatCounts
);

// GET /api/halls/type/:type - Get halls by screen type
router.get('/type/:type',
  middlewares.authenticate,
  middlewares.validator(hallSchema.hallScreenTypeParamSchema, 'params'),
  middlewares.validator(hallSchema.paginationSchema, 'query'),
  HallController.getHallsByScreenType
);

// GET /api/halls/theater/:theaterId - Get halls by theater
router.get('/theater/:theaterId',
  middlewares.authenticate,
  middlewares.validator(hallSchema.theaterIdParamSchema, 'params'),
  HallController.getHallsByTheater
);

// POST /api/halls/:id/layout - Generate seat layout for a hall (Admin/SuperAdmin only)
router.post('/:id/layout',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(hallSchema.hallIdParamSchema, 'params'),
  middlewares.validator(hallSchema.generateLayoutSchema),
  HallController.generateSeatLayout
);

// PUT /api/halls/:id/restore - Restore deleted hall (Admin/SuperAdmin only)
router.put('/:id/restore',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(hallSchema.hallIdParamSchema, 'params'),
  HallController.restore
);

// PUT /api/halls/:id/status - Update hall status
router.put('/:id/status',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(hallSchema.hallIdParamSchema, 'params'),
  middlewares.validator(hallSchema.updateStatusSchema),
  HallController.updateStatus
);

// PUT /api/halls/:id/capacity - Update hall capacity
router.put('/:id/capacity',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(hallSchema.hallIdParamSchema, 'params'),
  middlewares.validator(hallSchema.updateCapacitySchema),
  HallController.updateCapacity
);

// DELETE /api/halls/:id/force-delete - Permanently delete hall (Admin/SuperAdmin only)
router.delete('/:id/force-delete',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(hallSchema.hallIdParamSchema, 'params'),
  HallController.forceDelete
);

// 1. GET ALL HALLS - Get all halls with pagination and filtering
router.get('/',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.USER),
  middlewares.validator(hallSchema.getAllHallsQuerySchema, 'query'),
  HallController.getAll
);

// 2. CREATE HALL - Create new hall (Admin/SuperAdmin only)
router.post('/',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(hallSchema.createHallSchema),
  HallController.create
);

// 3. GET BY ID - Get hall by ID
router.get('/:id',
  middlewares.authenticate,
  middlewares.validator(hallSchema.hallIdParamSchema, 'params'),
  HallController.getById
);

// 4. UPDATE HALL - Update hall by ID (Admin/SuperAdmin only)
router.put('/:id',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(hallSchema.hallIdParamSchema, 'params'),
  middlewares.validator(hallSchema.updateHallSchema),
  HallController.update
);

// 5. SOFT DELETE - Deactivate hall (Admin/SuperAdmin only)
router.delete('/:id',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(hallSchema.hallIdParamSchema, 'params'),
  HallController.delete
);

module.exports = router;