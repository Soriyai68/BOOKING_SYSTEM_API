const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
    paymentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Payment',
        required: true,
    },
    invoice_number: {
        type: String,
        required: true,
        unique: true,
    },
    qr: {
        type: String,
        required: true,
    },
    cashierId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    location: {
        type: String,
        required: true,
    },
    currency: {
        type: String,
        enum: ['USD', 'KHR'],
        default: 'USD',
    },
    amount: {
        type: Number,
        required: true,
        min: 0,
    },
    description: {
        type: String,
        default: '',
    },
    paid: {
        type: Boolean,
        default: false,
    },
    tracking_status: {
        type: String,
        enum: ['Waiting', 'Acknowledged', 'Paid', 'Verified', 'Seen'],
        default: 'Waiting',
    },
    acknowledged_at: {
        type: Date,
    },
    paid_at: {
        type: Date,
    },
    deletedAt: {
        type: Date,
        default: null,
    },
}, {
    timestamps: true,
});

// Indexes
invoiceSchema.index({ invoice_number: 1 });
invoiceSchema.index({ paymentId: 1 });
invoiceSchema.index({ cashierId: 1 });
invoiceSchema.index({ tracking_status: 1 });
invoiceSchema.index({ paid: 1 });
invoiceSchema.index({ deletedAt: 1 });
invoiceSchema.index({ createdAt: -1 });

const Invoice = mongoose.model('Invoice', invoiceSchema);

module.exports = Invoice;
