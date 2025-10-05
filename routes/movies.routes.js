const express = require('express');
const { Role } = require('../data');
const movieSchema = require('../schemas/movieSchema');
const middlewares = require('../middlewares');
const MovieController = require('../controllers/movie.controller');

const router = express.Router();

// Special routes (must be before /:id routes)

// GET /api/movies/now-showing - Get now showing movies
router.get('/now-showing',
  middlewares.authenticate,
  middlewares.validator(movieSchema.paginationSchema, 'query'),
  MovieController.getNowShowing
);

// GET /api/movies/coming-soon - Get coming soon movies
router.get('/coming-soon',
  middlewares.authenticate,
  middlewares.validator(movieSchema.paginationSchema, 'query'),
  MovieController.getComingSoon
);

// GET /api/movies/deleted - Get deleted movies (Admin/SuperAdmin only)
router.get('/deleted',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(movieSchema.paginationSchema, 'query'),
  MovieController.listDeleted
);

// GET /api/movies/genre/:genre - Get movies by genre
router.get('/genre/:genre',
  middlewares.authenticate,
  middlewares.validator(movieSchema.genreParamSchema, 'params'),
  middlewares.validator(movieSchema.paginationSchema, 'query'),
  MovieController.getByGenre
);

// PUT /api/movies/:id/restore - Restore deleted movie (Admin/SuperAdmin only)
router.put('/:id/restore',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(movieSchema.movieIdParamSchema, 'params'),
  MovieController.restore
);

// PUT /api/movies/:id/status - Update movie status (Admin/SuperAdmin only)
router.put('/:id/status',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(movieSchema.movieIdParamSchema, 'params'),
  middlewares.validator(movieSchema.updateStatusSchema),
  MovieController.updateStatus
);

// DELETE /api/movies/:id/force-delete - Permanently delete movie (Admin/SuperAdmin only)
router.delete('/:id/force-delete',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(movieSchema.movieIdParamSchema, 'params'),
  MovieController.forceDelete
);

// Standard CRUD routes

// GET /api/movies - Get all movies with pagination and filtering
router.get('/',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN, Role.USER),
  middlewares.validator(movieSchema.getAllMoviesQuerySchema, 'query'),
  MovieController.getAll
);

// POST /api/movies - Create new movie (Admin/SuperAdmin only)
router.post('/',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(movieSchema.createMovieSchema),
  MovieController.create
);

// GET /api/movies/:id - Get movie by ID
router.get('/:id',
  middlewares.authenticate,
  middlewares.validator(movieSchema.movieIdParamSchema, 'params'),
  MovieController.getById
);

// PUT /api/movies/:id - Update movie by ID (Admin/SuperAdmin only)
router.put('/:id',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(movieSchema.movieIdParamSchema, 'params'),
  middlewares.validator(movieSchema.updateMovieSchema),
  MovieController.update
);

// DELETE /api/movies/:id - Soft delete movie (Admin/SuperAdmin only)
router.delete('/:id',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  middlewares.validator(movieSchema.movieIdParamSchema, 'params'),
  MovieController.delete
);

module.exports = router;
