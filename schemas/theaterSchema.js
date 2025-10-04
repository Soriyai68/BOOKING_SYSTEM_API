const Joi = require('joi');

const THEATER_STATUSES = ['active', 'maintenance', 'closed', 'renovation'];
const THEATER_FEATURES = ['parking', 'food_court', 'disabled_access', 'air_conditioning', 'wifi', '3d_capable', 'imax', 'vip_lounge', 'arcade'];
const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

// Contact info schema for nested validation
const contactInfoSchema = Joi.object({
  phone: Joi.string()
    .trim()
    .pattern(/^\+?[\d\s\-\(\)]{8,20}$/)
    .allow(null, '')
    .optional()
    .messages({
      'string.pattern.base': 'Phone number format is invalid'
    }),
  email: Joi.string()
    .trim()
    .lowercase()
    .email()
    .allow(null, '')
    .optional()
    .messages({
      'string.email': 'Email format is invalid'
    }),
  website: Joi.string()
    .trim()
    .uri({ scheme: ['http', 'https'] })
    .allow(null, '')
    .optional()
    .messages({
      'string.uri': 'Website URL format is invalid'
    })
});

// Operating hours day schema
const operatingHoursDaySchema = Joi.object({
  open: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .default('09:00')
    .messages({
      'string.pattern.base': 'Time format must be HH:MM (24-hour format)'
    }),
  close: Joi.string()
    .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .default('23:00')
    .messages({
      'string.pattern.base': 'Time format must be HH:MM (24-hour format)'
    }),
  closed: Joi.boolean().default(false)
});

// Operating hours schema for nested validation
const operatingHoursSchema = Joi.object({
  monday: operatingHoursDaySchema.optional(),
  tuesday: operatingHoursDaySchema.optional(),
  wednesday: operatingHoursDaySchema.optional(),
  thursday: operatingHoursDaySchema.optional(),
  friday: operatingHoursDaySchema.optional(),
  saturday: operatingHoursDaySchema.optional(),
  sunday: operatingHoursDaySchema.optional()
});

// Location schema for nested validation
const locationSchema = Joi.object({
  coordinates: Joi.array()
    .items(Joi.number().min(-180).max(180))
    .length(2)
    .allow(null)
    .optional()
    .messages({
      'array.length': 'Coordinates must contain exactly 2 numbers [longitude, latitude]',
      'number.min': 'Longitude and latitude must be between -180 and 180',
      'number.max': 'Longitude and latitude must be between -180 and 180'
    }),
  type: Joi.string()
    .valid('Point')
    .default('Point')
});

const createTheaterSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.empty': 'Theater name is required',
      'string.min': 'Theater name must be at least 1 character',
      'string.max': 'Theater name cannot exceed 100 characters',
      'any.required': 'Theater name is required'
    }),

  screens_id: Joi.array()
    .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
    .default([])
    .messages({
      'string.pattern.base': 'Invalid screen ID format'
    }),

  address: Joi.string()
    .trim()
    .min(1)
    .max(500)
    .required()
    .messages({
      'string.empty': 'Address is required',
      'string.min': 'Address must be at least 1 character',
      'string.max': 'Address cannot exceed 500 characters',
      'any.required': 'Address is required'
    }),

  city: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.empty': 'City is required',
      'string.min': 'City must be at least 1 character',
      'string.max': 'City cannot exceed 100 characters',
      'any.required': 'City is required'
    }),

  province: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .required()
    .messages({
      'string.empty': 'Province is required',
      'string.min': 'Province must be at least 1 character',
      'string.max': 'Province cannot exceed 100 characters',
      'any.required': 'Province is required'
    }),

  status: Joi.string()
    .valid(...THEATER_STATUSES)
    .default('active')
    .messages({
      'any.only': `Status must be one of: ${THEATER_STATUSES.join(', ')}`
    }),

  contact_info: contactInfoSchema.optional(),

  operating_hours: operatingHoursSchema.optional(),

  features: Joi.array()
    .items(Joi.string().valid(...THEATER_FEATURES))
    .unique()
    .default([])
    .messages({
      'array.unique': 'Duplicate features are not allowed',
      'any.only': `Features must be one of: ${THEATER_FEATURES.join(', ')}`
    }),

  total_screens: Joi.number()
    .integer()
    .min(0)
    .max(50)
    .default(0)
    .messages({
      'number.base': 'Total screens must be a number',
      'number.integer': 'Total screens must be an integer',
      'number.min': 'Total screens cannot be negative',
      'number.max': 'Total screens cannot exceed 50'
    }),

  total_capacity: Joi.number()
    .integer()
    .min(0)
    .default(0)
    .messages({
      'number.base': 'Total capacity must be a number',
      'number.integer': 'Total capacity must be an integer',
      'number.min': 'Total capacity cannot be negative'
    }),

  location: locationSchema.optional(),

  notes: Joi.string()
    .trim()
    .max(1000)
    .allow('')
    .default('')
    .messages({
      'string.max': 'Notes cannot exceed 1000 characters'
    })
});

const updateTheaterSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .messages({
      'string.min': 'Theater name must be at least 1 character',
      'string.max': 'Theater name cannot exceed 100 characters'
    }),

  screens_id: Joi.array()
    .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
    .messages({
      'string.pattern.base': 'Invalid screen ID format'
    }),

  address: Joi.string()
    .trim()
    .min(1)
    .max(500)
    .messages({
      'string.min': 'Address must be at least 1 character',
      'string.max': 'Address cannot exceed 500 characters'
    }),

  city: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .messages({
      'string.min': 'City must be at least 1 character',
      'string.max': 'City cannot exceed 100 characters'
    }),

  province: Joi.string()
    .trim()
    .min(1)
    .max(100)
    .messages({
      'string.min': 'Province must be at least 1 character',
      'string.max': 'Province cannot exceed 100 characters'
    }),

  status: Joi.string()
    .valid(...THEATER_STATUSES)
    .messages({
      'any.only': `Status must be one of: ${THEATER_STATUSES.join(', ')}`
    }),

  contact_info: contactInfoSchema,

  operating_hours: operatingHoursSchema,

  features: Joi.array()
    .items(Joi.string().valid(...THEATER_FEATURES))
    .unique()
    .messages({
      'array.unique': 'Duplicate features are not allowed',
      'any.only': `Features must be one of: ${THEATER_FEATURES.join(', ')}`
    }),

  total_screens: Joi.number()
    .integer()
    .min(0)
    .max(50)
    .messages({
      'number.base': 'Total screens must be a number',
      'number.integer': 'Total screens must be an integer',
      'number.min': 'Total screens cannot be negative',
      'number.max': 'Total screens cannot exceed 50'
    }),

  total_capacity: Joi.number()
    .integer()
    .min(0)
    .messages({
      'number.base': 'Total capacity must be a number',
      'number.integer': 'Total capacity must be an integer',
      'number.min': 'Total capacity cannot be negative'
    }),

  location: locationSchema,

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
const theaterIdParamSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid theater ID format',
      'any.required': 'Theater ID is required'
    })
});

const cityParamSchema = Joi.object({
  city: Joi.string()
    .trim()
    .required()
    .messages({
      'any.required': 'City is required'
    })
});

const provinceParamSchema = Joi.object({
  province: Joi.string()
    .trim()
    .required()
    .messages({
      'any.required': 'Province is required'
    })
});

// Query validation schemas
const getAllTheatersQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string().valid('createdAt', 'name', 'city', 'province', 'status', 'total_screens', 'total_capacity', 'updatedAt').default('name'),
  sortOrder: Joi.string().valid('asc', 'desc').default('asc'),
  search: Joi.string().trim().max(100).optional(),
  status: Joi.string().valid(...THEATER_STATUSES).optional(),
  city: Joi.string().trim().optional(),
  province: Joi.string().trim().optional(),
  includeDeleted: Joi.string().valid('true', 'false').default('false'),
  minScreens: Joi.number().integer().min(0).optional(),
  maxScreens: Joi.number().integer().min(Joi.ref('minScreens')).optional(),
  minCapacity: Joi.number().integer().min(0).optional(),
  maxCapacity: Joi.number().integer().min(Joi.ref('minCapacity')).optional(),
  hasFeatures: Joi.array().items(Joi.string().valid(...THEATER_FEATURES)).unique().optional(),
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().min(Joi.ref('dateFrom')).optional(),
  nearLocation: Joi.string().pattern(/^-?\d+\.?\d*,-?\d+\.?\d*$/).optional().messages({
    'string.pattern.base': 'Near location format must be "longitude,latitude"'
  }),
  maxDistance: Joi.number().positive().default(10000)
}).messages({
  'number.min': 'maxScreens must be greater than or equal to minScreens',
  'date.min': 'dateTo must be greater than or equal to dateFrom'
});

// Status update schema
const updateStatusSchema = Joi.object({
  status: Joi.string()
    .valid(...THEATER_STATUSES)
    .required()
    .messages({
      'any.only': `Status must be one of: ${THEATER_STATUSES.join(', ')}`,
      'any.required': 'Status is required'
    })
});

// Screen management schemas
const addScreenSchema = Joi.object({
  screen_id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid screen ID format',
      'any.required': 'Screen ID is required'
    })
});

const removeScreenSchema = Joi.object({
  screen_id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      'string.pattern.base': 'Invalid screen ID format',
      'any.required': 'Screen ID is required'
    })
});

// Location update schema
const updateLocationSchema = Joi.object({
  longitude: Joi.number()
    .min(-180)
    .max(180)
    .required()
    .messages({
      'number.min': 'Longitude must be between -180 and 180',
      'number.max': 'Longitude must be between -180 and 180',
      'any.required': 'Longitude is required'
    }),
  latitude: Joi.number()
    .min(-90)
    .max(90)
    .required()
    .messages({
      'number.min': 'Latitude must be between -90 and 90',
      'number.max': 'Latitude must be between -90 and 90',
      'any.required': 'Latitude is required'
    })
});

