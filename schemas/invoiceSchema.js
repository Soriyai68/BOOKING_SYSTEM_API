const Joi = require("joi");

const invoiceIdParamSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid invoice ID format",
      "any.required": "Invoice ID is required",
    }),
});

const invoiceNumberParamSchema = Joi.object({
  invoiceNumber: Joi.string()
    .required()
    .messages({
      "any.required": "Invoice number is required",
    }),
});

const createInvoiceSchema = Joi.object({
  paymentId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid payment ID format",
      "any.required": "Payment ID is required",
    }),
  invoice_number: Joi.string()
    .required()
    .messages({
      "any.required": "Invoice number is required",
    }),
  qr: Joi.string()
    .required()
    .messages({
      "any.required": "QR code is required",
    }),
  cashierId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid cashier ID format",
      "any.required": "Cashier ID is required",
    }),
  location: Joi.string()
    .required()
    .messages({
      "any.required": "Location is required",
    }),
  currency: Joi.string()
    .valid("USD", "KHR")
    .default("USD")
    .messages({
      "any.only": "Currency must be either USD or KHR",
    }),
  amount: Joi.number()
    .min(0)
    .required()
    .messages({
      "number.min": "Amount must be a positive number",
      "any.required": "Amount is required",
    }),
  description: Joi.string().allow("").optional(),
  paid: Joi.boolean().default(false),
  tracking_status: Joi.string()
    .valid("Waiting", "Acknowledged", "Paid", "Verified", "Seen")
    .default("Waiting")
    .messages({
      "any.only":
        "Tracking status must be one of: Waiting, Acknowledged, Paid, Verified, Seen",
    }),
});

const updateInvoiceSchema = Joi.object({
  paymentId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      "string.pattern.base": "Invalid payment ID format",
    }),
  invoice_number: Joi.string().optional(),
  qr: Joi.string().optional(),
  cashierId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      "string.pattern.base": "Invalid cashier ID format",
    }),
  location: Joi.string().optional(),
  currency: Joi.string().valid("USD", "KHR").optional().messages({
    "any.only": "Currency must be either USD or KHR",
  }),
  amount: Joi.number().min(0).optional().messages({
    "number.min": "Amount must be a positive number",
  }),
  description: Joi.string().allow("").optional(),
  paid: Joi.boolean().optional(),
  tracking_status: Joi.string()
    .valid("Waiting", "Acknowledged", "Paid", "Verified", "Seen")
    .optional()
    .messages({
      "any.only":
        "Tracking status must be one of: Waiting, Acknowledged, Paid, Verified, Seen",
    }),
  acknowledged_at: Joi.date().optional(),
  paid_at: Joi.date().optional(),
}).min(1).messages({
  "object.min": "At least one field must be provided for update",
});

const updateInvoiceStatusSchema = Joi.object({
  tracking_status: Joi.string()
    .valid("Waiting", "Acknowledged", "Paid", "Verified", "Seen")
    .optional()
    .messages({
      "any.only":
        "Tracking status must be one of: Waiting, Acknowledged, Paid, Verified, Seen",
    }),
  paid: Joi.boolean().optional(),
}).min(1).messages({
  "object.min": "At least one field (tracking_status or paid) must be provided",
});

const getAllInvoicesQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string()
    .valid(
      "invoice_number",
      "amount",
      "tracking_status",
      "paid",
      "createdAt",
      "updatedAt",
      "paid_at"
    )
    .default("createdAt"),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
  search: Joi.string().allow("").optional(),
  includeDeleted: Joi.boolean().default(false),
  paymentId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      "string.pattern.base": "Invalid payment ID format",
    }),
  cashierId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      "string.pattern.base": "Invalid cashier ID format",
    }),
  tracking_status: Joi.string()
    .valid("Waiting", "Acknowledged", "Paid", "Verified", "Seen")
    .optional(),
  currency: Joi.string().valid("USD", "KHR").optional(),
  paid: Joi.boolean().optional(),
  location: Joi.string().optional(),
  dateFrom: Joi.date().optional(),
  dateTo: Joi.date().optional(),
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
  invoiceIdParamSchema,
  invoiceNumberParamSchema,
  createInvoiceSchema,
  updateInvoiceSchema,
  updateInvoiceStatusSchema,
  getAllInvoicesQuerySchema,
  paginationSchema,
};
