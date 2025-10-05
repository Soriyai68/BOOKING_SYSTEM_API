const Joi = require('joi');

const SCREEN_TYPES = ['standard', 'imax', '3d', '4dx', 'vip'];
const SCREEN_STATUSES = ['active', 'maintenance', 'closed', 'renovation'];
const SCREEN_FEATURES = ['dolby_atmos', 'surround_sound', 'premium_seating', 'wheelchair_accessible', 'air_conditioning', 'heating'];

// Capacity schema for nested validation
const capacitySchema = Joi.object({
  standard: Joi.number().integer().min(0).max(500).default(0),
  premium: Joi.number().integer().min(0).max(500).default(0),
  vip: Joi.number().integer().min(0).max(500).default(0),
  wheelchair: Joi.number().integer().min(0).max(100).default(0),
  recliner: Joi.number().integer().min(0).max(200).default(0)
});

// Dimensions schema for nested validation
const dimensionsSchema = Joi.object({
  width: Joi.number().min(1).max(100).default(10),
  height: Joi.number().min(1).max(100).default(10)
});

const createScreenSchema = Joi.object({
  screen_name: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.empty': 'Screen name is required',
      'string.min': 'Screen name must be at least 1 character',
      'string.max': 'Screen name cannot exceed 100 characters',
      'any.required': 'Screen name is required'
    }),

  total_seats: Joi.number()
    .integer()
    .min(0)
    .max(1000)
    // .required()
    .messages({
      'number.base': 'Total seats must be a number',
      'number.integer': 'Total seats must be an integer',
      'number.min': 'Total seats must be at least 0',
      'number.max': 'Total seats cannot exceed 1000',
      'any.required': 'Total seats is required'
    }),

  seat_layout_id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .allow(null)
    .optional()
    .messages({
      'string.pattern.base': 'Invalid seat layout ID format'
    }),

  theater_id: Joi.string()
    .trim()
    .allow(null, '')
    .optional(),

  screen_type: Joi.string()
    .valid(...SCREEN_TYPES)
    .default('standard')
    .messages({
      'any.only': `Screen type must be one of: ${SCREEN_TYPES.join(', ')}`
    }),

  capacity: capacitySchema.optional(),

  dimensions: dimensionsSchema.optional(),

  status: Joi.string()
    .valid(...SCREEN_STATUSES)
    .default('active')
    .messages({
      'any.only': `Status must be one of: ${SCREEN_STATUSES.join(', ')}`
    }),

  features: Joi.array()
    .items(Joi.string().valid(...SCREEN_FEATURES))
    .unique()
    .default([])
    .messages({
      'array.unique': 'Duplicate features are not allowed',
      'any.only': `Features must be one of: ${SCREEN_FEATURES.join(', ')}`
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

const updateScreenSchema = Joi.object({
  screen_name: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .messages({
      'string.min': 'Screen name must be at least 1 character',
      'string.max': 'Screen name cannot exceed 100 characters'
    }),

  total_seats: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .messages({
      'number.base': 'Total seats must be a number',
      'number.integer': 'Total seats must be an integer',
      'number.min': 'Total seats must be at least 1',
      'number.max': 'Total seats cannot exceed 1000'
    }),

  seat_layout_id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .allow(null)
    .messages({
      'string.pattern.base': 'Invalid seat layout ID format'
    }),

  theater_id: Joi.string()
    .trim()
    .allow(null, ''),

  screen_type: Joi.string()
    .valid(...SCREEN_TYPES)
    .messages({
      'any.only': `Screen type must be one of: ${SCREEN_TYPES.join(', ')}`
    }),

  capacity: capacitySchema,

  dimensions: dimensionsSchema,

  status: Joi.string()
    .valid(...SCREEN_STATUSES)
    .messages({
      'any.only': `Status must be one of: ${SCREEN_STATUSES.join(', ')}`
    }),

  features: Joi.array()
    .items(Joi.string().valid(...SCREEN_FEATURES))
    .unique()
    .messages({
      'array.unique': 'Duplicate features are not allowed',
      'any.only': `Features must be one of: ${SCREEN_FEATURES.join(', ')}`
    }),

  notes: Joi.string()
    .trim()
    .max(1000)
    .allow('')
    .messages({
      'string.max': 'Notes cannot exceed 1000 characters'
    })
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

// Parameter validation schemas
const screenIdParamSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid screen ID format',
      'any.required': 'Screen ID is required'
    })
});

const screenTypeParamSchema = Joi.object({
  type: Joi.string()
    .valid(...SCREEN_TYPES)
    .required()
    .messages({
      'any.only': `Screen type must be one of: ${SCREEN_TYPES.join(', ')}`,
      'any.required': 'Screen type is required'
    })
});

const theaterIdParamSchema = Joi.object({
  theaterId: Joi.string()
    .trim()
    .required()
    .messages({
      'any.required': 'Theater ID is required'
    })
});

