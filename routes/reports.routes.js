const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reports.controller");

router.get("/total-customers", reportController.getTotalCustomers);
router.get("/total-bookings", reportController.getTotalBookings);
router.get("/total-revenue", reportController.getTotalRevenue);
router.get("/total-movies", reportController.getTotalMovies);
router.get(
  "/customer-booking-frequency",
  reportController.getCustomerBookingFrequency,
);

router.get("/revenue-report", reportController.getRevenueReport);
router.get("/booking-status-report", reportController.getBookingStatusReport);
router.get("/popular-movies-report", reportController.getPopularMoviesReport);
router.get(
  "/seat-type-revenue-report",
  reportController.getSeatTypeRevenueReport,
);

// Detailed Reports
router.get("/detailed-revenue", reportController.getDetailedRevenueReport);
router.get("/detailed-bookings", reportController.getDetailedBookingReport);
router.get("/detailed-movies", reportController.getDetailedMovieReport);

// Analysis Reports
router.get(
  "/payment-method-analysis",
  reportController.getPaymentMethodAnalysisReport,
);
router.get(
  "/showtime-utilization",
  reportController.getShowtimeUtilizationReport,
);
router.get(
  "/customer-demographic",
  reportController.getCustomerDemographicReport,
);
router.get(
  "/staff-performance",
  reportController.getStaffPerformanceReport,
);
router.get(
  "/inventory-seat-management",
  reportController.getInventorySeatManagementReport,
);

module.exports = router;
