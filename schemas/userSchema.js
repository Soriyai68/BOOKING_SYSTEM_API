const Joi = require('joi');
const { Role } = require('../data');
const Providers = require('../data/providers');

const createUserSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .required()
    .messages({
      'string.empty': 'Name is required',
      'string.min': 'Name must be at least 2 characters',
      'string.max': 'Name cannot exceed 50 characters'
    }),
  
  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required()
    .messages({
      'string.pattern.base': 'Please enter a valid phone number',
      'any.required': 'Phone number is required'
    }),
  
  // Password required for all roles except 'user'
  password: Joi.string()
    .min(6)
    .when('role', {
      is: Joi.string().valid('user'),
      then: Joi.optional(),
      otherwise: Joi.required()
    })
    .messages({
      'string.min': 'Password must be at least 6 characters',
      'any.required': 'Password is required for this role (non-user)'
    }),
  
  role: Joi.string()
    .trim()
    .lowercase()
    .default('user'),
  
  provider: Joi.string()
    .valid(Providers.PHONE)
    .default(Providers.PHONE)
    .messages({
      'any.only': 'Provider must be phone'
    }),
  
  isVerified: Joi.boolean().default(false),
  
  isActive: Joi.boolean().default(true)
});

const updateUserSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .messages({
      'string.min': 'Name must be at least 2 characters',
      'string.max': 'Name cannot exceed 50 characters'
    }),
  
  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .messages({
      'string.pattern.base': 'Please enter a valid phone number'
    }),
  
  // Add password field for updates (optional)
  password: Joi.string()
    .min(6)
    .optional()
    .messages({
      'string.min': 'Password must be at least 6 characters'
    }),
  
  role: Joi.string()
    .trim()
    .lowercase(),
  
  isActive: Joi.boolean(),
  
  // Add isVerified field for updates
  isVerified: Joi.boolean(),
  
  lastLogin: Joi.date()
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

// Phone OTP schemas (from authSchema.js)
const sendOTPSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required()
    .messages({
      'string.pattern.base': 'Please enter a valid phone number',
      'any.required': 'Phone number is required'
    })
});

const verifyOTPSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required()
    .messages({
      'string.pattern.base': 'Please enter a valid phone number',
      'any.required': 'Phone number is required'
    }),
  otp: Joi.string()
    .length(6)
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      'string.length': 'OTP must be 6 digits',
      'string.pattern.base': 'OTP must contain only numbers',
      'any.required': 'OTP is required'
    }),
  name: Joi.string()
    .min(2)
    .max(50)
    .trim()
    .optional()
    .messages({
      'string.min': 'Name must be at least 2 characters',
      'string.max': 'Name cannot exceed 50 characters'
    })
});

// Parameter validation schemas
const userIdParamSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/) 
    .required()
    .messages({
      'string.pattern.base': 'Invalid user ID format',
      'any.required': 'User ID is required'
    })
});

// Also add userId version for session routes
const userIdSessionParamSchema = Joi.object({
  userId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/) 
    .required()
    .messages({
      'string.pattern.base': 'Invalid user ID format',
      'any.required': 'User ID is required'
    })
});
const phoneParamSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required()
    .messages({
      'string.pattern.base': 'Please enter a valid phone number',
      'any.required': 'Phone number is required'
    })
});

const roleParamSchema = Joi.object({
  role: Joi.string()
    .trim()
    .lowercase()
    .required()
});

// Query validation schemas
const getUsersQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().trim().max(100).optional(),
  role: Joi.string().valid(...Object.values(Role)).optional(),
  provider: Joi.string().valid(...Object.values(Providers)).optional(),
  status: Joi.string().valid('true', 'false').optional()
});

const searchUsersQuerySchema = Joi.object({
  q: Joi.string().trim().min(1).max(100).required().messages({
    'string.empty': 'Search term is required',
    'string.min': 'Search term must be at least 1 character',
    'any.required': 'Search term is required'
  }),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
});

// Add these new schemas at the end before module.exports

// Activate/Deactivate user schema
const activateUserSchema = Joi.object({
  isActive: Joi.boolean().required().messages({
    'any.required': 'isActive field is required',
    'boolean.base': 'isActive must be a boolean value'
  })
});

// Session data schema
const sessionSchema = Joi.object({
  sessionId: Joi.string().required(),
  loginTime: Joi.date().default(Date.now),
  ipAddress: Joi.string().ip().optional(),
  userAgent: Joi.string().optional(),
  expiresAt: Joi.date().optional()
}).unknown(true);

// Pagination schema (reusable)
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10)
});

// Batch delete schema
const batchDeleteSchema = Joi.object({
  ids: Joi.array()
    .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
    .min(1)
    .max(100)
    .required()
    .messages({
      'array.min': 'At least one user ID is required',
      'array.max': 'Cannot delete more than 100 users at once',
      'any.required': 'User IDs array is required'
    }),
  permanent: Joi.boolean().default(false)
});

// Advanced search schema
const advancedSearchSchema = Joi.object({
  query: Joi.string().trim().min(1).max(100).required().messages({
    'string.empty': 'Search query is required',
    'string.min': 'Search query must be at least 1 character',
    'any.required': 'Search query is required'
  }),
  fields: Joi.array()
    .items(Joi.string().valid('name', 'phone'))
    .optional()
    .default(['name', 'phone']),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string().valid('createdAt', 'name', 'phone', 'lastLogin', 'updatedAt').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  exact: Joi.boolean().default(false),
  caseSensitive: Joi.boolean().default(false),
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().min(Joi.ref('dateFrom')).optional(),
  role: Joi.string().trim().lowercase().optional(),
  provider: Joi.string().valid(...Object.values(Providers)).optional(),
  isActive: Joi.boolean().optional(),
  isVerified: Joi.boolean().optional()
}).messages({
  'date.min': 'dateTo must be greater than or equal to dateFrom'
});

// Enhanced query schema for getAll
const getAllUsersQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string().valid('createdAt', 'name', 'phone', 'lastLogin', 'updatedAt', 'role').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  search: Joi.string().trim().max(100).optional(),
  role: Joi.string().trim().lowercase().optional(),
  provider: Joi.string().valid(...Object.values(Providers)).optional(),
  status: Joi.string().valid('true', 'false').optional(),
  isVerified: Joi.string().valid('true', 'false').optional(),
  includeDeleted: Joi.string().valid('true', 'false').default('false'),
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().min(Joi.ref('dateFrom')).optional()
}).messages({
  'date.min': 'dateTo must be greater than or equal to dateFrom'
});

// Refresh token schema
const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    'string.empty': 'Refresh token is required',
    'any.required': 'Refresh token is required'
  })
});

// Logout schema
const logoutSchema = Joi.object({
  sessionId: Joi.string().optional().messages({
    'string.empty': 'Session ID cannot be empty'
  })
});

// Session ID param schema
const sessionIdParamSchema = Joi.object({
  sessionId: Joi.string().required().messages({
    'string.empty': 'Session ID is required',
    'any.required': 'Session ID is required'
  })
});

module.exports = {
  // Core CRUD schemas
  createUserSchema,
  updateUserSchema,
  userIdParamSchema,
  getAllUsersQuerySchema,
  batchDeleteSchema,
  advancedSearchSchema,
  
  
  // Parameter schemas
  userIdSessionParamSchema,
  phoneParamSchema,
  roleParamSchema,
  sessionIdParamSchema,
  
  // Query schemas
  getUsersQuerySchema, // Keep for backward compatibility
  searchUsersQuerySchema,
  
  // Utility schemas
  activateUserSchema,
  sessionSchema,
  paginationSchema
};