// Query validation schemas
const getAllScreensQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string().valid('createdAt', 'screen_name', 'screen_type', 'status', 'total_seats', 'theater_id', 'updatedAt').default('screen_name'),
  sortOrder: Joi.string().valid('asc', 'desc').default('asc'),
  search: Joi.string().trim().max(100).optional(),
  screen_type: Joi.string().valid(...SCREEN_TYPES).optional(),
  status: Joi.string().valid(...SCREEN_STATUSES).optional(),
  theater_id: Joi.string().trim().optional(),
  includeDeleted: Joi.string().valid('true', 'false').default('false'),
  minSeats: Joi.number().integer().min(0).optional(),
  maxSeats: Joi.number().integer().min(Joi.ref('minSeats')).optional(),
  hasFeatures: Joi.array().items(Joi.string().valid(...SCREEN_FEATURES)).unique().optional(),
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().min(Joi.ref('dateFrom')).optional()
}).messages({
  'number.min': 'maxSeats must be greater than or equal to minSeats',
  'date.min': 'dateTo must be greater than or equal to dateFrom'
});

// Status update schema
const updateStatusSchema = Joi.object({
  status: Joi.string()
    .valid(...SCREEN_STATUSES)
    .required()
    .messages({
      'any.only': `Status must be one of: ${SCREEN_STATUSES.join(', ')}`,
      'any.required': 'Status is required'
    })
});

// Capacity update schema
const updateCapacitySchema = Joi.object({
  capacity: capacitySchema.required().messages({
    'any.required': 'Capacity is required'
  })
});

// Pagination schema (reusable)
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
});

// Advanced search schema
const advancedSearchSchema = Joi.object({
  query: Joi.string().trim().min(1).max(100).required().messages({
    'string.empty': 'Search query is required',
    'string.min': 'Search query must be at least 1 character',
    'any.required': 'Search query is required'
  }),
  fields: Joi.array()
    .items(Joi.string().valid('screen_name', 'screen_type', 'theater_id', 'notes'))
    .optional()
    .default(['screen_name']),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string().valid('createdAt', 'screen_name', 'screen_type', 'status', 'total_seats', 'theater_id', 'updatedAt').default('screen_name'),
  sortOrder: Joi.string().valid('asc', 'desc').default('asc'),
  exact: Joi.boolean().default(false),
  caseSensitive: Joi.boolean().default(false),
  screen_type: Joi.string().valid(...SCREEN_TYPES).optional(),
  status: Joi.string().valid(...SCREEN_STATUSES).optional(),
  theater_id: Joi.string().trim().optional(),
  minSeats: Joi.number().integer().min(0).optional(),
  maxSeats: Joi.number().integer().min(Joi.ref('minSeats')).optional(),
  hasFeatures: Joi.array().items(Joi.string().valid(...SCREEN_FEATURES)).unique().optional(),
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().min(Joi.ref('dateFrom')).optional()
}).messages({
  'number.min': 'maxSeats must be greater than or equal to minSeats',
  'date.min': 'dateTo must be greater than or equal to dateFrom'
});

// Batch operations schema
const batchDeleteSchema = Joi.object({
  ids: Joi.array()
    .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
    .min(1)
    .max(100)
    .required()
    .messages({
      'array.min': 'At least one screen ID is required',
      'array.max': 'Cannot delete more than 100 screens at once',
      'any.required': 'Screen IDs array is required'
    }),
  permanent: Joi.boolean().default(false)
});

const batchUpdateStatusSchema = Joi.object({
  ids: Joi.array()
    .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
    .min(1)
    .max(100)
    .required()
    .messages({
      'array.min': 'At least one screen ID is required',
      'array.max': 'Cannot update more than 100 screens at once',
      'any.required': 'Screen IDs array is required'
    }),
  status: Joi.string()
    .valid(...SCREEN_STATUSES)
    .required()
    .messages({
      'any.only': `Status must be one of: ${SCREEN_STATUSES.join(', ')}`,
      'any.required': 'Status is required'
    })
});

// Theater screens query schema
const theaterScreensQuerySchema = Joi.object({
  theater_id: Joi.string().trim().required().messages({
    'any.required': 'Theater ID is required'
  }),
  screen_type: Joi.string().valid(...SCREEN_TYPES).optional(),
  status: Joi.string().valid(...SCREEN_STATUSES).optional(),
  activeOnly: Joi.string().valid('true', 'false').default('true')
});

// Screen analytics schema
const analyticsQuerySchema = Joi.object({
  theater_id: Joi.string().trim().optional(),
  screen_type: Joi.string().valid(...SCREEN_TYPES).optional(),
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().min(Joi.ref('dateFrom')).optional(),
  groupBy: Joi.string().valid('theater_id', 'screen_type', 'status', 'month', 'week').default('screen_type')
}).messages({
  'date.min': 'dateTo must be greater than or equal to dateFrom'
});

module.exports = {
  // Core CRUD schemas
  createScreenSchema,
  updateScreenSchema,
  screenIdParamSchema,
  getAllScreensQuerySchema,

  // Parameter schemas
  screenTypeParamSchema,
  theaterIdParamSchema,

  // Status and capacity schemas
  updateStatusSchema,
  updateCapacitySchema,

  // Search and filtering
  advancedSearchSchema,
  theaterScreensQuerySchema,
  analyticsQuerySchema,

  // Batch operations
  batchDeleteSchema,
  batchUpdateStatusSchema,

  // Utility schemas
  paginationSchema,
  capacitySchema,
  dimensionsSchema,

  // Constants
  SCREEN_TYPES,
  SCREEN_STATUSES,
  SCREEN_FEATURES
};