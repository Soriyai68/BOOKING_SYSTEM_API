const Joi = require("joi");

// const SEAT_TYPES = ['standard', 'premium', 'vip', 'wheelchair', 'recliner'];
const SEAT_TYPES = ["regular", "vip", "couple", "queen"];
const SEAT_STATUSES = ["active", "maintenance", "out_of_order", "reserved", "closed"];

const createSeatSchema = Joi.object({
  row: Joi.string()
    .trim()
    .uppercase()
    .min(1)
    .max(5)
    .pattern(/^[A-Z][A-Z0-9]*$/)
    .required()
    .messages({
      "string.empty": "Row is required",
      "string.min": "Row must be at least 1 character",
      "string.max": "Row cannot exceed 5 characters",
      "string.pattern.base":
        "Row must start with a letter and contain only letters and numbers",
      "any.required": "Row is required",
    }),

  seat_number: Joi.array()
    .items(
      Joi.string()
        .trim()
        .uppercase()
        .min(1)
        .max(10)
        .pattern(/^[A-Z0-9]+$/)
    )
    .min(1)
    .max(10) // Limit to 10 seats per entry
    .unique()
    .required()
    .messages({
      "string.min": "Each seat number must be at least 1 character",
      "string.max": "Each seat number cannot exceed 10 characters",
      "string.pattern.base": "Each seat number must contain only letters and numbers",
      "array.base": "Seat number must be an array",
      "array.min": "At least one seat number is required",
      "array.max": "Cannot have more than 10 seat numbers per entry",
      "array.unique": "Duplicate seat numbers are not allowed",
      "any.required": "Seat number is required",
    }),

  seat_type: Joi.string()
    .valid(...SEAT_TYPES)
    .default("standard")
    .messages({
      "any.only": `Seat type must be one of: ${SEAT_TYPES.join(", ")}`,
    }),

  status: Joi.string()
    .valid(...SEAT_STATUSES)
    .default("active")
    .messages({
      "any.only": `Status must be one of: ${SEAT_STATUSES.join(", ")}`,
    }),

  price: Joi.number().min(0).precision(2).default(0).messages({
    "number.min": "Price cannot be negative",
  }),

  notes: Joi.string().trim().max(500).allow("").optional().messages({
    "string.max": "Notes cannot exceed 500 characters",
  }),
});

const updateSeatSchema = Joi.object({
  row: Joi.string()
    .trim()
    .uppercase()
    .min(1)
    .max(5)
    .pattern(/^[A-Z][A-Z0-9]*$/)
    .messages({
      "string.min": "Row must be at least 1 character",
      "string.max": "Row cannot exceed 5 characters",
      "string.pattern.base":
        "Row must start with a letter and contain only letters and numbers",
    }),

  seat_number: Joi.array()
    .items(
      Joi.string()
        .trim()
        .uppercase()
        .min(1)
        .max(10)
        .pattern(/^[A-Z0-9]+$/)
    )
    .min(1)
    .max(10)
    .unique()
    .messages({
      "string.min": "Each seat number must be at least 1 character",
      "string.max": "Each seat number cannot exceed 10 characters",
      "string.pattern.base": "Each seat number must contain only letters and numbers",
      "array.base": "Seat number must be an array",
      "array.min": "At least one seat number is required",
      "array.max": "Cannot have more than 10 seat numbers per entry",
      "array.unique": "Duplicate seat numbers are not allowed",
    }),

  seat_type: Joi.string()
    .valid(...SEAT_TYPES)
    .messages({
      "any.only": `Seat type must be one of: ${SEAT_TYPES.join(", ")}`,
    }),

  status: Joi.string()
    .valid(...SEAT_STATUSES)
    .messages({
      "any.only": `Status must be one of: ${SEAT_STATUSES.join(", ")}`,
    }),

  price: Joi.number().min(0).precision(2).messages({
    "number.min": "Price cannot be negative",
  }),

  notes: Joi.string().trim().max(500).allow("").optional().messages({
    "string.max": "Notes cannot exceed 500 characters",
  }),
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided for update",
  });

// Parameter validation schemas
const seatIdParamSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid seat ID format",
      "any.required": "Seat ID is required",
    }),
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
      "string.pattern.base":
        "Row must start with a letter and contain only letters and numbers",
      "any.required": "Row is required",
    }),
});

