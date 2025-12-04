const Joi = require("joi");
const Providers = require("../data/providers");

// ------------------------
// CREATE CUSTOMER
// ------------------------
const createCustomerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).required().messages({
    "string.empty": "Name is required",
    "string.min": "Name must be at least 2 characters",
    "string.max": "Name cannot exceed 50 characters",
  }),

  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required()
    .messages({
      "string.pattern.base": "Please enter a valid phone number",
      "any.required": "Phone number is required",
    }),

  // Optional username login
  username: Joi.string().trim().lowercase().min(3).max(30).optional().messages({
    "string.min": "Username must be at least 3 characters",
    "string.max": "Username cannot exceed 30 characters",
  }),

  // Password required only if username login is used
  password: Joi.string().min(6).optional().messages({
    "string.min": "Password must be at least 6 characters",
  }),

  provider: Joi.string()
    .valid(Providers.PHONE)
    .default(Providers.PHONE)
    .messages({
      "any.only": "Provider must be phone",
    }),

  isVerified: Joi.boolean().default(false),
  isActive: Joi.boolean().default(true),
});

// ------------------------
// UPDATE CUSTOMER
// ------------------------
const updateCustomerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(50).messages({
    "string.min": "Name must be at least 2 characters",
    "string.max": "Name cannot exceed 50 characters",
  }),

  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .messages({
      "string.pattern.base": "Please enter a valid phone number",
    }),

  username: Joi.string().trim().lowercase().min(3).max(30).optional().messages({
    "string.min": "Username must be at least 3 characters",
    "string.max": "Username cannot exceed 30 characters",
  }),

  password: Joi.string().min(6).optional().messages({
    "string.min": "Password must be at least 6 characters",
  }),

  isVerified: Joi.boolean(),
  isActive: Joi.boolean(),
  lastLogin: Joi.date(),
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided for update",
  });

// ------------------------
// PHONE OTP SCHEMAS
// ------------------------
const sendOTPSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required()
    .messages({
      "string.pattern.base": "Please enter a valid phone number",
      "any.required": "Phone number is required",
    }),
});

const verifyOTPSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required()
    .messages({
      "string.pattern.base": "Please enter a valid phone number",
      "any.required": "Phone number is required",
    }),
  otp: Joi.string()
    .length(6)
    .pattern(/^\d{6}$/)
    .required()
    .messages({
      "string.length": "OTP must be 6 digits",
      "string.pattern.base": "OTP must contain only numbers",
      "any.required": "OTP is required",
    }),
  name: Joi.string().min(2).max(50).trim().optional().messages({
    "string.min": "Name must be at least 2 characters",
    "string.max": "Name cannot exceed 50 characters",
  }),
});

// ------------------------
// PARAMETER SCHEMAS
// ------------------------
const customerIdParamSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid customer ID format",
      "any.required": "Customer ID is required",
    }),
});

const phoneParamSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required()
    .messages({
      "string.pattern.base": "Please enter a valid phone number",
      "any.required": "Phone number is required",
    }),
});

// ------------------------
// QUERY SCHEMAS
// ------------------------
const getCustomersQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  search: Joi.string().trim().max(100).optional(),
  provider: Joi.string()
    .valid(...Object.values(Providers))
    .optional(),
  status: Joi.string().valid("true", "false").optional(),
});

const searchCustomersQuerySchema = Joi.object({
  q: Joi.string().trim().min(1).max(100).required().messages({
    "string.empty": "Search term is required",
    "string.min": "Search term must be at least 1 character",
    "any.required": "Search term is required",
  }),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
});

// ------------------------
// BATCH DELETE SCHEMA
// ------------------------
const batchDeleteSchema = Joi.object({
  ids: Joi.array()
    .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
    .min(1)
    .max(100)
    .required()
    .messages({
      "array.min": "At least one customer ID is required",
      "array.max": "Cannot delete more than 100 customers at once",
      "any.required": "Customer IDs array is required",
    }),
  permanent: Joi.boolean().default(false),
});

module.exports = {
  createCustomerSchema,
  updateCustomerSchema,
  sendOTPSchema,
  verifyOTPSchema,
  customerIdParamSchema,
  phoneParamSchema,
  getCustomersQuerySchema,
  searchCustomersQuerySchema,
  batchDeleteSchema,
};
