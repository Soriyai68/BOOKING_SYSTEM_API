const express = require('express');
const { Role } = require('../data');
const middlewares = require('../middlewares');
const ReportsController = require('../controllers/reports.controller');

const router = express.Router();

// GET /api/v1/reports/total-customers - Get total number of customers
router.get('/total-customers',
 middlewares.authenticate,
 middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
 ReportsController.getTotalCustomers
);

module.exports = router;