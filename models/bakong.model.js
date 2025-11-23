const mongoose = require('mongoose');

const bakongSchema = new mongoose.Schema({
    // Removed direct bookingId reference for now, as requested.
    // An external reference, which could eventually be a booking's reference code, but not a direct ObjectId link.
    external_reference: {
        type: String,
        required: true,
        unique: true, // Assuming external_reference will be unique per transaction
        sparse: true
    },
    // Bakong's merchant terminal ID
    tid: {
        type: String,
        required: true
    },
    // MD5 hash for generating the QR data
    md5: {
        type: String,
        required: true
    },
    currency: {
        type: String,
        enum: ["USD", "KHR"],
        default: "USD"
    },
    amount: {
        type: Number,
        required: true
    },
    qr_string: { // The full string that gets encoded into QR
        type: String
    },
    qr_image_url: { // The URL of the generated QR image (e.g., from Cloudinary)
        type: String
    },
    status: {
        type: String,
        enum: ['Pending', 'Completed', 'Failed'],
        default: 'Pending'
    },
    // Bakong specific transaction details from webhook/callback
    transactionId: {
        type: String,
        unique: true,
        sparse: true
    },
    hash: { // Hash from Bakong callback for verification
        type: String
    },
    fromAccount: { type: String },
    toAccount: { type: String },
}, {
    timestamps: true
});

bakongSchema.index({ external_reference: 1 });
bakongSchema.index({ transactionId: 1 });

const Bakong = mongoose.model('Bakong', bakongSchema);

module.exports = Bakong;
