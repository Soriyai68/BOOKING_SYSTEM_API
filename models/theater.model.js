const mongoose = require('mongoose');

const theaterSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 100,
    index: true
  },
  screens_id: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Screen',
    default: []
  }],
  address: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 500,
    index: true
  },
  city: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 100,
    index: true
  },
  province: {
    type: String,
    required: true,
    trim: true,
    minlength: 1,
    maxlength: 100,
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'maintenance', 'closed', 'renovation'],
    default: 'active',
    index: true
  },
  contact_info: {
    phone: {
      type: String,
      trim: true,
      match: /^\+?[\d\s\-\(\)]{8,20}$/,
      default: null
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      default: null
    },
    website: {
      type: String,
      trim: true,
      match: /^https?:\/\/.+/,
      default: null
    }
  },
  operating_hours: {
    monday: {
      open: { type: String, default: '09:00' },
      close: { type: String, default: '23:00' },
      closed: { type: Boolean, default: false }
    },
    tuesday: {
      open: { type: String, default: '09:00' },
      close: { type: String, default: '23:00' },
      closed: { type: Boolean, default: false }
    },
    wednesday: {
      open: { type: String, default: '09:00' },
      close: { type: String, default: '23:00' },
      closed: { type: Boolean, default: false }
    },
    thursday: {
      open: { type: String, default: '09:00' },
      close: { type: String, default: '23:00' },
      closed: { type: Boolean, default: false }
    },
    friday: {
      open: { type: String, default: '09:00' },
      close: { type: String, default: '23:00' },
      closed: { type: Boolean, default: false }
    },
    saturday: {
      open: { type: String, default: '09:00' },
      close: { type: String, default: '23:00' },
      closed: { type: Boolean, default: false }
    },
    sunday: {
      open: { type: String, default: '09:00' },
      close: { type: String, default: '23:00' },
      closed: { type: Boolean, default: false }
    }
  },
  features: {
    type: [String],
    enum: ['parking', 'food_court', 'disabled_access', 'air_conditioning', 'wifi', '3d_capable', 'imax', 'vip_lounge', 'arcade'],
    default: []
  },
  total_screens: {
    type: Number,
    min: 0,
    max: 50,
    default: 0
  },
  total_capacity: {
    type: Number,
    min: 0,
    default: 0
  },
  location: {
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere',
      default: null
    },
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    }
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
theaterSchema.index({ name: 1, city: 1 }, { unique: true });
theaterSchema.index({ city: 1, province: 1 });
theaterSchema.index({ status: 1 });
theaterSchema.index({ total_screens: 1 });
theaterSchema.index({ total_capacity: 1 });
theaterSchema.index({ deletedAt: 1 });
theaterSchema.index({ createdAt: 1 });
theaterSchema.index({ 'location.coordinates': '2dsphere' });

// Instance method for soft delete
theaterSchema.methods.softDelete = function (deletedBy = null) {
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  this.status = 'closed'; // Change status when deleted
  return this.save();
};

// Instance method for restore
theaterSchema.methods.restore = function (restoredBy = null) {
  this.deletedAt = null;
  this.deletedBy = null;
  this.restoredAt = new Date();
  this.restoredBy = restoredBy;
  this.status = 'active'; // Restore to active status
  return this.save();
};

// Instance method to check if deleted
theaterSchema.methods.isDeleted = function () {
  return this.deletedAt !== null;
};

// Instance method to update status
theaterSchema.methods.updateStatus = function (newStatus, updatedBy = null) {
  const validStatuses = ['active', 'maintenance', 'closed', 'renovation'];
  if (!validStatuses.includes(newStatus)) {
    throw new Error('Invalid status provided');
  }

  this.status = newStatus;
  this.updatedBy = updatedBy;

  return this.save();
};

// Instance method to add screen
theaterSchema.methods.addScreen = function (screenId) {
  if (!this.screens_id.includes(screenId)) {
    this.screens_id.push(screenId);
    this.total_screens = this.screens_id.length;
  }
  return this.save();
};

// Instance method to remove screen
theaterSchema.methods.removeScreen = function (screenId) {
  this.screens_id = this.screens_id.filter(id => !id.equals(screenId));
  this.total_screens = this.screens_id.length;
  return this.save();
};

// Instance method to update location
theaterSchema.methods.updateLocation = function (longitude, latitude) {
  if (typeof longitude === 'number' && typeof latitude === 'number') {
    this.location.coordinates = [longitude, latitude];
  }
  return this.save();
};

// Instance method to update operating hours
theaterSchema.methods.updateOperatingHours = function (day, hours) {
  const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  if (validDays.includes(day.toLowerCase())) {
    this.operating_hours[day.toLowerCase()] = {
      ...this.operating_hours[day.toLowerCase()],
      ...hours
    };
  }
  return this.save();
};

