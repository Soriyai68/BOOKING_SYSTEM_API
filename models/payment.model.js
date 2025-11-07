const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Booking',
        required: true,
    },
    amount: {
        type: Number,
        required: true,
        min: 0,
    },
    payment_method: {
        type: String,
        enum: ['Bakong', 'Cash', 'Card', 'Mobile Banking', 'Bank Transfer'],
        required: true,
    },
    payment_date: {
        type: Date,
        default: Date.now,
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
    transaction_id: {
        type: String,
        unique: true,
        sparse: true,
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
paymentSchema.index({ bookingId: 1 });
paymentSchema.index({ transaction_id: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ payment_method: 1 });
paymentSchema.index({ deletedAt: 1 });
paymentSchema.index({ createdAt: -1 });

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
