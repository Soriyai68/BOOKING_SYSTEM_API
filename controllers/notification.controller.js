const { Notification } = require("../models");
const logger = require("../utils/logger");
const { logActivity } = require("../utils/activityLogger");
const { emitEvent } = require("../utils/socket");

class NotificationController {
  /**
   * Get notifications for the authenticated user/customer
   */
  static async getNotifications(req, res) {
    try {
      let userId;
      let userModel;

      if (req.user) {
        userId = req.user.userId;
        userModel = "User";
      } else if (req.customer) {
        userId = req.customer.customerId;
        userModel = "Customer";
      } else {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      const notifications = await Notification.find({
        userId,
        userModel,
        deletedAt: null,
      })
        .sort({ createdAt: -1 })
        .limit(50);

      const unreadCount = await Notification.countDocuments({
        userId,
        userModel,
        isRead: false,
        deletedAt: null,
      });

      res.status(200).json({
        success: true,
        data: {
          notifications,
          unreadCount,
        },
      });
    } catch (error) {
      logger.error("Get notifications error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch notifications" });
    }
  }

  /**
   * Mark a notification as read
   */
  static async markAsRead(req, res) {
    try {
      const { id } = req.params;
      let userId;
      let userModel;

      if (req.user) {
        userId = req.user.userId;
        userModel = "User";
      } else if (req.customer) {
        userId = req.customer.customerId;
        userModel = "Customer";
      } else {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      const notification = await Notification.findOneAndUpdate(
        { _id: id, userId, userModel, deletedAt: null },
        { isRead: true },
        { new: true },
      );

      if (!notification) {
        return res
          .status(404)
          .json({ success: false, message: "Notification not found" });
      }

      res.status(200).json({ success: true, data: notification });

      // Log Activity
      await logActivity({
        userId,
        logType: userModel.toUpperCase(),
        action: "NOTIFICATION_UPDATE",
        targetId: notification._id,
        req,
        metadata: {
          isRead: true,
          type: notification.type,
        },
      });
    } catch (error) {
      logger.error("Mark notification as read error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to mark notification as read",
      });
    }
  }

