const User = require("../models/user.model");
const { generateTokenPair, generateAccessToken } = require("../utils/jwt");
const logger = require("../utils/logger");
const Providers = require("../data/providers");
const { getRedisClient } = require("../config/redis");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

class AuthController {
  // Logout user
  static async logout(req, res) {
    try {
      const token = req.header("Authorization")?.replace("Bearer ", "");
      const { sessionId } = req.body || {}; // Optional: specific session to logout

      if (!token) {
        return res.status(400).json({
          success: false,
          message: "No token provided",
        });
      }

      // Decode token to get user info and expiration
      const decoded = jwt.decode(token);
      if (!decoded) {
        return res.status(400).json({
          success: false,
          message: "Invalid token",
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
          await redisClient.setEx(blacklistKey, ttl, "blacklisted");
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
          const sessionKeys = sessionIds.map((id) => `session:${userId}:${id}`);
          if (sessionKeys.length > 0) {
            await redisClient.del(sessionKeys);
          }

          // Clear the sessions set
          await redisClient.del(userSessionsKey);

          logger.info(`All sessions logged out for user: ${userId}`);
        }

        // Log activity
        const { logActivity } = require("../utils/activityLogger");
        await logActivity({
          userId: userId,
          action: "USER_LOGOUT",
          req,
        });
      } catch (redisError) {
        // Redis error - log but continue with logout
        logger.warn(
          "Redis operations failed during logout:",
          redisError.message,
        );
      }

      res.status(200).json({
        success: true,
        message: "Logged out successfully",
      });
    } catch (error) {
      logger.error("Logout error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get current user profile
  static async getProfile(req, res) {
    try {
      const user = await User.findById(req.user.userId).select("-__v");

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            name: user.name,
            phone: user.phone,
            photoUrl: user.photoUrl,
            role: user.role,
            isVerified: user.isVerified,
            lastLogin: user.lastLogin,
            createdAt: user.createdAt,
          },
        },
      });
    } catch (error) {
      logger.error("Get profile error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Admin login with password
  static async adminLogin(req, res) {
    try {
      const { username, password } = req.body || {};

      if (!username || !password) {
        return res.status(400).json({
          success: false,
          message: "Username or Gmail and password are required",
        });
      }

      // Find user with password field included
      // Search by email or username
      const user = await User.findOne({
        $or: [{ email: username.toLowerCase() }, { username: username }],
      }).select("+password");

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: "Your account has been deactivated. Please contact support.",
        });
      }

      // Check if user is admin or superadmin
      if (!user.requiresPassword()) {
        return res.status(403).json({
          success: false,
          message: "This login method is only for admin users",
        });
      }

      // Verify password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
        });
      }

      // Update last login
      user.lastLogin = new Date();
      await user.save();

      // Generate JWT token pair for admin
      const tokens = generateTokenPair({
        userId: user._id,
        username: user.username,
        role: user.role,
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
          userAgent: req.get("User-Agent") || "unknown",
          ip: req.ip || req.connection.remoteAddress,
          loginType: "admin",
        };

        await redisClient.setEx(
          refreshTokenKey,
          7 * 24 * 60 * 60,
          JSON.stringify(refreshTokenData),
        );

        // Create admin session in Redis (manual way to avoid strict parity if not wanted)
        sessionId = crypto.randomUUID();
        const sessionKey = `admin_session:${user._id}:${sessionId}`;
        const sessionData = {
          sessionId,
          userId: user._id.toString(),
          username: user.username,
          role: user.role,
          loginTime: Date.now(),
          userAgent: req.get("User-Agent") || "unknown",
          ip: req.ip || req.connection.remoteAddress,
          isActive: true,
          loginType: "admin",
        };

        await redisClient.setEx(
          sessionKey,
          24 * 60 * 60,
          JSON.stringify(sessionData),
        );

        // Use sAdd method (capital A) for Redis sets
        const userSessionsKey = `admin_sessions:${user._id}`;
        if (redisClient.sAdd) {
          await redisClient.sAdd(userSessionsKey, sessionId);
        } else if (redisClient.sadd) {
          await redisClient.sadd(userSessionsKey, sessionId);
        } else {
          logger.warn(
            "Redis sAdd/sadd method not available, skipping session tracking",
          );
        }
        await redisClient.expire(userSessionsKey, 7 * 24 * 60 * 60);

        logger.info(`Admin session stored in Redis: ${sessionId}`);
      } catch (redisError) {
        // Redis error - continue without Redis session management
        logger.warn(
          "Redis not available, continuing without session management:",
          redisError.message,
        );
        sessionId = crypto.randomUUID(); // Generate session ID anyway for response
      }

      logger.info(`Admin logged in: ${user.username} (${user.role})`);

      // Log activity
      const { logActivity } = require("../utils/activityLogger");
      await logActivity({
        userId: user._id,
        action: "USER_LOGIN",
        req,
        metadata: {
          role: user.role,
          username: user.username,
        },
      });

      res.status(200).json({
        success: true,
        message: "Login successful",
        data: {
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            name: user.name,
            phone: user.phone,
            photoUrl: user.photoUrl,
            role: user.role,
            isVerified: user.isVerified,
            lastLogin: user.lastLogin,
          },
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          sessionId: sessionId,
        },
      });
    } catch (error) {
      logger.error("Admin login error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
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
          message: "Refresh token is required",
        });
      }

      // Verify refresh token
      let decoded;
      try {
        decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
      } catch (error) {
        return res.status(401).json({
          success: false,
          message: "Invalid refresh token",
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
              message: "Invalid refresh token",
            });
          }
        }
      } catch (redisError) {
        logger.warn(
          "Redis not available for token validation:",
          redisError.message,
        );
        // Continue without Redis validation
      }

      if (!storedTokenData) {
        return res.status(401).json({
          success: false,
          message: "Refresh token not found or expired",
        });
      }

      // Get user data
      const user = await User.findById(decoded.userId);
      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: "User not found or inactive",
        });
      }

      // Generate new access token
      const newAccessToken = generateAccessToken({
        userId: user._id,
        username: user.username,
        role: user.role,
      });

      res.status(200).json({
        success: true,
        message: "Token refreshed successfully",
        data: {
          accessToken: newAccessToken,
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            name: user.name,
            role: user.role,
          },
        },
      });
    } catch (error) {
      logger.error("Refresh token error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Get user's activity logs
  static async getActivityLogs(req, res) {
    try {
      const userId = req.user.userId;
      const { page = 1, limit = 10 } = req.query;

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      const ActivityLog = require("../models/activityLog.model");

      const [logs, total] = await Promise.all([
        ActivityLog.find({ userId })
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        ActivityLog.countDocuments({ userId }),
      ]);

      res.status(200).json({
        success: true,
        data: {
          logs,
          pagination: {
            currentPage: pageNum,
            totalPages: Math.ceil(total / limitNum),
            totalCount: total,
            limit: limitNum,
          },
        },
      });
    } catch (error) {
      logger.error("Get admin activity logs error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve activity logs",
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
              type: "user",
              ttl: await redisClient.ttl(sessionKey),
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
              type: "admin",
              ttl: await redisClient.ttl(sessionKey),
            });
          }
        }
      } catch (redisError) {
        logger.warn(
          "Redis not available for session retrieval:",
          redisError.message,
        );
        // Return empty sessions if Redis is not available
      }

      res.status(200).json({
        success: true,
        data: {
          sessions: allSessions,
          totalSessions: allSessions.length,
        },
      });
    } catch (error) {
      logger.error("Get sessions error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
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
          message: "Session ID is required",
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
        logger.warn(
          "Redis operations failed during session logout:",
          redisError.message,
        );
        // Assume session was found if Redis is not available
        sessionFound = true;
      }

      if (sessionFound) {
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
      logger.error("Logout session error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
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
        redisAvailable: false,
      };

      // Try Redis operations with error handling
      try {
        const redisClient = getRedisClient();

        // Get various auth-related counts from Redis
        const keys = await redisClient.keys("*");

        stats = {
          totalKeys: keys.length,
          otpKeys: keys.filter((key) => key.startsWith("otp:")).length,
          sessionKeys: keys.filter((key) => key.startsWith("session:")).length,
          adminSessionKeys: keys.filter((key) =>
            key.startsWith("admin_session:"),
          ).length,
          refreshTokenKeys: keys.filter((key) =>
            key.startsWith("refresh_token:"),
          ).length,
          blacklistedTokens: keys.filter((key) => key.startsWith("blacklist:"))
            .length,
          rateLimitKeys: keys.filter((key) => key.startsWith("otp_rate_limit:"))
            .length,
          redisAvailable: true,
        };
      } catch (redisError) {
        logger.warn("Redis not available for stats:", redisError.message);
        // Return default stats indicating Redis is not available
      }

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error("Get auth stats error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
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
          message: "New password is required",
        });
      }

      // Get user with password field included
      const user = await User.findById(userId).select("+password");

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Check if user already has a password
      const hasPassword = user.password && user.password.length > 0;

      if (hasPassword) {
        // User has existing password - require current password
        if (!currentPassword) {
          return res.status(400).json({
            success: false,
            message: "Current password is required to change password",
          });
        }

        // Verify current password
        const isCurrentPasswordValid =
          await user.comparePassword(currentPassword);
        if (!isCurrentPasswordValid) {
          return res.status(400).json({
            success: false,
            message: "Current password is incorrect",
          });
        }

        // Check if new password is different from current password
        const isSamePassword = await user.comparePassword(newPassword);
        if (isSamePassword) {
          return res.status(400).json({
            success: false,
            message: "New password must be different from current password",
          });
        }
      } else {
        // User doesn't have password - they're setting up their first password
        // No current password verification needed
        logger.info(
          `User ${user.username || user.email} is setting up their first password`,
        );
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
            sessionIds = (await redisClient.sMembers(userSessionsKey)) || [];
            adminSessionIds =
              (await redisClient.sMembers(adminSessionsKey)) || [];
          } else if (redisClient.smembers) {
            sessionIds = (await redisClient.smembers(userSessionsKey)) || [];
            adminSessionIds =
              (await redisClient.smembers(adminSessionsKey)) || [];
          }

          // Delete all session keys
          const allSessionKeys = [
            ...sessionIds.map((id) => `session:${userId}:${id}`),
            ...adminSessionIds.map((id) => `admin_session:${userId}:${id}`),
          ];

          if (allSessionKeys.length > 0) {
            await redisClient.del(allSessionKeys);
          }

          // Clear session sets
          await redisClient.del([userSessionsKey, adminSessionsKey]);

          logger.info(
            `All sessions cleared for user ${userId} after password change`,
          );
        } catch (redisError) {
          logger.warn(
            "Redis operations failed during password change:",
            redisError.message,
          );
          // Continue even if Redis operations fail
        }
      }

      logger.info(
        `Password ${isFirstTimeSetup ? "set up" : "changed"} for user: ${user.username || user.email}`,
      );

      const message = isFirstTimeSetup
        ? "Password set up successfully. You can now login using your username or email and password."
        : "Password changed successfully. Please login again with your new password.";

      res.status(200).json({
        success: true,
        message,
        data: {
          isFirstTimeSetup,
          requiresReauth: hasPassword, // Only require re-auth if they had a password before
        },
      });
    } catch (error) {
      logger.error("Change password error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }

  // Reset password (no OTP — looks up user by username or email)
  static async resetPassword(req, res) {
    try {
      const { username, newPassword } = req.body || {};

      if (!username || !newPassword) {
        return res.status(400).json({
          success: false,
          message: "Username or email and new password are required",
        });
      }

      // Find user by username or email
      const user = await User.findOne({
        $or: [{ email: username.toLowerCase() }, { username: username }],
      }).select("+password");

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Check if new password is different from current password (if they have one)
      if (user.password && user.password.length > 0) {
        const isSamePassword = await user.comparePassword(newPassword);
        if (isSamePassword) {
          return res.status(400).json({
            success: false,
            message: "New password must be different from current password",
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

        const refreshTokenKey = `refresh_token:${user._id}`;
        await redisClient.del(refreshTokenKey);

        const userSessionsKey = `user_sessions:${user._id}`;
        const adminSessionsKey = `admin_sessions:${user._id}`;

        let sessionIds = [];
        let adminSessionIds = [];

        if (redisClient.sMembers) {
          sessionIds = (await redisClient.sMembers(userSessionsKey)) || [];
          adminSessionIds =
            (await redisClient.sMembers(adminSessionsKey)) || [];
        } else if (redisClient.smembers) {
          sessionIds = (await redisClient.smembers(userSessionsKey)) || [];
          adminSessionIds =
            (await redisClient.smembers(adminSessionsKey)) || [];
        }

        const allSessionKeys = [
          ...sessionIds.map((id) => `session:${user._id}:${id}`),
          ...adminSessionIds.map((id) => `admin_session:${user._id}:${id}`),
        ];

        if (allSessionKeys.length > 0) {
          await redisClient.del(allSessionKeys);
        }

        await redisClient.del([userSessionsKey, adminSessionsKey]);

        logger.info(
          `All sessions cleared for user ${user._id} after password reset`,
        );
      } catch (redisError) {
        logger.warn(
          "Redis operations failed during password reset:",
          redisError.message,
        );
      }

      logger.info(`Password reset for user: ${user.username || user.email}`);

      res.status(200).json({
        success: true,
        message:
          "Password reset successfully. Please login with your new password.",
      });
    } catch (error) {
      logger.error("Reset password error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  }
}

module.exports = AuthController;
