const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      // Can be either User (Admin) or Customer
      refPath: "userModel",
    },
    userModel: {
      type: String,
      required: true,
      enum: ["User", "Customer"],
    },
    type: {
      type: String,
      required: true,
      enum: [
        "booking_created",
        "booking_confirmed",
        "booking_cancelled",
        "booking_updated",
        "pay_at_cinema",
        "pending_payment",
        "promotion_new",
        "general",
      ],
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "relatedModel",
      default: null,
    },
    relatedModel: {
      type: String,
      enum: ["Booking", "Promotions"],
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for performance
notificationSchema.index({ userId: 1, isRead: 1, deletedAt: 1 });
notificationSchema.index({ createdAt: -1 });
notificationSchema.index({ deletedAt: 1 });

const Notification = mongoose.model("Notification", notificationSchema);

module.exports = Notification;
