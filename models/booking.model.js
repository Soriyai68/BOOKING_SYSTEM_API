const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    showtimeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Showtime',
        required: true,
    },
    total_price: {
        type: Number,
        required: true,
    },
    payment_status: {
        type: String,
        enum: ['Pending', 'Completed', 'Failed'],
        default: 'Pending',
    },
    seat_count: {
        type: Number,
        required: true,
    },
    booking_status: {
        type: String,
        enum: ['Confirmed', 'Cancelled', 'Completed'],
        default: 'Confirmed',
    },
    reference_code: {
        type: String,
        required: true,
        unique: true,
    },
    payment_id: {
        type: String,
    },
    booking_date: {
        type: Date,
        default: Date.now,
    },
    expired_at: {
        type: Date,
        required: true,
    },
    noted: {
        type: String,
        default: '',
    },
    deletedAt: {
        type: Date,
        default: null,
    },
}, {
    timestamps: true,
});

// Indexes
bookingSchema.index({ userId: 1 });
bookingSchema.index({ showtimeId: 1 });
bookingSchema.index({ reference_code: 1 });
bookingSchema.index({ booking_status: 1 });
bookingSchema.index({ deletedAt: 1 });

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
