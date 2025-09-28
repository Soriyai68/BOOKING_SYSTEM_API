const Joi = require('joi');

const SEAT_TYPES = ['standard', 'premium', 'vip', 'wheelchair', 'recliner'];
const SEAT_STATUSES = ['active', 'maintenance', 'out_of_order', 'reserved'];

const createSeatSchema = Joi.object({
  row: Joi.string()
    .trim()
    .uppercase()
    .min(1)
    .max(5)
    .pattern(/^[A-Z][A-Z0-9]*$/)
    .required()
    .messages({
      'string.empty': 'Row is required',
      'string.min': 'Row must be at least 1 character',
      'string.max': 'Row cannot exceed 5 characters',
      'string.pattern.base': 'Row must start with a letter and contain only letters and numbers',
      'any.required': 'Row is required'
    }),
  
  seat_number: Joi.string()
    .trim()
    .uppercase()
    .min(1)
    .max(10)
    .pattern(/^[A-Z0-9]+$/)
    .required()
    .messages({
      'string.empty': 'Seat number is required',
      'string.min': 'Seat number must be at least 1 character',
      'string.max': 'Seat number cannot exceed 10 characters',
      'string.pattern.base': 'Seat number must contain only letters and numbers',
      'any.required': 'Seat number is required'
    }),
  
  seat_type: Joi.string()
    .valid(...SEAT_TYPES)
    .default('standard')
    .messages({
      'any.only': `Seat type must be one of: ${SEAT_TYPES.join(', ')}`
    }),
  
  is_available: Joi.boolean().default(true),
  
  status: Joi.string()
    .valid(...SEAT_STATUSES)
    .default('active')
    .messages({
      'any.only': `Status must be one of: ${SEAT_STATUSES.join(', ')}`
    }),
  
  theater_id: Joi.string()
    .trim()
    .allow(null)
    .optional(),
  
  screen_id: Joi.string()
    .trim()
    .allow(null)
    .optional(),
  
  price: Joi.number()
    .min(0)
    .precision(2)
    .default(0)
    .messages({
      'number.min': 'Price cannot be negative'
    }),
  
  notes: Joi.string()
    .trim()
    .max(500)
    .allow('')
    .optional()
    .messages({
      'string.max': 'Notes cannot exceed 500 characters'
    })
});

const updateSeatSchema = Joi.object({
  row: Joi.string()
    .trim()
    .uppercase()
    .min(1)
    .max(5)
    .pattern(/^[A-Z][A-Z0-9]*$/)
    .messages({
      'string.min': 'Row must be at least 1 character',
      'string.max': 'Row cannot exceed 5 characters',
      'string.pattern.base': 'Row must start with a letter and contain only letters and numbers'
    }),
  
  seat_number: Joi.string()
    .trim()
    .uppercase()
    .min(1)
    .max(10)
    .pattern(/^[A-Z0-9]+$/)
    .messages({
      'string.min': 'Seat number must be at least 1 character',
      'string.max': 'Seat number cannot exceed 10 characters',
      'string.pattern.base': 'Seat number must contain only letters and numbers'
    }),
  
  seat_type: Joi.string()
    .valid(...SEAT_TYPES)
    .messages({
      'any.only': `Seat type must be one of: ${SEAT_TYPES.join(', ')}`
    }),
  
  is_available: Joi.boolean(),
  
  status: Joi.string()
    .valid(...SEAT_STATUSES)
    .messages({
      'any.only': `Status must be one of: ${SEAT_STATUSES.join(', ')}`
    }),
  
  theater_id: Joi.string()
    .trim()
    .allow(null)
    .optional(),
  
  screen_id: Joi.string()
    .trim()
    .allow(null)
    .optional(),
  
  price: Joi.number()
    .min(0)
    .precision(2)
    .messages({
      'number.min': 'Price cannot be negative'
    }),
  
  notes: Joi.string()
    .trim()
    .max(500)
    .allow('')
    .optional()
    .messages({
      'string.max': 'Notes cannot exceed 500 characters'
    })
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

// Parameter validation schemas
const seatIdParamSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid seat ID format',
      'any.required': 'Seat ID is required'
    })
});

const rowParamSchema = Joi.object({
  row: Joi.string()
    .trim()
    .uppercase()
    .min(1)
    .max(5)
    .pattern(/^[A-Z][A-Z0-9]*$/)
    .required()
    .messages({
      'string.pattern.base': 'Row must start with a letter and contain only letters and numbers',
      'any.required': 'Row is required'
    })
});

