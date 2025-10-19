const express = require("express");
const { Role } = require("../data");
const theaterSchema = require("../schemas/theaterSchema");
const middlewares = require("../middlewares");
const TheaterController = require("../controllers/theater.controller");

const router = express.Router();

// GET /api/theaters/analytics - Get theater analytics (Admin/SuperAdmin only)
router.get(
  "/analytics",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),

  middlewares.validator(theaterSchema.analyticsQuerySchema, "query"),
  TheaterController.getAnalytics
);

// GET /api/theaters/deleted - Get deleted/deactivated theaters (Admin/SuperAdmin only)
router.get(
  "/deleted",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),

  middlewares.validator(theaterSchema.paginationSchema, "query"),
  TheaterController.listDeleted
);

// GET /api/theaters/nearby - Get theaters nearby a location
router.get(
  "/nearby",
  middlewares.authenticate,
  middlewares.validator(theaterSchema.nearbyTheatersQuerySchema, "query"),
  TheaterController.getNearby
);

// GET /api/theaters/city/:city - Get theaters by city
router.get(
  "/city/:city",
  middlewares.authenticate,
  middlewares.validator(theaterSchema.cityParamSchema, "params"),
  middlewares.validator(theaterSchema.locationTheatersQuerySchema, "query"),
  TheaterController.getByCity
);

// GET /api/theaters/province/:province - Get theaters by province
router.get(
  "/province/:province",
  middlewares.authenticate,
  middlewares.validator(theaterSchema.provinceParamSchema, "params"),
  middlewares.validator(theaterSchema.locationTheatersQuerySchema, "query"),
  TheaterController.getByProvince
);

// PUT /api/theaters/:id/restore - Restore deleted theater (Admin/SuperAdmin only)
router.put(
  "/:id/restore",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),

  middlewares.validator(theaterSchema.theaterIdParamSchema, "params"),
  TheaterController.restore
);

// PUT /api/theaters/:id/status - Update theater status (Admin/SuperAdmin only)
router.put(
  "/:id/status",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),

  middlewares.validator(theaterSchema.theaterIdParamSchema, "params"),
  middlewares.validator(theaterSchema.updateStatusSchema),
  TheaterController.updateStatus
);

// PUT /api/theaters/:id/location - Update theater location (Admin/SuperAdmin only)
router.put(
  "/:id/location",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),

  middlewares.validator(theaterSchema.theaterIdParamSchema, "params"),
  middlewares.validator(theaterSchema.updateLocationSchema),
  TheaterController.updateLocation
);

// POST /api/theaters/:id/halls - Add hall to theater (Admin/SuperAdmin only)
// router.post(
//   "/:id/halls",
//   middlewares.authenticate,
//  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),

//   middlewares.validator(theaterSchema.theaterIdParamSchema, "params"),
//   middlewares.validator(theaterSchema.addHallSchema),
//   TheaterController.addHall
// );

// DELETE /api/theaters/:id/halls - Remove hall from theater (Admin/SuperAdmin only)
// router.delete(
//   "/:id/halls",
//   middlewares.authenticate,
//  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),

//   middlewares.validator(theaterSchema.theaterIdParamSchema, "params"),
//   middlewares.validator(theaterSchema.removeHallSchema),
//   TheaterController.removeHall
// );

// DELETE /api/theaters/:id/force-delete - Permanently delete theater (Admin/SuperAdmin only)
router.delete(
  "/:id/force-delete",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),

  middlewares.validator(theaterSchema.theaterIdParamSchema, "params"),
  TheaterController.forceDelete
);

// 1. GET ALL THEATERS - Get all theaters with pagination and filtering
router.get(
  "/",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.USER, Role.CASHIER),
  middlewares.validator(theaterSchema.getAllTheatersQuerySchema, "query"),
  TheaterController.getAll
);

// 2. CREATE THEATER - Create new theater (Admin/SuperAdmin only)
router.post(
  "/",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),

  middlewares.validator(theaterSchema.createTheaterSchema),
  TheaterController.create
);

// 3. GET BY ID - Get theater by ID
router.get(
  "/:id",
  middlewares.authenticate,
  middlewares.validator(theaterSchema.theaterIdParamSchema, "params"),
  TheaterController.getById
);

// 4. UPDATE THEATER - Update theater by ID (Admin/SuperAdmin only)
router.put(
  "/:id",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.CASHIER),

  middlewares.validator(theaterSchema.theaterIdParamSchema, "params"),
  middlewares.validator(theaterSchema.updateTheaterSchema),
  TheaterController.update
);

// 5. SOFT DELETE - Deactivate theater (Admin/SuperAdmin only)
router.delete(
  "/:id",
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),

  middlewares.validator(theaterSchema.theaterIdParamSchema, "params"),
  TheaterController.delete
);

module.exports = router;
