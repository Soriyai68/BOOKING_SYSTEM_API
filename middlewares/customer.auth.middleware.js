const jwt = require('jsonwebtoken');
const Customer = require('../models/customer.model');
const logger = require('../utils/logger');
const { getRedisClient } = require('../config/redis');

const authenticateCustomer = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    // Check if token is blacklisted
    let isBlacklisted = false;
    try {
      const redisClient = getRedisClient();
      const blacklistKey = `customer_blacklist:${token}`;
      const blacklistResult = await redisClient.get(blacklistKey);
      isBlacklisted = !!blacklistResult;
    } catch (redisError) {
      logger.warn('Redis not available for customer blacklist check:', redisError.message);
    }
    
    if (isBlacklisted) {
      return res.status(401).json({
        success: false,
        message: 'Token has been invalidated. Please login again.'
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Ensure this is a customer token
    if (decoded.type !== 'customer') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type. Customer token required.'
      });
    }
    
    // Check if customer exists and is active
    const customer = await Customer.findById(decoded.customerId);
    
    if (!customer || !customer.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token or customer not found.'
      });
    }

    // Optional: Validate session exists in Redis
    if (process.env.STRICT_SESSION_VALIDATION === 'true') {
      try {
        const redisClient = getRedisClient();
        const customerSessionsKey = `customer_sessions:${decoded.customerId}`;
        
        let sessionIds = [];
        if (redisClient.sMembers) {
          sessionIds = await redisClient.sMembers(customerSessionsKey);
        } else if (redisClient.smembers) {
          sessionIds = await redisClient.smembers(customerSessionsKey);
        }
        
        if (sessionIds.length === 0) {
          return res.status(401).json({
            success: false,
            message: 'No active session found. Please login again.'
          });
        }
      } catch (redisError) {
        logger.warn('Redis not available for customer session validation:', redisError.message);
      }
    }

    req.customer = decoded;
    req.token = token;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please refresh your token or login again.'
      });
    }
    
    logger.error('Customer authentication error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token.'
    });
  }
};

module.exports = authenticateCustomer;
