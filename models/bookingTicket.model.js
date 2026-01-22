const mongoose = require('mongoose');
const logger = require('../utils/logger');

const bookingTicketSchema = new mongoose.Schema({
    customer_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: true
    },
    booking_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        required: true
    },
    showtime_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Showtime',
        required: true
    },
    ticket_code: {
        type: String,
        required: true,
        unique: true // Assuming ticket codes should be unique
    },
    seat: {
        seat_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Seat',
            required: true
        },
        seat_number: {
            type: String,
            required: true,
        },
        price: {
            type: Number,
            required: true
        },
        ticket_type: {
            type: String,
            required: true
        },
    },
    payment_method: {
        type: String,
        enum: ['Bakong', 'Cash', 'Card', 'Mobile Banking', 'Bank Transfer', 'PayAtCinema'],
    },
    qr_code: {
        type: String,
        // Assuming qr_code might not always be present immediately or could be generated later
    },
    issuedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

bookingTicketSchema.statics.generateTicketsForBooking = async function (booking) {
    try {
        const existingTicketCount = await this.countDocuments({ booking_id: booking._id });
        if (existingTicketCount > 0) {
            logger.warn(`Tickets already exist for booking ${booking._id}. Skipping generation.`);
            return;
        }
        const tickets = [];
        for (const seat of booking.seats) {
            const ticket_code = `TKT-${Date.now()}-${Math.random()
                .toString(36)
                .substr(2, 5)
                .toUpperCase()}`;

            const newTicket = new this({
                booking_id: booking._id,
                customer_id: booking.customerId,
                showtime_id: booking.showtimeId,
                payment_method: booking.payment_method,
                ticket_code,
                seat: {
                    seat_id: seat._id,
                    price: seat.price,
                    ticket_type: seat.seat_type,
                    seat_number: `${seat.row}${seat.seat_number}`,
                },
            });

            await newTicket.save();
            tickets.push(newTicket);
        }
        logger.info(`Generated ${tickets.length} tickets for booking ${booking._id}`);
        return tickets;
    } catch (error) {
        logger.error(
            `Failed to generate tickets for booking ${booking._id}:`,
            error
        );
        throw error;
    }
}

const BookingTicket = mongoose.model('BookingTicket', bookingTicketSchema);

module.exports = BookingTicket;
