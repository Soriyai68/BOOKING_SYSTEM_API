const Joi = require('joi');

const MOVIE_STATUSES = ['coming_soon', 'now_showing', 'ended'];
const MOVIE_GENRES = [
  'action', 'adventure', 'animation', 'comedy', 'crime',
  'documentary', 'drama', 'family', 'fantasy', 'horror',
  'mystery', 'romance', 'sci-fi', 'thriller', 'war', 'western'
];

// Movie ID param validation
const movieIdParamSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid movie ID format',
      'any.required': 'Movie ID is required'
    })
});

// Genre param validation
const genreParamSchema = Joi.object({
  genre: Joi.string()
    .valid(...MOVIE_GENRES)
    .required()
    .messages({
      'any.only': `Genre must be one of: ${MOVIE_GENRES.join(', ')}`,
      'any.required': 'Genre is required'
    })
});

// Create movie validation schema
const createMovieSchema = Joi.object({
  title: Joi.string()
    .trim()
    .min(1)
    .max(200)
    .required()
    .messages({
      'string.empty': 'Movie title is required',
      'string.min': 'Movie title must be at least 1 character',
      'string.max': 'Movie title cannot exceed 200 characters',
      'any.required': 'Movie title is required'
    }),

  description: Joi.string()
    .trim()
    .max(2000)
    .allow('')
    .default('')
    .messages({
      'string.max': 'Description cannot exceed 2000 characters'
    }),

  genres: Joi.array()
    .items(Joi.string().valid(...MOVIE_GENRES))
    .unique()
    .default([])
    .messages({
      'array.unique': 'Duplicate genres are not allowed',
      'any.only': `Genres must be one of: ${MOVIE_GENRES.join(', ')}`
    }),

  languages: Joi.array()
    .items(Joi.string().trim().min(1).max(50))
    .unique()
    .default([])
    .messages({
      'array.unique': 'Duplicate languages are not allowed',
      'string.min': 'Language must be at least 1 character',
      'string.max': 'Language cannot exceed 50 characters'
    }),

  duration_minutes: Joi.number()
    .integer()
    .min(1)
    .max(500)
    .required()
    .messages({
      'number.base': 'Duration must be a number',
      'number.integer': 'Duration must be an integer',
      'number.min': 'Duration must be at least 1 minute',
      'number.max': 'Duration cannot exceed 500 minutes',
      'any.required': 'Duration is required'
    }),

  release_date: Joi.date()
    .required()
    .messages({
      'date.base': 'Release date must be a valid date',
      'any.required': 'Release date is required'
    }),

  end_date: Joi.date()
    .greater(Joi.ref('release_date'))
    .allow(null)
    .optional()
    .messages({
      'date.base': 'End date must be a valid date',
      'date.greater': 'End date must be after release date'
    }),

  rating: Joi.number()
    .min(0)
    .max(10)
    .default(0)
    .messages({
      'number.base': 'Rating must be a number',
      'number.min': 'Rating cannot be less than 0',
      'number.max': 'Rating cannot exceed 10'
    }),

  poster_url: Joi.string()
    .trim()
    .uri()
    .allow(null, '')
    .optional()
    .messages({
      'string.uri': 'Poster URL must be a valid URL'
    }),

  trailer_url: Joi.string()
    .trim()
    .uri()
    .allow(null, '')
    .optional()
    .messages({
      'string.uri': 'Trailer URL must be a valid URL'
    }),

  cast: Joi.array()
    .items(Joi.string().trim().min(1).max(100))
    .default([])
    .messages({
      'string.min': 'Cast member name must be at least 1 character',
      'string.max': 'Cast member name cannot exceed 100 characters'
    }),

  director: Joi.string()
    .trim()
    .max(100)
    .allow('')
    .default('')
    .messages({
      'string.max': 'Director name cannot exceed 100 characters'
    }),

  producers: Joi.array()
    .items(Joi.string().trim().min(1).max(100))
    .default([])
    .messages({
      'string.min': 'Producer name must be at least 1 character',
      'string.max': 'Producer name cannot exceed 100 characters'
    }),

  status: Joi.string()
    .valid(...MOVIE_STATUSES)
    .default('coming_soon')
    .messages({
      'any.only': `Status must be one of: ${MOVIE_STATUSES.join(', ')}`
    }),

  notes: Joi.string()
    .trim()
    .max(1000)
    .allow('')
    .default('')
    .messages({
      'string.max': 'Notes cannot exceed 1000 characters'
    })
});

