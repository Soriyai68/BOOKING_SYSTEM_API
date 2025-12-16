const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        required: true,
    },
    amount: {
        type: Number,
        min: 0,
    },
    payment_method: {
        type: String,
        enum: ['Bakong', 'Cash', 'Card', 'Mobile Banking', 'Bank Transfer', 'PayAtCinema'],
        required: true,
    },
    payment_date: {
        type: Date,
        default: Date.now,
    },
    qr_method: {
        type: String,
        enum: ["KHQR", "USD"],
        default: "KHQR"
    },
    currency: {
        type: String,
        enum: ['USD', 'KHR'],
        default: 'USD',
    },
    status: {
        type: String,
        enum: ['Pending', 'Completed', 'Failed', 'Refunded'],
        default: 'Pending',
    },
    qr: {
        type: String
    },
    md5: {
        type: String
    },
    bakongHash: {
        type: String
    },
    fromAccount_id: {
        type: String
    },
    toAccount_id: {
        type: String
    },
    paid: {
        type: Boolean,
        default: false
    },
    paidAt: {
        type: Date
    },
    expiration: {
        type: Number
    },
    description: {
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
paymentSchema.index({bookingId: 1});
paymentSchema.index({status: 1});
paymentSchema.index({payment_method: 1});
paymentSchema.index({deletedAt: 1});
paymentSchema.index({createdAt: -1});

// Instance methods
paymentSchema.methods.markAsPaid = function (transactionDetails) {
    this.status = 'Completed';
    this.paid = true;
    this.paidAt = new Date();

    this.bakongHash = transactionDetails.bakongHash;
    this.fromAccount_id = transactionDetails.fromAccountId;
    this.toAccount_id = transactionDetails.toAccountId;
    return this.save();
};

paymentSchema.methods.markAsFailed = function (reason = 'Payment failed') {
    this.status = 'Failed';
    this.description = reason;
    return this.save();
};

paymentSchema.methods.isExpired = function () {
    if (!this.expiration) {
        return false;
    }
    return this.expiration < Date.now();
};

// Middleware
paymentSchema.pre('save', async function (next) {
    // 'this' refers to the payment document
    if (this.isModified('status')) {
        const Booking = mongoose.model('Booking'); // Get Booking model
        try {
            const booking = await Booking.findById(this.bookingId);
            if (booking) {
                if (this.status === 'Completed' && booking.payment_status !== 'Completed') {
                    await booking.markAsCompleted(this._id);
                } else if (this.status === 'Failed' && booking.payment_status !== 'Failed') {
                    booking.payment_status = 'Failed';
                    await booking.save();
                }
            }
        } catch (error) {
            console.error('Error updating booking from payment middleware:', error);
            // Decide if the payment should still save if the booking update fails
            // For now, we'll let it save but log the error.
        }
    }
    next();
});

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