const seatTypeParamSchema = Joi.object({
  type: Joi.string()
    .valid(...SEAT_TYPES)
    .required()
    .messages({
      'any.only': `Seat type must be one of: ${SEAT_TYPES.join(', ')}`,
      'any.required': 'Seat type is required'
    })
});

// Query validation schemas
const getAllSeatsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string().valid('createdAt', 'row', 'seat_number', 'seat_type', 'status', 'price', 'updatedAt').default('row'),
  sortOrder: Joi.string().valid('asc', 'desc').default('asc'),
  search: Joi.string().trim().max(100).optional(),
  seat_type: Joi.string().valid(...SEAT_TYPES).optional(),
  status: Joi.string().valid(...SEAT_STATUSES).optional(),
  is_available: Joi.string().valid('true', 'false').optional(),
  theater_id: Joi.string().trim().optional(),
  screen_id: Joi.string().trim().optional(),
  includeDeleted: Joi.string().valid('true', 'false').default('false'),
  priceMin: Joi.number().min(0).optional(),
  priceMax: Joi.number().min(Joi.ref('priceMin')).optional(),
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().min(Joi.ref('dateFrom')).optional()
}).messages({
  'number.min': 'priceMax must be greater than or equal to priceMin',
  'date.min': 'dateTo must be greater than or equal to dateFrom'
});

// Status update schema
const updateStatusSchema = Joi.object({
  status: Joi.string()
    .valid(...SEAT_STATUSES)
    .required()
    .messages({
      'any.only': `Status must be one of: ${SEAT_STATUSES.join(', ')}`,
      'any.required': 'Status is required'
    })
});

// Availability toggle schema
const toggleAvailabilitySchema = Joi.object({
  is_available: Joi.boolean()
    .required()
    .messages({
      'any.required': 'is_available field is required',
      'boolean.base': 'is_available must be a boolean value'
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
    .items(Joi.string().valid('row', 'seat_number', 'seat_type', 'notes'))
    .optional()
    .default(['row', 'seat_number']),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string().valid('createdAt', 'row', 'seat_number', 'seat_type', 'status', 'price', 'updatedAt').default('row'),
  sortOrder: Joi.string().valid('asc', 'desc').default('asc'),
  exact: Joi.boolean().default(false),
  caseSensitive: Joi.boolean().default(false),
  seat_type: Joi.string().valid(...SEAT_TYPES).optional(),
  status: Joi.string().valid(...SEAT_STATUSES).optional(),
  is_available: Joi.boolean().optional(),
  theater_id: Joi.string().trim().optional(),
  screen_id: Joi.string().trim().optional(),
  priceMin: Joi.number().min(0).optional(),
  priceMax: Joi.number().min(Joi.ref('priceMin')).optional(),
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().min(Joi.ref('dateFrom')).optional()
}).messages({
  'number.min': 'priceMax must be greater than or equal to priceMin',
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
      'array.min': 'At least one seat ID is required',
      'array.max': 'Cannot delete more than 100 seats at once',
      'any.required': 'Seat IDs array is required'
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
      'array.min': 'At least one seat ID is required',
      'array.max': 'Cannot update more than 100 seats at once',
      'any.required': 'Seat IDs array is required'
    }),
  status: Joi.string()
    .valid(...SEAT_STATUSES)
    .required()
    .messages({
      'any.only': `Status must be one of: ${SEAT_STATUSES.join(', ')}`,
      'any.required': 'Status is required'
    })
});

// Theater/Screen query schema
const theaterSeatsQuerySchema = Joi.object({
  theater_id: Joi.string().trim().required().messages({
    'any.required': 'Theater ID is required'
  }),
  screen_id: Joi.string().trim().optional(),
  seat_type: Joi.string().valid(...SEAT_TYPES).optional(),
  status: Joi.string().valid(...SEAT_STATUSES).optional(),
  is_available: Joi.string().valid('true', 'false').optional(),
  activeOnly: Joi.string().valid('true', 'false').default('true')
});

module.exports = {
  // Core CRUD schemas
  createSeatSchema,
  updateSeatSchema,
  seatIdParamSchema,
  getAllSeatsQuerySchema,
  
  // Parameter schemas
  rowParamSchema,
  seatTypeParamSchema,
  
  // Status and availability schemas
  updateStatusSchema,
  toggleAvailabilitySchema,
  
  // Search and filtering
  advancedSearchSchema,
  theaterSeatsQuerySchema,
  
  // Batch operations
  batchDeleteSchema,
  batchUpdateStatusSchema,
  
  // Utility schemas
  paginationSchema,
  
  // Constants
  SEAT_TYPES,
  SEAT_STATUSES
};