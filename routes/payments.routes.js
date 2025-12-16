const express = require("express");
const { Role } = require("../data");
const paymentSchema = require("../schemas/paymentSchema");
const middlewares = require("../middlewares");
const PaymentController = require("../controllers/payment.controller");

const router = express.Router();

// === Special Routes (before /:id) ===

// POST /api/payments/check-payment - Check the status of a Bakong payment
router.post(
  "/check-payment",
  middlewares.authenticate,
  PaymentController.checkPayment
);

// GET /api/payments/analytics - Get payment analytics (Admin/SuperAdmin/Cashier only)
router.get(
  "/analytics",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),
  PaymentController.getAnalytics
);

// GET /api/payments/deleted - Get deleted payments (Admin/SuperAdmin only)
router.get(
  "/deleted",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(paymentSchema.paginationSchema, "query"),
  PaymentController.listDeleted
);


// GET /api/payments/booking/:bookingId - Get all payments for a specific booking
router.get(
  "/booking/:bookingId",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.USER, Role.CASHIER),
  middlewares.validator(paymentSchema.bookingIdParamSchema, "params"),
  PaymentController.getByBookingId
);

// PUT /api/payments/:id/restore - Restore a deleted payment (Admin/SuperAdmin only)
router.put(
  "/:id/restore",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(paymentSchema.paymentIdParamSchema, "params"),
  PaymentController.restore
);

// PUT /api/payments/:id/status - Update payment status
router.put(
  "/:id/status",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),
  middlewares.validator(paymentSchema.paymentIdParamSchema, "params"),
  middlewares.validator(paymentSchema.updatePaymentStatusSchema),
  PaymentController.updateStatus
);

// DELETE /api/payments/:id/force-delete - Permanently delete a payment (Admin/SuperAdmin only)
router.delete(
  "/:id/force-delete",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(paymentSchema.paymentIdParamSchema, "params"),
  PaymentController.forceDelete
);

// === Standard CRUD Routes ===

// GET /api/payments - Get all payments
router.get(
  "/",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),
  middlewares.validator(paymentSchema.getAllPaymentsQuerySchema, "query"),
  PaymentController.getAll
);

// POST /api/payments - Create a new payment
router.post(
  "/",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),
  middlewares.validator(paymentSchema.createPaymentSchema),
  PaymentController.create
);

// GET /api/payments/:id - Get a single payment by ID
router.get(
  "/:id",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),
  middlewares.validator(paymentSchema.paymentIdParamSchema, "params"),
  PaymentController.getById
);

// PUT /api/payments/:id - Update a payment
router.put(
  "/:id",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),
  middlewares.validator(paymentSchema.paymentIdParamSchema, "params"),
  middlewares.validator(paymentSchema.updatePaymentSchema),
  PaymentController.update
);

// DELETE /api/payments/:id - Soft delete a payment
router.delete(
  "/:id",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),
  middlewares.validator(paymentSchema.paymentIdParamSchema, "params"),
  PaymentController.delete
);

module.exports = router;
