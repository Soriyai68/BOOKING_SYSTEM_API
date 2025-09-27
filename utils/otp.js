const crypto = require('crypto');
const logger = require('./logger');

// In-memory OTP storage (use Redis in production)
const otpStore = new Map();

class OTPService {
  // Generate 6-digit OTP
  static generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Store OTP with expiration (5 minutes)
  static storeOTP(phone, otp) {
    const expiresAt = Date.now() + (5 * 60 * 1000); // 5 minutes
    otpStore.set(phone, {
      otp,
      expiresAt,
      attempts: 0
    });
    
    logger.info(`OTP stored for phone: ${phone}`);
    
    // Auto cleanup after expiration
    setTimeout(() => {
      otpStore.delete(phone);
    }, 5 * 60 * 1000);
  }

  // Verify OTP
  static verifyOTP(phone, inputOTP) {
    const otpData = otpStore.get(phone);
    
    if (!otpData) {
      return { success: false, message: 'OTP not found or expired' };
    }

    if (Date.now() > otpData.expiresAt) {
      otpStore.delete(phone);
      return { success: false, message: 'OTP expired' };
    }

    // Increment attempts
    otpData.attempts += 1;

    // Max 3 attempts
    if (otpData.attempts > 3) {
      otpStore.delete(phone);
      return { success: false, message: 'Too many attempts. Please request new OTP' };
    }

    if (otpData.otp === inputOTP) {
      otpStore.delete(phone);
      logger.info(`OTP verified successfully for phone: ${phone}`);
      return { success: true, message: 'OTP verified successfully' };
    }

    return { success: false, message: 'Invalid OTP' };
  }

  // Check if OTP exists and not expired
  static hasValidOTP(phone) {
    const otpData = otpStore.get(phone);
    return otpData && Date.now() <= otpData.expiresAt;
  }

  // Clear OTP
  static clearOTP(phone) {
    otpStore.delete(phone);
  }
}

module.exports = OTPService;