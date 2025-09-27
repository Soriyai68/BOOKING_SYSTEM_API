const express = require('express');
const { Role } = require("../data");
const { seatSchema } = require('../schemas');
const middlewares = require('../middlewares');
const SeatController = require('../controllers/seat.controller');

const router = express.Router();

// === UTILITY ROUTES (Should come first to avoid conflicts) ===

// GET /api/seats/stats - Get seat statistics (Admin/SuperAdmin only)
router.get('/stats',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  SeatController.getStats
);

// GET /api/seats/available - Get available seats
router.get('/available',
  middlewares.authenticate,
  middlewares.validator(seatSchema.availableSeatsQuerySchema, 'query'),
  SeatController.getAvailable
);

// GET /api/seats/deleted - Get soft deleted seats (Admin/SuperAdmin only)
router.get('/deleted',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(seatSchema.availableSeatsQuerySchema, 'query'),
  SeatController.getDeleted
);

// GET /api/seats/unavailable - Get unavailable seats (Admin/SuperAdmin only)
router.get('/unavailable',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(seatSchema.availableSeatsQuerySchema, 'query'),
  SeatController.getUnavailable
);

// POST /api/seats/search - Advanced seat search
router.post('/search',
  middlewares.authenticate,
  middlewares.validator(seatSchema.searchSeatSchema),
  SeatController.search
);

// POST /api/seats/batch-delete - Delete multiple seats (Admin/SuperAdmin only)
router.post('/batch-delete',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(seatSchema.batchDeleteSchema),
  SeatController.listDelete
);

// POST /api/seats/bulk - Create multiple seats (Admin/SuperAdmin only)
router.post('/bulk',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(seatSchema.bulkSeatSchema),
  SeatController.createBulk
);

// === PARAMETER-BASED ROUTES ===

// GET /api/seats/type/:type - Get seats by type
router.get('/type/:type',
  middlewares.authenticate,
  middlewares.validator(seatSchema.seatTypeParamSchema, 'params'),
  middlewares.validator(seatSchema.availableSeatsQuerySchema, 'query'),
  SeatController.getSeatsByType
);

// GET /api/seats/row/:row - Get seats by row
router.get('/row/:row',
  middlewares.authenticate,
  middlewares.validator(seatSchema.rowParamSchema, 'params'),
  SeatController.getSeatsByRow
);

// PUT /api/seats/:id/toggle - Toggle seat availability (Admin/SuperAdmin only)
router.put('/:id/toggle',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(seatSchema.seatIdParamSchema, 'params'),
  SeatController.toggleAvailability
);

// PUT /api/seats/:id/restore - Restore seat (Mark as available) (Admin/SuperAdmin only)
router.put('/:id/restore',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(seatSchema.seatIdParamSchema, 'params'),
  SeatController.restore
);

// DELETE /api/seats/:id/force - Permanently delete seat (SuperAdmin only)
router.delete('/:id/force',
  middlewares.authenticate,
  middlewares.authorize(Role.SUPERADMIN),
  middlewares.validator(seatSchema.seatIdParamSchema, 'params'),
  SeatController.forceDelete
);

// === CORE CRUD ROUTES ===

// 1. GET ALL SEATS - Get all seats with pagination and filtering
router.get('/',
  middlewares.authenticate,
  middlewares.validator(seatSchema.getSeatQuerySchema, 'query'),
  SeatController.getAll
);

// 2. CREATE SEAT - Create new seat (Admin/SuperAdmin only)
router.post('/',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(seatSchema.createSeatSchema),
  SeatController.create
);

// 3. GET BY ID - Get seat by ID
router.get('/:id',
  middlewares.authenticate,
  middlewares.validator(seatSchema.seatIdParamSchema, 'params'),
  SeatController.getById
);

// 4. UPDATE SEAT - Update seat by ID (Admin/SuperAdmin only)
router.put('/:id',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(seatSchema.seatIdParamSchema, 'params'),
  middlewares.validator(seatSchema.updateSeatSchema),
  SeatController.update
);

// 5. SOFT DELETE - Mark seat as unavailable (Admin/SuperAdmin only)
router.delete('/:id',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(seatSchema.seatIdParamSchema, 'params'),
  SeatController.delete
);

module.exports = router;