const Joi = require("joi");

const PROMOTION_STATUSES = ["Active", "Inactive", "Expired"];

// MongoDB ObjectId param validation
const promotionIdParamSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid promotion ID format",
      "any.required": "Promotion ID is required",
    }),
});

// Create promotion validation schema
const createPromotionSchema = Joi.object({
  code: Joi.string().trim().min(1).max(100).required().messages({
    "string.empty": "Promotion code is required",
    "string.min": "Promotion code must be at least 1 character",
    "string.max": "Promotion code cannot exceed 100 characters",
    "any.required": "Promotion code is required",
  }),

  title: Joi.string().trim().max(200).allow("").optional().messages({
    "string.max": "Title cannot exceed 200 characters",
  }),

  image_url: Joi.string().trim().uri().allow(null, "").optional().messages({
    "string.uri": "Image URL must be a valid URL",
  }),

  start_date: Joi.date().iso().required().messages({
    "date.base": "Start date must be a valid ISO date",
    "any.required": "Start date is required",
  }),

  end_date: Joi.date().iso().greater(Joi.ref("start_date")).required().messages({
    "date.base": "End date must be a valid ISO date",
    "date.greater": "End date must be after start date",
    "any.required": "End date is required",
  }),

  status: Joi.string()
    .valid(...PROMOTION_STATUSES)
    .default("Inactive")
    .messages({
      "any.only": `Status must be one of: ${PROMOTION_STATUSES.join(", ")}`,
    }),
});

// Update promotion validation schema (all fields optional)
const updatePromotionSchema = Joi.object({
  code: Joi.string().trim().min(1).max(100).messages({
    "string.min": "Promotion code must be at least 1 character",
    "string.max": "Promotion code cannot exceed 100 characters",
  }),

  title: Joi.string().trim().max(200).allow("").messages({
    "string.max": "Title cannot exceed 200 characters",
  }),

  image_url: Joi.string().trim().uri().allow(null, "").messages({
    "string.uri": "Image URL must be a valid URL",
  }),

  start_date: Joi.date().iso().messages({
    "date.base": "Start date must be a valid ISO date",
  }),

  end_date: Joi.date().iso().messages({
    "date.base": "End date must be a valid ISO date",
  }),

  status: Joi.string()
    .valid(...PROMOTION_STATUSES)
    .messages({
      "any.only": `Status must be one of: ${PROMOTION_STATUSES.join(", ")}`,
    }),
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided for update",
  });

// Pagination + filter query schema for getAll
const getAllPromotionsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1).messages({
    "number.base": "Page must be a number",
    "number.integer": "Page must be an integer",
    "number.min": "Page must be at least 1",
  }),

  limit: Joi.number().integer().min(1).max(100).default(10).messages({
    "number.base": "Limit must be a number",
    "number.integer": "Limit must be an integer",
    "number.min": "Limit must be at least 1",
    "number.max": "Limit cannot exceed 100",
  }),

  sortBy: Joi.string()
    .valid("code", "start_date", "end_date", "status", "createdAt", "updatedAt")
    .default("start_date")
    .messages({
      "any.only":
        "sortBy must be one of: code, start_date, end_date, status, createdAt, updatedAt",
    }),

  sortOrder: Joi.string().valid("asc", "desc").default("desc").messages({
    "any.only": "sortOrder must be either asc or desc",
  }),

  search: Joi.string().trim().allow("").optional(),

  status: Joi.string().valid(...PROMOTION_STATUSES).optional().messages({
    "any.only": `Status must be one of: ${PROMOTION_STATUSES.join(", ")}`,
  }),

  startFrom: Joi.date().iso().optional().messages({
    "date.base": "startFrom must be a valid ISO date",
  }),
  startTo: Joi.date().iso().optional().messages({
    "date.base": "startTo must be a valid ISO date",
  }),
  endFrom: Joi.date().iso().optional().messages({
    "date.base": "endFrom must be a valid ISO date",
  }),
  endTo: Joi.date().iso().optional().messages({
    "date.base": "endTo must be a valid ISO date",
  }),

  activeOnly: Joi.boolean().optional().default(false),
});

// Simple reusable pagination schema (if you need it elsewhere)
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
});

// Batch delete promotions schema
const batchDeleteSchema = Joi.object({
  ids: Joi.array()
    .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
    .min(1)
    .max(100)
    .required()
    .messages({
      "array.min": "At least one promotion ID is required",
      "array.max": "Cannot delete more than 100 promotions at once",
      "any.required": "Promotion IDs array is required",
      "string.pattern.base": "Each promotion ID must be a valid ObjectId",
    }),
});

module.exports = {
  PROMOTION_STATUSES,
  promotionIdParamSchema,
  createPromotionSchema,
  updatePromotionSchema,
  getAllPromotionsQuerySchema,
  paginationSchema,
};