// Operating hours update schema
const updateOperatingHoursSchema = Joi.object({
  day: Joi.string()
    .valid(...DAYS_OF_WEEK)
    .required()
    .messages({
      'any.only': `Day must be one of: ${DAYS_OF_WEEK.join(', ')}`,
      'any.required': 'Day is required'
    }),
  hours: operatingHoursDaySchema.required().messages({
    'any.required': 'Hours configuration is required'
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
    .items(Joi.string().valid('name', 'address', 'city', 'province', 'notes'))
    .optional()
    .default(['name']),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string().valid('createdAt', 'name', 'city', 'province', 'status', 'total_screens', 'total_capacity', 'updatedAt').default('name'),
  sortOrder: Joi.string().valid('asc', 'desc').default('asc'),
  exact: Joi.boolean().default(false),
  caseSensitive: Joi.boolean().default(false),
  status: Joi.string().valid(...THEATER_STATUSES).optional(),
  city: Joi.string().trim().optional(),
  province: Joi.string().trim().optional(),
  minScreens: Joi.number().integer().min(0).optional(),
  maxScreens: Joi.number().integer().min(Joi.ref('minScreens')).optional(),
  minCapacity: Joi.number().integer().min(0).optional(),
  maxCapacity: Joi.number().integer().min(Joi.ref('minCapacity')).optional(),
  hasFeatures: Joi.array().items(Joi.string().valid(...THEATER_FEATURES)).unique().optional(),
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().min(Joi.ref('dateFrom')).optional()
}).messages({
  'number.min': 'maxScreens/maxCapacity must be greater than or equal to minScreens/minCapacity',
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
      'array.min': 'At least one theater ID is required',
      'array.max': 'Cannot delete more than 100 theaters at once',
      'any.required': 'Theater IDs array is required'
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
      'array.min': 'At least one theater ID is required',
      'array.max': 'Cannot update more than 100 theaters at once',
      'any.required': 'Theater IDs array is required'
    }),
  status: Joi.string()
    .valid(...THEATER_STATUSES)
    .required()
    .messages({
      'any.only': `Status must be one of: ${THEATER_STATUSES.join(', ')}`,
      'any.required': 'Status is required'
    })
});

// City/Province theaters query schema
const locationTheatersQuerySchema = Joi.object({
  activeOnly: Joi.string().valid('true', 'false').default('true'),
  includeScreens: Joi.string().valid('true', 'false').default('false'),
  sortBy: Joi.string().valid('name', 'total_screens', 'total_capacity', 'createdAt').default('name'),
  sortOrder: Joi.string().valid('asc', 'desc').default('asc')
});

// Nearby theaters query schema
const nearbyTheatersQuerySchema = Joi.object({
  longitude: Joi.number()
    .min(-180)
    .max(180)
    .required()
    .messages({
      'number.min': 'Longitude must be between -180 and 180',
      'number.max': 'Longitude must be between -180 and 180',
      'any.required': 'Longitude is required'
    }),
  latitude: Joi.number()
    .min(-90)
    .max(90)
    .required()
    .messages({
      'number.min': 'Latitude must be between -90 and 90',
      'number.max': 'Latitude must be between -90 and 90',
      'any.required': 'Latitude is required'
    }),
  maxDistance: Joi.number().positive().default(10000),
  limit: Joi.number().integer().min(1).max(100).default(10),
  activeOnly: Joi.string().valid('true', 'false').default('true')
});

// Theater analytics schema
const analyticsQuerySchema = Joi.object({
  city: Joi.string().trim().optional(),
  province: Joi.string().trim().optional(),
  status: Joi.string().valid(...THEATER_STATUSES).optional(),
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().min(Joi.ref('dateFrom')).optional(),
  groupBy: Joi.string().valid('city', 'province', 'status', 'month', 'week').default('province')
}).messages({
  'date.min': 'dateTo must be greater than or equal to dateFrom'
});

module.exports = {
  // Core CRUD schemas
  createTheaterSchema,
  updateTheaterSchema,
  theaterIdParamSchema,
  getAllTheatersQuerySchema,

  // Parameter schemas
  cityParamSchema,
  provinceParamSchema,

  // Status and management schemas
  updateStatusSchema,
  addScreenSchema,
  removeScreenSchema,
  updateLocationSchema,
  updateOperatingHoursSchema,

  // Search and filtering
  advancedSearchSchema,
  locationTheatersQuerySchema,
  nearbyTheatersQuerySchema,
  analyticsQuerySchema,

  // Batch operations
  batchDeleteSchema,
  batchUpdateStatusSchema,

  // Utility schemas
  paginationSchema,
  contactInfoSchema,
  operatingHoursSchema,
  locationSchema,
  operatingHoursDaySchema,

  // Constants
  THEATER_STATUSES,
  THEATER_FEATURES,
  DAYS_OF_WEEK
};