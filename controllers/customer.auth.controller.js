const Customer = require("../models/customer.model");
const { ActivityLog } = require("../models/index");

const AuthService = require("../service/auth.service");
const logger = require("../utils/logger");
const Providers = require("../data/providers");
const jwt = require("jsonwebtoken");
const Telegram = require("../utils/telegram");
const { UAParser } = require("ua-parser-js");
const crypto = require("crypto");
const { logActivity } = require("../utils/activityLogger");

const PREFIX = "customer_";

const NotificationController = require("./notification.controller");

class CustomerAuthController {
  // Authenticate/Register customer via Telegram (Standard Widget)
  static async telegramLogin(req, res) {
    try {
      const {
        id,
        first_name,
        last_name,
        username,
        photo_url,
        auth_date,
        hash,
      } = req.body;

      if (!id || !auth_date || !hash) {
        return res.status(400).json({
          success: false,
          message: "Telegram authentication data is required.",
        });
      }

      // 1. Validate Telegram data
      const isValidHash = Telegram.validateTelegramAuth(req.body);
      const isValidDate = Telegram.isValidTelegramAuthDate(Number(auth_date));

      if (!isValidHash || !isValidDate) {
        return res.status(401).json({
          success: false,
          message: "Invalid Telegram authentication data.",
        });
      }

      let customer = await Customer.findOne({ telegramId: id });
      let isNewCustomer = false;

      const customerName =
        `${first_name || ""} ${last_name || ""}`.trim() ||
        username ||
        `user_${id}`;

      if (customer) {
        customer.lastLogin = new Date();
        customer.name = customerName;
        customer.username = username || customer.username;
        customer.photoUrl = photo_url || customer.photoUrl;
        await customer.save();
        logger.info(`Customer logged in via Telegram: ${id}`);
      } else {
        const customerData = {
          telegramId: id,
          name: customerName,
          username: username,
          photoUrl: photo_url,
          provider: Providers.TELEGRAM,
          customerType: "member",
          isVerified: true,
          lastLogin: new Date(),
        };

        customer = new Customer(customerData);
        await customer.save();
        isNewCustomer = true;
        logger.info(`New customer registered via Telegram: ${id}`);

        // Send welcome message
        await Telegram.sendMessage(
          id,
          `🎉 <b>Welcome to Movie Booking, ${customer.name}!</b>\n\nYour account has been successfully registered via Telegram.`,
        );

        // Notify admins
        await Telegram.sendNotificationToAdmins(
          `🆕 <b>New Customer (via Telegram)</b>\nName: ${customer.name}\nProvider: telegram\nProvider ID: ${id}\nUser: @${username || "N/A"}`,
        );

        // Welcome Notification (Internal)
        NotificationController.notifyCustomer(customer._id, {
          type: "welcome",
          title: "Welcome to Movie Booking!",
          message: `Hello ${customer.name}, welcome to our platform! Enjoy your movie experience.`,
        });
      }

      // Handle session and tokens
      return await CustomerAuthController.handleAuthSuccess(
        req,
        res,
        customer,
        isNewCustomer,
        "telegram",
      );
    } catch (error) {
      logger.error("Customer Telegram login error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Authenticate/Register customer via Telegram Mini App
  static async telegramWebAppLogin(req, res) {
    try {
      const { initData, phone_number } = req.body;

      if (!initData) {
        return res.status(400).json({
          success: false,
          message: "Missing initData.",
        });
      }

      // 1. Validate Telegram Mini App data
      const userData = Telegram.validateTelegramWebAppAuth(initData);

      if (!userData) {
        return res.status(401).json({
          success: false,
          message: "Invalid Telegram Mini App data.",
        });
      }

      const id = userData.id.toString();
      const { first_name, last_name, username, photo_url } = userData;

      let customer = await Customer.findOne({ telegramId: id });
      let isNewCustomer = false;

      const customerName =
        `${first_name || ""} ${last_name || ""}`.trim() ||
        username ||
        `user_${id}`;

      if (customer) {
        customer.lastLogin = new Date();
        customer.name = customerName;
        customer.username = username || customer.username;
        customer.photoUrl = photo_url || customer.photoUrl;

        // Update phone number if provided by Mini App
        if (phone_number) {
          customer.phone = phone_number;
        }

        await customer.save();
        logger.info(`Customer logged in via Telegram Mini App: ${id}`);
      } else {
        const customerData = {
          telegramId: id,
          name: customerName,
          username: username,
          phone: phone_number,
          photoUrl: photo_url,
          provider: Providers.TELEGRAM,
          customerType: "member",
          isVerified: true,
          lastLogin: new Date(),
        };

        customer = new Customer(customerData);
        await customer.save();
        isNewCustomer = true;
        logger.info(`New customer registered via Telegram Mini App: ${id}`);

        // Send welcome message
        await Telegram.sendMessage(
          id,
          `🎉 <b>Welcome to Movie Booking, ${customer.name}!</b>\n\nYour account has been successfully registered via Telegram Mini App.`,
        );

        // Notify admins
        await Telegram.sendNotificationToAdmins(
          `🆕 <b>New Customer (via Mini App)</b>\nName: ${customer.name}\nProvider: telegram-webapp\nProvider ID: ${id}\nUser: @${username || "N/A"}\nPhone: ${phone_number || "N/A"}`,
        );

        // Welcome Notification (Internal)
        NotificationController.notifyCustomer(customer._id, {
          type: "welcome",
          title: "Welcome to Movie Booking!",
          message: `Hello ${customer.name}, welcome to our platform! Enjoy your movie experience.`,
        });
      }

      // Handle session and tokens
      return await CustomerAuthController.handleAuthSuccess(
        req,
        res,
        customer,
        isNewCustomer,
        "telegram-webapp",
      );
    } catch (error) {
      logger.error("Customer Telegram WebApp login error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  static async handleAuthSuccess(req, res, customer, isNewCustomer, loginType) {
    // Prevent login if account is deactivated
    if (!customer.isActive) {
      return res.status(401).json({
        success: false,
        message: "Your account has been deactivated. Please contact support.",
      });
    }

    // Generate unique session ID first
    const sessionId = crypto.randomUUID();

    // Generate tokens including sessionId in payload
    const tokens = AuthService.generateTokens({
      customerId: customer._id,
      phone: customer.phone,
      telegramId: customer.telegramId,
      sessionId, // Link JWT to specific session
      type: "customer",
    });

    // Parse User-Agent for detailed device info
    const userAgent = req.get("User-Agent") || "unknown";
    const parser = new UAParser(userAgent);
    const uaResult = parser.getResult();

    const device = {
      browser: uaResult.browser.name || "Unknown",
      os: uaResult.os.name || "Unknown",
      vendor: uaResult.device.vendor || "",
      model: uaResult.device.model || "",
      type: uaResult.device.type || "desktop",
    };

    // Store refresh token
    await AuthService.storeRefreshToken(
      customer._id,
      tokens.refreshToken,
      PREFIX,
      {
        customerId: customer._id.toString(),
        sessionId,
        userAgent,
        device,
        ip: req.ip || req.connection.remoteAddress,
        loginType: loginType,
      },
    );

    // Create session using the SAME sessionId
    await AuthService.createSession(
      customer._id,
      PREFIX,
      {
        customerId: customer._id.toString(),
        userAgent,
        device,
        ip: req.ip || req.connection.remoteAddress,
        loginType: loginType,
      },
      24 * 60 * 60, // 24 hours
      sessionId,
    );

    // Update lastLogin timestamp
    customer.lastLogin = new Date();
    await customer.save();

    // Log activity
    await logActivity({
      customerId: customer._id,
      logType: "CUSTOMER",
      action: "LOGIN",
      status: "SUCCESS",
      req,
      metadata: {
        loginType,
        device: device.type,
        os: device.os,
        browser: device.browser,
      },
    });

    return res.status(200).json({
      success: true,
      message: isNewCustomer
        ? `${loginType} registration successful`
        : `${loginType} login successful`,
      data: {
        customer: {
          id: customer._id,
          phone: customer.phone,
          name: customer.name,
          username: customer.username,
          telegramId: customer.telegramId,
          photoUrl: customer.photoUrl,
          isVerified: customer.isVerified,
          email: customer.email,
          createdAt: customer.createdAt,
          customerType: customer.customerType,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        sessionId,
      },
    });
  }

  // Logout customer
  static async logout(req, res) {
    try {
      const token = req.header("Authorization")?.replace("Bearer ", "");
      const { sessionId } = req.body || {};

      if (!token) {
        return res.status(400).json({
          success: false,
          message: "No token provided",
        });
      }

      const decoded = jwt.decode(token);
      if (!decoded) {
        return res.status(400).json({
          success: false,
          message: "Invalid token",
        });
      }

      const customerId = decoded.customerId;
      const tokenExp = decoded.exp * 1000;

      // Blacklist token
      await AuthService.blacklistToken(token, tokenExp, PREFIX);

      // Delete refresh token
      await AuthService.deleteRefreshToken(customerId, PREFIX);

      // Delete session(s)
      if (sessionId) {
        await AuthService.deleteSession(customerId, sessionId, PREFIX);
        logger.info(`Customer session ${sessionId} logged out: ${customerId}`);
      } else {
        await AuthService.deleteAllSessions(customerId, PREFIX);
        logger.info(`All customer sessions logged out: ${customerId}`);
      }

      res.status(200).json({
        success: true,
        message: "Logged out successfully",
      });

      // Log activity
      await logActivity({
        customerId: customerId,
        logType: "CUSTOMER",
        action: "LOGOUT",
        status: "SUCCESS",
        req,
      });

      // Log activity
      await logActivity({
        customerId: customerId,
        logType: "CUSTOMER",
        action: "LOGOUT",
        status: "SUCCESS",
        req,
      });
    } catch (error) {
      logger.error("Customer logout error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get current customer profile
  static async getProfile(req, res) {
    try {
      const customer = await Customer.findById(req.customer.customerId).select(
        "-__v",
      );

      if (!customer) {
        return res.status(404).json({
          success: false,
          message: "Customer not found",
        });
      }

      res.status(200).json({
        success: true,
        data: {
          customer: {
            id: customer._id,
            phone: customer.phone,
            name: customer.name,
            username: customer.username,
            telegramId: customer.telegramId,
            photoUrl: customer.photoUrl,
            isVerified: customer.isVerified,
            email: customer.email,
            createdAt: customer.createdAt,
            customerType: customer.customerType,
          },
        },
      });
    } catch (error) {
      logger.error("Get customer profile error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Refresh access token
  static async refreshToken(req, res) {
    try {
      const { refreshToken } = req.body || {};

      if (!refreshToken) {
        return res.status(400).json({
          success: false,
          message: "Refresh token is required",
        });
      }

      let decoded;
      try {
        decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      } catch (error) {
        return res.status(401).json({
          success: false,
          message: "Invalid refresh token",
        });
      }

      if (decoded.type !== "customer") {
        return res.status(401).json({
          success: false,
          message: "Invalid token type",
        });
      }

      // Validate refresh token
      const validation = await AuthService.validateRefreshToken(
        decoded.customerId,
        refreshToken,
        PREFIX,
      );
      if (!validation.valid) {
        return res.status(401).json({
          success: false,
          message: validation.message,
        });
      }

      const customer = await Customer.findById(decoded.customerId);
      if (!customer || !customer.isActive) {
        return res.status(401).json({
          success: false,
          message: "Customer not found or inactive",
        });
      }

      const newAccessToken = AuthService.generateAccessTokenOnly({
        customerId: customer._id,
        phone: customer.phone,
        telegramId: customer.telegramId,
        type: "customer",
      });

      res.status(200).json({
        success: true,
        message: "Token refreshed successfully",
        data: {
          accessToken: newAccessToken,
          customer: {
            id: customer._id,
            phone: customer.phone,
            name: customer.name,
          },
        },
      });
    } catch (error) {
      logger.error("Customer refresh token error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get customer's active sessions
  static async getSessions(req, res) {
    try {
      const customerId = req.customer.customerId;
      const sessions = await AuthService.getSessions(customerId, PREFIX);

      res.status(200).json({
        success: true,
        data: {
          sessions,
          totalSessions: sessions.length,
        },
      });
    } catch (error) {
      logger.error("Get customer sessions error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Logout specific session
  static async logoutSession(req, res) {
    try {
      const customerId = req.customer.customerId;
      const { sessionId } = req.params;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: "Session ID is required",
        });
      }

      const deleted = await AuthService.deleteSession(
        customerId,
        sessionId,
        PREFIX,
      );

      if (deleted) {
        logger.info(`Customer session ${sessionId} logged out: ${customerId}`);
        res.status(200).json({
          success: true,
          message: "Session logged out successfully",
        });
      } else {
        res.status(404).json({
          success: false,
          message: "Session not found",
        });
      }
    } catch (error) {
      logger.error("Customer logout session error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Update customer profile
  static async updateProfile(req, res) {
    try {
      const { email, phone } = req.body;
      const customerId = req.customer.customerId;

      const customer = await Customer.findById(customerId);

      if (!customer) {
        return res.status(404).json({
          success: false,
          message: "Customer not found",
        });
      }

      // Update allowed fields
      if (email !== undefined) customer.email = email;
      if (phone !== undefined) {
        // Normalize phone number: remove non-digit characters except for leading '+'
        let normalizedPhone = phone.trim().replace(/[^\d+]/g, "");

        // If it starts with '0', assume local and convert to +855 (Cambodia)
        if (normalizedPhone.startsWith("0")) {
          normalizedPhone = "+855" + normalizedPhone.substring(1);
        } else if (
          normalizedPhone.length > 0 &&
          !normalizedPhone.startsWith("+")
        ) {
          // If no '+' and not starting with 0, prepend '+' if it doesn't have it
          normalizedPhone = "+" + normalizedPhone;
        }

        customer.phone = normalizedPhone;
      }

      await customer.save();

      logger.info(`Customer profile updated: ${customerId}`);

      res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        data: {
          customer: {
            id: customer._id,
            phone: customer.phone,
            email: customer.email,
            name: customer.name,
            username: customer.username,
            telegramId: customer.telegramId,
            photoUrl: customer.photoUrl,
            isVerified: customer.isVerified,
            customerType: customer.customerType,
          },
        },
      });
    } catch (error) {
      logger.error("Update customer profile error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Delete customer account
  static async deleteAccount(req, res) {
    try {
      const customerId = req.customer.customerId;
      const token = req.header("Authorization")?.replace("Bearer ", "");

      const customer = await Customer.findById(customerId);

      if (!customer) {
        return res.status(404).json({
          success: false,
          message: "Customer not found",
        });
      }

      // 1. Soft delete the customer account
      // This sets isActive: false and sets deletedAt timestamp
      await customer.softDelete();

      // 2. Blacklist current token
      if (token) {
        const decoded = jwt.decode(token);
        if (decoded && decoded.exp) {
          await AuthService.blacklistToken(token, decoded.exp * 1000, PREFIX);
        }
      }

      // 3. Delete all sessions and refresh tokens
      await AuthService.deleteAllSessions(customerId, PREFIX);
      await AuthService.deleteRefreshToken(customerId, PREFIX);

      logger.info(`Customer account soft-deleted: ${customerId}`);

      res.status(200).json({
        success: true,
        message: "Account deleted successfully",
      });
    } catch (error) {
      logger.error("Delete customer account error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get customer's activity logs

  static async getActivityLogs(req, res) {
    try {
      const customerId = req.customer.customerId;
      const { page = 1, limit = 20, action } = req.query;

      const query = { customerId, logType: "CUSTOMER" };
      if (action) {
        query.action = action;
      }

      const totalLogs = await ActivityLog.countDocuments(query);
      const logs = await ActivityLog.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(Number(limit));

      res.status(200).json({
        success: true,
        data: {
          logs,
          pagination: {
            totalCount: totalLogs,
            currentPage: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil(totalLogs / limit),
          },
        },
      });
    } catch (error) {
      logger.error("Get activity logs error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}

module.exports = CustomerAuthController;