// Static method to find theaters by city
theaterSchema.statics.findByCity = function (city, query = {}) {
  return this.find({
    ...query,
    city: new RegExp(city, 'i'),
    deletedAt: null
  });
};

// Static method to find theaters by province
theaterSchema.statics.findByProvince = function (province, query = {}) {
  return this.find({
    ...query,
    province: new RegExp(province, 'i'),
    deletedAt: null
  });
};

// Static method to find active theaters
theaterSchema.statics.findActive = function (query = {}) {
  return this.find({
    ...query,
    deletedAt: null,
    status: 'active'
  });
};

// Static method to find theaters by status
theaterSchema.statics.findByStatus = function (status, query = {}) {
  return this.find({
    ...query,
    status: status,
    deletedAt: null
  });
};

// Static method to find deleted theaters
theaterSchema.statics.findDeleted = function (query = {}) {
  return this.find({
    ...query,
    deletedAt: { $ne: null }
  });
};

// Static method to find theaters near location
theaterSchema.statics.findNearby = function (longitude, latitude, maxDistance = 10000, query = {}) {
  return this.find({
    ...query,
    'location.coordinates': {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: maxDistance
      }
    },
    deletedAt: null
  });
};

// Static method to get theaters with screen counts
theaterSchema.statics.getTheatersWithScreenCounts = async function (query = {}) {
  return this.aggregate([
    {
      $match: {
        ...query,
        deletedAt: null
      }
    },
    {
      $lookup: {
        from: 'screens',
        localField: 'screens_id',
        foreignField: '_id',
        as: 'screens',
        pipeline: [
          { $match: { deletedAt: null } }
        ]
      }
    },
    {
      $addFields: {
        actualScreenCount: { $size: '$screens' },
        totalActualCapacity: { $sum: '$screens.total_seats' }
      }
    }
  ]);
};

// Static method for theater analytics
theaterSchema.statics.getAnalytics = async function (query = {}) {
  return this.aggregate([
    {
      $match: {
        ...query,
        deletedAt: null
      }
    },
    {
      $group: {
        _id: null,
        totalTheaters: { $sum: 1 },
        activeTheaters: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
        },
        totalScreens: { $sum: '$total_screens' },
        totalCapacity: { $sum: '$total_capacity' },
        averageScreensPerTheater: { $avg: '$total_screens' },
        theatersByProvince: {
          $push: {
            province: '$province',
            city: '$city',
            name: '$name',
            screens: '$total_screens',
            capacity: '$total_capacity'
          }
        }
      }
    },
    {
      $addFields: {
        provinceStats: {
          $reduce: {
            input: '$theatersByProvince',
            initialValue: {},
            in: {
              $mergeObjects: [
                '$$value',
                {
                  $arrayToObject: [[
                    { k: '$$this.province', v: { $add: [{ $ifNull: [{ $getField: { field: '$$this.province', input: '$$value' } }, 0] }, 1] } }
                  ]]
                }
              ]
            }
          }
        }
      }
    }
  ]);
};

// Virtual for display name with location
theaterSchema.virtual('display_name').get(function () {
  return `${this.name} - ${this.city}, ${this.province}`;
});

// Virtual for status display
theaterSchema.virtual('status_display').get(function () {
  if (this.isDeleted()) return 'Deleted';
  return this.status.charAt(0).toUpperCase() + this.status.slice(1).replace('_', ' ');
});

// Virtual for full address
theaterSchema.virtual('full_address').get(function () {
  return `${this.address}, ${this.city}, ${this.province}`;
});

// Virtual for screen count display
theaterSchema.virtual('screen_count_display').get(function () {
  const count = this.screens_id.length;
  return `${count} screen${count !== 1 ? 's' : ''}`;
});

// Virtual for capacity display
theaterSchema.virtual('capacity_display').get(function () {
  return `${this.total_capacity} seats`;
});

// Pre-save middleware
theaterSchema.pre('save', function (next) {
  // Ensure name is properly formatted
  if (this.name) {
    this.name = this.name.trim();
  }

  // Ensure address fields are properly formatted
  if (this.address) {
    this.address = this.address.trim();
  }
  if (this.city) {
    this.city = this.city.trim();
  }
  if (this.province) {
    this.province = this.province.trim();
  }

  // Set updatedBy for updates
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }

  // Ensure deleted theaters are not active
  if (this.deletedAt && this.status === 'active') {
    this.status = 'closed';
  }

  // Update total screens count
  if (this.isModified('screens_id')) {
    this.total_screens = this.screens_id.length;
  }

  next();
});

// Pre-aggregate middleware to exclude deleted theaters by default
theaterSchema.pre(['find', 'findOne', 'findOneAndUpdate', 'count', 'countDocuments'], function () {
  // Only apply if deletedAt filter is not already specified
  if (!this.getQuery().hasOwnProperty('deletedAt')) {
    this.where({ deletedAt: null });
  }
});

module.exports = mongoose.model('Theater', theaterSchema);