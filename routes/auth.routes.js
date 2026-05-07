const express = require("express");
const AuthController = require("../controllers/auth.controller");
const validator = require("../middlewares/validator.middleware");
const authenticate = require("../middlewares/auth.middleware");
const {
  adminLoginSchema,
  changePasswordSchema,
  resetPasswordSchema,
  requestPasswordResetSchema,
  verifyPasswordResetSchema,
} = require("../schemas/authSchema");

const router = express.Router();

// Admin authentication (username or email + password)
router.post(
  "/admin-login",
  validator(adminLoginSchema),
  AuthController.adminLogin,
);

// Token management
router.post("/refresh-token", AuthController.refreshToken);

// Password management
router.post(
  "/change-password",
  authenticate,
  validator(changePasswordSchema),
  AuthController.changePassword,
);
router.post(
  "/reset-password",
  authenticate,
  validator(resetPasswordSchema),
  AuthController.resetPassword,
);

// Password reset with OTP (public routes)
router.post(
  "/request-password-reset",
  validator(requestPasswordResetSchema),
  AuthController.requestPasswordReset,
);
router.post(
  "/verify-password-reset",
  validator(verifyPasswordResetSchema),
  AuthController.verifyPasswordResetOTP,
);

// Session management
router.get("/sessions", authenticate, AuthController.getSessions);
router.get("/activity-logs", authenticate, AuthController.getActivityLogs);
router.delete(
  "/sessions/:sessionId",
  authenticate,
  AuthController.logoutSession,
);

// Common routes
router.post("/logout", authenticate, AuthController.logout);
router.get("/profile", authenticate, AuthController.getProfile);

// Admin/Debug routes (consider adding admin role check middleware)
router.get("/stats", authenticate, AuthController.getAuthStats);

module.exports = router;
