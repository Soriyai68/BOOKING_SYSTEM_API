const mongoose = require("mongoose");

const activityLogSchema = new mongoose.Schema(
  {
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    logType: {
      type: String,
      enum: ["ADMIN", "CUSTOMER"],
      required: true,
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        "LOGIN",
        "LOGOUT",
        "ROLE_UPDATE",
        "PERMISSION_UPDATE",
        "BOOK_CREATE_PENDING",
        "BOOK_CREATE_CONFIRMED",
        "BOOK_UPDATE",
        "BOOK_UPDATE_SEATS",
        "BOOK_CANCEL",
        "BOOK_RESTORE",
        "BOOK_DELETE",
        "BOOK_FORCE_DELETE",
        "BOOK_EXPIRED",
      ],
      index: true,
    },
    status: {
      type: String,
      enum: ["SUCCESS", "FAILED"],
      default: "SUCCESS",
    },
    targetId: {
      type: mongoose.Schema.Types.ObjectId,
      index: true,
    }, // Reference to Booking, Showtime, etc.
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

// Indexes for performance
activityLogSchema.index({ customerId: 1, action: 1, createdAt: -1 });
activityLogSchema.index({ userId: 1, action: 1, createdAt: -1 });
activityLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 90 },
); // Keep logs for 90 days

module.exports = mongoose.model("ActivityLog", activityLogSchema);
