const Joi = require('joi');

const createLocationSchema = Joi.object({
  address: Joi.string()
    .trim()
    .min(5)
    .max(200)
    .required()
    .messages({
      'string.empty': 'Address is required',
      'string.min': 'Address must be at least 5 characters',
      'string.max': 'Address cannot exceed 200 characters',
      'any.required': 'Address is required'
    }),
  
  city: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.empty': 'City is required',
      'string.min': 'City must be at least 2 characters',
      'string.max': 'City cannot exceed 50 characters',
      'any.required': 'City is required'
    }),
  
  province: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.empty': 'Province is required',
      'string.min': 'Province must be at least 2 characters',
      'string.max': 'Province cannot exceed 50 characters',
      'any.required': 'Province is required'
    }),
  
  status: Joi.boolean().default(true),
  
  description: Joi.string()
    .trim()
    .max(1000)
    .allow('')
    .optional()
    .messages({
      'string.max': 'Description cannot exceed 1000 characters'
    }),
  
  // Additional fields
  coordinates: Joi.object({
    latitude: Joi.number()
      .min(-90)
      .max(90)
      .messages({
        'number.min': 'Latitude must be between -90 and 90',
        'number.max': 'Latitude must be between -90 and 90'
      }),
    longitude: Joi.number()
      .min(-180)
      .max(180)
      .messages({
        'number.min': 'Longitude must be between -180 and 180',
        'number.max': 'Longitude must be between -180 and 180'
      })
  }).optional(),
  
  postalCode: Joi.string()
    .trim()
    .max(20)
    .optional()
    .messages({
      'string.max': 'Postal code cannot exceed 20 characters'
    }),
  
  country: Joi.string()
    .trim()
    .max(50)
    .default('Cambodia')
    .messages({
      'string.max': 'Country cannot exceed 50 characters'
    }),
  
  businessHours: Joi.object({
    openTime: Joi.string()
      .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .optional()
      .messages({
        'string.pattern.base': 'Invalid time format. Use HH:MM (24-hour format)'
      }),
    closeTime: Joi.string()
      .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .optional()
      .messages({
        'string.pattern.base': 'Invalid time format. Use HH:MM (24-hour format)'
      }),
    isOpen24Hours: Joi.boolean().default(false)
  }).optional(),
  
  contact: Joi.object({
    phone: Joi.string()
      .trim()
      .pattern(/^(\+?[1-9]\d{1,14})?$/)
      .allow('')
      .optional()
      .messages({
        'string.pattern.base': 'Invalid phone number format'
      }),
    email: Joi.string()
      .trim()
      .email()
      .lowercase()
      .allow('')
      .optional()
      .messages({
        'string.email': 'Invalid email format'
      })
  }).optional(),
  
  totalTheaters: Joi.number()
    .min(0)
    .default(0)
    .messages({
      'number.min': 'Total theaters cannot be negative'
    }),
  
  totalSeats: Joi.number()
    .min(0)
    .default(0)
    .messages({
      'number.min': 'Total seats cannot be negative'
    }),
  
  amenities: Joi.array()
    .items(Joi.string().trim())
    .optional()
});

const updateLocationSchema = Joi.object({
  address: Joi.string()
    .trim()
    .min(5)
    .max(200)
    .messages({
      'string.min': 'Address must be at least 5 characters',
      'string.max': 'Address cannot exceed 200 characters'
    }),
  
  city: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .messages({
      'string.min': 'City must be at least 2 characters',
      'string.max': 'City cannot exceed 50 characters'
    }),
  
  province: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .messages({
      'string.min': 'Province must be at least 2 characters',
      'string.max': 'Province cannot exceed 50 characters'
    }),
  
  status: Joi.boolean(),
  
  description: Joi.string()
    .trim()
    .max(1000)
    .allow('')
    .optional()
    .messages({
      'string.max': 'Description cannot exceed 1000 characters'
    }),
  
  coordinates: Joi.object({
    latitude: Joi.number()
      .min(-90)
      .max(90)
      .messages({
        'number.min': 'Latitude must be between -90 and 90',
        'number.max': 'Latitude must be between -90 and 90'
      }),
    longitude: Joi.number()
      .min(-180)
      .max(180)
      .messages({
        'number.min': 'Longitude must be between -180 and 180',
        'number.max': 'Longitude must be between -180 and 180'
      })
  }).optional(),
  
  postalCode: Joi.string()
    .trim()
    .max(20)
    .optional()
    .messages({
      'string.max': 'Postal code cannot exceed 20 characters'
    }),
  
  country: Joi.string()
    .trim()
    .max(50)
    .messages({
      'string.max': 'Country cannot exceed 50 characters'
    }),
  
  businessHours: Joi.object({
    openTime: Joi.string()
      .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .optional()
      .messages({
        'string.pattern.base': 'Invalid time format. Use HH:MM (24-hour format)'
      }),
    closeTime: Joi.string()
      .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .optional()
      .messages({
        'string.pattern.base': 'Invalid time format. Use HH:MM (24-hour format)'
      }),
    isOpen24Hours: Joi.boolean()
  }).optional(),
  
  contact: Joi.object({
    phone: Joi.string()
      .trim()
      .pattern(/^(\+?[1-9]\d{1,14})?$/)
      .allow('')
      .optional()
      .messages({
        'string.pattern.base': 'Invalid phone number format'
      }),
    email: Joi.string()
      .trim()
      .email()
      .lowercase()
      .allow('')
      .optional()
      .messages({
        'string.email': 'Invalid email format'
      })
  }).optional(),
  
  totalTheaters: Joi.number()
    .min(0)
    .messages({
      'number.min': 'Total theaters cannot be negative'
    }),
  
  totalSeats: Joi.number()
    .min(0)
    .messages({
      'number.min': 'Total seats cannot be negative'
    }),
  
  amenities: Joi.array()
    .items(Joi.string().trim())
    .optional()
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

// Parameter validation schemas
const locationIdParamSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid location ID format',
      'any.required': 'Location ID is required'
    })
});