const seatTypeParamSchema = Joi.object({
  type: Joi.string()
    .valid(...SEAT_TYPES)
    .required()
    .messages({
      "any.only": `Seat type must be one of: ${SEAT_TYPES.join(", ")}`,
      "any.required": "Seat type is required",
    }),
});

// Query validation schemas
const getAllSeatsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string()
    .valid(
      "createdAt",
      "row",
      "seat_number",
      "seat_type",
      "status",
      "price",
      "updatedAt"
    )
    .default("row"),
  sortOrder: Joi.string().valid("asc", "desc").default("asc"),
  search: Joi.string().trim().max(100).optional(),
  seat_type: Joi.string()
    .valid(...SEAT_TYPES)
    .optional(),
  status: Joi.string()
    .valid(...SEAT_STATUSES)
    .optional(),
  includeDeleted: Joi.string().valid("true", "false").default("false"),
  priceMin: Joi.number().min(0).optional(),
  priceMax: Joi.number().min(Joi.ref("priceMin")).optional(),
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().min(Joi.ref("dateFrom")).optional(),
}).messages({
  "number.min": "priceMax must be greater than or equal to priceMin",
  "date.min": "dateTo must be greater than or equal to dateFrom",
});

// Status update schema
const updateStatusSchema = Joi.object({
  status: Joi.string()
    .valid(...SEAT_STATUSES)
    .required()
    .messages({
      "any.only": `Status must be one of: ${SEAT_STATUSES.join(", ")}`,
      "any.required": "Status is required",
    }),
});

// Pagination schema (reusable)
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
});

// Advanced search schema
const advancedSearchSchema = Joi.object({
  query: Joi.string().trim().min(1).max(100).required().messages({
    "string.empty": "Search query is required",
    "string.min": "Search query must be at least 1 character",
    "any.required": "Search query is required",
  }),
  fields: Joi.array()
    .items(Joi.string().valid("row", "seat_number", "seat_type", "notes"))
    .optional()
    .default(["row", "seat_number"]),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string()
    .valid(
      "createdAt",
      "row",
      "seat_number",
      "seat_type",
      "status",
      "price",
      "updatedAt"
    )
    .default("row"),
  sortOrder: Joi.string().valid("asc", "desc").default("asc"),
  exact: Joi.boolean().default(false),
  caseSensitive: Joi.boolean().default(false),
  seat_type: Joi.string()
    .valid(...SEAT_TYPES)
    .optional(),
  status: Joi.string()
    .valid(...SEAT_STATUSES)
    .optional(),
  priceMin: Joi.number().min(0).optional(),
  priceMax: Joi.number().min(Joi.ref("priceMin")).optional(),
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().min(Joi.ref("dateFrom")).optional(),
}).messages({
  "number.min": "priceMax must be greater than or equal to priceMin",
  "date.min": "dateTo must be greater than or equal to dateFrom",
});

// Batch operations schema
const batchDeleteSchema = Joi.object({
  ids: Joi.array()
    .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
    .min(1)
    .max(100)
    .required()
    .messages({
      "array.min": "At least one seat ID is required",
      "array.max": "Cannot delete more than 100 seats at once",
      "any.required": "Seat IDs array is required",
    }),
  permanent: Joi.boolean().default(false),
});

const batchUpdateStatusSchema = Joi.object({
  ids: Joi.array()
    .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
    .min(1)
    .max(100)
    .required()
    .messages({
      "array.min": "At least one seat ID is required",
      "array.max": "Cannot update more than 100 seats at once",
      "any.required": "Seat IDs array is required",
    }),
  status: Joi.string()
    .valid(...SEAT_STATUSES)
    .required()
    .messages({
      "any.only": `Status must be one of: ${SEAT_STATUSES.join(", ")}`,
      "any.required": "Status is required",
    }),
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

  // Search and filtering
  advancedSearchSchema,

  // Batch operations
  batchDeleteSchema,
  batchUpdateStatusSchema,

  // Utility schemas
  paginationSchema,

  // Constants
  SEAT_TYPES,
  SEAT_STATUSES,
};
