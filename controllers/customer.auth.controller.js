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
const { normalizePhone } = require("../utils/helpers");
const NotificationController = require("./notification.controller");

const PREFIX = "customer_";
const { emitEvent } = require("../utils/socket");

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
        phone,
      } = req.body;

      logger.info(
        `[Auth] Telegram Widget Login attempt: id=${id}, phone_received=${phone}`,
      );

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

      const normalizedPhone = normalizePhone(phone);

      if (customer) {
        customer.lastLogin = new Date();
        customer.name = customerName;
        customer.username = username || customer.username;
        customer.photoUrl = photo_url || customer.photoUrl;

        // Sync phone if provided and not already set
        if (phone && !customer.phone) {
          customer.phone = normalizedPhone;
          logger.info(`[Auth] Updated existing customer ${customer._id} with phone ${normalizedPhone}`);
        }

        await customer.save();

        // Emit refresh if phone was updated
        if (phone) {
          emitEvent("customer:created", customer.toObject());
        }

        logger.info(`Customer logged in via Telegram: ${id}`);
      } else {
        const customerData = {
          telegramId: id,
          name: customerName,
          username: username,
          phone: normalizePhone(phone),
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

        await Telegram.sendNotificationToAdmins(
          `🆕 <b>New Customer (via Telegram)</b>\nName: ${customer.name}\nProvider: telegram\nProvider ID: ${id}\nUser: @${username || "N/A"}`,
        );

        // Notify Admins Dashboard
        await NotificationController.notifyAdmins({
          type: "customer_registered",
          title: "New Customer Registered",
          message: `${customer.name} (@${customer.username || "no_username"}) has registered via Telegram.`,
          metadata: {
            customerId: customer._id,
            name: customer.name,
            source: "Telegram Widget",
          },
          req,
        });

        // Emit socket event for real-time dashboard update
        emitEvent("customer:created", customer.toObject());

        // Welcome Notification (Internal)
        NotificationController.notifyCustomer(
          customer._id,
          {
            type: "welcome",
            title: "Welcome to Movie Booking!",
            message: `Hello ${customer.name}, welcome to our platform! Enjoy your movie experience.`,
          },
          req,
        );
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
      const { initData, phone } = req.body;

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
      const normalizedPhone = normalizePhone(phone);
      logger.info(`[Auth] Telegram WebApp Login: id=${id}, phone_received=${phone}, normalized=${normalizedPhone}`);

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

        if (phone && !customer.phone) {
          customer.phone = normalizedPhone;
          logger.info(`Updated existing customer ${customer._id} with phone ${normalizedPhone}`);
        }

        await customer.save();
        
        // Emit refresh if phone was updated or just for safety
        emitEvent("customer:created", customer.toObject());
        
        logger.info(`Customer logged in via Telegram Mini App: ${id}`);
      } else {
        const customerData = {
          telegramId: id,
          name: customerName,
          username: username,
          phone: normalizePhone(phone),
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

        await Telegram.sendNotificationToAdmins(
          `🆕 <b>New Customer (via Mini App)</b>\nName: ${customer.name}\nProvider: telegram-webapp\nProvider ID: ${id}\nUser: @${username || "N/A"}\nPhone: ${normalizedPhone || "N/A"}`,
        );

        // Notify Admins Dashboard
        await NotificationController.notifyAdmins({
          type: "customer_registered",
          title: "New Customer Registered",
          message: `${customer.name} (@${customer.username || "no_username"}) has registered via Telegram Mini App.`,
          metadata: {
            customerId: customer._id,
            name: customer.name,
            source: "Telegram Mini App",
          },
          req,
        });

        // Emit socket event for real-time dashboard update
        emitEvent("customer:created", customer.toObject());

        // Welcome Notification (Internal)
        NotificationController.notifyCustomer(
          customer._id,
          {
            type: "welcome",
            title: "Welcome to Movie Booking!",
            message: `Hello ${customer.name}, welcome to our platform! Enjoy your movie experience.`,
          },
          req,
        );
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
      const { phone } = req.body;
      const customerId = req.customer.customerId;

      const customer = await Customer.findById(customerId);

      if (!customer) {
        return res.status(404).json({
          success: false,
          message: "Customer not found",
        });
      }

      // Update allowed fields
      if (phone !== undefined) {
        customer.phone = normalizePhone(phone);
      }

      await customer.save();

      // Notify admins via socket to refresh their view
      emitEvent("customer:created", customer.toObject());

      logger.info(`Customer profile updated: ${customerId}`);

      res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        data: {
          customer: {
            id: customer._id,
            phone: customer.phone,
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
      console.error("[Auth] Update profile FAILED:", error);
      res.status(500).json({
        success: false,
        message: error.message || "Internal server error",
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
