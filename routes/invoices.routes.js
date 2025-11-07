const express = require("express");
const { Role } = require("../data");
const invoiceSchema = require("../schemas/invoiceSchema");
const middlewares = require("../middlewares");
const InvoiceController = require("../controllers/invoice.controller");

const router = express.Router();

// === Special Routes (before /:id) ===

// GET /api/invoices/analytics - Get invoice analytics (Admin/SuperAdmin/Cashier only)
router.get(
  "/analytics",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),
  InvoiceController.getAnalytics
);

// GET /api/invoices/deleted - Get deleted invoices (Admin/SuperAdmin only)
router.get(
  "/deleted",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(invoiceSchema.paginationSchema, "query"),
  InvoiceController.listDeleted
);

// GET /api/invoices/number/:invoiceNumber - Get invoice by invoice number
router.get(
  "/number/:invoiceNumber",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),
  middlewares.validator(invoiceSchema.invoiceNumberParamSchema, "params"),
  InvoiceController.getByInvoiceNumber
);

// PUT /api/invoices/:id/restore - Restore a deleted invoice (Admin/SuperAdmin only)
router.put(
  "/:id/restore",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(invoiceSchema.invoiceIdParamSchema, "params"),
  InvoiceController.restore
);

// PUT /api/invoices/:id/status - Update invoice status
router.put(
  "/:id/status",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),
  middlewares.validator(invoiceSchema.invoiceIdParamSchema, "params"),
  middlewares.validator(invoiceSchema.updateInvoiceStatusSchema),
  InvoiceController.updateStatus
);

// DELETE /api/invoices/:id/force-delete - Permanently delete an invoice (Admin/SuperAdmin only)
router.delete(
  "/:id/force-delete",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(invoiceSchema.invoiceIdParamSchema, "params"),
  InvoiceController.forceDelete
);

// === Standard CRUD Routes ===

// GET /api/invoices - Get all invoices
router.get(
  "/",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),
  middlewares.validator(invoiceSchema.getAllInvoicesQuerySchema, "query"),
  InvoiceController.getAll
);

// POST /api/invoices - Create a new invoice
router.post(
  "/",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),
  middlewares.validator(invoiceSchema.createInvoiceSchema),
  InvoiceController.create
);

// GET /api/invoices/:id - Get a single invoice by ID
router.get(
  "/:id",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),
  middlewares.validator(invoiceSchema.invoiceIdParamSchema, "params"),
  InvoiceController.getById
);

// PUT /api/invoices/:id - Update an invoice
router.put(
  "/:id",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),
  middlewares.validator(invoiceSchema.invoiceIdParamSchema, "params"),
  middlewares.validator(invoiceSchema.updateInvoiceSchema),
  InvoiceController.update
);

// DELETE /api/invoices/:id - Soft delete an invoice
router.delete(
  "/:id",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),
  middlewares.validator(invoiceSchema.invoiceIdParamSchema, "params"),
  InvoiceController.delete
);

module.exports = router;
