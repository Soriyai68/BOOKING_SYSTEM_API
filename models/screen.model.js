const mongoose = require('mongoose');

const screenSchema = new mongoose.Schema({
  screen_name: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 100,
    index: true
  },
  total_seats: {
    type: Number,
    required: true,
    min: 1,
    max: 1000,
    default: 0
  },
  seat_layout_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SeatLayout',
    default: null
  },
  theater_id: {
    type: String,
    trim: true,
    default: null,
    index: true
  },
  screen_type: {
    type: String,
    enum: ['standard', 'imax', '3d', '4dx', 'vip'],
    default: 'standard'
  },
  capacity: {
    type: Object,
    default: {
      standard: 0,
      premium: 0,
      vip: 0,
      wheelchair: 0,
      recliner: 0
    }
  },
  dimensions: {
    width: {
      type: Number,
      min: 1,
      max: 100,
      default: 10
    },
    height: {
      type: Number,
      min: 1,
      max: 100,
      default: 10
    }
  },
  status: {
    type: String,
    enum: ['active', 'maintenance', 'closed', 'renovation'],
    default: 'active',
    index: true
  },
  features: {
    type: [String],
    enum: ['dolby_atmos', 'surround_sound', 'premium_seating', 'wheelchair_accessible', 'air_conditioning', 'heating'],
    default: []
  },
  notes: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: ''
  },
  // Soft delete fields
  deletedAt: {
    type: Date,
    default: null,
    index: true
  },
  deletedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  restoredAt: {
    type: Date,
    default: null
  },
  restoredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // Audit fields
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  }
}, {
  timestamps: true
});

// Indexes for faster queries
screenSchema.index({ screen_name: 1, theater_id: 1 }, { unique: true });
screenSchema.index({ screen_type: 1 });
screenSchema.index({ status: 1 });
screenSchema.index({ total_seats: 1 });
screenSchema.index({ deletedAt: 1 });
screenSchema.index({ createdAt: 1 });
screenSchema.index({ 'capacity.standard': 1 });
screenSchema.index({ 'capacity.premium': 1 });
screenSchema.index({ 'capacity.vip': 1 });

// Instance method for soft delete
screenSchema.methods.softDelete = function (deletedBy = null) {
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  this.status = 'closed'; // Change status when deleted
  return this.save();
};

// Instance method for restore
screenSchema.methods.restore = function (restoredBy = null) {
  this.deletedAt = null;
  this.deletedBy = null;
  this.restoredAt = new Date();
  this.restoredBy = restoredBy;
  this.status = 'active'; // Restore to active status
  return this.save();
};

// Instance method to check if deleted
screenSchema.methods.isDeleted = function () {
  return this.deletedAt !== null;
};

// Instance method to check for associated active seats
screenSchema.methods.hasActiveSeats = async function () {
  const Seat = mongoose.model('Seat');
  const associatedSeats = await Seat.find({
    screen_id: this._id,
    deletedAt: null // Only count active seats
  });

  if (associatedSeats.length > 0) {
    return {
      hasSeats: true,
      count: associatedSeats.length,
      identifiers: associatedSeats.map(seat => seat.seat_identifier || `${seat.row}${seat.seat_number}`)
    };
  }

  return { hasSeats: false };
};

// Instance method to update status
screenSchema.methods.updateStatus = function (newStatus, updatedBy = null) {
  const validStatuses = ['active', 'maintenance', 'closed', 'renovation'];
  if (!validStatuses.includes(newStatus)) {
    throw new Error('Invalid status provided');
  }
  
  this.status = newStatus;
  this.updatedBy = updatedBy;
  
  return this.save();
};

// Instance method to calculate total capacity
screenSchema.methods.calculateTotalCapacity = function () {
  if (!this.capacity) return 0;
  
  const { standard = 0, premium = 0, vip = 0, wheelchair = 0, recliner = 0 } = this.capacity;
  return standard + premium + vip + wheelchair + recliner;
};

