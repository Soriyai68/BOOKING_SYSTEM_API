const express = require("express");
const { Role } = require("../data");
const {
  createCustomerSchema,
  updateCustomerSchema,
  customerIdParamSchema,
  customerPhoneParamSchema,
  paginationSchema,
  advancedSearchSchema,
} = require("../schemas/customerSchema");
const middlewares = require("../middlewares");
const CustomerController = require("../controllers/customer.controller");

const router = express.Router();

// Note: Unlike the previous version, middleware is now applied per-route.

// GET /api/customers/stats - Get customer statistics
router.get(
  "/stats",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  CustomerController.getStats
);

// GET /api/customers/deleted - Get soft-deleted customers
router.get(
  "/deleted",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  // Assuming a pagination schema exists for customers
  // middlewares.validator(paginationSchema, 'query'),
  CustomerController.getDeleted
);

// POST /api/customers/search - Advanced customer search
router.post(
  "/search",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  // Assuming an advanced search schema exists for customers
  // middlewares.validator(advancedSearchSchema),
  CustomerController.search
);

// GET /api/customers/phones/:phone - Get customer by phone (FIXED ROUTE)
router.get(
  "/phones/:phone",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(customerPhoneParamSchema, "params"),
  CustomerController.getByPhone
);

// PUT /api/customers/:id/restore - Restore a soft-deleted customer
router.put(
  "/:id/restore",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(customerIdParamSchema, "params"),
  CustomerController.restore
);

// DELETE /api/customers/:id/force - Permanently delete a customer
router.delete(
  "/:id/force",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN), // Or a more restrictive role like SUPERADMIN if applicable
  middlewares.validator(customerIdParamSchema, "params"),
  CustomerController.forceDelete
);

// Standard CRUD Routes

// GET all customers and POST to create a customer
router
  .route("/")
  .get(
    middlewares.authenticate,
    middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),
    // middlewares.validator(paginationSchema, 'query'),
    CustomerController.getAll
  )
  .post(
    middlewares.authenticate,
    middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
    middlewares.validator(createCustomerSchema),
    CustomerController.create
  );

// GET, UPDATE, and SOFT-DELETE a customer by ID
router
  .route("/:id")
  .get(
    middlewares.authenticate,
    middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),
    middlewares.validator(customerIdParamSchema, "params"),
    CustomerController.getById
  )
  .put(
    middlewares.authenticate,
    middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),
    middlewares.validator(customerIdParamSchema, "params"),
    middlewares.validator(updateCustomerSchema),
    CustomerController.update
  )
  .delete(
    middlewares.authenticate,
    middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
    middlewares.validator(customerIdParamSchema, "params"),
    CustomerController.delete // This performs a soft delete
  );

module.exports = router;
