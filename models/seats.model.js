const { default: mongoose } = require("mongoose");
const { v4: uuidv4 } = require('uuid');

const seatSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
      default: () => uuidv4()
    },
    row: {
      type: String,
      required: true,
      trim: true
    },
    seat_number: {
      type: String,
      required: true,
      trim: true
    },
    seat_type: {
      type: String,
      required: true,
      enum: ['regular', 'vip', 'couple', 'king', 'queen'],
      default: 'regular',
      trim: true
    },
    is_available: {
      type: Boolean,
      default: true
    },
    // Soft delete fields
    deletedAt: {
      type: Date,
      default: null
    },
    deletedBy: {
      type: String,
      default: null
    },
    restoredAt: {
      type: Date,
      default: null
    },
    restoredBy: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true,
    versionKey: false
  }
);

// Compound index for unique seat identification
seatSchema.index({ row: 1, seat_number: 1 }, { unique: true });

// Virtual for seat identifier
seatSchema.virtual('seat_identifier').get(function() {
  return `${this.row}${this.seat_number}`;
});

// Static method to find available seats (excluding soft deleted)
seatSchema.statics.findAvailableSeats = function(options = {}) {
  const query = {
    is_available: true,
    deletedAt: null  // Exclude soft deleted seats
  };
  
  if (options.seatType) {
    query.seat_type = options.seatType;
  }
  
  if (options.row) {
    query.row = options.row;
  }
  
  return this.find(query).sort({ row: 1, seat_number: 1 });
};

// Static method to find deleted seats
seatSchema.statics.findDeletedSeats = function(options = {}) {
  const query = {
    deletedAt: { $ne: null }
  };
  
  if (options.seatType) {
    query.seat_type = options.seatType;
  }
  
  if (options.row) {
    query.row = options.row;
  }
  
  return this.find(query).sort({ deletedAt: -1 });
};

// Instance method to toggle availability
seatSchema.methods.toggleAvailability = function() {
  this.is_available = !this.is_available;
  return this.save();
};

// Instance method to soft delete seat
seatSchema.methods.softDelete = function(userId = null) {
  this.is_available = false;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  this.restoredAt = null;
  this.restoredBy = null;
  return this.save();
};

// Instance method to restore seat
seatSchema.methods.restore = function(userId = null) {
  this.is_available = true;
  this.deletedAt = null;
  this.deletedBy = null;
  this.restoredAt = new Date();
  this.restoredBy = userId;
  return this.save();
};

// Instance method to check if seat is soft deleted
seatSchema.methods.isDeleted = function() {
  return this.deletedAt !== null;
};

const Seat = mongoose.model("Seat", seatSchema);

module.exports = Seat;