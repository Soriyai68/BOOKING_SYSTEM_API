const express = require('express');
const { Role } = require('../data');
const { locationSchema } = require('../schemas');
const middlewares = require('../middlewares');
const LocationController = require('../controllers/location.controller');

const router = express.Router();

// GET /api/locations/stats - Get location statistics (Admin/SuperAdmin only)
router.get('/stats',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  LocationController.getStats
);

// GET /api/locations/deleted - Get deleted/deactivated locations (Admin/SuperAdmin only)
router.get('/deleted',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(locationSchema.paginationSchema, 'query'),
  LocationController.listDeleted
);

// GET /api/locations/active - Get active locations (accessible to all roles)
router.get('/active',
  middlewares.authenticate,
  LocationController.getActiveLocations
);

// GET /api/locations/city/:city - Get locations by city
router.get('/city/:city',
  middlewares.authenticate,
  middlewares.validator(locationSchema.cityParamSchema, 'params'),
  middlewares.validator(locationSchema.paginationSchema, 'query'),
  LocationController.getLocationsByCity
);

// GET /api/locations/province/:province - Get locations by province
router.get('/province/:province',
  middlewares.authenticate,
  middlewares.validator(locationSchema.provinceParamSchema, 'params'),
  middlewares.validator(locationSchema.paginationSchema, 'query'),
  LocationController.getLocationsByProvince
);

// PUT /api/locations/:id/restore - Restore deleted location (Admin/SuperAdmin only)
router.put('/:id/restore',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(locationSchema.locationIdParamSchema, 'params'),
  LocationController.restore
);

// PUT /api/locations/:id/status - Update location status (Admin/SuperAdmin only)
router.put('/:id/status',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(locationSchema.locationIdParamSchema, 'params'),
  middlewares.validator(locationSchema.updateStatusSchema),
  LocationController.updateStatus
);

// PUT /api/locations/:id/coordinates - Update location coordinates (Admin/SuperAdmin only)
router.put('/:id/coordinates',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(locationSchema.locationIdParamSchema, 'params'),
  middlewares.validator(locationSchema.updateCoordinatesSchema),
  LocationController.updateCoordinates
);

// DELETE /api/locations/:id/force-delete - Permanently delete location (Admin/SuperAdmin only)
router.delete('/:id/force-delete',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(locationSchema.locationIdParamSchema, 'params'),
  LocationController.forceDelete
);

// 1. GET ALL LOCATIONS - Get all locations with pagination and filtering
router.get('/',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.USER),
  middlewares.validator(locationSchema.getAllLocationsQuerySchema, 'query'),
  LocationController.getAll
);

// 2. CREATE LOCATION - Create new location (Admin/SuperAdmin only)
router.post('/',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(locationSchema.createLocationSchema),
  LocationController.create
);

// 3. GET BY ID - Get location by ID
router.get('/:id',
  middlewares.authenticate,
  middlewares.validator(locationSchema.locationIdParamSchema, 'params'),
  LocationController.getById
);

// 4. UPDATE LOCATION - Update location by ID (Admin/SuperAdmin only)
router.put('/:id',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(locationSchema.locationIdParamSchema, 'params'),
  middlewares.validator(locationSchema.updateLocationSchema),
  LocationController.update
);

// 5. SOFT DELETE - Deactivate location (Admin/SuperAdmin only)
router.delete('/:id',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(locationSchema.locationIdParamSchema, 'params'),
  LocationController.delete
);

module.exports = router;