const express = require('express');
const AuthController = require('../controllers/auth.controller');
const validator = require('../middlewares/validator.middleware');
const authenticate = require('../middlewares/auth.middleware');
const { 
  sendOTPSchema, 
  verifyOTPSchema, 
  adminLoginSchema,
  changePasswordSchema,
  sendResetOTPSchema,
  resetPasswordSchema 
} = require('../schemas/authSchema');

const router = express.Router();

// Regular user authentication (phone + OTP)
router.post('/send-otp', validator(sendOTPSchema), AuthController.sendOTP);
router.post('/verify-otp', validator(verifyOTPSchema), AuthController.verifyOTP);

// Admin authentication (phone + password)
router.post('/admin-login', validator(adminLoginSchema), AuthController.adminLogin);

// Token management
router.post('/refresh-token', AuthController.refreshToken);

// Password management
router.post('/change-password', authenticate, validator(changePasswordSchema), AuthController.changePassword);
router.post('/send-reset-otp', validator(sendResetOTPSchema), AuthController.sendResetOTP);
router.post('/reset-password', validator(resetPasswordSchema), AuthController.resetPassword);

// Session management
router.get('/sessions', authenticate, AuthController.getSessions);
router.delete('/sessions/:sessionId', authenticate, AuthController.logoutSession);

// Common routes
router.post('/logout', authenticate, AuthController.logout);
router.get('/profile', authenticate, AuthController.getProfile);

// Admin/Debug routes (consider adding admin role check middleware)
router.get('/stats', authenticate, AuthController.getAuthStats);

module.exports = router;