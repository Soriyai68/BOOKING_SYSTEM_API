const mongoose = require('mongoose');

const bookingDetailSchema = new mongoose.Schema({
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        required: true,
    },
    seatId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Seat',
        required: true,
    },
    row_label: {
        type: String,
        required: true,
    },
    seat_number: {
        type: Number,
        required: true,
    },
    seat_type: {
        type: String,
        enum: ['Standard', 'VIP', 'Premium', 'Couple'],
        required: true,
    },
    price: {
        type: Number,
        required: true,
        min: 0,
    },
    deletedAt: {
        type: Date,
        default: null,
    },
}, {
    timestamps: true,
});

// Indexes
bookingDetailSchema.index({ bookingId: 1 });
bookingDetailSchema.index({ seatId: 1 });
bookingDetailSchema.index({ deletedAt: 1 });

// Compound index for unique seat per booking
bookingDetailSchema.index({ bookingId: 1, seatId: 1 }, { unique: true });

const BookingDetail = mongoose.model('BookingDetail', bookingDetailSchema);

module.exports = BookingDetail;
