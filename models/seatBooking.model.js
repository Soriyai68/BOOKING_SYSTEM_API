const mongoose = require('mongoose');

const seatBookingSchema = new mongoose.Schema({
    showtimeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Showtime',
        required: true,
        index: true,
    },
    seatId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Seat',
        required: true,
    },
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        default: null,
        index: true,
    },
    status: {
        type: String,
        enum: ['locked', 'booked'],
        required: true,
    },
    locked_until: {
        type: Date,
        default: null,
        expires: '15m',
        index: {partialFilterExpression: {status: 'locked'}},
    },
}, {
    timestamps: true,
});

seatBookingSchema.index({showtimeId: 1, seatId: 1}, {unique: true});

// Instance methods
seatBookingSchema.methods.isLocked = function () {
    return this.status === 'locked' && this.locked_until > new Date();
};

seatBookingSchema.methods.isBooked = function () {
    return this.status === 'booked';
};

seatBookingSchema.methods.markAsBooked = async function (bookingId) {
    if (this.status !== 'locked' || !this.isLocked()) {
        throw new Error('Seat is not validly locked to be booked.');
    }
    this.status = 'booked';
    this.bookingId = bookingId;
    this.locked_until = undefined; // Clear the expiration date
    await this.save();
    return this;
};

seatBookingSchema.methods.extendLock = async function (durationMinutes = 15) {
    if (this.status !== 'locked') {
        throw new Error('Only locked seats can have their lock extended.');
    }
    this.locked_until = new Date(Date.now() + durationMinutes * 60 * 1000);
    await this.save();
    return this;
};

const SeatBooking = mongoose.model('SeatBooking', seatBookingSchema);

module.exports = SeatBooking;
