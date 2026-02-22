const { getRedisClient } = require('../config/redis');
const { generateTokenPair, generateAccessToken } = require('../utils/jwt');
const logger = require('../utils/logger');
const crypto = require('crypto');

class AuthService {
  /**
   * Validate email format
   * @param {string} email
   */
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Generate token pair for a user
   * @param {Object} payload - Token payload
   */
  static generateTokens(payload) {
    return generateTokenPair(payload);
  }

  /**
   * Generate access token only
   * @param {Object} payload - Token payload
   */
  static generateAccessTokenOnly(payload) {
    return generateAccessToken(payload);
  }

  /**
   * Store refresh token in Redis
   * @param {string} id - User ID
   * @param {string} token - Refresh token
   * @param {string} prefix - Redis key prefix
   * @param {Object} metadata - Additional metadata
   * @param {number} expirySeconds - Expiry time in seconds
   */
  static async storeRefreshToken(id, token, prefix = '', metadata = {}, expirySeconds = 7 * 24 * 60 * 60) {
    try {
      const redisClient = getRedisClient();
      const refreshTokenKey = `${prefix}refresh_token:${id}`;

      const refreshTokenData = {
        token,
        id: id.toString(),
        createdAt: Date.now(),
        ...metadata
      };

      await redisClient.setEx(refreshTokenKey, expirySeconds, JSON.stringify(refreshTokenData));
      return { success: true };
    } catch (error) {
      logger.warn('Failed to store refresh token:', error.message);
      return { success: false };
    }
  }

  /**
   * Validate refresh token from Redis
   * @param {string} id - User ID
   * @param {string} token - Refresh token to validate
   * @param {string} prefix - Redis key prefix
   */
  static async validateRefreshToken(id, token, prefix = '') {
    try {
      const redisClient = getRedisClient();
      const refreshTokenKey = `${prefix}refresh_token:${id}`;
      const storedTokenData = await redisClient.get(refreshTokenKey);

      if (!storedTokenData) {
        return { valid: false, message: 'Refresh token not found or expired' };
      }

      const tokenData = JSON.parse(storedTokenData);
      if (tokenData.token !== token) {
        return { valid: false, message: 'Invalid refresh token' };
      }

      return { valid: true };
    } catch (error) {
      logger.warn('Refresh token validation failed:', error.message);
      return { valid: false, message: 'Unable to validate token' };
    }
  }

  /**
   * Delete refresh token from Redis
   * @param {string} id - User ID
   * @param {string} prefix - Redis key prefix
   */
  static async deleteRefreshToken(id, prefix = '') {
    try {
      const redisClient = getRedisClient();
      const refreshTokenKey = `${prefix}refresh_token:${id}`;
      await redisClient.del(refreshTokenKey);
    } catch (error) {
      logger.warn('Failed to delete refresh token:', error.message);
    }
  }

  /**
   * Create session in Redis
   * @param {string} id - User ID
   * @param {string} prefix - Redis key prefix
   * @param {Object} sessionData - Session data
   * @param {number} expirySeconds - Expiry time in seconds
   * @returns {Promise<string>} - Session ID
   */
  static async createSession(id, prefix = '', sessionData = {}, expirySeconds = 24 * 60 * 60) {
    const sessionId = crypto.randomUUID();

    try {
      const redisClient = getRedisClient();
      const sessionKey = `${prefix}session:${id}:${sessionId}`;

      const data = {
        sessionId,
        id: id.toString(),
        loginTime: Date.now(),
        isActive: true,
        ...sessionData
      };

      await redisClient.setEx(sessionKey, expirySeconds, JSON.stringify(data));

      // Add to sessions set
      const sessionsKey = `${prefix}sessions:${id}`;
      if (redisClient.sAdd) {
        await redisClient.sAdd(sessionsKey, sessionId);
      } else if (redisClient.sadd) {
        await redisClient.sadd(sessionsKey, sessionId);
      }
      await redisClient.expire(sessionsKey, 7 * 24 * 60 * 60);

      return sessionId;
    } catch (error) {
      logger.warn('Failed to create session:', error.message);
      return sessionId;
    }
  }

