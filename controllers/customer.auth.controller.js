const Customer = require("../models/customer.model");
const AuthService = require("../service/auth.service");
const logger = require("../utils/logger");
const Providers = require("../data/providers");
const jwt = require("jsonwebtoken");

const PREFIX = "customer_";

class CustomerAuthController {
  // Send OTP for registration or login
  static async sendOTP(req, res) {
    try {
      const { phone } = req.body || {};

      if (!phone) {
        return res.status(400).json({
          success: false,
          message: "Phone number is required",
        });
      }

      if (!AuthService.isValidPhone(phone)) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid phone number",
        });
      }

      // Check rate limiting
      const rateLimit = await AuthService.checkOTPRateLimit(phone, PREFIX);
      if (!rateLimit.allowed) {
        return res.status(429).json({
          success: false,
          message: rateLimit.message,
        });
      }

      // Check if OTP already sent recently
      const existingOTP = await AuthService.checkExistingOTP(phone, PREFIX);
      if (existingOTP.exists) {
        return res.status(429).json({
          success: false,
          message: `OTP already sent. Please wait ${Math.ceil(
            existingOTP.ttl / 60
          )} minutes before requesting again.`,
        });
      }

      // Generate and store OTP
      const otp = AuthService.generateOTP();
      const storeResult = await AuthService.storeOTP(phone, otp, PREFIX);

      if (!storeResult.success) {
        return res.status(500).json({
          success: false,
          message: "Failed to generate OTP. Please try again.",
        });
      }

      // Update rate limit
      await AuthService.updateRateLimit(phone, PREFIX);

      // Send OTP via SMS
      const smsResult = await AuthService.sendOTP(phone, otp, "login");

      if (!smsResult.success) {
        await AuthService.deleteOTP(phone, PREFIX);
        return res.status(500).json({
          success: false,
          message: "Failed to send OTP. Please try again.",
        });
      }

      logger.info(`Customer OTP sent to phone: ${phone}`);

      res.status(200).json({
        success: true,
        message: "OTP sent successfully",
        data: {
          phone,
          otp,
          expiresIn: "5 minutes",
        },
      });
    } catch (error) {
      logger.error("Customer Send OTP error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Verify OTP and register/login customer
  static async verifyOTP(req, res) {
    try {
      const { phone, otp, name } = req.body || {};

      if (!phone || !otp) {
        return res.status(400).json({
          success: false,
          message: "Phone number and OTP are required",
        });
      }

      // Verify OTP
      const otpResult = await AuthService.verifyOTP(phone, otp, PREFIX);
      if (!otpResult.valid) {
        return res.status(400).json({
          success: false,
          message: otpResult.message,
        });
      }

      let customer = await Customer.findOne({ phone });
      let isNewCustomer = false;

      if (customer) {
        if (!customer.isActive) {
          return res.status(403).json({
            success: false,
            message:
              "Your account has been deactivated. Please contact support.",
          });
        }

        customer.lastLogin = new Date();
        customer.isVerified = true;
        await customer.save();

        logger.info(`Customer logged in: ${phone}`);
      } else {
        const { username } = req.body;
        if (!name || name.trim().length < 2) {
          return res.status(400).json({
            success: false,
            message: "Name is required for registration (minimum 2 characters)",
          });
        }

        // If username is provided, check for uniqueness
        if (username) {
          const existingCustomer = await Customer.findOne({
            username: username.trim().toLowerCase(),
          });
          if (existingCustomer) {
            return res.status(409).json({
              success: false,
              message:
                "This username is already taken. Please choose another one.",
            });
          }
        }

        const customerData = {
          phone,
          name: name.trim(),
          provider: Providers.PHONE,
          isVerified: true,
          lastLogin: new Date(),
        };

        if (username) {
          customerData.username = username.trim().toLowerCase();
        }

        customer = new Customer(customerData);

        await customer.save();
        isNewCustomer = true;
        logger.info(`New customer registered: ${phone}`);
      }

      // Generate tokens
      const tokens = AuthService.generateTokens({
        customerId: customer._id,
        phone: customer.phone,
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
        }
      );

      // Create session
      const sessionId = await AuthService.createSession(customer._id, PREFIX, {
        customerId: customer._id.toString(),
        phone: customer.phone,
        userAgent: req.get("User-Agent") || "unknown",
        ip: req.ip || req.connection.remoteAddress,
      });

      res.status(200).json({
        success: true,
        message: isNewCustomer ? "Registration successful" : "Login successful",
        data: {
          customer: {
            id: customer._id,
            phone: customer.phone,
            name: customer.name,
            isVerified: customer.isVerified,
            customerType: customer.customerType, // Add customerType to response
          },
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          sessionId,
        },
      });
    } catch (error) {
      logger.error("Customer Verify OTP error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Customer login with password (optional)
  static async login(req, res) {
    try {
      const { phone, password } = req.body || {};

      if (!phone || !password) {
        return res.status(400).json({
          success: false,
          message: "Phone number and password are required",
        });
      }

      const customer = await Customer.findOne({ phone }).select("+password");

      if (!customer) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      if (!customer.isActive) {
        return res.status(403).json({
          success: false,
          message: "Your account has been deactivated. Please contact support.",
        });
      }

      // Ensure only 'member' customers can log in with a password
      if (!customer.isMemberCustomer()) {
        return res.status(403).json({
          success: false,
          message: "Password login is not available for this account type.",
        });
      }

      if (!customer.requiresPassword()) {
        return res.status(400).json({
          success: false,
          message:
            "Password not set. Please use OTP login or set up a password first.",
        });
      }

      const isPasswordValid = await customer.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      customer.lastLogin = new Date();
      await customer.save();

      // Generate tokens
      const tokens = AuthService.generateTokens({
        customerId: customer._id,
        phone: customer.phone,
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
          loginType: "password",
        }
      );

      // Create session
      const sessionId = await AuthService.createSession(customer._id, PREFIX, {
        customerId: customer._id.toString(),
        phone: customer.phone,
        userAgent: req.get("User-Agent") || "unknown",
        ip: req.ip || req.connection.remoteAddress,
        loginType: "password",
      });

      logger.info(`Customer logged in with password: ${phone}`);

      res.status(200).json({
        success: true,
        message: "Login successful",
        data: {
          customer: {
            id: customer._id,
            phone: customer.phone,
            name: customer.name,
            isVerified: customer.isVerified,
            customerType: customer.customerType, // Add customerType to response
          },
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          sessionId,
        },
      });
    } catch (error) {
      logger.error("Customer login error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
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
        "-__v"
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
            isVerified: customer.isVerified,
            createdAt: customer.createdAt,
            customerType: customer.customerType, // Add customerType to response
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
        PREFIX
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
        PREFIX
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

  // Change password for authenticated customer
  static async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body || {};
      const customerId = req.customer.customerId;

      if (!newPassword) {
        return res.status(400).json({
          success: false,
          message: "New password is required",
        });
      }

      const customer = await Customer.findById(customerId).select("+password");

      if (!customer) {
        return res.status(404).json({
          success: false,
          message: "Customer not found",
        });
      }

      const hasPassword = customer.password && customer.password.length > 0;

      if (hasPassword) {
        if (!currentPassword) {
          return res.status(400).json({
            success: false,
            message: "Current password is required to change password",
          });
        }

        const isCurrentPasswordValid = await customer.comparePassword(
          currentPassword
        );
        if (!isCurrentPasswordValid) {
          return res.status(400).json({
            success: false,
            message: "Current password is incorrect",
          });
        }

        const isSamePassword = await customer.comparePassword(newPassword);
        if (isSamePassword) {
          return res.status(400).json({
            success: false,
            message: "New password must be different from current password",
          });
        }
      }

      customer.password = newPassword;
      customer.passwordChangedAt = new Date();
      await customer.save();

      const isFirstTimeSetup = !hasPassword;

      if (hasPassword) {
        await AuthService.deleteRefreshToken(customerId, PREFIX);
        await AuthService.deleteAllSessions(customerId, PREFIX);
        logger.info(
          `All customer sessions cleared after password change: ${customerId}`
        );
      }

      logger.info(
        `Password ${isFirstTimeSetup ? "set up" : "changed"} for customer: ${
          customer.phone
        }`
      );

      const message = isFirstTimeSetup
        ? "Password set up successfully. You can now login using your phone number and password."
        : "Password changed successfully. Please login again with your new password.";

      res.status(200).json({
        success: true,
        message,
        data: {
          isFirstTimeSetup,
          requiresReauth: hasPassword,
        },
      });
    } catch (error) {
      logger.error("Customer change password error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
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
          message: "Phone number is required",
        });
      }

      if (!AuthService.isValidPhone(phone)) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid phone number",
        });
      }

      const customer = await Customer.findOne({ phone });

      if (!customer) {
        return res.status(404).json({
          success: false,
          message: "Customer not found",
        });
      }

      const resetPrefix = `${PREFIX}reset_`;

      // Check rate limiting
      const rateLimit = await AuthService.checkOTPRateLimit(phone, resetPrefix);
      if (!rateLimit.allowed) {
        return res.status(429).json({
          success: false,
          message:
            "Too many password reset requests. Please try again after an hour.",
        });
      }

      // Check if OTP already sent recently
      const existingOTP = await AuthService.checkExistingOTP(
        phone,
        resetPrefix
      );
      if (existingOTP.exists) {
        return res.status(429).json({
          success: false,
          message: `Password reset OTP already sent. Please wait ${Math.ceil(
            existingOTP.ttl / 60
          )} minutes before requesting again.`,
        });
      }

      // Generate and store OTP
      const otp = AuthService.generateOTP();
      const storeResult = await AuthService.storeOTP(
        phone,
        otp,
        resetPrefix,
        300,
        "password_reset"
      );

      if (!storeResult.success) {
        return res.status(500).json({
          success: false,
          message: "Failed to generate OTP. Please try again.",
        });
      }

      // Update rate limit
      await AuthService.updateRateLimit(phone, resetPrefix);

      // Send OTP via SMS
      const smsResult = await AuthService.sendOTP(phone, otp, "password_reset");

      if (!smsResult.success) {
        await AuthService.deleteOTP(phone, resetPrefix);
        return res.status(500).json({
          success: false,
          message: "Failed to send password reset OTP. Please try again.",
        });
      }

      logger.info(`Customer password reset OTP sent to phone: ${phone}`);

      res.status(200).json({
        success: true,
        message: "Password reset OTP sent successfully",
        data: {
          phone,
          expiresIn: "5 minutes",
        },
      });
    } catch (error) {
      logger.error("Customer send reset OTP error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
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
          message: "Phone number, OTP, and new password are required",
        });
      }

      if (!AuthService.isValidPhone(phone)) {
        return res.status(400).json({
          success: false,
          message: "Please enter a valid phone number",
        });
      }

      const resetPrefix = `${PREFIX}reset_`;

      // Verify OTP
      const otpResult = await AuthService.verifyOTP(phone, otp, resetPrefix);
      if (!otpResult.valid) {
        return res.status(400).json({
          success: false,
          message: otpResult.message,
        });
      }

      const customer = await Customer.findOne({ phone }).select("+password");

      if (!customer) {
        return res.status(404).json({
          success: false,
          message: "Customer not found",
        });
      }

      const hasPassword = customer.password && customer.password.length > 0;

      if (hasPassword) {
        const isSamePassword = await customer.comparePassword(newPassword);
        if (isSamePassword) {
          return res.status(400).json({
            success: false,
            message: "New password must be different from current password",
          });
        }
      }

      customer.password = newPassword;
      customer.passwordChangedAt = new Date();
      await customer.save();

      // Clear all sessions
      await AuthService.deleteRefreshToken(customer._id, PREFIX);
      await AuthService.deleteAllSessions(customer._id, PREFIX);

      logger.info(`Customer password reset: ${phone}`);

      res.status(200).json({
        success: true,
        message:
          "Password reset successfully. Please login with your new password.",
      });
    } catch (error) {
      logger.error("Customer reset password error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}

module.exports = CustomerAuthController;
