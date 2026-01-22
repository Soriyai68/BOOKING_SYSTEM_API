const express = require('express');
const { Role } = require("../data");
const { bookingTicketIdParamSchema, createBookingTicketSchema, updateBookingTicketSchema, getAllBookingTicketsQuerySchema } = require('../schemas/bookingTicketSchema');
const { authenticate, authorize, validator: validate } = require('../middlewares');
const BookingTicketController = require('../controllers/bookingTicket.controller');

const router = express.Router();

router.get(
    '/',
    authenticate,
    authorize([Role.Admin, Role.SuperAdmin]),
    validate(getAllBookingTicketsQuerySchema, 'query'),
    BookingTicketController.getAll
);

router.get(
    '/:id',
    authenticate,
    authorize([Role.Admin, Role.SuperAdmin, Role.User]),
    validate(bookingTicketIdParamSchema, 'params'),
    BookingTicketController.getById
);

router.post(
    '/',
    authenticate,
    authorize([Role.Admin, Role.SuperAdmin]),
    validate(createBookingTicketSchema),
    BookingTicketController.create
);

router.put(
    '/:id',
    authenticate,
    authorize([Role.Admin, Role.SuperAdmin]),
    validate(bookingTicketIdParamSchema, 'params'),
    validate(updateBookingTicketSchema),
    BookingTicketController.update
);

router.delete(
    '/:id',
    authenticate,
    authorize([Role.Admin, Role.SuperAdmin]),
    validate(bookingTicketIdParamSchema, 'params'),
    BookingTicketController.delete
);

module.exports = router;
