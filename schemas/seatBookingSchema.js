const Joi = require('joi');

const showtimeIdParam = Joi.object({
    id: Joi.string().hex().length(24).required()
});

const lockSeatsBody = Joi.object({
    showtimeId: Joi.string().hex().length(24).required(),
    seatIds: Joi.array().items(Joi.string().hex().length(24)).min(1).required()
});

const extendLockBody = Joi.object({
    seatBookingIds: Joi.array().items(Joi.string().hex().length(24)).min(1).required()
});

const getAllQuery = Joi.object({
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).optional(),
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid('asc', 'desc').optional(),
    search: Joi.string().optional().allow(''),
    showtimeId: Joi.string().hex().length(24).optional(),
    seatId: Joi.string().hex().length(24).optional(),
    bookingId: Joi.string().hex().length(24).optional(),
    status: Joi.string().optional(),
    seat_type: Joi.string().valid("regular", "vip", "couple", "queen").optional(),
});

module.exports = {
    showtimeIdParam,
    lockSeatsBody,
    extendLockBody,
    getAllQuery,
};
