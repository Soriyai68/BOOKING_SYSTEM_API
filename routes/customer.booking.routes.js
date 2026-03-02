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

// DELETE /api/customer/bookings/history/all - Clear all booking history
router.delete(
  "/bookings/history/all",
  CustomerBookingController.softDeleteAllHistory,
);

// DELETE /api/customer/bookings/:id - Remove a specific booking from history
router.delete("/bookings/:id", CustomerBookingController.softDeleteBooking);

module.exports = router;
