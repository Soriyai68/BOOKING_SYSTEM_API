const express = require('express');
const { Role } = require('../data');
const showtimeSchema = require('../schemas/showtimeSchema');
const middlewares = require('../middlewares');
const ShowtimeController = require('../controllers/showtime.controller');

const router = express.Router();

// === Special Routes (before /:id) ===

// GET /api/showtimes/deleted lists - Get deleted showtimes (Admin/SuperAdmin only)
router.get('/deleted',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(showtimeSchema.paginationSchema, 'query'),
  ShowtimeController.listDeleted
);

// PUT /api/showtimes/:id/restore - Restore a deleted showtime (Admin/SuperAdmin only)
router.put('/:id/restore',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(showtimeSchema.showtimeIdParamSchema, 'params'),
  ShowtimeController.restore
);

// PUT /api/showtimes/:id/status - Update showtime status (Admin/SuperAdmin only)
router.put('/:id/status',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(showtimeSchema.showtimeIdParamSchema, 'params'),
  middlewares.validator(showtimeSchema.updateShowtimeStatusSchema),
  ShowtimeController.updateStatus
);

// DELETE /api/showtimes/:id/force-delete - Permanently delete a showtime (Admin/SuperAdmin only)
router.delete('/:id/force-delete',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(showtimeSchema.showtimeIdParamSchema, 'params'),
  ShowtimeController.forceDelete
);


// === Standard CRUD Routes ===

// GET /api/showtimes - Get all showtimes
router.get('/',
  middlewares.authenticate,
  // Allow all authenticated users to view showtimes
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.USER),
  middlewares.validator(showtimeSchema.getAllShowtimesQuerySchema, 'query'),
  ShowtimeController.getAll
);

// POST /api/showtimes - Create a new showtime (Admin/SuperAdmin only)
router.post('/',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(showtimeSchema.createShowtimeSchema),
  ShowtimeController.create
);

// GET /api/showtimes/:id - Get a single showtime by ID
router.get('/:id',
  middlewares.authenticate,
  middlewares.validator(showtimeSchema.showtimeIdParamSchema, 'params'),
  ShowtimeController.getById
);

// PUT /api/showtimes/:id - Update a showtime (Admin/SuperAdmin only)
router.put('/:id',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(showtimeSchema.showtimeIdParamSchema, 'params'),
  middlewares.validator(showtimeSchema.updateShowtimeSchema),
  ShowtimeController.update
);

// DELETE /api/showtimes/:id - Soft delete a showtime (Admin/SuperAdmin only)
router.delete('/:id',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(showtimeSchema.showtimeIdParamSchema, 'params'),
  ShowtimeController.delete
);

module.exports = router;
