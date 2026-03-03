const Joi = require("joi");
const Providers = require("../data/providers");

// ------------------------
// CREATE CUSTOMER
// ------------------------
// Base fields for reuse
const baseCustomerFields = {
  username: Joi.string()
    .trim()
    .lowercase()
    .min(3)
    .max(30)
    .optional()
    .empty(["", null])
    .messages({
      "string.min": "Username must be at least 3 characters",
      "string.max": "Username cannot exceed 30 characters",
    }),
  password: Joi.string().min(6).optional().messages({
    "string.min": "Password must be at least 6 characters",
  }),
  isVerified: Joi.boolean().default(false),
  isActive: Joi.boolean().default(true),
};

const createCustomerSchema = Joi.alternatives().try(
  // Schema for 'member'
  Joi.object({
    customerType: Joi.string().valid("member").required(),
    name: Joi.string().trim().min(2).max(50).optional().empty(["", null]),
    phone: Joi.string()
      .pattern(/^\+?\d{1,15}$/)
      .optional()
      .empty(["", null])
      .messages({
        "string.pattern.base": "Please enter a valid phone number",
      }),
    email: Joi.string().email().optional().empty(["", null]).messages({
      "string.email": "Please enter a valid email address",
    }),
    provider: Joi.string().valid(Providers.PHONE).default(Providers.PHONE),
    ...baseCustomerFields,
  }),
  // Schema for 'walkin'
  Joi.object({
    customerType: Joi.string().valid("walkin").required(),
    name: Joi.string().trim().min(2).max(50).optional().empty(["", null]),
    phone: Joi.string()
      .pattern(/^\+?\d{1,15}$/)
      .optional()
      .empty(["", null])
      .messages({
        "string.pattern.base": "Please enter a valid phone number",
      }),
    email: Joi.string().email().optional().empty(["", null]).messages({
      "string.email": "Please enter a valid email address",
    }),
    provider: Joi.string().valid(Providers.PHONE).default(Providers.PHONE),
    ...baseCustomerFields,
  }),
  // Schema for 'guest'
  Joi.object({
    customerType: Joi.string().valid("guest").required(),
    name: Joi.string().trim().min(2).max(50).optional().empty(["", null]),
    phone: Joi.string()
      .pattern(/^\+?\d{1,15}$/)
      .optional()
      .empty(["", null]),
    email: Joi.string().email().optional().empty(["", null]).messages({
      "string.email": "Please enter a valid email address",
    }),
    provider: Joi.string().valid(Providers.EMAIL).default(Providers.EMAIL),
    ...baseCustomerFields,
  }),
);

// ------------------------
// UPDATE CUSTOMER
// ------------------------
// Simple flat schema for updates to allow partial updates of any fields
const updateCustomerSchema = Joi.object({
  customerType: Joi.string().valid("member", "walkin", "guest").optional(),
  name: Joi.string().trim().min(2).max(50).optional().empty(["", null]),
  phone: Joi.string()
    .pattern(/^\+?\d{1,15}$/)
    .optional()
    .empty(["", null])
    .messages({
      "string.pattern.base": "Please enter a valid phone number",
    }),
  email: Joi.string().email().optional().empty(["", null]).messages({
    "string.email": "Please enter a valid email address",
  }),
  username: Joi.string()
    .trim()
    .lowercase()
    .min(3)
    .max(30)
    .optional()
    .empty(["", null]),
  password: Joi.string().min(6).optional().empty(["", null]),
  isActive: Joi.boolean().optional(),
  isVerified: Joi.boolean().optional(),
  provider: Joi.string()
    .valid(...Object.values(Providers))
    .optional(),
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
