const mongoose = require("mongoose");

const seatBookingHistorySchema = new mongoose.Schema(
  {
    showtimeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Showtime",
      required: true,
      index: true,
    },
    seatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seat",
      required: true,
      index: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      default: null,
      index: true,
    },
    action: {
      type: String,
      enum: ["booked", "canceled"],
      required: true,
    },
  },
  { timestamps: true }
);

// Instance method to get the associated booking details
seatBookingHistorySchema.methods.getBookingDetails = async function () {
  if (!this.bookingId) {
    return null;
  }
  return await this.populate("bookingId");
};

// Instance method to get the associated showtime details
seatBookingHistorySchema.methods.getShowtimeDetails = async function () {
  return await this.populate("showtimeId");
};

// Instance method to get the associated seat details
seatBookingHistorySchema.methods.getSeatDetails = async function () {
  return await this.populate("seatId");
};

// Instance method to check if the action was 'booked'
seatBookingHistorySchema.methods.isBooked = function () {
  return this.action === "booked";
};

// Instance method to check if the action was 'canceled'
seatBookingHistorySchema.methods.isCanceled = function () {
  return this.action === "canceled";
};

module.exports = mongoose.model("SeatBookingHistory", seatBookingHistorySchema);
