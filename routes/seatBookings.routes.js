const express = require('express');
const router = express.Router();
const { SeatBookingController } = require('../controllers');
const { authenticate, authorize, validator } = require('../middlewares');
const { Role } = require('../data');
const seatBookingSchema = require('../schemas/seatBookingSchema');

// GET /api/seat-bookings - Get all seat bookings (Admin/SuperAdmin only)
router.get('/',
    authenticate,
    authorize(Role.ADMIN, Role.SUPERADMIN),
    validator(seatBookingSchema.getAllQuery, 'query'),
    SeatBookingController.getAll
);

// GET /api/seat-bookings/showtime/:id/status - Get seat status for a showtime (Public)
router.get(
    '/showtime/:id/status',
    validator(seatBookingSchema.showtimeIdParam, 'params'),
    SeatBookingController.getShowtimeSeatStatus
);

// GET /api/seat-bookings/showtime/:id/raw - Get raw seat booking documents for a showtime (Admin only)
router.get(
    '/showtime/:id/raw',
    authenticate,
    authorize(Role.ADMIN, Role.SUPERADMIN),
    validator(seatBookingSchema.showtimeIdParam, 'params'),
    SeatBookingController.getSeatBookingsForShowtime
);

// POST /api/seat-bookings/lock - Lock seats for a booking (Authenticated users)
router.post(
    '/lock',
    authenticate,
    authorize(Role.USER, Role.CASHIER, Role.ADMIN, Role.SUPERADMIN),
    validator(seatBookingSchema.lockSeatsBody),
    SeatBookingController.lockSeatsForBooking
);

// POST /api/seat-bookings/extend-lock - Extend the lock on seats (Authenticated users)
router.post(
    '/extend-lock',
    authenticate,
    authorize(Role.USER, Role.CASHIER, Role.ADMIN, Role.SUPERADMIN),
    validator(seatBookingSchema.extendLockBody),
    SeatBookingController.extendSeatLock
);

// GET /api/seat-bookings/history - Get all seat booking histories (Admin/SuperAdmin only)
router.get(
    '/history',
    authenticate,
    authorize(Role.ADMIN, Role.SUPERADMIN),
    validator(seatBookingSchema.getAllQuery, 'query'),
    SeatBookingController.getHistory
);

module.exports = router;
