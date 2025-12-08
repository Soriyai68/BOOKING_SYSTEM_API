const express = require('express');
const {Role} = require('../data');
const {seatSchema} = require('../schemas');
const middlewares = require('../middlewares');
const SeatController = require('../controllers/seat.controller');
const {bulkCreateSeatsSchema, bulkUpdateSeatsSchema, bulkDuplicateSeatsSchema} = require("../schemas/seatSchema");

const router = express.Router();

// GET /api/seats/stats - Get seat statistics (Admin/SuperAdmin only)
router.get('/stats',
    middlewares.authenticate,
    middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),
    SeatController.getStats
);

// GET /api/seats/deleted - Get deleted/deactivated seats (Admin/SuperAdmin only)
router.get('/deleted',
    middlewares.authenticate,
    middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),
    middlewares.validator(seatSchema.paginationSchema, 'query'),
    SeatController.listDeleted
);

// GET /api/seats/type/:type - Get seats by type
router.get('/type/:type',
    middlewares.authenticate,
    middlewares.validator(seatSchema.seatTypeParamSchema, 'params'),
    middlewares.validator(seatSchema.paginationSchema, 'query'),
    SeatController.getSeatsByType
);

// PUT /api/seats/:id/restore - Restore deleted seat (Admin/SuperAdmin only)
router.put('/:id/restore',
    middlewares.authenticate,
    middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),

    middlewares.validator(seatSchema.seatIdParamSchema, 'params'),
    SeatController.restore
);

// PUT /api/seats/:id/status - Update seat status
router.put('/:id/status',
    middlewares.authenticate,
    middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),

    middlewares.validator(seatSchema.seatIdParamSchema, 'params'),
    middlewares.validator(seatSchema.updateStatusSchema),
    SeatController.updateStatus
);
// DELETE /api/seats/bulk/force-delete - Permanently delete seats (Admin/SuperAdmin only)
router.delete('/bulk/force-delete',
    middlewares.authenticate,
    middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
    middlewares.validator(seatSchema.batchDeleteSchema),
    SeatController.bulkForceDeleteSeats
)
// DELETE /api/seats/:id/force - Permanently delete seat (Admin/SuperAdmin only)
router.delete('/:id/force-delete',
    middlewares.authenticate,
    middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),

    middlewares.validator(seatSchema.seatIdParamSchema, 'params'),
    SeatController.forceDelete
);
// 1. GET ALL SEATS - Get all seats with pagination and filtering
router.get('/',
    middlewares.authenticate,
    middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.USER, Role.CASHIER),
    middlewares.validator(seatSchema.getAllSeatsQuerySchema, 'query'),
    SeatController.getAll
);

// 2. CREATE SEAT - Create new seat (Admin/SuperAdmin only)
router.post('/',
    middlewares.authenticate,
    middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),
    // middlewares.validator(seatSchema.createSeatSchema),
    SeatController.create
);
// 2.1 BULK CREATE SEAT - Create new multiple seats (Admin/SuperAdmin only)
router.post('/bulk/create-seats',
    middlewares.authenticate,
    middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
    middlewares.validator(seatSchema.bulkCreateSeatsSchema),
    SeatController.bulkCreateSeats
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
    middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),
    middlewares.validator(seatSchema.seatIdParamSchema, 'params'),
    middlewares.validator(seatSchema.updateSeatSchema),
    SeatController.update
);

// 5. SOFT DELETE - Deactivate seat (Admin/SuperAdmin only)
router.delete('/:id',
    middlewares.authenticate,
    middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
    middlewares.validator(seatSchema.seatIdParamSchema, 'params'),
    SeatController.delete
);

//6. bulk update for multiple seats
router.put('/bulk/update-seats',
    middlewares.authenticate,
    middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
    middlewares.validator(bulkUpdateSeatsSchema),
    SeatController.bulkUpdateSeats
);

//7. bulk duplicate seats from one hall to another
router.post('/bulk/duplicate-seats',
    middlewares.authenticate,
    middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
    middlewares.validator(bulkDuplicateSeatsSchema),
    SeatController.bulkDuplicateSeats
);

module.exports = router;