const cityParamSchema = Joi.object({
  city: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.min': 'City must be at least 2 characters',
      'string.max': 'City cannot exceed 50 characters',
      'any.required': 'City is required'
    })
});

const provinceParamSchema = Joi.object({
  province: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.min': 'Province must be at least 2 characters',
      'string.max': 'Province cannot exceed 50 characters',
      'any.required': 'Province is required'
    })
});

// Query validation schemas
const getAllLocationsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string().valid('createdAt', 'city', 'province', 'address', 'status', 'totalTheaters', 'totalSeats', 'updatedAt').default('city'),
  sortOrder: Joi.string().valid('asc', 'desc').default('asc'),
  search: Joi.string().trim().max(100).optional(),
  city: Joi.string().trim().max(50).optional(),
  province: Joi.string().trim().max(50).optional(),
  status: Joi.string().valid('true', 'false').optional(),
  includeDeleted: Joi.string().valid('true', 'false').default('false'),
  country: Joi.string().trim().max(50).optional(),
  hasCoordinates: Joi.string().valid('true', 'false').optional(),
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().min(Joi.ref('dateFrom')).optional()
}).messages({
  'date.min': 'dateTo must be greater than or equal to dateFrom'
});

// Status update schema
const updateStatusSchema = Joi.object({
  status: Joi.boolean()
    .required()
    .messages({
      'any.required': 'Status is required',
      'boolean.base': 'Status must be a boolean value'
    })
});

// Coordinates update schema
const updateCoordinatesSchema = Joi.object({
  latitude: Joi.number()
    .min(-90)
    .max(90)
    .required()
    .messages({
      'number.min': 'Latitude must be between -90 and 90',
      'number.max': 'Latitude must be between -90 and 90',
      'any.required': 'Latitude is required'
    }),
  longitude: Joi.number()
    .min(-180)
    .max(180)
    .required()
    .messages({
      'number.min': 'Longitude must be between -180 and 180',
      'number.max': 'Longitude must be between -180 and 180',
      'any.required': 'Longitude is required'
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
    .items(Joi.string().valid('address', 'city', 'province', 'description'))
    .optional()
    .default(['address', 'city', 'province']),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string().valid('createdAt', 'city', 'province', 'address', 'status', 'updatedAt').default('city'),
  sortOrder: Joi.string().valid('asc', 'desc').default('asc'),
  exact: Joi.boolean().default(false),
  caseSensitive: Joi.boolean().default(false),
  city: Joi.string().trim().max(50).optional(),
  province: Joi.string().trim().max(50).optional(),
  status: Joi.boolean().optional(),
  country: Joi.string().trim().max(50).optional(),
  hasCoordinates: Joi.boolean().optional(),
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().min(Joi.ref('dateFrom')).optional()
}).messages({
  'date.min': 'dateTo must be greater than or equal to dateFrom'
});

// Batch operations schema
const batchDeleteSchema = Joi.object({
  ids: Joi.array()
    .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
    .min(1)
    .max(50)
    .required()
    .messages({
      'array.min': 'At least one location ID is required',
      'array.max': 'Cannot delete more than 50 locations at once',
      'any.required': 'Location IDs array is required'
    }),
  permanent: Joi.boolean().default(false)
});

const batchUpdateStatusSchema = Joi.object({
  ids: Joi.array()
    .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
    .min(1)
    .max(50)
    .required()
    .messages({
      'array.min': 'At least one location ID is required',
      'array.max': 'Cannot update more than 50 locations at once',
      'any.required': 'Location IDs array is required'
    }),
  status: Joi.boolean()
    .required()
    .messages({
      'any.required': 'Status is required',
      'boolean.base': 'Status must be a boolean value'
    })
});

// Nearby locations query schema
const nearbyLocationsSchema = Joi.object({
  latitude: Joi.number()
    .min(-90)
    .max(90)
    .required()
    .messages({
      'number.min': 'Latitude must be between -90 and 90',
      'number.max': 'Latitude must be between -90 and 90',
      'any.required': 'Latitude is required'
    }),
  longitude: Joi.number()
    .min(-180)
    .max(180)
    .required()
    .messages({
      'number.min': 'Longitude must be between -180 and 180',
      'number.max': 'Longitude must be between -180 and 180',
      'any.required': 'Longitude is required'
    }),
  radius: Joi.number()
    .min(0.1)
    .max(100)
    .default(10)
    .messages({
      'number.min': 'Radius must be at least 0.1 km',
      'number.max': 'Radius cannot exceed 100 km'
    }),
  limit: Joi.number().integer().min(1).max(50).default(10)
});

module.exports = {
  // Core CRUD schemas
  createLocationSchema,
  updateLocationSchema,
  locationIdParamSchema,
  getAllLocationsQuerySchema,
  
  // Parameter schemas
  cityParamSchema,
  provinceParamSchema,
  
  // Status and coordinates schemas
  updateStatusSchema,
  updateCoordinatesSchema,
  
  // Search and filtering
  advancedSearchSchema,
  nearbyLocationsSchema,
  
  // Batch operations
  batchDeleteSchema,
  batchUpdateStatusSchema,
  
  // Utility schemas
  paginationSchema
};