const crypto = require("crypto");
const config = require("../config/env");

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
 * Check if Telegram auth timestamp is valid
 * @param {number} authDate - Timestamp from Telegram
 * @returns {boolean}
 */
function isValidTelegramAuthDate(authDate) {
  const MAX_AUTH_AGE = 5 * 60; // 5 minutes in seconds
  const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds
  return currentTime - authDate <= MAX_AUTH_AGE;
}

module.exports = { validateTelegramAuth, isValidTelegramAuthDate };
