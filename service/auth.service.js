const { getRedisClient } = require('../config/redis');
const { generateTokenPair, generateAccessToken } = require('../utils/jwt');
const SMSService = require('../utils/sms');
const logger = require('../utils/logger');
const crypto = require('crypto');

class AuthService {
  /**
   * Generate a 6-digit OTP
   */
  static generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Validate phone number format
   */
  static isValidPhone(phone) {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone);
  }

  /**
   * Check OTP rate limit
   * @param {string} phone - Phone number
   * @param {string} prefix - Redis key prefix (e.g., 'customer', 'user')
   * @param {number} maxRequests - Maximum requests allowed
   * @returns {Promise<{allowed: boolean, message?: string}>}
   */
  static async checkOTPRateLimit(phone, prefix = '', maxRequests = 3) {
    try {
      const redisClient = getRedisClient();
      const rateLimitKey = `${prefix}otp_rate_limit:${phone}`;
      const currentCount = await redisClient.get(rateLimitKey);
      
      if (currentCount && parseInt(currentCount) >= maxRequests) {
        return {
          allowed: false,
          message: 'Too many OTP requests. Please try again after an hour.'
        };
      }
      return { allowed: true };
    } catch (error) {
      logger.warn('Redis rate limit check failed:', error.message);
      return { allowed: true };
    }
  }

  /**
   * Check if OTP was recently sent
   * @param {string} phone - Phone number
   * @param {string} prefix - Redis key prefix
   * @returns {Promise<{exists: boolean, ttl?: number}>}
   */
  static async checkExistingOTP(phone, prefix = '') {
    try {
      const redisClient = getRedisClient();
      const otpKey = `${prefix}otp:${phone}`;
      const existingOTP = await redisClient.get(otpKey);
      
      if (existingOTP) {
        const ttl = await redisClient.ttl(otpKey);
        return { exists: true, ttl };
      }
      return { exists: false };
    } catch (error) {
      logger.warn('Redis OTP check failed:', error.message);
      return { exists: false };
    }
  }

  /**
   * Store OTP in Redis
   * @param {string} phone - Phone number
   * @param {string} otp - OTP code
   * @param {string} prefix - Redis key prefix
   * @param {number} expirySeconds - Expiry time in seconds
   * @param {string} type - OTP type (e.g., 'login', 'password_reset')
   */
  static async storeOTP(phone, otp, prefix = '', expirySeconds = 300, type = 'login') {
    try {
      const redisClient = getRedisClient();
      const otpKey = `${prefix}otp:${phone}`;
      
      const otpData = JSON.stringify({
        otp,
        phone,
        attempts: 0,
        createdAt: Date.now(),
        type
      });
      
      await redisClient.setEx(otpKey, expirySeconds, otpData);
      return { success: true };
    } catch (error) {
      logger.error('Failed to store OTP:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Update rate limit counter
   * @param {string} phone - Phone number
   * @param {string} prefix - Redis key prefix
   * @param {number} expirySeconds - Expiry time in seconds
   */
  static async updateRateLimit(phone, prefix = '', expirySeconds = 3600) {
    try {
      const redisClient = getRedisClient();
      const rateLimitKey = `${prefix}otp_rate_limit:${phone}`;
      const currentCount = await redisClient.get(rateLimitKey);
      
      if (currentCount) {
        await redisClient.incr(rateLimitKey);
      } else {
        await redisClient.setEx(rateLimitKey, expirySeconds, '1');
      }
    } catch (error) {
      logger.warn('Failed to update rate limit:', error.message);
    }
  }

  /**
   * Send OTP via SMS
   * @param {string} phone - Phone number
   * @param {string} otp - OTP code
   * @param {string} type - OTP type ('login' or 'password_reset')
   */
  static async sendOTP(phone, otp, type = 'login') {
    try {
      let smsResult;
      if (type === 'password_reset') {
        smsResult = await SMSService.sendPasswordResetOTP(phone, otp);
      } else {
        smsResult = await SMSService.sendOTP(phone, otp);
      }
      
      if (process.env.NODE_ENV === 'development') {
        logger.info(`Development OTP for ${phone}: ${otp}`);
      }
      
      return smsResult;
    } catch (error) {
      logger.error('Failed to send OTP:', error.message);
      return { success: false, message: 'Failed to send OTP' };
    }
  }

  /**
   * Verify OTP
   * @param {string} phone - Phone number
   * @param {string} otp - OTP code to verify
   * @param {string} prefix - Redis key prefix
   * @returns {Promise<{valid: boolean, message?: string}>}
   */
  static async verifyOTP(phone, otp, prefix = '') {
    try {
      const redisClient = getRedisClient();
      const otpKey = `${prefix}otp:${phone}`;
      const storedOTPData = await redisClient.get(otpKey);
      
      if (!storedOTPData) {
        return {
          valid: false,
          message: 'OTP not found or expired. Please request a new OTP.'
        };
      }

      const otpData = JSON.parse(storedOTPData);
      
      if (otpData.attempts >= 3) {
        await redisClient.del(otpKey);
        return {
          valid: false,
          message: 'Too many attempts. Please request a new OTP.'
        };
      }

      if (otpData.otp !== otp) {
        otpData.attempts += 1;
        const ttl = await redisClient.ttl(otpKey);
        await redisClient.setEx(otpKey, ttl, JSON.stringify(otpData));
        
        return {
          valid: false,
          message: `Invalid OTP. ${3 - otpData.attempts} attempts remaining.`
        };
      }

      await redisClient.del(otpKey);
      return { valid: true };
    } catch (error) {
      logger.error('OTP verification failed:', error.message);
      return {
        valid: false,
        message: 'Unable to verify OTP. Please try again.'
      };
    }
  }

  /**
   * Delete OTP from Redis
   * @param {string} phone - Phone number
   * @param {string} prefix - Redis key prefix
   */
  static async deleteOTP(phone, prefix = '') {
    try {
      const redisClient = getRedisClient();
      const otpKey = `${prefix}otp:${phone}`;
      await redisClient.del(otpKey);
    } catch (error) {
      logger.warn('Failed to delete OTP:', error.message);
    }
  }

  /**
   * Generate token pair for user/customer
   * @param {Object} payload - Token payload
   */
  static generateTokens(payload) {
    return generateTokenPair(payload);
  }

  /**
   * Generate access token only
   * @param {Object} payload - Token payload
   */
  static generateAccessTokenOnly(payload) {
    return generateAccessToken(payload);
  }

  /**
   * Store refresh token in Redis
   * @param {string} id - User/Customer ID
   * @param {string} token - Refresh token
   * @param {string} prefix - Redis key prefix
   * @param {Object} metadata - Additional metadata
   * @param {number} expirySeconds - Expiry time in seconds
   */
  static async storeRefreshToken(id, token, prefix = '', metadata = {}, expirySeconds = 7 * 24 * 60 * 60) {
    try {
      const redisClient = getRedisClient();
      const refreshTokenKey = `${prefix}refresh_token:${id}`;
      
      const refreshTokenData = {
        token,
        id: id.toString(),
        createdAt: Date.now(),
        ...metadata
      };
      
      await redisClient.setEx(refreshTokenKey, expirySeconds, JSON.stringify(refreshTokenData));
      return { success: true };
    } catch (error) {
      logger.warn('Failed to store refresh token:', error.message);
      return { success: false };
    }
  }

  /**
   * Validate refresh token from Redis
   * @param {string} id - User/Customer ID
   * @param {string} token - Refresh token to validate
   * @param {string} prefix - Redis key prefix
   */
  static async validateRefreshToken(id, token, prefix = '') {
    try {
      const redisClient = getRedisClient();
      const refreshTokenKey = `${prefix}refresh_token:${id}`;
      const storedTokenData = await redisClient.get(refreshTokenKey);
      
      if (!storedTokenData) {
        return { valid: false, message: 'Refresh token not found or expired' };
      }
      
      const tokenData = JSON.parse(storedTokenData);
      if (tokenData.token !== token) {
        return { valid: false, message: 'Invalid refresh token' };
      }
      
      return { valid: true };
    } catch (error) {
      logger.warn('Refresh token validation failed:', error.message);
      return { valid: false, message: 'Unable to validate token' };
    }
  }

  /**
   * Delete refresh token from Redis
   * @param {string} id - User/Customer ID
   * @param {string} prefix - Redis key prefix
   */
  static async deleteRefreshToken(id, prefix = '') {
    try {
      const redisClient = getRedisClient();
      const refreshTokenKey = `${prefix}refresh_token:${id}`;
      await redisClient.del(refreshTokenKey);
    } catch (error) {
      logger.warn('Failed to delete refresh token:', error.message);
    }
  }

  /**
   * Create session in Redis
   * @param {string} id - User/Customer ID
   * @param {string} prefix - Redis key prefix
   * @param {Object} sessionData - Session data
   * @param {number} expirySeconds - Expiry time in seconds
   * @returns {Promise<string>} - Session ID
   */
  static async createSession(id, prefix = '', sessionData = {}, expirySeconds = 24 * 60 * 60) {
    const sessionId = crypto.randomUUID();
    
    try {
      const redisClient = getRedisClient();
      const sessionKey = `${prefix}session:${id}:${sessionId}`;
      
      const data = {
        sessionId,
        id: id.toString(),
        loginTime: Date.now(),
        isActive: true,
        ...sessionData
      };
      
      await redisClient.setEx(sessionKey, expirySeconds, JSON.stringify(data));
      
      // Add to sessions set
      const sessionsKey = `${prefix}sessions:${id}`;
      if (redisClient.sAdd) {
        await redisClient.sAdd(sessionsKey, sessionId);
      } else if (redisClient.sadd) {
        await redisClient.sadd(sessionsKey, sessionId);
      }
      await redisClient.expire(sessionsKey, 7 * 24 * 60 * 60);
      
      return sessionId;
    } catch (error) {
      logger.warn('Failed to create session:', error.message);
      return sessionId;
    }
  }

  /**
   * Get all sessions for a user/customer
   * @param {string} id - User/Customer ID
   * @param {string} prefix - Redis key prefix
   */
  static async getSessions(id, prefix = '') {
    const sessions = [];
    
    try {
      const redisClient = getRedisClient();
      const sessionsKey = `${prefix}sessions:${id}`;
      
      let sessionIds = [];
      if (redisClient.sMembers) {
        sessionIds = await redisClient.sMembers(sessionsKey);
      } else if (redisClient.smembers) {
        sessionIds = await redisClient.smembers(sessionsKey);
      }
      
      for (const sessionId of sessionIds) {
        const sessionKey = `${prefix}session:${id}:${sessionId}`;
        const sessionData = await redisClient.get(sessionKey);
        if (sessionData) {
          const session = JSON.parse(sessionData);
          sessions.push({
            ...session,
            ttl: await redisClient.ttl(sessionKey)
          });
        }
      }
    } catch (error) {
      logger.warn('Failed to get sessions:', error.message);
    }
    
    return sessions;
  }

  /**
   * Delete a specific session
   * @param {string} id - User/Customer ID
   * @param {string} sessionId - Session ID to delete
   * @param {string} prefix - Redis key prefix
   */
  static async deleteSession(id, sessionId, prefix = '') {
    try {
      const redisClient = getRedisClient();
      const sessionKey = `${prefix}session:${id}:${sessionId}`;
      const deleted = await redisClient.del(sessionKey);
      
      if (deleted) {
        const sessionsKey = `${prefix}sessions:${id}`;
        if (redisClient.sRem) {
          await redisClient.sRem(sessionsKey, sessionId);
        } else if (redisClient.srem) {
          await redisClient.srem(sessionsKey, sessionId);
        }
        return true;
      }
      return false;
    } catch (error) {
      logger.warn('Failed to delete session:', error.message);
      return false;
    }
  }

  /**
   * Delete all sessions for a user/customer
   * @param {string} id - User/Customer ID
   * @param {string} prefix - Redis key prefix
   */
  static async deleteAllSessions(id, prefix = '') {
    try {
      const redisClient = getRedisClient();
      const sessionsKey = `${prefix}sessions:${id}`;
      
      let sessionIds = [];
      if (redisClient.sMembers) {
        sessionIds = await redisClient.sMembers(sessionsKey);
      } else if (redisClient.smembers) {
        sessionIds = await redisClient.smembers(sessionsKey);
      }
      
      const sessionKeys = sessionIds.map(sid => `${prefix}session:${id}:${sid}`);
      if (sessionKeys.length > 0) {
        await redisClient.del(sessionKeys);
      }
      
      await redisClient.del(sessionsKey);
      return true;
    } catch (error) {
      logger.warn('Failed to delete all sessions:', error.message);
      return false;
    }
  }

  /**
   * Blacklist a token
   * @param {string} token - Token to blacklist
   * @param {number} expMs - Token expiry in milliseconds
   * @param {string} prefix - Redis key prefix
   */
  static async blacklistToken(token, expMs, prefix = '') {
    try {
      const redisClient = getRedisClient();
      const blacklistKey = `${prefix}blacklist:${token}`;
      const ttl = Math.max(0, Math.floor((expMs - Date.now()) / 1000));
      
      if (ttl > 0) {
        await redisClient.setEx(blacklistKey, ttl, 'blacklisted');
      }
    } catch (error) {
      logger.warn('Failed to blacklist token:', error.message);
    }
  }

  /**
   * Check if token is blacklisted
   * @param {string} token - Token to check
   * @param {string} prefix - Redis key prefix
   */
  static async isTokenBlacklisted(token, prefix = '') {
    try {
      const redisClient = getRedisClient();
      const blacklistKey = `${prefix}blacklist:${token}`;
      const result = await redisClient.get(blacklistKey);
      return !!result;
    } catch (error) {
      logger.warn('Failed to check blacklist:', error.message);
      return false;
    }
  }
}

module.exports = AuthService;
