// Make sure this file exports the authenticate function properly
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const logger = require('../utils/logger');
const { getRedisClient } = require('../config/redis');

const authenticate = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Try Redis operations with error handling
    let isBlacklisted = false;
    try {
      const redisClient = getRedisClient();
      
      // Check if token is blacklisted in Redis
      const blacklistKey = `blacklist:${token}`;
      const blacklistResult = await redisClient.get(blacklistKey);
      isBlacklisted = !!blacklistResult;
    } catch (redisError) {
      logger.warn('Redis not available for blacklist check:', redisError.message);
      // Continue without Redis blacklist check
    }
    
    if (isBlacklisted) {
      return res.status(401).json({
        success: false,
        message: 'Token has been invalidated. Please login again.'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if user exists and is active
    const user = await User.findById(decoded.userId);
    
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token or user not found.'
      });
    }

    // Optional: Validate session exists in Redis (for extra security)
    // This can be enabled based on your security requirements
    if (process.env.STRICT_SESSION_VALIDATION === 'true') {
      try {
        const redisClient = getRedisClient();
        const userSessionsKey = `user_sessions:${decoded.userId}`;
        const adminSessionsKey = `admin_sessions:${decoded.userId}`;
        
        let userSessions = [];
        let adminSessions = [];
        
        // Handle different Redis versions
        if (redisClient.sMembers) {
          userSessions = await redisClient.sMembers(userSessionsKey);
          adminSessions = await redisClient.sMembers(adminSessionsKey);
        } else if (redisClient.smembers) {
          userSessions = await redisClient.smembers(userSessionsKey);
          adminSessions = await redisClient.smembers(adminSessionsKey);
        }
        
        const hasActiveSession = userSessions.length > 0 || adminSessions.length > 0;
        
        if (!hasActiveSession) {
          return res.status(401).json({
            success: false,
            message: 'No active session found. Please login again.'
          });
        }
      } catch (redisError) {
        logger.warn('Redis not available for session validation:', redisError.message);
        // Continue without strict session validation if Redis is not available
      }
    }

    req.user = decoded;
    req.token = token; // Store token for potential blacklisting
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please refresh your token or login again.'
      });
    }
    
    logger.error('Authentication error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token.'
    });
  }
};

// Export the function directly, not as an object
module.exports = authenticate;

