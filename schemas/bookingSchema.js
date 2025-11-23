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

const createBookingSchema = Joi.object({
    userId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
            "string.pattern.base": "Invalid user ID format",
            "any.required": "User ID is required",
        }),
    showtimeId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .required()
        .messages({
            "string.pattern.base": "Invalid showtime ID format",
            "any.required": "Showtime ID is required",
        }),
    total_price: Joi.number()
        .min(0)
        .required()
        .messages({
            "number.min": "Total price must be a positive number",
            "any.required": "Total price is required",
        }),
    seat_count: Joi.number()
        .integer()
        .min(1)
        .required()
        .messages({
            "number.integer": "Seat count must be an integer",
            "number.min": "Seat count must be at least 1",
            "any.required": "Seat count is required",
        }),
    reference_code: Joi.string()
        .optional(),
    payment_id: Joi.string().allow("").optional(),
    payment_status: Joi.string()
        .valid("Pending", "Completed", "Failed")
        .default("Pending")
        .messages({
            "any.only": "Payment status must be one of: Pending, Completed, Failed",
        }),
    booking_status: Joi.string()
        .valid("Confirmed", "Cancelled", "Completed")
        .default("Confirmed")
        .messages({
            "any.only": "Booking status must be one of: Confirmed, Cancelled, Completed",
        }),
    expired_at: Joi.date()
        .optional(),
    noted: Joi.string().allow("").optional(),
    payment_method: Joi.string()
        .valid('Bakong', 'Cash', 'Card', 'Mobile Banking', 'Bank Transfer')
        .required()
        .messages({
            "any.only": "Payment method must be one of: Bakong, Cash, Card, Mobile Banking, Bank Transfer",
            "any.required": "Payment method is required",
        }),
});

const updateBookingSchema = Joi.object({
    userId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .optional()
        .messages({
            "string.pattern.base": "Invalid user ID format",
        }),
    showtimeId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .optional()
        .messages({
            "string.pattern.base": "Invalid showtime ID format",
        }),
    total_price: Joi.number().min(0).optional().messages({
        "number.min": "Total price must be a positive number",
    }),
    seat_count: Joi.number().integer().min(1).optional().messages({
        "number.integer": "Seat count must be an integer",
        "number.min": "Seat count must be at least 1",
    }),
    reference_code: Joi.string().optional(),
    payment_id: Joi.string().allow("").optional(),
    payment_status: Joi.string()
        .valid("Pending", "Completed", "Failed")
        .optional()
        .messages({
            "any.only": "Payment status must be one of: Pending, Completed, Failed",
        }),
    booking_status: Joi.string()
        .valid("Confirmed", "Cancelled", "Completed")
        .optional()
        .messages({
            "any.only": "Booking status must be one of: Confirmed, Cancelled, Completed",
        }),
    expired_at: Joi.date().optional(),
    noted: Joi.string().allow("").optional(),
}).min(1).messages({
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
        .valid("Confirmed", "Cancelled", "Completed")
        .optional(),
    payment_status: Joi.string()
        .valid("Pending", "Completed", "Failed")
        .optional(),
    userId: Joi.string()
        .pattern(/^[0-9a-fA-F]{24}$/)
        .optional()
        .messages({
            "string.pattern.base": "Invalid user ID format",
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
