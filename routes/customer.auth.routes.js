const express = require("express");
const CustomerAuthController = require("../controllers/customer.auth.controller");
const validator = require("../middlewares/validator.middleware");
const authenticateCustomer = require("../middlewares/customer.auth.middleware");
const {
  telegramLoginSchema,
  telegramWebAppLoginSchema,
} = require("../schemas/customerAuthSchema");

const router = express.Router();

// Telegram authentication
router.post(
  "/telegram-login",
  validator(telegramLoginSchema),
  CustomerAuthController.telegramLogin,
);

router.post(
  "/telegram-webapp-login",
  validator(telegramWebAppLoginSchema),
  CustomerAuthController.telegramWebAppLogin,
);

// Token management
router.post("/refresh-token", CustomerAuthController.refreshToken);

// Session management
router.get(
  "/sessions",
  authenticateCustomer,
  CustomerAuthController.getSessions,
);

router.delete(
  "/sessions/:sessionId",
  authenticateCustomer,
  CustomerAuthController.logoutSession,
);

// Common routes
router.post("/logout", authenticateCustomer, CustomerAuthController.logout);
router.get("/profile", authenticateCustomer, CustomerAuthController.getProfile);

module.exports = router;
