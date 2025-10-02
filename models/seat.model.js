const mongoose = require('mongoose');

const seatSchema = new mongoose.Schema({
  row: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    minlength: 1,
    maxlength: 5
  },
  seat_number: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    minlength: 1,
    maxlength: 10
  },
  seat_type: {
    type: String,
    required: true,
    enum: ['regular', 'vip', 'couple', 'king', 'queen'],
    default: 'regular'
  },
  is_available: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for faster queries
seatSchema.index({ row: 1, seat_number: 1 }, { unique: true });
seatSchema.index({ seat_type: 1 });
seatSchema.index({ is_available: 1 });

// Instance method to toggle availability
seatSchema.methods.toggleAvailability = function () {
  this.is_available = !this.is_available;
  return this.save();
};

// Static method to find seats by type
seatSchema.statics.findByType = function (seatType) {
  return this.find({ seat_type: seatType });
};

// Static method to find available seats
seatSchema.statics.findAvailable = function (query = {}) {
  return this.find({
    ...query,
    is_available: true
  });
};

// Virtual for full seat identifier
seatSchema.virtual('seat_identifier').get(function () {
  return `${this.row}${this.seat_number}`;
});

// Virtual for seat display name
seatSchema.virtual('display_name').get(function () {
  return `Seat ${this.row}${this.seat_number} (${this.seat_type})`;
});

// Pre-save middleware to ensure uppercase
seatSchema.pre('save', function (next) {
  if (this.seat_number) {
    this.seat_number = this.seat_number.toString().toUpperCase();
  }
  if (this.row) {
    this.row = this.row.toString().toUpperCase();
  }
  next();
});

module.exports = mongoose.model('Seat', seatSchema);