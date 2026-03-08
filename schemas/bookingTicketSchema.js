const Joi = require("joi");

const bookingTicketIdParamSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid booking ticket ID format",
      "any.required": "Booking ticket ID is required",
    }),
});

const baseBookingTicketFields = {
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
  price: Joi.number().min(0).required().messages({
    "number.min": "Price must be a positive number",
    "any.required": "Price is required",
  }),
  ticket_type: Joi.string().valid("adult", "child", "vip").required().messages({
    "any.only": "Invalid ticket type",
    "any.required": "Ticket type is required",
  }),
};

const createBookingTicketSchema = Joi.object({
  ...baseBookingTicketFields,
});

const updateBookingTicketSchema = Joi.object({
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
  price: Joi.number().min(0).optional().messages({
    "number.min": "Price must be a positive number",
  }),
  ticket_type: Joi.string().valid("adult", "child", "vip").optional().messages({
    "any.only": "Invalid ticket type",
  }),
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided for update",
  });

const getAllBookingTicketsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string()
    .valid("price", "ticket_type", "createdAt", "updatedAt", "issuedAt")
    .default("issuedAt"),
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
  ticket_type: Joi.string().valid("adult", "child", "vip").optional(),
  startDate: Joi.date().iso().optional().messages({
    "date.format": "Start date must be in ISO format",
  }),
  endDate: Joi.date().iso().min(Joi.ref("startDate")).optional().messages({
    "date.format": "End date must be in ISO format",
    "date.min": "End date must be after start date",
  }),
});

module.exports = {
  bookingTicketIdParamSchema,
  createBookingTicketSchema,
  updateBookingTicketSchema,
  getAllBookingTicketsQuerySchema,
};
