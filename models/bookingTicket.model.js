const mongoose = require("mongoose");
const logger = require("../utils/logger");

const bookingTicketSchema = new mongoose.Schema(
  {
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
    booking_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      required: true,
    },
    showtime_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Showtime",
      required: true,
    },
    ticket_code: {
      type: String,
      required: true,
      unique: true, // Assuming ticket codes should be unique
    },
    seats: [
      {
        seat_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Seat",
          required: true,
        },
        seat_number: {
          type: String,
          required: true,
        },
        price: {
          type: Number,
          required: true,
        },
        ticket_type: {
          type: String,
          required: true,
        },
      },
    ],
    payment_method: {
      type: String,
      enum: [
        "Bakong",
        "Cash",
        "Card",
        "Mobile Banking",
        "Bank Transfer",
        "PayAtCinema",
      ],
    },
    qr_code: {
      type: String,
    },
    issuedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

bookingTicketSchema.statics.generateTicketsForBooking = async function (
  booking,
) {
  try {
    const existingTicket = await this.findOne({
      booking_id: booking._id,
    });
    if (existingTicket) {
      logger.warn(
        `Ticket already exists for booking ${booking._id}. Skipping generation.`,
      );
      return [existingTicket];
    }

    const ticket_code = `TKT-${booking.reference_code}`;

    const seats = booking.seats.map((seat) => ({
      seat_id: seat._id,
      price: seat.price,
      ticket_type: seat.seat_type,
      seat_number: `${seat.row}-${seat.seat_number}`,
    }));

    const newTicket = new this({
      booking_id: booking._id,
      customer_id: booking.customerId,
      showtime_id: booking.showtimeId,
      payment_method: booking.payment_method,
      ticket_code,
      seats,
    });

    await newTicket.save();
    logger.info(
      `Generated 1 ticket with ${seats.length} seats for booking ${booking._id}`,
    );
    return [newTicket];
  } catch (error) {
    logger.error(
      `Failed to generate ticket for booking ${booking._id}:`,
      error,
    );
    throw error;
  }
};

const BookingTicket = mongoose.model("BookingTicket", bookingTicketSchema);

module.exports = BookingTicket;