  /**
   * Mark all notifications as read for the current user
   */
  static async markAllAsRead(req, res) {
    try {
      let userId;
      let userModel;

      if (req.user) {
        userId = req.user.userId;
        userModel = "User";
      } else if (req.customer) {
        userId = req.customer.customerId;
        userModel = "Customer";
      }

      await Notification.updateMany(
        { userId, userModel, isRead: false, deletedAt: null },
        { isRead: true },
      );

      res
        .status(200)
        .json({ success: true, message: "All notifications marked as read" });

      // Log Activity
      await logActivity({
        userId,
        logType: userModel.toUpperCase(),
        action: "NOTIFICATION_UPDATE",
        req,
        metadata: {
          isRead: true,
          all: true,
        },
      });
    } catch (error) {
      logger.error("Mark all as read error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to mark all as read" });
    }
  }

  /**
   * Delete a notification
   */
  static async delete(req, res) {
    try {
      const { id } = req.params;
      let userId;
      let userModel;

      if (req.user) {
        userId = req.user.userId;
        userModel = "User";
      } else if (req.customer) {
        userId = req.customer.customerId;
        userModel = "Customer";
      } else {
        return res
          .status(401)
          .json({ success: false, message: "Unauthorized" });
      }

      const notification = await Notification.findOneAndUpdate(
        {
          _id: id,
          userId,
          userModel,
          deletedAt: null,
        },
        { deletedAt: new Date() },
      );

      if (!notification) {
        return res
          .status(404)
          .json({ success: false, message: "Notification not found" });
      }

      res
        .status(200)
        .json({ success: true, message: "Notification deleted successfully" });

      // Log Activity
      await logActivity({
        userId,
        logType: userModel.toUpperCase(),
        action: "NOTIFICATION_DELETE",
        targetId: notification._id,
        req,
        metadata: {
          type: notification.type,
          title: notification.title,
        },
      });
    } catch (error) {
      logger.error("Delete notification error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to delete notification" });
    }
  }

  /**
   * Delete all notifications for the current user
   */
  static async deleteAll(req, res) {
    try {
      let userId;
      let userModel;

      if (req.user) {
        userId = req.user.userId;
        userModel = "User";
      } else if (req.customer) {
        userId = req.customer.customerId;
        userModel = "Customer";
      }

      await Notification.updateMany(
        { userId, userModel, deletedAt: null },
        { deletedAt: new Date() },
      );

      res
        .status(200)
        .json({ success: true, message: "All notifications deleted" });

      // Log Activity
      await logActivity({
        userId,
        logType: userModel.toUpperCase(),
        action: "NOTIFICATION_DELETE",
        req,
        metadata: {
          all: true,
        },
      });
    } catch (error) {
      logger.error("Delete all notifications error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete all notifications",
      });
    }
  }

  /**
   * Generate a dynamic message and metadata based on booking and payment type
   */
  static generateBookingMessage(booking, movieTitle = "Movie") {
    const ref = booking.reference_code;
    const method = booking.payment_method;
    const status = booking.booking_status;

    // Use populatedSeats if available, otherwise fallback to IDs
    const seats = (booking.populatedSeats || booking.seats || [])
      .map((s) => (s && s.seat_identifier ? s.seat_identifier : s))
      .join(", ");

    const metadata = {
      ref,
      movie: movieTitle,
      seats,
      amount: booking.total_price,
      method: method || "",
      status,
      payment_status: booking.payment_status || "",
    };

    let message = "";
    let type = "booking_created";

    // payment_method: "Bakong", "Cash", "PayAtCinema"

    if (status === "Cancelled") {
      type = "booking_cancelled";
      message = `Your booking ${ref} for "${movieTitle}" has been cancelled.`;
    } else if (method === "PayAtCinema") {
      type = "pay_at_cinema";
      message = `Booking ${ref} confirmed for "${movieTitle}".\n\n📌 Important: Please arrive at the cinema at least 30 minutes before the show starts to complete your payment and collect your tickets.\n\nSeats: ${seats}`;
    } else if (method === "Bakong") {
      if (booking.payment_status === "Completed") {
        type = "booking_confirmed";
        message = `Payment received! Your tickets for "${movieTitle}" are confirmed.\n\nReference: ${ref}\nSeats: ${seats}\n\nShow this code at the counter or use it to enter.`;
      } else {
        type = "pending_payment";
        message = `Booking ${ref} created for "${movieTitle}".\n\nPlease complete your Bakong payment to confirm your seats.\n\nSeats: ${seats}`;
      }
    } else {
      // Cash
      type = "booking_created";
      message = `Your booking ${ref} for "${movieTitle}" has been processed.\n\nSeats: ${seats}\nTotal: $${booking.total_price}`;
    }

    return { message, metadata, type };
  }

  /**
   * Create a notification (Internal helper)
   */
  static async createInternal({
    userId,
    userModel,
    type,
    title,
    message,
    metadata = {},
    relatedId = null,
    relatedModel = null,
  }) {
    try {
      const notification = new Notification({
        userId,
        userModel,
        type,
        title,
        message,
        metadata,
        relatedId,
        relatedModel: relatedId ? relatedModel || "Booking" : null,
      });
      await notification.save();
      
      // Notify via Socket.io
      emitEvent("notification:new", { 
        userId: notification.userId, 
        notification 
      });

      return notification;
    } catch (error) {
      logger.error("Internal create notification error:", error);
    }
  }

  /**
   * Notify all admins and superadmins
   */
  static async notifyAdmins({
    type,
    title,
    message,
    metadata = {},
    relatedId = null,
    relatedModel = "Booking",
    req = null,
  }) {
    try {
      const { User } = require("../models");
      const { Role } = require("../data");

      const admins = await User.find({
        role: { $in: [Role.ADMIN, Role.SUPERADMIN, Role.CASHIER] },
        isActive: true,
        deletedAt: null,
      });

      const notifications = admins.map((admin) => ({
        userId: admin._id,
        userModel: "User",
        type,
        title,
        message,
        metadata,
        relatedId,
        relatedModel: relatedId ? relatedModel : null,
      }));

      if (notifications.length > 0) {
        const savedNotifications = await Notification.insertMany(notifications);

        // Notify via Socket.io (Admins)
        // We emit it as notification:new so the store catches it and adds to list
        savedNotifications.forEach(notif => {
          emitEvent("notification:new", { 
            userId: notif.userId, 
            notification: notif 
          });
        });

        // Backward compatibility if needed
        emitEvent("notification:admin", { count: savedNotifications.length });

        // Log Activity
        await logActivity({
          userId: req?.user?.userId,
          logType: "ADMIN",
          action: "NOTIFICATION_SEND",
          req,
          metadata: {
            type,
            title,
            recipientCount: notifications.length,
            recipientType: "Admins",
          },
        });
      }
    } catch (error) {
      logger.error("Notify admins error:", error);
    }
  }

  /**
   * Notify a specific customer
   */
  static async notifyCustomer(
    customerId,
    {
      type,
      title,
      message,
      metadata = {},
      relatedId = null,
      relatedModel = "Booking",
    },
    req = null,
  ) {
    const result = await this.createInternal({
      userId: customerId,
      userModel: "Customer",
      type,
      title,
      message,
      metadata,
      relatedId,
      relatedModel: relatedId ? relatedModel : null,
    });

    // Log Activity
    await logActivity({
      userId: req?.user?.userId || req?.customer?.customerId,
      logType: req?.user?.userId ? "ADMIN" : "CUSTOMER",
      action: "NOTIFICATION_SEND",
      targetId: customerId,
      req,
      metadata: {
        type,
        title,
        recipientType: "Customer",
      },
    });

    return result;
  }

  /**
   * Notify all active customers
   */
  static async notifyAllCustomers({
    type,
    title,
    message,
    metadata = {},
    relatedId = null,
    relatedModel = "Promotions",
    req = null,
  }) {
    try {
      const { Customer } = require("../models");

      const customers = await Customer.find({
        isActive: true,
        deletedAt: null,
      }).select("_id");

      const notifications = customers.map((customer) => ({
        userId: customer._id,
        userModel: "Customer",
        type,
        title,
        message,
        metadata,
        relatedId,
        relatedModel: relatedId ? relatedModel : null,
      }));

      if (notifications.length > 0) {
        // Use insertMany for efficiency
        await Notification.insertMany(notifications);

        // Notify via Socket.io (All Customers)
        emitEvent("notification:all", { count: notifications.length });

        // Log Activity
        await logActivity({
          userId: req?.user?.userId,
          logType: "ADMIN",
          action: "NOTIFICATION_SEND",
          req,
          metadata: {
            type,
            title,
            recipientCount: notifications.length,
            recipientType: "All Customers",
          },
        });

        logger.info(
          `Bulk notifications sent to ${notifications.length} customers`,
        );
      }
    } catch (error) {
      logger.error("Notify all customers error:", error);
    }
  }
}

module.exports = NotificationController;
