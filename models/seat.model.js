const mongoose = require('mongoose');

const seatSchema = new mongoose.Schema({
  row: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
    minlength: 1,
    maxlength: 5,
    match: [/^[A-Z][A-Z0-9]*$/, 'Row must start with a letter and contain only letters and numbers']
  },
  seat_number: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 10,
    match: [/^[A-Z0-9]+$/, 'Seat number must contain only letters and numbers']
  },
  seat_type: {
    type: String,
    required: true,
    enum: ['regular', 'vip', 'king', 'queen', 'recliner'],
    default: 'standard'
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
  },
  // Status tracking
  status: {
    type: String,
    enum: ['active', 'maintenance', 'out_of_order', 'reserved'],
    default: 'active'
  },
  // Additional metadata
  theater_id: {
    type: String,
    default: null
  },
  screen_id: {
    type: String,
    default: null
  },
  price: {
    type: Number,
    min: 0,
    default: 0
  },
  notes: {
    type: String,
    maxlength: 500,
    trim: true
  }
}, {
  timestamps: true
});

// Compound index to ensure unique seat per theater/screen
seatSchema.index({ row: 1, seat_number: 1, theater_id: 1, screen_id: 1 }, { unique: true });

// Index for faster queries
seatSchema.index({ row: 1 });
seatSchema.index({ seat_type: 1 });
seatSchema.index({ is_available: 1 });
seatSchema.index({ status: 1 });
seatSchema.index({ deletedAt: 1 });
seatSchema.index({ theater_id: 1, screen_id: 1 });

// Instance method to soft delete seat
seatSchema.methods.softDelete = function(userId = null) {
  this.is_available = false;
  this.status = 'out_of_order';
  this.deletedAt = new Date();
  this.deletedBy = userId;
  this.restoredAt = null;
  this.restoredBy = null;
  return this.save();
};

// Instance method to restore seat
seatSchema.methods.restore = function(userId = null) {
  this.is_available = true;
  this.status = 'active';
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

// Instance method to update seat status
seatSchema.methods.updateStatus = function(newStatus, userId = null) {
  const validStatuses = ['active', 'maintenance', 'out_of_order', 'reserved'];
  if (!validStatuses.includes(newStatus)) {
    throw new Error('Invalid status provided');
  }
  
  this.status = newStatus;
  
  // Auto-set availability based on status
  this.is_available = newStatus === 'active';
  
  // Add metadata for status changes
  this.updatedBy = userId;
  
  return this.save();
};

// Instance method to toggle availability
seatSchema.methods.toggleAvailability = function(userId = null) {
  this.is_available = !this.is_available;
  
  // Update status accordingly
  if (this.is_available && this.status === 'out_of_order') {
    this.status = 'active';
  } else if (!this.is_available && this.status === 'active') {
    this.status = 'reserved';
  }
  
  this.updatedBy = userId;
  return this.save();
};

// Static method to find active seats (excluding soft deleted)
seatSchema.statics.findActive = function(query = {}) {
  return this.find({
    ...query,
    deletedAt: null
  });
};

// Static method to find deleted seats
seatSchema.statics.findDeleted = function(query = {}) {
  return this.find({
    ...query,
    deletedAt: { $ne: null }
  }).sort({ deletedAt: -1 });
};

// Static method to find seats by type
seatSchema.statics.findByType = function(seatType, activeOnly = true) {
  const query = { seat_type: seatType };
  if (activeOnly) {
    query.deletedAt = null;
    query.status = { $in: ['active', 'reserved'] };
  }
  return this.find(query);
};

// Static method to find available seats
seatSchema.statics.findAvailable = function(query = {}) {
  return this.find({
    ...query,
    is_available: true,
    deletedAt: null,
    status: 'active'
  });
};

// Static method to find seats by theater/screen
seatSchema.statics.findByTheater = function(theaterId, screenId = null, activeOnly = true) {
  const query = { theater_id: theaterId };
  if (screenId) query.screen_id = screenId;
  if (activeOnly) query.deletedAt = null;
  
  return this.find(query).sort({ row: 1, seat_number: 1 });
};

// Virtual for full seat identifier
seatSchema.virtual('seat_identifier').get(function() {
  return `${this.row}${this.seat_number}`;
});

// Virtual for seat display name
seatSchema.virtual('display_name').get(function() {
  return `Seat ${this.row}${this.seat_number} (${this.seat_type})`;
});

// Pre-save middleware for seat validation
seatSchema.pre('save', function(next) {
  // Ensure seat_number and row are uppercase
  if (this.seat_number) {
    this.seat_number = this.seat_number.toString().toUpperCase();
  }
  if (this.row) {
    this.row = this.row.toString().toUpperCase();
  }
  
  // Validate status and availability consistency
  if (this.status === 'out_of_order' || this.status === 'maintenance') {
    this.is_available = false;
  } else if (this.status === 'active' && this.deletedAt === null) {
    this.is_available = true;
  }
  
  next();
});

module.exports = mongoose.model('Seat', seatSchema);