// Instance method to update capacity
screenSchema.methods.updateCapacity = function (capacityUpdate) {
  this.capacity = {
    ...this.capacity,
    ...capacityUpdate
  };
  
  // Recalculate total seats
  this.total_seats = this.calculateTotalCapacity();
  
  return this.save();
};

// Static method to find screens by type
screenSchema.statics.findByType = function (screenType) {
  return this.find({ screen_type: screenType, deletedAt: null });
};

// Static method to find active screens
screenSchema.statics.findActive = function (query = {}) {
  return this.find({
    ...query,
    deletedAt: null,
    status: 'active'
  });
};

// Static method to find screens by theater
screenSchema.statics.findByTheater = function (theaterId, query = {}) {
  return this.find({
    ...query,
    theater_id: theaterId,
    deletedAt: null
  });
};

// Static method to find deleted screens
screenSchema.statics.findDeleted = function (query = {}) {
  return this.find({
    ...query,
    deletedAt: { $ne: null }
  });
};

// Static method to get screens with seat counts
screenSchema.statics.getScreensWithSeatCounts = async function (query = {}) {
  const Seat = mongoose.model('Seat');
  
  return this.aggregate([
    {
      $match: {
        ...query,
        deletedAt: null
      }
    },
    {
      $lookup: {
        from: 'seats',
        let: { screenId: { $toString: '$_id' } },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$screen_id', '$$screenId'] },
                  { $eq: ['$deletedAt', null] }
                ]
              }
            }
          },
          {
            $group: {
              _id: '$seat_type',
              count: { $sum: 1 }
            }
          }
        ],
        as: 'actualSeats'
      }
    },
    {
      $addFields: {
        actualCapacity: {
          $arrayToObject: {
            $map: {
              input: '$actualSeats',
              as: 'seat',
              in: {
                k: '$$seat._id',
                v: '$$seat.count'
              }
            }
          }
        },
        actualTotalSeats: {
          $sum: '$actualSeats.count'
        }
      }
    }
  ]);
};

// Virtual for display name
screenSchema.virtual('display_name').get(function () {
  return this.theater_id 
    ? `${this.theater_id} - ${this.screen_name}`
    : this.screen_name;
});

// Virtual for status display
screenSchema.virtual('status_display').get(function () {
  if (this.isDeleted()) return 'Deleted';
  return this.status.charAt(0).toUpperCase() + this.status.slice(1).replace('_', ' ');
});

// Virtual for capacity display
screenSchema.virtual('capacity_display').get(function () {
  const total = this.calculateTotalCapacity();
  return `${total} seats`;
});

// Virtual for utilization percentage
screenSchema.virtual('utilization_percentage').get(function () {
  if (!this.total_seats) return 0;
  const calculatedCapacity = this.calculateTotalCapacity();
  return Math.round((calculatedCapacity / this.total_seats) * 100);
});

// Pre-save middleware
screenSchema.pre('save', function (next) {
  // Ensure screen_name is properly formatted
  if (this.screen_name) {
    this.screen_name = this.screen_name.trim();
  }
  
  // Set updatedBy for updates
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }
  
  // Ensure deleted screens are not active
  if (this.deletedAt && this.status === 'active') {
    this.status = 'closed';
  }
  
  // Recalculate total_seats if capacity changed
  if (this.isModified('capacity')) {
    this.total_seats = this.calculateTotalCapacity();
  }
  
  next();
});

// Pre-aggregate middleware to exclude deleted screens by default
screenSchema.pre(['find', 'findOne', 'findOneAndUpdate', 'count', 'countDocuments'], function() {
  // Only apply if deletedAt filter is not already specified
  if (!this.getQuery().hasOwnProperty('deletedAt')) {
    this.where({ deletedAt: null });
  }
});

module.exports = mongoose.model('Screen', screenSchema);