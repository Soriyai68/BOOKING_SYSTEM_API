const express = require('express');
const CustomerAuthController = require('../controllers/customer.auth.controller');
const validator = require('../middlewares/validator.middleware');
const authenticateCustomer = require('../middlewares/customer.auth.middleware');
const {
  sendOTPSchema,
  verifyOTPSchema,
  loginSchema,
  changePasswordSchema,
  sendResetOTPSchema,
  resetPasswordSchema
} = require('../schemas/customerAuthSchema');

const router = express.Router();

// OTP-based authentication
router.post('/send-otp', validator(sendOTPSchema), CustomerAuthController.sendOTP);
router.post('/verify-otp', validator(verifyOTPSchema), CustomerAuthController.verifyOTP);

// Password-based authentication (optional)
router.post('/login', validator(loginSchema), CustomerAuthController.login);

// Token management
router.post('/refresh-token', CustomerAuthController.refreshToken);

// Password management
router.post('/change-password', authenticateCustomer, validator(changePasswordSchema), CustomerAuthController.changePassword);
router.post('/send-reset-otp', validator(sendResetOTPSchema), CustomerAuthController.sendResetOTP);
router.post('/reset-password', validator(resetPasswordSchema), CustomerAuthController.resetPassword);

// Session management
router.get('/sessions', authenticateCustomer, CustomerAuthController.getSessions);
router.delete('/sessions/:sessionId', authenticateCustomer, CustomerAuthController.logoutSession);

// Common routes
router.post('/logout', authenticateCustomer, CustomerAuthController.logout);
router.get('/profile', authenticateCustomer, CustomerAuthController.getProfile);

module.exports = router;
