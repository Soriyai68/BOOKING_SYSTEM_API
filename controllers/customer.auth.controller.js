const Customer = require("../models/customer.model");
const AuthService = require("../service/auth.service");
const logger = require("../utils/logger");
const Providers = require("../data/providers");
const jwt = require("jsonwebtoken");
const Telegram = require("../utils/telegram");

const PREFIX = "customer_";

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

  // Helper method to handle successful authentication
  static async handleAuthSuccess(req, res, customer, isNewCustomer, loginType) {
    // Generate tokens
    const tokens = AuthService.generateTokens({
      customerId: customer._id,
      phone: customer.phone,
      telegramId: customer.telegramId,
      type: "customer",
    });

    // Store refresh token
    await AuthService.storeRefreshToken(
      customer._id,
      tokens.refreshToken,
      PREFIX,
      {
        customerId: customer._id.toString(),
        userAgent: req.get("User-Agent") || "unknown",
        ip: req.ip || req.connection.remoteAddress,
        loginType: loginType,
      },
    );

    // Create session
    const sessionId = await AuthService.createSession(customer._id, PREFIX, {
      customerId: customer._id.toString(),
      userAgent: req.get("User-Agent") || "unknown",
      ip: req.ip || req.connection.remoteAddress,
      loginType: loginType,
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
}

module.exports = CustomerAuthController;