// Update movie validation schema (all fields optional)
const updateMovieSchema = Joi.object({
  title: Joi.string()
    .trim()
    .min(1)
    .max(200)
    .messages({
      'string.min': 'Movie title must be at least 1 character',
      'string.max': 'Movie title cannot exceed 200 characters'
    }),

  description: Joi.string()
    .trim()
    .max(2000)
    .allow('')
    .messages({
      'string.max': 'Description cannot exceed 2000 characters'
    }),

  genres: Joi.array()
    .items(Joi.string().valid(...MOVIE_GENRES))
    .unique()
    .messages({
      'array.unique': 'Duplicate genres are not allowed',
      'any.only': `Genres must be one of: ${MOVIE_GENRES.join(', ')}`
    }),

  languages: Joi.array()
    .items(Joi.string().trim().min(1).max(50))
    .unique()
    .messages({
      'array.unique': 'Duplicate languages are not allowed',
      'string.min': 'Language must be at least 1 character',
      'string.max': 'Language cannot exceed 50 characters'
    }),

  duration_minutes: Joi.number()
    .integer()
    .min(1)
    .max(500)
    .messages({
      'number.base': 'Duration must be a number',
      'number.integer': 'Duration must be an integer',
      'number.min': 'Duration must be at least 1 minute',
      'number.max': 'Duration cannot exceed 500 minutes'
    }),

  release_date: Joi.date()
    .messages({
      'date.base': 'Release date must be a valid date'
    }),

  end_date: Joi.date()
    .allow(null)
    .messages({
      'date.base': 'End date must be a valid date'
    }),

  rating: Joi.number()
    .min(0)
    .max(10)
    .messages({
      'number.base': 'Rating must be a number',
      'number.min': 'Rating cannot be less than 0',
      'number.max': 'Rating cannot exceed 10'
    }),

  poster_url: Joi.string()
    .trim()
    .uri()
    .allow(null, '')
    .messages({
      'string.uri': 'Poster URL must be a valid URL'
    }),

  trailer_url: Joi.string()
    .trim()
    .uri()
    .allow(null, '')
    .messages({
      'string.uri': 'Trailer URL must be a valid URL'
    }),

  cast: Joi.array()
    .items(Joi.string().trim().min(1).max(100))
    .messages({
      'string.min': 'Cast member name must be at least 1 character',
      'string.max': 'Cast member name cannot exceed 100 characters'
    }),

  director: Joi.string()
    .trim()
    .max(100)
    .allow('')
    .messages({
      'string.max': 'Director name cannot exceed 100 characters'
    }),

  producers: Joi.array()
    .items(Joi.string().trim().min(1).max(100))
    .messages({
      'string.min': 'Producer name must be at least 1 character',
      'string.max': 'Producer name cannot exceed 100 characters'
    }),

  status: Joi.string()
    .valid(...MOVIE_STATUSES)
    .messages({
      'any.only': `Status must be one of: ${MOVIE_STATUSES.join(', ')}`
    }),

  notes: Joi.string()
    .trim()
    .max(1000)
    .allow('')
    .messages({
      'string.max': 'Notes cannot exceed 1000 characters'
    })
});

// Update status validation schema
const updateStatusSchema = Joi.object({
  status: Joi.string()
    .valid(...MOVIE_STATUSES)
    .required()
    .messages({
      'any.only': `Status must be one of: ${MOVIE_STATUSES.join(', ')}`,
      'any.required': 'Status is required'
    })
});

// Pagination query validation schema
const paginationSchema = Joi.object({
  page: Joi.number()
    .integer()
    .min(1)
    .default(1)
    .messages({
      'number.base': 'Page must be a number',
      'number.integer': 'Page must be an integer',
      'number.min': 'Page must be at least 1'
    }),

  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .default(10)
    .messages({
      'number.base': 'Limit must be a number',
      'number.integer': 'Limit must be an integer',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100'
    }),

  sortBy: Joi.string()
    .valid('title', 'release_date', 'rating', 'duration_minutes', 'createdAt', 'updatedAt', 'deletedAt')
    .default('release_date')
    .messages({
      'any.only': 'SortBy must be one of: title, release_date, rating, duration_minutes, createdAt, updatedAt, deletedAt'
    }),

  sortOrder: Joi.string()
    .valid('asc', 'desc')
    .default('desc')
    .messages({
      'any.only': 'SortOrder must be either asc or desc'
    })
});

// Get all movies query validation schema
const getAllMoviesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string().valid('title', 'release_date', 'rating', 'duration_minutes', 'createdAt').default('release_date'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  search: Joi.string().trim().allow('').optional(),
  includeDeleted: Joi.boolean().default(false),
  
  // Filters
  status: Joi.string().valid(...MOVIE_STATUSES).optional(),
  genre: Joi.string().valid(...MOVIE_GENRES).optional(),
  language: Joi.string().trim().optional(),
  minRating: Joi.number().min(0).max(10).optional(),
  maxRating: Joi.number().min(0).max(10).optional(),
  minDuration: Joi.number().integer().min(1).optional(),
  maxDuration: Joi.number().integer().max(500).optional(),
  dateFrom: Joi.date().optional(),
  dateTo: Joi.date().optional()
});

module.exports = {
  createMovieSchema,
  updateMovieSchema,
  updateStatusSchema,
  paginationSchema,
  getAllMoviesQuerySchema,
  movieIdParamSchema,
  genreParamSchema,
  MOVIE_STATUSES,
  MOVIE_GENRES
};
