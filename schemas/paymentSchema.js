const Joi = require("joi");

const paymentIdParamSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid payment ID format",
      "any.required": "Payment ID is required",
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

const transactionIdParamSchema = Joi.object({
  transactionId: Joi.string()
    .required()
    .messages({
      "any.required": "Transaction ID is required",
    }),
});

const createPaymentSchema = Joi.object({
  bookingId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid booking ID format",
      "any.required": "Booking ID is required",
    }),
  amount: Joi.number()
    .min(0)
    .required()
    .messages({
      "number.min": "Amount must be a positive number",
      "any.required": "Amount is required",
    }),
  payment_method: Joi.string()
    .valid("Bakong", "Cash", "Card", "Mobile Banking", "Bank Transfer")
    .required()
    .messages({
      "any.only":
        "Payment method must be one of: Bakong, Cash, Card, Mobile Banking, Bank Transfer",
      "any.required": "Payment method is required",
    }),
  currency: Joi.string()
    .valid("USD", "KHR")
    .default("USD")
    .messages({
      "any.only": "Currency must be either USD or KHR",
    }),
  status: Joi.string()
    .valid("Pending", "Completed", "Failed", "Refunded")
    .default("Pending")
    .messages({
      "any.only": "Status must be one of: Pending, Completed, Failed, Refunded",
    }),
  transaction_id: Joi.string().allow("").optional(),
  description: Joi.string().allow("").optional(),
});

const updatePaymentSchema = Joi.object({
  bookingId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      "string.pattern.base": "Invalid booking ID format",
    }),
  amount: Joi.number().min(0).optional().messages({
    "number.min": "Amount must be a positive number",
  }),
  payment_method: Joi.string()
    .valid("Bakong", "Cash", "Card", "Mobile Banking", "Bank Transfer")
    .optional()
    .messages({
      "any.only":
        "Payment method must be one of: Bakong, Cash, Card, Mobile Banking, Bank Transfer",
    }),
  payment_date: Joi.date().optional(),
  currency: Joi.string().valid("USD", "KHR").optional().messages({
    "any.only": "Currency must be either USD or KHR",
  }),
  status: Joi.string()
    .valid("Pending", "Completed", "Failed", "Refunded")
    .optional()
    .messages({
      "any.only": "Status must be one of: Pending, Completed, Failed, Refunded",
    }),
  transaction_id: Joi.string().allow("").optional(),
  description: Joi.string().allow("").optional(),
}).min(1).messages({
  "object.min": "At least one field must be provided for update",
});

const updatePaymentStatusSchema = Joi.object({
  status: Joi.string()
    .valid("Pending", "Completed", "Failed", "Refunded")
    .required()
    .messages({
      "any.only": "Status must be one of: Pending, Completed, Failed, Refunded",
      "any.required": "Status is required",
    }),
});

const getAllPaymentsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string()
    .valid(
      "amount",
      "payment_method",
      "payment_date",
      "status",
      "createdAt",
      "updatedAt"
    )
    .default("payment_date"),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
  search: Joi.string().allow("").optional(),
  includeDeleted: Joi.boolean().default(false),
  bookingId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      "string.pattern.base": "Invalid booking ID format",
    }),
  status: Joi.string()
    .valid("Pending", "Completed", "Failed", "Refunded")
    .optional(),
  payment_method: Joi.string()
    .valid("Bakong", "Cash", "Card", "Mobile Banking", "Bank Transfer")
    .optional(),
  currency: Joi.string().valid("USD", "KHR").optional(),
  transaction_id: Joi.string().optional(),
  dateFrom: Joi.date().optional(),
  dateTo: Joi.date().optional(),
  amountFrom: Joi.number().min(0).optional(),
  amountTo: Joi.number().min(0).optional(),
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
  paymentIdParamSchema,
  bookingIdParamSchema,
  transactionIdParamSchema,
  createPaymentSchema,
  updatePaymentSchema,
  updatePaymentStatusSchema,
  getAllPaymentsQuerySchema,
  paginationSchema,
};
