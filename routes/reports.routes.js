const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reports.controller');

router.get('/total-customers', reportController.getTotalCustomers);
router.get('/total-bookings', reportController.getTotalBookings);
router.get('/total-revenue', reportController.getTotalRevenue);
router.get('/total-movies', reportController.getTotalMovies);

module.exports = router;
