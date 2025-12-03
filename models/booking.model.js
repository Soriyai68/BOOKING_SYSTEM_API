const mongoose = require("mongoose");
const logger = require("../utils/logger");
const SeatBooking = mongoose.model("SeatBooking");
const SeatBookingHistory = mongoose.model("SeatBookingHistory");

const bookingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    showtimeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Showtime",
      required: true,
    },
    total_price: {
      type: Number,
      required: true,
    },
    payment_status: {
      type: String,
      enum: ["Pending", "Completed", "Failed", "Refunded"],
      default: "Pending",
    },
    payment_method: {
      type: String,
      enum: ["Bakong", "Cash", "Card", "Mobile Banking", "Bank Transfer"],
    },
    seats: {
      type: [String],
      required: true,
    },
    seat_count: {
      type: Number,
      required: true,
    },
    booking_status: {
      type: String,
      enum: ["Pending", "Confirmed", "Cancelled", "Completed"],
      default: "Pending",
    },
    reference_code: {
      type: String,
      required: true,
      unique: true,
    },
    payment_id: {
      type: String,
    },
    // payment_id: {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: 'Payment',
    //     required: true,
    // },
    booking_date: {
      type: Date,
      default: Date.now,
    },
    expired_at: {
      type: Date,
      default: null,
    },
    noted: {
      type: String,
      default: "",
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Static methods
bookingSchema.statics.findByUserId = function (userId) {
  return this.find({ userId, deletedAt: null });
};

bookingSchema.statics.findByReferenceCode = function (referenceCode) {
  return this.findOne({ reference_code: referenceCode, deletedAt: null });
};

bookingSchema.statics.findActiveBookingsByShowtime = function (showtimeId) {
  return this.find({
    showtimeId,
    booking_status: "Confirmed",
    deletedAt: null,
  });
};

bookingSchema.statics.autoCancelExpiredBookings = async function () {
  const now = new Date();
  const expiredBookings = await this.find({
    expired_at: { $lte: now },
    booking_status: "Pending",
    payment_status: "Pending",
    deletedAt: null,
  });

  for (const booking of expiredBookings) {
    await booking.cancelBooking("Auto-cancelled due to expiration");
  }

  return expiredBookings.map((b) => b._id);
};

bookingSchema.statics.generateReferenceCode = async function () {
  let referenceCode;
  let isUnique = false;
  while (!isUnique) {
    referenceCode = Math.random().toString(36).substring(2, 10).toUpperCase();
    const existingBooking = await this.findOne({
      reference_code: referenceCode,
    });
    if (!existingBooking) {
      isUnique = true;
    }
  }
  return referenceCode;
};

// Instance methods
bookingSchema.methods.isExpired = function () {
  return this.expired_at < new Date();
};

bookingSchema.methods.markAsCompleted = async function (paymentId) {
  // Changed to async
  this.payment_status = "Completed";
  this.booking_status = "Confirmed";
  if (paymentId) {
    this.payment_id = paymentId;
  }

  // Update associated SeatBooking records
  const updateResult = await SeatBooking.updateMany(
    { bookingId: this._id, status: "locked" },
    {
      $set: {
        status: "booked",
      },
      $unset: { locked_until: "" },
    }
  );

  if (updateResult.modifiedCount > 0) {
    logger.info(
      `${updateResult.modifiedCount} seat bookings for Booking ID: ${this._id} updated from 'locked' to 'booked'.`
    );
  } else {
    logger.warn(
      `No 'locked' seat bookings found for Booking ID: ${this._id} to update to 'booked'.`
    );
  }

  logger.info(
    `Booking ${this.reference_code} (ID: ${this._id}) status updated to Completed. Payment ID: ${paymentId}.`
  );

  return this.save();
};

bookingSchema.methods.cancelBooking = async function (
  reason = "Cancelled by user"
) {
  this.booking_status = "Cancelled";
  this.noted = reason;
  this.deletedAt = new Date();

  // Instead of creating a new history record, update the existing one to 'canceled'.
  const SeatBookingHistory = mongoose.model("SeatBookingHistory");
  await SeatBookingHistory.updateMany(
    { bookingId: this._id, action: "booked" },
    { $set: { action: "canceled" } }
  );

  // New logic: Release the seats by deleting the corresponding SeatBooking documents.
  const SeatBooking = mongoose.model("SeatBooking");
  await SeatBooking.deleteMany({ bookingId: this._id });

  return this.save();
};

// Mongoose middleware for auto-updating seat status has been removed.
// The new design uses a separate SeatBooking collection to manage seat reservations per showtime.

// Middleware to handle seat updates on existing bookings has been removed.

// Middleware to release seats when a booking is permanently deleted has been removed.

// Indexes
bookingSchema.index({ userId: 1 });
bookingSchema.index({ showtimeId: 1 });
bookingSchema.index({ reference_code: 1 });
bookingSchema.index({ booking_status: 1 });
bookingSchema.index({ deletedAt: 1 });

const Booking = mongoose.model("Booking", bookingSchema);

module.exports = Booking;
