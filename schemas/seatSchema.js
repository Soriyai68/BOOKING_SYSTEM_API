const Joi = require('joi');

// Base seat validation schema
const baseSeatSchema = {
  seat_number: Joi.string().trim().min(1).max(10).required().messages({
    'string.empty': 'Seat number is required',
    'string.min': 'Seat number must be at least 1 character',
    'string.max': 'Seat number cannot exceed 10 characters',
    'any.required': 'Seat number is required'
  }),
  row: Joi.string().trim().min(1).max(5).required().messages({
    'string.empty': 'Row is required',
    'string.min': 'Row must be at least 1 character',
    'string.max': 'Row cannot exceed 5 characters',
    'any.required': 'Row is required'
  }),
  seat_type: Joi.string().valid('regular', 'vip', 'couple', 'king', 'queen').default('regular').messages({
    'any.only': 'Seat type must be one of: regular, vip, couple, king, queen'
  }),
  is_available: Joi.boolean().default(true)
};

// 1. CREATE - Schema for creating new seat resource
const createSeatSchema = Joi.object(baseSeatSchema);

// 2. UPDATE - Schema for updating seat resource by ID
const updateSeatSchema = Joi.object({
  seat_number: Joi.string().trim().min(1).max(10).messages({
    'string.empty': 'Seat number cannot be empty',
    'string.min': 'Seat number must be at least 1 character',
    'string.max': 'Seat number cannot exceed 10 characters'
  }),
  row: Joi.string().trim().min(1).max(5).messages({
    'string.empty': 'Row cannot be empty',
    'string.min': 'Row must be at least 1 character',
    'string.max': 'Row cannot exceed 5 characters'
  }),
  seat_type: Joi.string().valid('regular', 'vip', 'couple', 'king', 'queen').messages({
    'any.only': 'Seat type must be one of: regular, vip, couple, king, queen'
  }),
  is_available: Joi.boolean()
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

// 3. GET BY ID - Schema for validating seat ID parameter
const seatIdParamSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    'string.guid': 'Invalid seat ID format',
    'any.required': 'Seat ID is required'
  })
});

// 4. GET ALL - Schema for query parameters with filters and pagination
const getSeatQuerySchema = Joi.object({
  // Pagination
  page: Joi.number().integer().min(1).default(1).messages({
    'number.base': 'Page must be a number',
    'number.integer': 'Page must be an integer',
    'number.min': 'Page must be at least 1'
  }),
  limit: Joi.number().integer().min(1).max(100).default(10).messages({
    'number.base': 'Limit must be a number',
    'number.integer': 'Limit must be an integer',
    'number.min': 'Limit must be at least 1',
    'number.max': 'Limit cannot exceed 100'
  }),
  
  // Filters
  seat_type: Joi.string().valid('regular', 'vip', 'couple', 'king', 'queen'),
  is_available: Joi.string().valid('true', 'false'),
  row: Joi.string().trim().max(5),
  seat_number: Joi.string().trim().max(10),
  includeUnavailable: Joi.string().valid('true', 'false').default('true'),
  
  // Date range
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().min(Joi.ref('dateFrom')).optional(),
  
  // Sorting
  sortBy: Joi.string().valid('seat_number', 'row', 'seat_type', 'createdAt', 'seat_identifier').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  
  // General search
  search: Joi.string().trim().min(1).max(50)
}).messages({
  'date.min': 'dateTo must be greater than or equal to dateFrom'
});

// 5. REMOVE - Schema for validating seat ID parameter (same as getById)
const removeSeatParamSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    'string.guid': 'Invalid seat ID format',
    'any.required': 'Seat ID is required'
  })
});

// 6. SEARCH - Schema for advanced search with multiple criteria
const searchSeatSchema = Joi.object({
  // Text search
  query: Joi.string().trim().min(1).max(50).required().messages({
    'string.empty': 'Search query is required',
    'string.min': 'Search query must be at least 1 character',
    'string.max': 'Search query cannot exceed 50 characters',
    'any.required': 'Search query is required'
  }),
  
  // Search fields
  fields: Joi.array()
    .items(Joi.string().valid('row', 'seat_number', 'seat_type'))
    .optional()
    .default(['row', 'seat_number', 'seat_type']),
  
  // Specific filters
  seat_type: Joi.string().valid('regular', 'vip', 'couple', 'king', 'queen'),
  is_available: Joi.boolean(),
  row: Joi.string().trim().max(5),
  seat_number: Joi.string().trim().max(10),
  
  // Date range
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().min(Joi.ref('dateFrom')).optional(),
  
  // Search options
  exact: Joi.boolean().default(false),
  caseSensitive: Joi.boolean().default(false),
  
  // Pagination
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  
  // Sorting
  sortBy: Joi.string().valid('seat_number', 'row', 'seat_type', 'createdAt', 'seat_identifier').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc')
}).messages({
  'date.min': 'dateTo must be greater than or equal to dateFrom'
});

// Additional utility schemas

// Toggle availability schema
const toggleAvailabilitySchema = Joi.object({
  is_available: Joi.boolean().required().messages({
    'any.required': 'Availability status is required',
    'boolean.base': 'Availability status must be a boolean'
  })
});

// Batch delete schema
const batchDeleteSchema = Joi.object({
  ids: Joi.array()
    .items(Joi.string().uuid())
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

// Bulk seat creation schema
const bulkSeatSchema = Joi.object({
  seats: Joi.array().items(createSeatSchema).min(1).max(50).required().messages({
    'array.min': 'At least one seat is required',
    'array.max': 'Cannot create more than 50 seats at once',
    'any.required': 'Seats array is required'
  })
});

// Row param schema
const rowParamSchema = Joi.object({
  row: Joi.string().trim().min(1).max(5).required().messages({
    'string.empty': 'Row is required',
    'string.min': 'Row must be at least 1 character',
    'string.max': 'Row cannot exceed 5 characters',
    'any.required': 'Row is required'
  })
});

// Seat type param schema
const seatTypeParamSchema = Joi.object({
  type: Joi.string().valid('regular', 'vip', 'couple', 'king', 'queen').required().messages({
    'any.only': 'Seat type must be one of: regular, vip, couple, king, queen',
    'any.required': 'Seat type is required'
  })
});

// Query schema for available seats
const availableSeatsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  seat_type: Joi.string().valid('regular', 'vip', 'couple', 'king', 'queen'),
  row: Joi.string().trim().max(5),
  sortBy: Joi.string().valid('row', 'seat_number', 'seat_identifier').default('row'),
  sortOrder: Joi.string().valid('asc', 'desc').default('asc')
});

module.exports = {
  // Core CRUD schemas
  createSeatSchema,          // For create(req, res)
  updateSeatSchema,          // For update(req, res)
  seatIdParamSchema,         // For getById(req, res)
  getSeatQuerySchema,        // For getAll(req, res)
  removeSeatParamSchema,     // For delete(req, res)
  searchSeatSchema,          // For search(req, res)
  batchDeleteSchema,         // For listDelete(req, res)
  
  // Parameter schemas
  rowParamSchema,            // For getSeatsByRow(req, res)
  seatTypeParamSchema,       // For getSeatsByType(req, res)
  
  // Query schemas
  availableSeatsQuerySchema, // For getAvailable(req, res)
  
  // Utility schemas
  toggleAvailabilitySchema,  // For toggleAvailability(req, res)
  bulkSeatSchema            // For bulk operations
};
