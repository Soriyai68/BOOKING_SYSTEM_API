const Joi = require("joi");

const bookingDetailIdParamSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid booking detail ID format",
      "any.required": "Booking detail ID is required",
    }),
});

const bookingIdParamSchema = Joi.object({
  bookingId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid booking ID format",
      "any.required": "Booking ID is required",
    }),
});

const createBookingDetailSchema = Joi.object({
  bookingId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid booking ID format",
      "any.required": "Booking ID is required",
    }),
  seatId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid seat ID format",
      "any.required": "Seat ID is required",
    }),
  row_label: Joi.string()
    .required()
    .messages({
      "any.required": "Row label is required",
    }),
  seat_number: Joi.number()
    .integer()
    .min(1)
    .required()
    .messages({
      "number.integer": "Seat number must be an integer",
      "number.min": "Seat number must be at least 1",
      "any.required": "Seat number is required",
    }),
  seat_type: Joi.string()
    .valid("Standard", "VIP", "Premium", "Couple")
    .required()
    .messages({
      "any.only": "Seat type must be one of: Standard, VIP, Premium, Couple",
      "any.required": "Seat type is required",
    }),
  price: Joi.number()
    .min(0)
    .required()
    .messages({
      "number.min": "Price must be a positive number",
      "any.required": "Price is required",
    }),
});

const createBulkBookingDetailsSchema = Joi.object({
  bookingId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid booking ID format",
      "any.required": "Booking ID is required",
    }),
  seats: Joi.array()
    .items(
      Joi.object({
        seatId: Joi.string()
          .pattern(/^[0-9a-fA-F]{24}$/)
          .required()
          .messages({
            "string.pattern.base": "Invalid seat ID format",
            "any.required": "Seat ID is required",
          }),
        row_label: Joi.string().required().messages({
          "any.required": "Row label is required",
        }),
        seat_number: Joi.number().integer().min(1).required().messages({
          "number.integer": "Seat number must be an integer",
          "number.min": "Seat number must be at least 1",
          "any.required": "Seat number is required",
        }),
        seat_type: Joi.string()
          .valid("Standard", "VIP", "Premium", "Couple")
          .required()
          .messages({
            "any.only":
              "Seat type must be one of: Standard, VIP, Premium, Couple",
            "any.required": "Seat type is required",
          }),
        price: Joi.number().min(0).required().messages({
          "number.min": "Price must be a positive number",
          "any.required": "Price is required",
        }),
      })
    )
    .min(1)
    .required()
    .messages({
      "array.min": "At least one seat is required",
      "any.required": "Seats array is required",
    }),
});

const updateBookingDetailSchema = Joi.object({
  bookingId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      "string.pattern.base": "Invalid booking ID format",
    }),
  seatId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      "string.pattern.base": "Invalid seat ID format",
    }),
  row_label: Joi.string().optional(),
  seat_number: Joi.number().integer().min(1).optional().messages({
    "number.integer": "Seat number must be an integer",
    "number.min": "Seat number must be at least 1",
  }),
  seat_type: Joi.string()
    .valid("Standard", "VIP", "Premium", "Couple")
    .optional()
    .messages({
      "any.only": "Seat type must be one of: Standard, VIP, Premium, Couple",
    }),
  price: Joi.number().min(0).optional().messages({
    "number.min": "Price must be a positive number",
  }),
}).min(1).messages({
  "object.min": "At least one field must be provided for update",
});

const deleteBulkSchema = Joi.object({
  ids: Joi.array()
    .items(
      Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .messages({
          "string.pattern.base": "Invalid booking detail ID format",
        })
    )
    .min(1)
    .required()
    .messages({
      "array.min": "At least one ID is required",
      "any.required": "IDs array is required",
    }),
});

const getAllBookingDetailsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string()
    .valid(
      "row_label",
      "seat_number",
      "seat_type",
      "price",
      "createdAt",
      "updatedAt"
    )
    .default("createdAt"),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
  search: Joi.string().allow("").optional(),
  includeDeleted: Joi.boolean().default(false),
  bookingId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      "string.pattern.base": "Invalid booking ID format",
    }),
  seatId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      "string.pattern.base": "Invalid seat ID format",
    }),
  seat_type: Joi.string()
    .valid("Standard", "VIP", "Premium", "Couple")
    .optional(),
  row_label: Joi.string().optional(),
});

const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string()
    .valid("deletedAt", "createdAt", "updatedAt")
    .default("deletedAt"),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
});

module.exports = {
  bookingDetailIdParamSchema,
  bookingIdParamSchema,
  createBookingDetailSchema,
  createBulkBookingDetailsSchema,
  updateBookingDetailSchema,
  deleteBulkSchema,
  getAllBookingDetailsQuerySchema,
  paginationSchema,
};
