const crypto = require("crypto");
const axios = require("axios");
const config = require("../config/env");
const logger = require("./logger");

/**
 * Validate Telegram authentication data
 * @param {Object} userData - Telegram auth data
 * @returns {boolean}
 */
const validateTelegramAuth = (userData) => {
  const { hash, ...rest } = userData;

  const secretKey = crypto
    .createHash("sha256")
    .update(config.envConfig.telegram.botToken)
    .digest();

  const dataCheckString = Object.keys(rest)
    .sort()
    .map((key) => `${key}=${String(rest[key])}`)
    .join("\n");

  const hmac = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  return hmac === hash.toLowerCase(); // Ensure both are lowercase
};

/**
 * Validate Telegram Mini App authentication data (initData)
 * @param {string} initData - URL encoded string from Mini App
 * @returns {Object|boolean} - User data if valid, false otherwise
 */
const validateTelegramWebAppAuth = (initData) => {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    params.delete("hash");

    // Sort and create data check string
    const dataCheckString = Array.from(params.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    // Verify using HMAC-SHA256
    // The secret key for Mini App is "WebAppData"
    const secretKey = crypto
      .createHmac("sha256", "WebAppData")
      .update(config.envConfig.telegram.botToken)
      .digest();

    const computedHash = crypto
      .createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    if (computedHash !== hash) {
      return false;
    }

    // Return parsed user data
    return JSON.parse(params.get("user"));
  } catch (error) {
    logger.error("Telegram WebApp validation error:", error.message);
    return false;
  }
};

/**
 * Check if Telegram auth timestamp is valid
 * @param {number} authDate - Timestamp from Telegram
 * @returns {boolean}
 */
function isValidTelegramAuthDate(authDate) {
  const MAX_AUTH_AGE = 5 * 60; // 5 minutes in seconds
  const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
  return currentTime - authDate <= MAX_AUTH_AGE;
}

/**
 * Send a message via Telegram Bot API
 * @param {string|number} chatId - Recipient chat ID
 * @param {string} text - Message text
 * @param {Object} options - Additional API options
 * @returns {Promise<Object>}
 */
const sendMessage = async (chatId, text, options = {}) => {
  try {
    const token = config.envConfig.telegram.botToken;
    if (!token) {
      throw new Error("Telegram bot token is not configured");
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await axios.post(url, {
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      ...options,
    });

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    logger.error(
      "Telegram sendMessage error:",
      error.response?.data || error.message,
    );
    return {
      success: false,
      error: error.response?.data || error.message,
    };
  }
};

/**
 * Send a notification to admin group/user
 * @param {string} text - Notification text
 * @returns {Promise<Object>}
 */
const sendNotificationToAdmins = async (text) => {
  // Use a default admin chat ID from env or a dedicated config
  const adminChatId = process.env.TELEGRAM_ADMIN_CHAT_ID;
  if (!adminChatId) {
    logger.warn(
      "TELEGRAM_ADMIN_CHAT_ID is not set, skipping admin notification",
    );
    return { success: false, error: "Admin chat ID not set" };
  }

  return sendMessage(adminChatId, `<b>[SYSTEM NOTIFICATION]</b>\n${text}`);
};

module.exports = {
  validateTelegramAuth,
  validateTelegramWebAppAuth,
  isValidTelegramAuthDate,
  sendMessage,
  sendNotificationToAdmins,
};
