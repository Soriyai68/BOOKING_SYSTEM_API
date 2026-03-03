const jwt = require("jsonwebtoken");
const Customer = require("../models/customer.model");
const logger = require("../utils/logger");
const { getRedisClient } = require("../config/redis");
const { JWT_SECRET } = require("../config/env");
const fs = require("fs");
const DEBUG_LOG_PATH = "d:/BOOKING_SYSTEM/auth_debug.log";

const authenticateCustomer = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
      logger.warn(
        `Customer Auth: No token provided for ${req.method} ${req.originalUrl} from ${req.ip}`,
      );
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    logger.debug(
      `Customer Auth: Verifying token ${token.substring(0, 5)}... for ${req.method} ${req.originalUrl}`,
    );

    // Check if token is blacklisted
    let isBlacklisted = false;
    try {
      const redisClient = getRedisClient();
      if (redisClient && redisClient.isReady) {
        const blacklistKey = `customer_blacklist:${token}`;
        const blacklistResult = await redisClient.get(blacklistKey);
        isBlacklisted = !!blacklistResult;
      }
    } catch (redisError) {
      logger.warn(
        "Redis not available for customer blacklist check:",
        redisError.message,
      );
    }

    if (isBlacklisted) {
      logger.warn("Customer Auth: Token is blacklisted");
      return res.status(401).json({
        success: false,
        message: "Token has been invalidated. Please login again.",
      });
    }

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (jwtError) {
      logger.error("Customer Auth: JWT verification failed:", jwtError.message);
      return res.status(401).json({
        success: false,
        message:
          jwtError.name === "TokenExpiredError"
            ? "Token expired."
            : "Invalid token.",
      });
    }

    // Ensure this is a customer token
    if (decoded.type !== "customer") {
      logger.warn(`Customer Auth: Invalid token type: ${decoded.type}`);
      return res.status(401).json({
        success: false,
        message: "Invalid token type. Customer token required.",
      });
    }

    // Check if customer exists and is active
    const customer = await Customer.findById(decoded.customerId);

    if (!customer) {
      logger.warn(`Customer Auth: Customer not found: ${decoded.customerId}`);
      return res.status(401).json({
        success: false,
        message: "User not found.",
      });
    }

    const debugMsg = `[${new Date().toISOString()}] [MIDDLEWARE] Customer ${customer._id} isActive: ${customer.isActive}, Name: ${customer.name}\n`;
    fs.appendFileSync(DEBUG_LOG_PATH, debugMsg);

    if (!customer.isActive) {
      logger.warn(`Customer Auth: Account deactivated: ${decoded.customerId}`);
      return res.status(401).json({
        success: false,
        message: "Your account has been deactivated. Please contact support.",
      });
    }

    // Enforce strict session validation for customers
    try {
      const redisClient = getRedisClient();
      if (redisClient && redisClient.isReady) {
        // Prefix is 'customer_' for customer sessions
        const sessionId = decoded.sessionId;
        const sessionKey = `customer_session:${decoded.customerId}:${sessionId}`;

        const sessionData = await redisClient.get(sessionKey);

        if (!sessionData) {
          logger.warn(
            `Customer Auth: Session not found in Redis: ${sessionKey}`,
          );
          return res.status(401).json({
            success: false,
            message:
              "Your session has been terminated or expired. Please login again.",
          });
        }
      }
    } catch (redisError) {
      logger.warn(
        "Redis not available for customer session validation:",
        redisError.message,
      );
    }

    req.customer = decoded;
    req.token = token;
    next();
  } catch (error) {
    logger.error("Customer authentication unexpected error:", error);
    res.status(401).json({
      success: false,
      message: "Authentication failed.",
    });
  }
};

module.exports = authenticateCustomer;
