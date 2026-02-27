// Make sure this file exports the authenticate function properly
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const logger = require("../utils/logger");
const { getRedisClient } = require("../config/redis");
const { JWT_SECRET } = require("../config/env");

const authenticate = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    // Try Redis operations with error handling
    let isBlacklisted = false;
    try {
      const redisClient = getRedisClient();
      // Check both blacklists (just in case)
      const blacklistKey = `blacklist:${token}`;
      const customerBlacklistKey = `customer_blacklist:${token}`;

      const [staffResult, customerResult] = await Promise.all([
        redisClient.get(blacklistKey),
        redisClient.get(customerBlacklistKey),
      ]);

      isBlacklisted = !!staffResult || !!customerResult;
    } catch (redisError) {
      logger.warn(
        "Redis not available for blacklist check:",
        redisError.message,
      );
    }

    if (isBlacklisted) {
      return res.status(401).json({
        success: false,
        message: "Token has been invalidated. Please login again.",
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Flexible handling for both Users and Customers
    if (decoded.type === "customer") {
      const Customer = require("../models/customer.model");
      const customer = await Customer.findById(decoded.customerId);
      if (!customer || !customer.isActive) {
        return res.status(410).json({
          // Using 410 or similar could help frontend distinguish but 401 is standard
          success: false,
          message: "Customer account not found or inactive.",
        });
      }
      req.customer = decoded;
      req.token = token;
      return next();
    }

    // Default to User (Staff)
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: "Invalid token or user not found/inactive.",
      });
    }

    req.user = decoded;
    req.token = token;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        message: "Token expired. Please login again.",
      });
    }

    logger.error("Authentication error:", error);
    res.status(401).json({
      success: false,
      message: "Invalid token.",
    });
  }
};

// Export the function directly, not as an object
module.exports = authenticate;
