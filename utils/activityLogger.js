const { ActivityLog } = require("../models");
const logger = require("./logger");

/**
 * Log a customer activity to the database.
 * @param {Object} params
 * @param {string} [params.customerId] - The ID of the customer
 * @param {string} [params.userId] - The ID of the administrative user
 * @param {string} params.action - The action being performed (LOGIN, BOOK_CREATE, etc.)
 * @param {string} [params.status="SUCCESS"] - The status of the action
 * @param {string} [params.targetId] - The ID of the related entity (bookingId, showtimeId, etc.)
 * @param {Object} [params.req] - The request object to extract IP and UA
 * @param {Object} [params.metadata] - Additional structured data
 */
const logActivity = async ({
  customerId,
  userId,
  action,
  status = "SUCCESS",
  targetId,
  req,
  metadata = {},
}) => {
  try {
    const logData = {
      customerId,
      userId,
      action,
      status,
      targetId,
      metadata,
    };

    if (req) {
      logData.ipAddress =
        req.ip || req.get("x-forwarded-for") || req.connection.remoteAddress;
      const ua = req.get("User-Agent");
      logData.userAgent = ua;

      // Simple UA Parsing for metadata enrichment
      if (ua) {
        const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua);
        const isTablet = /Tablet|iPad/i.test(ua);

        let os = "Unknown OS";
        if (/Windows/i.test(ua)) os = "Windows";
        else if (/Macintosh/i.test(ua)) os = "macOS";
        else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
        else if (/Android/i.test(ua)) os = "Android";
        else if (/Linux/i.test(ua)) os = "Linux";

        let browser = "Unknown Browser";
        if (/Edg/i.test(ua)) browser = "Edge";
        else if (/Chrome/i.test(ua)) browser = "Chrome";
        else if (/Firefox/i.test(ua)) browser = "Firefox";
        else if (/Safari/i.test(ua)) browser = "Safari";

        logData.metadata.device = isTablet
          ? "Tablet"
          : isMobile
            ? "Mobile"
            : "Desktop";
        logData.metadata.os = os;
        logData.metadata.browser = browser;
      }
    }

    await ActivityLog.create(logData);
  } catch (error) {
    logger.error("Failed to record activity log:", error);
  }
};

module.exports = {
  logActivity,
};
