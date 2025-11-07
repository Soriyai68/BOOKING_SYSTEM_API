const express = require("express");
const { Role } = require("../data");
const bookingDetailSchema = require("../schemas/bookingDetailSchema");
const middlewares = require("../middlewares");
const BookingDetailController = require("../controllers/bookingDetail.controller");

const router = express.Router();

// === Special Routes (before /:id) ===

// GET /api/booking-details/deleted - Get deleted booking details (Admin/SuperAdmin only)
router.get(
  "/deleted",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(bookingDetailSchema.paginationSchema, "query"),
  BookingDetailController.listDeleted
);

// POST /api/booking-details/bulk - Create multiple booking details
router.post(
  "/bulk",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),
  middlewares.validator(bookingDetailSchema.createBulkBookingDetailsSchema),
  BookingDetailController.createBulk
);

// DELETE /api/booking-details/bulk - Delete multiple booking details
router.delete(
  "/bulk",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),
  middlewares.validator(bookingDetailSchema.deleteBulkSchema),
  BookingDetailController.deleteBulk
);

// GET /api/booking-details/booking/:bookingId - Get all booking details for a specific booking
router.get(
  "/booking/:bookingId",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.USER, Role.CASHIER),
  middlewares.validator(bookingDetailSchema.bookingIdParamSchema, "params"),
  BookingDetailController.getByBookingId
);

// PUT /api/booking-details/:id/restore - Restore a deleted booking detail (Admin/SuperAdmin only)
router.put(
  "/:id/restore",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(bookingDetailSchema.bookingDetailIdParamSchema, "params"),
  BookingDetailController.restore
);

// DELETE /api/booking-details/:id/force-delete - Permanently delete a booking detail (Admin/SuperAdmin only)
router.delete(
  "/:id/force-delete",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(bookingDetailSchema.bookingDetailIdParamSchema, "params"),
  BookingDetailController.forceDelete
);

// === Standard CRUD Routes ===

// GET /api/booking-details - Get all booking details
router.get(
  "/",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),
  middlewares.validator(bookingDetailSchema.getAllBookingDetailsQuerySchema, "query"),
  BookingDetailController.getAll
);

// POST /api/booking-details - Create a new booking detail
router.post(
  "/",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),
  middlewares.validator(bookingDetailSchema.createBookingDetailSchema),
  BookingDetailController.create
);

// GET /api/booking-details/:id - Get a single booking detail by ID
router.get(
  "/:id",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),
  middlewares.validator(bookingDetailSchema.bookingDetailIdParamSchema, "params"),
  BookingDetailController.getById
);

// PUT /api/booking-details/:id - Update a booking detail
router.put(
  "/:id",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),
  middlewares.validator(bookingDetailSchema.bookingDetailIdParamSchema, "params"),
  middlewares.validator(bookingDetailSchema.updateBookingDetailSchema),
  BookingDetailController.update
);

// DELETE /api/booking-details/:id - Soft delete a booking detail
router.delete(
  "/:id",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),
  middlewares.validator(bookingDetailSchema.bookingDetailIdParamSchema, "params"),
  BookingDetailController.delete
);

module.exports = router;
