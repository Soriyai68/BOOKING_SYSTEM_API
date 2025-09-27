const User = require('../models/user.model');
const OTPService = require('../utils/otp');
const SMSService = require('../utils/sms');
const { generateTokenPair, generateAccessToken } = require('../utils/jwt');
const logger = require('../utils/logger');
const Providers = require('../data/providers');
const { getRedisClient } = require('../config/redis');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

class AuthController {
  // Send OTP for registration or login
  static async sendOTP(req, res) {
    try {
      const { phone } = req.body || {};
      
      if (!phone) {
        return res.status(400).json({
          success: false,
          message: 'Phone number is required'
        });
      }
      
      const redisClient = getRedisClient();

      // Validate phone format
      const phoneRegex = /^\+?[1-9]\d{1,14}$/;
      if (!phoneRegex.test(phone)) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid phone number'
        });
      }

      // Check rate limiting - max 3 OTP requests per phone per hour
      const rateLimitKey = `otp_rate_limit:${phone}`;
      const currentCount = await redisClient.get(rateLimitKey);
      if (currentCount && parseInt(currentCount) >= 3) {
        return res.status(429).json({
          success: false,
          message: 'Too many OTP requests. Please try again after an hour.'
        });
      }

      // Check if OTP already sent recently (Redis-based)
      const otpKey = `otp:${phone}`;
      const existingOTP = await redisClient.get(otpKey);
      if (existingOTP) {
        const ttl = await redisClient.ttl(otpKey);
        return res.status(429).json({
          success: false,
          message: `OTP already sent. Please wait ${Math.ceil(ttl/60)} minutes before requesting again.`
        });
      }

      // Generate OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store OTP in Redis with 5 minute expiration
      const otpData = JSON.stringify({
        otp,
        phone,
        attempts: 0,
        createdAt: Date.now()
      });
      
      await redisClient.setEx(otpKey, 300, otpData); // 5 minutes
      
      // Update rate limiting counter
      if (currentCount) {
        await redisClient.incr(rateLimitKey);
      } else {
        await redisClient.setEx(rateLimitKey, 3600, '1'); // 1 hour
      }

      // Send OTP via SMS
      let smsResult;
      if (process.env.NODE_ENV === 'development') {
        smsResult = await SMSService.sendOTP(phone, otp);
        logger.info(`Development OTP for ${phone}: ${otp}`);
      } else {
        // For production, use Twilio Verify or your SMS service
        smsResult = await SMSService.sendOTP(phone, otp);
      }
      
      if (!smsResult.success) {
        // Clean up Redis if SMS fails
        await redisClient.del(otpKey);
        return res.status(500).json({
          success: false,
          message: 'Failed to send OTP. Please try again.'
        });
      }

      logger.info(`OTP sent to phone: ${phone}`);
      
      res.status(200).json({
        success: true,
        message: 'OTP sent successfully',
        data: {
          phone,
          expiresIn: '5 minutes'
        }
      });
    } catch (error) {
      logger.error('Send OTP error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Verify OTP and register/login user
  static async verifyOTP(req, res) {
    try {
      const { phone, otp, name } = req.body || {};
      
      if (!phone || !otp) {
        return res.status(400).json({
          success: false,
          message: 'Phone number and OTP are required'
        });
      }
      
      const redisClient = getRedisClient();

      // Get OTP from Redis
      const otpKey = `otp:${phone}`;
      const storedOTPData = await redisClient.get(otpKey);
      
      if (!storedOTPData) {
        return res.status(400).json({
          success: false,
          message: 'OTP not found or expired. Please request a new OTP.'
        });
      }

      const otpData = JSON.parse(storedOTPData);
      
      // Check attempts limit (max 3 attempts)
      if (otpData.attempts >= 3) {
        await redisClient.del(otpKey);
        return res.status(400).json({
          success: false,
          message: 'Too many attempts. Please request a new OTP.'
        });
      }

      // Verify OTP
      if (otpData.otp !== otp) {
        // Increment attempts
        otpData.attempts += 1;
        await redisClient.setEx(otpKey, await redisClient.ttl(otpKey), JSON.stringify(otpData));
        
        return res.status(400).json({
          success: false,
          message: `Invalid OTP. ${3 - otpData.attempts} attempts remaining.`
        });
      }

      // OTP is valid, remove it from Redis
      await redisClient.del(otpKey);

      // Check if user exists
      let user = await User.findOne({ phone });
      let isNewUser = false;
      
      if (user) {
        // Login existing user
        user.lastLogin = new Date();
        user.isVerified = true;
        await user.save();
        
        logger.info(`User logged in: ${phone}`);
      } else {
        // Register new user
        if (!name || name.trim().length < 2) {
          return res.status(400).json({
            success: false,
            message: 'Name is required for registration (minimum 2 characters)'
          });
        }

        user = new User({
          phone,
          name: name.trim(),
          provider: Providers.PHONE,
          isVerified: true,
          lastLogin: new Date()
        });
        
        await user.save();
        isNewUser = true;
        logger.info(`New user registered: ${phone}`);
      }

      // Generate JWT token pair
      const tokens = generateTokenPair({
        userId: user._id,
        phone: user.phone,
        role: user.role
      });

      // Try to store session data in Redis (with error handling)
      let sessionId = crypto.randomUUID();
      try {
        const redisClient = getRedisClient();
        
        // Store refresh token in Redis
        const refreshTokenKey = `refresh_token:${user._id}`;
        const refreshTokenData = {
          token: tokens.refreshToken,
          userId: user._id.toString(),
          createdAt: Date.now(),
          userAgent: req.get('User-Agent') || 'unknown',
          ip: req.ip || req.connection.remoteAddress
        };
        
        // Store refresh token for 7 days
        await redisClient.setEx(refreshTokenKey, 7 * 24 * 60 * 60, JSON.stringify(refreshTokenData));

        // Create user session in Redis
        const sessionKey = `session:${user._id}:${sessionId}`;
        const sessionData = {
          sessionId,
          userId: user._id.toString(),
          phone: user.phone,
          role: user.role,
          loginTime: Date.now(),
          userAgent: req.get('User-Agent') || 'unknown',
          ip: req.ip || req.connection.remoteAddress,
          isActive: true
        };
        
        // Store session for 24 hours
        await redisClient.setEx(sessionKey, 24 * 60 * 60, JSON.stringify(sessionData));
        
        // Store session ID in user's session list - handle different Redis versions
        const userSessionsKey = `user_sessions:${user._id}`;
        if (redisClient.sAdd) {
          await redisClient.sAdd(userSessionsKey, sessionId);
        } else if (redisClient.sadd) {
          await redisClient.sadd(userSessionsKey, sessionId);
        } else {
          logger.warn('Redis sAdd/sadd method not available, skipping session tracking');
        }
        await redisClient.expire(userSessionsKey, 7 * 24 * 60 * 60); // 7 days
        
        logger.info(`User session stored in Redis: ${sessionId}`);
      } catch (redisError) {
        // Redis error - continue without Redis session management
        logger.warn('Redis not available for session management:', redisError.message);
      }

      res.status(200).json({
        success: true,
        message: isNewUser ? 'Registration successful' : 'Login successful',
        data: {
          user: {
            id: user._id,
            phone: user.phone,
            name: user.name,
            role: user.role,
            isVerified: user.isVerified
          },
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          sessionId: sessionId
        }
      });
    } catch (error) {
      logger.error('Verify OTP error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Logout user
  static async logout(req, res) {
    try {
      const token = req.header('Authorization')?.replace('Bearer ', '');
      const { sessionId } = req.body || {}; // Optional: specific session to logout
      
      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'No token provided'
        });
      }

      // Decode token to get user info and expiration
      const decoded = jwt.decode(token);
      if (!decoded) {
        return res.status(400).json({
          success: false,
          message: 'Invalid token'
        });
      }

      const userId = decoded.userId;
      const tokenExp = decoded.exp * 1000; // Convert to milliseconds

      // Try to handle Redis operations with error handling
      try {
        const redisClient = getRedisClient();
        
        // Blacklist the access token until it expires
        const blacklistKey = `blacklist:${token}`;
        const ttl = Math.max(0, Math.floor((tokenExp - Date.now()) / 1000));
        if (ttl > 0) {
          await redisClient.setEx(blacklistKey, ttl, 'blacklisted');
        }

        // Remove refresh token
        const refreshTokenKey = `refresh_token:${userId}`;
        await redisClient.del(refreshTokenKey);

        if (sessionId) {
          // Logout specific session
          const sessionKey = `session:${userId}:${sessionId}`;
          await redisClient.del(sessionKey);
          
          // Remove from user sessions set - handle different Redis versions
          const userSessionsKey = `user_sessions:${userId}`;
          if (redisClient.sRem) {
            await redisClient.sRem(userSessionsKey, sessionId);
          } else if (redisClient.srem) {
            await redisClient.srem(userSessionsKey, sessionId);
          }
          
          logger.info(`Session ${sessionId} logged out for user: ${userId}`);
        } else {
          // Logout all sessions for this user
          const userSessionsKey = `user_sessions:${userId}`;
          let sessionIds = [];
          
          // Get session members - handle different Redis versions
          if (redisClient.sMembers) {
            sessionIds = await redisClient.sMembers(userSessionsKey);
          } else if (redisClient.smembers) {
            sessionIds = await redisClient.smembers(userSessionsKey);
          }
          
          // Delete all session keys
          const sessionKeys = sessionIds.map(id => `session:${userId}:${id}`);
          if (sessionKeys.length > 0) {
            await redisClient.del(sessionKeys);
          }
          
          // Clear the sessions set
          await redisClient.del(userSessionsKey);
          
          logger.info(`All sessions logged out for user: ${userId}`);
        }
      } catch (redisError) {
        // Redis error - log but continue with logout
        logger.warn('Redis operations failed during logout:', redisError.message);
      }
      
      res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      logger.error('Logout error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get current user profile
  static async getProfile(req, res) {
    try {
      const user = await User.findById(req.user.userId).select('-__v');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user._id,
            phone: user.phone,
            name: user.name,
            role: user.role,
            isVerified: user.isVerified,
            createdAt: user.createdAt
          }
        }
      });
    } catch (error) {
      logger.error('Get profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Admin login with password
  static async adminLogin(req, res) {
    try {
      const { phone, password } = req.body || {};
      
      if (!phone || !password) {
        return res.status(400).json({
          success: false,
          message: 'Phone number and password are required'
        });
      }
  
      // Find user with password field included
      const user = await User.findOne({ phone }).select('+password');
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }
  
      // Check if user is admin or superadmin
      if (!user.requiresPassword()) {
        return res.status(403).json({
          success: false,
          message: 'This login method is only for admin users'
        });
      }
  
      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials'
        });
      }
  
      // Update last login
      user.lastLogin = new Date();
      await user.save();
  
      // Generate JWT token pair for admin
      const tokens = generateTokenPair({
        userId: user._id,
        phone: user.phone,
        role: user.role
      });

      // Try to store session data in Redis (with error handling)
      let sessionId = null;
      try {
        const redisClient = getRedisClient();
        
        // Store refresh token in Redis
        const refreshTokenKey = `refresh_token:${user._id}`;
        const refreshTokenData = {
          token: tokens.refreshToken,
          userId: user._id.toString(),
          createdAt: Date.now(),
          userAgent: req.get('User-Agent') || 'unknown',
          ip: req.ip || req.connection.remoteAddress,
          loginType: 'admin'
        };
        
        await redisClient.setEx(refreshTokenKey, 7 * 24 * 60 * 60, JSON.stringify(refreshTokenData));

        // Create admin session in Redis
        sessionId = crypto.randomUUID();
        const sessionKey = `admin_session:${user._id}:${sessionId}`;
        const sessionData = {
          sessionId,
          userId: user._id.toString(),
          phone: user.phone,
          role: user.role,
          loginTime: Date.now(),
          userAgent: req.get('User-Agent') || 'unknown',
          ip: req.ip || req.connection.remoteAddress,
          isActive: true,
          loginType: 'admin'
        };
        
        await redisClient.setEx(sessionKey, 24 * 60 * 60, JSON.stringify(sessionData));
        
        // Use sAdd method (capital A) for Redis sets
        const userSessionsKey = `admin_sessions:${user._id}`;
        if (redisClient.sAdd) {
          await redisClient.sAdd(userSessionsKey, sessionId);
        } else if (redisClient.sadd) {
          await redisClient.sadd(userSessionsKey, sessionId);
        } else {
          // If neither method exists, log warning and continue without session tracking
          logger.warn('Redis sAdd/sadd method not available, skipping session tracking');
        }
        await redisClient.expire(userSessionsKey, 7 * 24 * 60 * 60);
        
        logger.info(`Admin session stored in Redis: ${sessionId}`);
      } catch (redisError) {
        // Redis error - continue without Redis session management
        logger.warn('Redis not available, continuing without session management:', redisError.message);
        sessionId = crypto.randomUUID(); // Generate session ID anyway for response
      }
  
      logger.info(`Admin logged in: ${phone} (${user.role})`);
  
      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user._id,
            phone: user.phone,
            name: user.name,
            role: user.role,
            isVerified: user.isVerified
          },
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          sessionId: sessionId
        }
      });
    } catch (error) {
      logger.error('Admin login error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Refresh access token using refresh token
  static async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body || {};
      
      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: 'Refresh token is required'
        });
      }

      // Verify refresh token
      let decoded;
      try {
        decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      } catch (error) {
        return res.status(401).json({
          success: false,
          message: 'Invalid refresh token'
        });
      }

      // Try Redis operations with error handling
      let storedTokenData = null;
      try {
        const redisClient = getRedisClient();
        
        // Check if refresh token exists in Redis
        const refreshTokenKey = `refresh_token:${decoded.userId}`;
        storedTokenData = await redisClient.get(refreshTokenKey);
        
        if (storedTokenData) {
          const tokenData = JSON.parse(storedTokenData);
          if (tokenData.token !== refreshToken) {
            return res.status(401).json({
              success: false,
              message: 'Invalid refresh token'
            });
          }
        }
      } catch (redisError) {
        logger.warn('Redis not available for token validation:', redisError.message);
        // Continue without Redis validation
      }
      
      if (!storedTokenData) {
        return res.status(401).json({
          success: false,
          message: 'Refresh token not found or expired'
        });
      }

      // Get user data
      const user = await User.findById(decoded.userId);
      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'User not found or inactive'
        });
      }

      // Generate new access token
      const newAccessToken = generateAccessToken({
        userId: user._id,
        phone: user.phone,
        role: user.role
      });

      res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          accessToken: newAccessToken,
          user: {
            id: user._id,
            phone: user.phone,
            name: user.name,
            role: user.role
          }
        }
      });
    } catch (error) {
      logger.error('Refresh token error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get user's active sessions
  static async getSessions(req, res) {
    try {
      const userId = req.user.userId;
      const allSessions = [];
      
      // Try Redis operations with error handling
      try {
        const redisClient = getRedisClient();
        
        // Get regular user sessions - handle different Redis versions
        const userSessionsKey = `user_sessions:${userId}`;
        let sessionIds = [];
        if (redisClient.sMembers) {
          sessionIds = await redisClient.sMembers(userSessionsKey);
        } else if (redisClient.smembers) {
          sessionIds = await redisClient.smembers(userSessionsKey);
        }
        
        // Get admin sessions - handle different Redis versions
        const adminSessionsKey = `admin_sessions:${userId}`;
        let adminSessionIds = [];
        if (redisClient.sMembers) {
          adminSessionIds = await redisClient.sMembers(adminSessionsKey);
        } else if (redisClient.smembers) {
          adminSessionIds = await redisClient.smembers(adminSessionsKey);
        }
        
        // Fetch regular sessions
        for (const sessionId of sessionIds) {
          const sessionKey = `session:${userId}:${sessionId}`;
          const sessionData = await redisClient.get(sessionKey);
          if (sessionData) {
            const session = JSON.parse(sessionData);
            allSessions.push({
              ...session,
              type: 'user',
              ttl: await redisClient.ttl(sessionKey)
            });
          }
        }
        
        // Fetch admin sessions
        for (const sessionId of adminSessionIds) {
          const sessionKey = `admin_session:${userId}:${sessionId}`;
          const sessionData = await redisClient.get(sessionKey);
          if (sessionData) {
            const session = JSON.parse(sessionData);
            allSessions.push({
              ...session,
              type: 'admin',
              ttl: await redisClient.ttl(sessionKey)
            });
          }
        }
      } catch (redisError) {
        logger.warn('Redis not available for session retrieval:', redisError.message);
        // Return empty sessions if Redis is not available
      }
      
      res.status(200).json({
        success: true,
        data: {
          sessions: allSessions,
          totalSessions: allSessions.length
        }
      });
    } catch (error) {
      logger.error('Get sessions error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Logout specific session
  static async logoutSession(req, res) {
    try {
      const userId = req.user.userId;
      const { sessionId } = req.params;
      
      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Session ID is required'
        });
      }

      let sessionFound = false;
      
      // Try Redis operations with error handling
      try {
        const redisClient = getRedisClient();
        
        // Try to delete from both user and admin sessions
        const userSessionKey = `session:${userId}:${sessionId}`;
        const adminSessionKey = `admin_session:${userId}:${sessionId}`;
        
        const userDeleted = await redisClient.del(userSessionKey);
        const adminDeleted = await redisClient.del(adminSessionKey);
        
        if (userDeleted || adminDeleted) {
          sessionFound = true;
          
          // Remove from session sets - handle different Redis versions
          if (redisClient.sRem) {
            await redisClient.sRem(`user_sessions:${userId}`, sessionId);
            await redisClient.sRem(`admin_sessions:${userId}`, sessionId);
          } else if (redisClient.srem) {
            await redisClient.srem(`user_sessions:${userId}`, sessionId);
            await redisClient.srem(`admin_sessions:${userId}`, sessionId);
          }
          
          logger.info(`Session ${sessionId} logged out for user: ${userId}`);
        }
      } catch (redisError) {
        logger.warn('Redis operations failed during session logout:', redisError.message);
        // Assume session was found if Redis is not available
        sessionFound = true;
      }
      
      if (sessionFound) {
        res.status(200).json({
          success: true,
          message: 'Session logged out successfully'
        });
      } else {
        res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }
    } catch (error) {
      logger.error('Logout session error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Get Redis-based authentication statistics
  static async getAuthStats(req, res) {
    try {
      let stats = {
        totalKeys: 0,
        otpKeys: 0,
        sessionKeys: 0,
        adminSessionKeys: 0,
        refreshTokenKeys: 0,
        blacklistedTokens: 0,
        rateLimitKeys: 0,
        redisAvailable: false
      };
      
      // Try Redis operations with error handling
      try {
        const redisClient = getRedisClient();
        
        // Get various auth-related counts from Redis
        const keys = await redisClient.keys('*');
        
        stats = {
          totalKeys: keys.length,
          otpKeys: keys.filter(key => key.startsWith('otp:')).length,
          sessionKeys: keys.filter(key => key.startsWith('session:')).length,
          adminSessionKeys: keys.filter(key => key.startsWith('admin_session:')).length,
          refreshTokenKeys: keys.filter(key => key.startsWith('refresh_token:')).length,
          blacklistedTokens: keys.filter(key => key.startsWith('blacklist:')).length,
          rateLimitKeys: keys.filter(key => key.startsWith('otp_rate_limit:')).length,
          redisAvailable: true
        };
      } catch (redisError) {
        logger.warn('Redis not available for stats:', redisError.message);
        // Return default stats indicating Redis is not available
      }
      
      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Get auth stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Change password for authenticated user
  static async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body || {};
      const userId = req.user.userId;
      
      if (!newPassword) {
        return res.status(400).json({
          success: false,
          message: 'New password is required'
        });
      }
      
      // Get user with password field included
      const user = await User.findById(userId).select('+password');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      // Check if user already has a password
      const hasPassword = user.password && user.password.length > 0;
      
      if (hasPassword) {
        // User has existing password - require current password
        if (!currentPassword) {
          return res.status(400).json({
            success: false,
            message: 'Current password is required to change password'
          });
        }
        
        // Verify current password
        const isCurrentPasswordValid = await user.comparePassword(currentPassword);
        if (!isCurrentPasswordValid) {
          return res.status(400).json({
            success: false,
            message: 'Current password is incorrect'
          });
        }
        
        // Check if new password is different from current password
        const isSamePassword = await user.comparePassword(newPassword);
        if (isSamePassword) {
          return res.status(400).json({
            success: false,
            message: 'New password must be different from current password'
          });
        }
      } else {
        // User doesn't have password - they're setting up their first password
        // No current password verification needed
        logger.info(`User ${user.phone} is setting up their first password`);
      }
      
      // Update password
      user.password = newPassword;
      user.passwordChangedAt = new Date();
      await user.save();
      
      const isFirstTimeSetup = !hasPassword;
      
      // Only invalidate sessions if user already had a password
      // For first-time password setup, keep current session active
      if (hasPassword) {
        try {
          const redisClient = getRedisClient();
          
          // Remove all refresh tokens for this user
          const refreshTokenKey = `refresh_token:${userId}`;
          await redisClient.del(refreshTokenKey);
          
          // Clear all sessions for this user
          const userSessionsKey = `user_sessions:${userId}`;
          const adminSessionsKey = `admin_sessions:${userId}`;
          
          let sessionIds = [];
          let adminSessionIds = [];
          
          // Handle different Redis versions
          if (redisClient.sMembers) {
            sessionIds = await redisClient.sMembers(userSessionsKey) || [];
            adminSessionIds = await redisClient.sMembers(adminSessionsKey) || [];
          } else if (redisClient.smembers) {
            sessionIds = await redisClient.smembers(userSessionsKey) || [];
            adminSessionIds = await redisClient.smembers(adminSessionsKey) || [];
          }
          
          // Delete all session keys
          const allSessionKeys = [
            ...sessionIds.map(id => `session:${userId}:${id}`),
            ...adminSessionIds.map(id => `admin_session:${userId}:${id}`)
          ];
          
          if (allSessionKeys.length > 0) {
            await redisClient.del(allSessionKeys);
          }
          
          // Clear session sets
          await redisClient.del([userSessionsKey, adminSessionsKey]);
          
          logger.info(`All sessions cleared for user ${userId} after password change`);
        } catch (redisError) {
          logger.warn('Redis operations failed during password change:', redisError.message);
          // Continue even if Redis operations fail
        }
      }
      
      logger.info(`Password ${isFirstTimeSetup ? 'set up' : 'changed'} for user: ${user.phone}`);
      
      const message = isFirstTimeSetup 
        ? 'Password set up successfully. You can now login using your phone number and password.'
        : 'Password changed successfully. Please login again with your new password.';
      
      res.status(200).json({
        success: true,
        message,
        data: {
          isFirstTimeSetup,
          requiresReauth: hasPassword // Only require re-auth if they had a password before
        }
      });
    } catch (error) {
      logger.error('Change password error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Reset password using OTP
  static async resetPassword(req, res) {
    try {
      const { phone, otp, newPassword } = req.body || {};
      
      if (!phone || !otp || !newPassword) {
        return res.status(400).json({
          success: false,
          message: 'Phone number, OTP, and new password are required'
        });
      }
      
      // Validate phone format
      const phoneRegex = /^\+?[1-9]\d{1,14}$/;
      if (!phoneRegex.test(phone)) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid phone number'
        });
      }
      
      // Try to verify OTP from Redis
      let otpValid = false;
      try {
        const redisClient = getRedisClient();
        
        // Get OTP from Redis
        const otpKey = `reset_otp:${phone}`;
        const storedOTPData = await redisClient.get(otpKey);
        
        if (!storedOTPData) {
          return res.status(400).json({
            success: false,
            message: 'OTP not found or expired. Please request a new password reset OTP.'
          });
        }
        
        const otpData = JSON.parse(storedOTPData);
        
        // Check attempts limit (max 3 attempts)
        if (otpData.attempts >= 3) {
          await redisClient.del(otpKey);
          return res.status(400).json({
            success: false,
            message: 'Too many attempts. Please request a new password reset OTP.'
          });
        }
        
        // Verify OTP
        if (otpData.otp !== otp) {
          // Increment attempts
          otpData.attempts += 1;
          await redisClient.setEx(otpKey, await redisClient.ttl(otpKey), JSON.stringify(otpData));
          
          return res.status(400).json({
            success: false,
            message: `Invalid OTP. ${3 - otpData.attempts} attempts remaining.`
          });
        }
        
        // OTP is valid, remove it from Redis
        await redisClient.del(otpKey);
        otpValid = true;
      } catch (redisError) {
        logger.warn('Redis not available for OTP verification:', redisError.message);
        return res.status(500).json({
          success: false,
          message: 'Unable to verify OTP. Please try again.'
        });
      }
      
      if (!otpValid) {
        return res.status(400).json({
          success: false,
          message: 'Invalid OTP'
        });
      }
      
      // Find user
      const user = await User.findOne({ phone }).select('+password');
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      // Check if user already has a password
      const hasPassword = user.password && user.password.length > 0;
      
      // Check if new password is different from current password (if they have one)
      if (hasPassword) {
        const isSamePassword = await user.comparePassword(newPassword);
        if (isSamePassword) {
          return res.status(400).json({
            success: false,
            message: 'New password must be different from current password'
          });
        }
      }
      
      // Update password
      user.password = newPassword;
      user.passwordChangedAt = new Date();
      await user.save();
      
      // Invalidate all existing sessions
      try {
        const redisClient = getRedisClient();
        
        // Remove all refresh tokens for this user
        const refreshTokenKey = `refresh_token:${user._id}`;
        await redisClient.del(refreshTokenKey);
        
        // Clear all sessions for this user
        const userSessionsKey = `user_sessions:${user._id}`;
        const adminSessionsKey = `admin_sessions:${user._id}`;
        
        let sessionIds = [];
        let adminSessionIds = [];
        
        // Handle different Redis versions
        if (redisClient.sMembers) {
          sessionIds = await redisClient.sMembers(userSessionsKey) || [];
          adminSessionIds = await redisClient.sMembers(adminSessionsKey) || [];
        } else if (redisClient.smembers) {
          sessionIds = await redisClient.smembers(userSessionsKey) || [];
          adminSessionIds = await redisClient.smembers(adminSessionsKey) || [];
        }
        
        // Delete all session keys
        const allSessionKeys = [
          ...sessionIds.map(id => `session:${user._id}:${id}`),
          ...adminSessionIds.map(id => `admin_session:${user._id}:${id}`)
        ];
        
        if (allSessionKeys.length > 0) {
          await redisClient.del(allSessionKeys);
        }
        
        // Clear session sets
        await redisClient.del([userSessionsKey, adminSessionsKey]);
        
        logger.info(`All sessions cleared for user ${user._id} after password reset`);
      } catch (redisError) {
        logger.warn('Redis operations failed during password reset:', redisError.message);
        // Continue even if Redis operations fail
      }
      
      logger.info(`Password reset for user: ${phone}`);
      
      res.status(200).json({
        success: true,
        message: 'Password reset successfully. Please login with your new password.'
      });
    } catch (error) {
      logger.error('Reset password error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }

  // Send OTP for password reset
  static async sendResetOTP(req, res) {
    try {
      const { phone } = req.body || {};
      
      if (!phone) {
        return res.status(400).json({
          success: false,
          message: 'Phone number is required'
        });
      }
      
      // Validate phone format
      const phoneRegex = /^\+?[1-9]\d{1,14}$/;
      if (!phoneRegex.test(phone)) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid phone number'
        });
      }
      
      // Find user
      const user = await User.findOne({ phone });
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      // All users can request password reset OTP (for setting up or resetting password)
      logger.info(`Password reset OTP requested for user: ${phone}`);
      
      const hasPassword = user.password && user.password.length > 0;
      const actionType = hasPassword ? 'reset' : 'setup';
      
      try {
        const redisClient = getRedisClient();
        
        // Check rate limiting - max 3 reset OTP requests per phone per hour
        const rateLimitKey = `reset_otp_rate_limit:${phone}`;
        const currentCount = await redisClient.get(rateLimitKey);
        if (currentCount && parseInt(currentCount) >= 3) {
          return res.status(429).json({
            success: false,
            message: 'Too many password reset requests. Please try again after an hour.'
          });
        }
        
        // Check if OTP already sent recently
        const otpKey = `reset_otp:${phone}`;
        const existingOTP = await redisClient.get(otpKey);
        if (existingOTP) {
          const ttl = await redisClient.ttl(otpKey);
          return res.status(429).json({
            success: false,
            message: `Password reset OTP already sent. Please wait ${Math.ceil(ttl/60)} minutes before requesting again.`
          });
        }
        
        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Store OTP in Redis with 5 minute expiration
        const otpData = JSON.stringify({
          otp,
          phone,
          attempts: 0,
          createdAt: Date.now(),
          type: 'password_reset'
        });
        
        await redisClient.setEx(otpKey, 300, otpData); // 5 minutes
        
        // Update rate limiting counter
        if (currentCount) {
          await redisClient.incr(rateLimitKey);
        } else {
          await redisClient.setEx(rateLimitKey, 3600, '1'); // 1 hour
        }
        
        // Send OTP via SMS
        let smsResult;
        if (process.env.NODE_ENV === 'development') {
          smsResult = await SMSService.sendPasswordResetOTP(phone, otp);
          logger.info(`Development Password Reset OTP for ${phone}: ${otp}`);
        } else {
          smsResult = await SMSService.sendPasswordResetOTP(phone, otp);
        }
        
        if (!smsResult.success) {
          // Clean up Redis if SMS fails
          await redisClient.del(otpKey);
          return res.status(500).json({
            success: false,
            message: 'Failed to send password reset OTP. Please try again.'
          });
        }
        
        logger.info(`Password reset OTP sent to phone: ${phone}`);
        
        res.status(200).json({
          success: true,
          message: 'Password reset OTP sent successfully',
          data: {
            phone,
            expiresIn: '5 minutes'
          }
        });
      } catch (redisError) {
        logger.warn('Redis not available for password reset OTP:', redisError.message);
        return res.status(500).json({
          success: false,
          message: 'Unable to send password reset OTP. Please try again later.'
        });
      }
    } catch (error) {
      logger.error('Send reset OTP error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error'
      });
    }
  }
}

module.exports = AuthController;
