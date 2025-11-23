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
    payment_method: {
        type: String,
        enum: ['Bakong', 'Cash', 'Card', 'Mobile Banking', 'Bank Transfer'],
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
        default: '',
    },
    deletedAt: {
        type: Date,
        default: null,
    },
}, {
    timestamps: true,
});

// Static methods
bookingSchema.statics.findByUserId = function (userId) {
    return this.find({userId, deletedAt: null});
};

bookingSchema.statics.findByReferenceCode = function (referenceCode) {
    return this.findOne({reference_code: referenceCode, deletedAt: null});
};

bookingSchema.statics.findActiveBookingsByShowtime = function (showtimeId) {
    return this.find({
        showtimeId,
        booking_status: 'Confirmed',
        deletedAt: null,
    });
};

bookingSchema.statics.autoCancelExpiredBookings = async function () {
    const now = new Date();
    const expiredBookings = await this.find({
        expired_at: {$lte: now},
        booking_status: 'Confirmed',
        payment_status: 'Pending',
        deletedAt: null,
    });

    for (const booking of expiredBookings) {
        await booking.cancelBooking('Auto-cancelled due to expiration');
    }

    return expiredBookings.map(b => b._id);
};

bookingSchema.statics.generateReferenceCode = async function () {
    let referenceCode;
    let isUnique = false;
    while (!isUnique) {
        referenceCode = Math.random().toString(36).substring(2, 10).toUpperCase();
        const existingBooking = await this.findOne({reference_code: referenceCode});
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

bookingSchema.methods.markAsCompleted = function (paymentId) {
    this.payment_status = 'Completed';
    this.booking_status = 'Completed';
    if (paymentId) {
        this.payment_id = paymentId;
    }
    return this.save();
};

bookingSchema.methods.cancelBooking = function (reason = 'Cancelled by user') {
    this.booking_status = 'Cancelled';
    this.noted = reason;
    this.deletedAt = new Date();
    return this.save();
};

// Mongoose middleware for auto-updating seat status
bookingSchema.pre('save', async function (next) {
    if (this.isModified('booking_status') || this.isNew) {
        const Seat = mongoose.model('Seat');
        const Showtime = mongoose.model('Showtime');

        try {
            const showtime = await Showtime.findById(this.showtimeId);
            if (!showtime) {
                throw new Error(`Showtime with ID ${this.showtimeId} not found.`);
            }

            const hallId = showtime.hall_id;
            let newStatus;

            if (this.booking_status === 'Cancelled') {
                newStatus = 'active';
            } else if (this.booking_status === 'Confirmed' || this.booking_status === 'Completed') {
                newStatus = 'reserved';
            } else {
                return next(); // No seat status change needed
            }

            const seatUpdates = this.seats.map(async (seatId) => {
                const seat = await Seat.findById(seatId);

                if (seat) {
                    // Optional: Verify seat belongs to the correct hall from the showtime
                    if (seat.hall_id.toString() !== hallId.toString()) {
                        // Silently skip if seat is in the wrong hall
                        return;
                    }

                    if (seat.status !== newStatus) {
                        seat.status = newStatus;
                        return seat.save();
                    }
                }
            });

            await Promise.all(seatUpdates);
            next();
        } catch (error) {
            // Pass the error to prevent saving the booking in an inconsistent state
            next(error);
        }
    } else {
        next();
    }
});

// Middleware to handle seat updates on existing bookings
bookingSchema.pre('findOneAndUpdate', async function (next) {
    // `this` is the query object
    const update = this.getUpdate();

    // Check if the 'seats' field is being updated
    if (!update.$set || !update.$set.seats) {
        return next();
    }

    try {
        const Seat = mongoose.model('Seat');

        // Get the original document before the update
        const originalDoc = await this.model.findOne(this.getFilter()).lean();

        if (originalDoc) {
            const oldSeats = originalDoc.seats.map(s => s.toString());
            const newSeats = update.$set.seats.map(s => s.toString());

            // Determine which seats to release and which to reserve
            const seatsToRelease = oldSeats.filter(seatId => !newSeats.includes(seatId));
            const seatsToReserve = newSeats.filter(seatId => !oldSeats.includes(seatId));

            // Release old seats
            if (seatsToRelease.length > 0) {
                await Seat.updateMany(
                    {_id: {$in: seatsToRelease}},
                    {$set: {status: 'active'}}
                );
            }

            // Reserve new seats
            if (seatsToReserve.length > 0) {
                await Seat.updateMany(
                    {_id: {$in: seatsToReserve}},
                    {$set: {status: 'reserved'}}
                );
            }
        }

        next();
    } catch (error) {
        // Pass any errors to the next middleware
        next(error);
    }
});

// Middleware to release seats when a booking is permanently deleted
bookingSchema.post('findOneAndDelete', async function (doc) {
    if (doc) {
        const Seat = mongoose.model('Seat');
        const logger = require('../utils/logger');

        try {
            // Only release seats if the booking was not in a 'Cancelled' state
            // because their seats would have already been released.
            if (doc.booking_status !== 'Cancelled') {
                logger.info(`Booking ${doc._id} was permanently deleted. Releasing associated seats.`);
                const seatIdsToRelease = doc.seats.map(id => id.toString());

                if (seatIdsToRelease.length > 0) {
                    const {modifiedCount} = await Seat.updateMany(
                        {_id: {$in: seatIdsToRelease}, status: 'reserved'},
                        {$set: {status: 'active'}}
                    );
                    logger.info(`Released ${modifiedCount} seats for deleted booking ${doc._id}.`);
                }
            }
        } catch (error) {
            logger.error(`Error releasing seats for deleted booking ${doc._id}: ${error.message}`);
        }
    }
});

// Indexes
bookingSchema.index({userId: 1});
bookingSchema.index({showtimeId: 1});
bookingSchema.index({reference_code: 1});
bookingSchema.index({booking_status: 1});
bookingSchema.index({deletedAt: 1});

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;


