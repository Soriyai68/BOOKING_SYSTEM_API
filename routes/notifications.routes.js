const express = require("express");
const NotificationController = require("../controllers/notification.controller");

const router = express.Router();

// GET /api/v1/notifications or /api/v1/customers/notifications
router.get("/", NotificationController.getNotifications);

// PUT /api/v1/notifications/:id/read
router.put("/:id/read", NotificationController.markAsRead);

// PUT /api/v1/notifications/read-all
router.put("/read-all", NotificationController.markAllAsRead);

// DELETE /api/v1/notifications/:id
router.delete("/:id", NotificationController.delete);

// DELETE /api/v1/notifications
router.delete("/", NotificationController.deleteAll);

module.exports = router;
