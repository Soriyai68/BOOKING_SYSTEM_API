const Joi = require("joi");

const bookingIdParamSchema = Joi.object({
  id: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid booking ID format",
      "any.required": "Booking ID is required",
    }),
});

const baseBookingFields = {
  showtimeId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .required()
    .messages({
      "string.pattern.base": "Invalid showtime ID format",
      "any.required": "Showtime ID is required",
    }),
  seats: Joi.array()
    .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
    .min(1)
    .required()
    .messages({
      "array.base": "Seats must be an array of seat IDs",
      "array.min": "At least one seat ID is required",
      "string.pattern.base": "Invalid seat ID format in seats array",
      "any.required": "Seats are required",
    }),
  total_price: Joi.number().min(0).required().messages({
    "number.min": "Total price must be a positive number",
    "any.required": "Total price is required",
  }),
  payment_method: Joi.string()
    .valid(
      "Bakong",
      "Cash",
      "Card",
      "Mobile Banking",
      "Bank Transfer",
      "PayAtCinema"
    )
    .required()
    .messages({
      "any.only": "Invalid payment method",
      "any.required": "Payment method is required",
    }),
  noted: Joi.string().allow("").optional(),
};

const createBookingSchema = Joi.alternatives().try(
  // 1. Booking by Customer ID (for registered members)
  Joi.object({
    ...baseBookingFields,
    customerId: Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .messages({
        "string.pattern.base": "Invalid customer ID format",
        "any.required": "customerId is required for member bookings",
      }),
    guestEmail: Joi.forbidden().messages({"any.unknown": "guestEmail is not allowed for customerId bookings."}),
    phone: Joi.forbidden().messages({"any.unknown": "phone is not allowed for customerId bookings."}),
  }),
  // 2. Booking by Guest Email
  Joi.object({
    ...baseBookingFields,
    guestEmail: Joi.string().email().required().messages({
      "string.email": "Invalid email address format for guest booking",
      "any.required": "guestEmail is required for guest bookings",
    }),
    customerId: Joi.forbidden().messages({"any.unknown": "customerId is not allowed for guestEmail bookings."}),
    phone: Joi.forbidden().messages({"any.unknown": "phone is not allowed for guestEmail bookings."}),
  }),
  // 3. Booking by Phone (for walk-in customers)
  Joi.object({
    ...baseBookingFields,
    phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required().messages({
        'string.pattern.base': 'Please enter a valid phone number for the walk-in customer',
        'any.required': 'phone is required for walk-in bookings',
    }),
    customerId: Joi.forbidden().messages({"any.unknown": "customerId is not allowed for phone bookings."}),
    guestEmail: Joi.forbidden().messages({"any.unknown": "guestEmail is not allowed for phone bookings."}),
  })
);

const updateBookingSchema = Joi.object({
  customerId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      "string.pattern.base": "Invalid customer ID format",
    }),
  showtimeId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      "string.pattern.base": "Invalid showtime ID format",
    }),
  seats: Joi.array()
    .items(Joi.string().pattern(/^[0-9a-fA-F]{24}$/))
    .min(1)
    .optional()
    .messages({
      "array.base": "Seats must be an array of seat IDs",
      "array.min": "At least one seat ID is required",
      "string.pattern.base": "Invalid seat ID format in seats array",
    }),
  total_price: Joi.number().min(0).optional().messages({
    "number.min": "Total price must be a positive number",
  }),
  reference_code: Joi.string().optional(),
  payment_id: Joi.string().allow("").optional(),
  payment_status: Joi.string()
    .valid("Pending", "Completed", "Failed", "Refunded")
    .optional()
    .messages({
      "any.only":
        "Payment status must be one of: Pending, Completed, Failed, Refunded",
    }),
  booking_status: Joi.string()
    .valid("Pending", "Confirmed", "Cancelled", "Completed")
    .optional()
    .messages({
      "any.only":
        "Booking status must be one of: Pending, Confirmed, Cancelled, Completed",
    }),
  expired_at: Joi.date().optional(),
  noted: Joi.string().allow("").optional(),
  payment_method: Joi.string()
    .valid("Bakong", "Cash", "Card", "Mobile Banking", "Bank Transfer", "PayAtCinema")
    .optional()
    .messages({
      "any.only": "Invalid payment method",
    }),
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided for update",
  });

const getAllBookingsQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string()
    .valid(
      "booking_date",
      "total_price",
      "seat_count",
      "booking_status",
      "payment_status",
      "createdAt",
      "updatedAt"
    )
    .default("booking_date"),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
  search: Joi.string().allow("").optional(),
  includeDeleted: Joi.boolean().default(false),
  booking_status: Joi.string()
    .valid("Pending", "Confirmed", "Cancelled", "Completed")
    .optional(),
  payment_status: Joi.string()
    .valid("Pending", "Completed", "Failed", "Refunded")
    .optional(),
  customerId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      "string.pattern.base": "Invalid customer ID format",
    }),
  showtimeId: Joi.string()
    .pattern(/^[0-9a-fA-F]{24}$/)
    .optional()
    .messages({
      "string.pattern.base": "Invalid showtime ID format",
    }),
  dateFrom: Joi.date().optional(),
  dateTo: Joi.date().optional(),
});

const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string()
    .valid("booking_date", "deletedAt", "createdAt", "updatedAt")
    .default("deletedAt"),
  sortOrder: Joi.string().valid("asc", "desc").default("desc"),
});

const referenceCodeParamSchema = Joi.object({
  reference_code: Joi.string().required().messages({
    "any.required": "Reference code is required",
  }),
});

module.exports = {
  bookingIdParamSchema,
  createBookingSchema,
  updateBookingSchema,
  getAllBookingsQuerySchema,
  paginationSchema,
  referenceCodeParamSchema,
};
