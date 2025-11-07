const express = require("express");
const { Role } = require("../data");
const bookingSchema = require("../schemas/bookingSchema");
const middlewares = require("../middlewares");
const BookingController = require("../controllers/booking.controller");

const router = express.Router();

// === Special Routes (before /:id) ===

// GET /api/bookings/analytics - Get booking analytics (Admin/SuperAdmin/Cashier only)
router.get(
  "/analytics",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),
  BookingController.getAnalytics
);

// GET /api/bookings/deleted - Get deleted bookings (Admin/SuperAdmin only)
router.get(
  "/deleted",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(bookingSchema.paginationSchema, "query"),
  BookingController.listDeleted
);

// PUT /api/bookings/:id/restore - Restore a deleted booking (Admin/SuperAdmin only)
router.put(
  "/:id/restore",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(bookingSchema.bookingIdParamSchema, "params"),
  BookingController.restore
);

// DELETE /api/bookings/:id/force-delete - Permanently delete a booking (Admin/SuperAdmin only)
router.delete(
  "/:id/force-delete",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(bookingSchema.bookingIdParamSchema, "params"),
  BookingController.forceDelete
);

// === Standard CRUD Routes ===

// GET /api/bookings - Get all bookings
router.get(
  "/",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.USER, Role.CASHIER),
  middlewares.validator(bookingSchema.getAllBookingsQuerySchema, "query"),
  BookingController.getAll
);

// POST /api/bookings - Create a new booking
router.post(
  "/",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.USER, Role.CASHIER),
  middlewares.validator(bookingSchema.createBookingSchema),
  BookingController.create
);

// GET /api/bookings/:id - Get a single booking by ID
router.get(
  "/:id",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.USER, Role.CASHIER),
  middlewares.validator(bookingSchema.bookingIdParamSchema, "params"),
  BookingController.getById
);

// PUT /api/bookings/:id - Update a booking
router.put(
  "/:id",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),
  middlewares.validator(bookingSchema.bookingIdParamSchema, "params"),
  middlewares.validator(bookingSchema.updateBookingSchema),
  BookingController.update
);

// DELETE /api/bookings/:id - Soft delete a booking
router.delete(
  "/:id",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),
  middlewares.validator(bookingSchema.bookingIdParamSchema, "params"),
  BookingController.delete
);

module.exports = router;
