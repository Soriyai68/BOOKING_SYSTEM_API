const express = require("express");
const CustomerBookingController = require("../controllers/customer.booking.controller");
const authenticateCustomer = require("../middlewares/customer.auth.middleware");

const router = express.Router();

// All routes require customer authentication
router.use(authenticateCustomer);

// GET /api/customer/bookings - Get customer's booking history
router.get("/bookings", CustomerBookingController.getMyBookings);

// GET /api/customer/tickets - Get customer's tickets
router.get("/tickets", CustomerBookingController.getMyTickets);

module.exports = router;