  /**
   * Get all sessions for a user
   * @param {string} id - User ID
   * @param {string} prefix - Redis key prefix
   */
  static async getSessions(id, prefix = '') {
    const sessions = [];

    try {
      const redisClient = getRedisClient();
      const sessionsKey = `${prefix}sessions:${id}`;

      let sessionIds = [];
      if (redisClient.sMembers) {
        sessionIds = await redisClient.sMembers(sessionsKey);
      } else if (redisClient.smembers) {
        sessionIds = await redisClient.smembers(sessionsKey);
      }

      for (const sessionId of sessionIds) {
        const sessionKey = `${prefix}session:${id}:${sessionId}`;
        const sessionData = await redisClient.get(sessionKey);
        if (sessionData) {
          const session = JSON.parse(sessionData);
          sessions.push({
            ...session,
            ttl: await redisClient.ttl(sessionKey)
          });
        }
      }
    } catch (error) {
      logger.warn('Failed to get sessions:', error.message);
    }

    return sessions;
  }

  /**
   * Delete a specific session
   * @param {string} id - User ID
   * @param {string} sessionId - Session ID to delete
   * @param {string} prefix - Redis key prefix
   */
  static async deleteSession(id, sessionId, prefix = '') {
    try {
      const redisClient = getRedisClient();
      const sessionKey = `${prefix}session:${id}:${sessionId}`;
      const deleted = await redisClient.del(sessionKey);

      if (deleted) {
        const sessionsKey = `${prefix}sessions:${id}`;
        if (redisClient.sRem) {
          await redisClient.sRem(sessionsKey, sessionId);
        } else if (redisClient.srem) {
          await redisClient.srem(sessionsKey, sessionId);
        }
        return true;
      }
      return false;
    } catch (error) {
      logger.warn('Failed to delete session:', error.message);
      return false;
    }
  }

  /**
   * Delete all sessions for a user
   * @param {string} id - User ID
   * @param {string} prefix - Redis key prefix
   */
  static async deleteAllSessions(id, prefix = '') {
    try {
      const redisClient = getRedisClient();
      const sessionsKey = `${prefix}sessions:${id}`;

      let sessionIds = [];
      if (redisClient.sMembers) {
        sessionIds = await redisClient.sMembers(sessionsKey);
      } else if (redisClient.smembers) {
        sessionIds = await redisClient.smembers(sessionsKey);
      }

      const sessionKeys = sessionIds.map(sid => `${prefix}session:${id}:${sid}`);
      if (sessionKeys.length > 0) {
        await redisClient.del(sessionKeys);
      }

      await redisClient.del(sessionsKey);
      return true;
    } catch (error) {
      logger.warn('Failed to delete all sessions:', error.message);
      return false;
    }
  }

  /**
   * Blacklist a token until it expires
   * @param {string} token - Token to blacklist
   * @param {number} expMs - Token expiry in milliseconds
   * @param {string} prefix - Redis key prefix
   */
  static async blacklistToken(token, expMs, prefix = '') {
    try {
      const redisClient = getRedisClient();
      const blacklistKey = `${prefix}blacklist:${token}`;
      const ttl = Math.max(0, Math.floor((expMs - Date.now()) / 1000));

      if (ttl > 0) {
        await redisClient.setEx(blacklistKey, ttl, 'blacklisted');
      }
    } catch (error) {
      logger.warn('Failed to blacklist token:', error.message);
    }
  }

  /**
   * Check if token is blacklisted
   * @param {string} token - Token to check
   * @param {string} prefix - Redis key prefix
   */
  static async isTokenBlacklisted(token, prefix = '') {
    try {
      const redisClient = getRedisClient();
      const blacklistKey = `${prefix}blacklist:${token}`;
      const result = await redisClient.get(blacklistKey);
      return !!result;
    } catch (error) {
      logger.warn('Failed to check blacklist:', error.message);
      return false;
    }
  }
}

module.exports = AuthService;
