const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  address: {
    type: String,
    required: true,
    trim: true,
    minlength: 5,
    maxlength: 200
  },
  city: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 50
  },
  province: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 50
  },
  status: {
    type: Boolean,
    default: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000,
    default: ''
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
  // Additional metadata for better management
  coordinates: {
    latitude: {
      type: Number,
      min: -90,
      max: 90
    },
    longitude: {
      type: Number,
      min: -180,
      max: 180
    }
  },
  postalCode: {
    type: String,
    trim: true,
    maxlength: 20
  },
  country: {
    type: String,
    trim: true,
    maxlength: 50,
    default: 'Cambodia'
  },
  // Business metadata
  businessHours: {
    openTime: {
      type: String,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format. Use HH:MM']
    },
    closeTime: {
      type: String,
      match: [/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Invalid time format. Use HH:MM']
    },
    isOpen24Hours: {
      type: Boolean,
      default: false
    }
  },
  contact: {
    phone: {
      type: String,
      trim: true,
      match: [/^(\+?[1-9]\d{1,14})?$/, 'Invalid phone number format']
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email format']
    }
  },
  // Theater management
  totalTheaters: {
    type: Number,
    min: 0,
    default: 0
  },
  totalSeats: {
    type: Number,
    min: 0,
    default: 0
  },
  amenities: [{
    type: String,
    trim: true
  }],
  // Audit fields
  createdBy: {
    type: String,
    default: null
  },
  updatedBy: {
    type: String,
    default: null
  }
}, {
  timestamps: true
});

// Compound index for better search performance
locationSchema.index({ city: 1, province: 1 });
locationSchema.index({ status: 1, deletedAt: 1 });

// Text index for search functionality
locationSchema.index({
  address: 'text',
  city: 'text',
  province: 'text',
  description: 'text'
});

// Individual indexes for faster queries
locationSchema.index({ deletedAt: 1 });
locationSchema.index({ status: 1 });
locationSchema.index({ city: 1 });
locationSchema.index({ province: 1 });

// Instance method to soft delete location
locationSchema.methods.softDelete = function (userId = null) {
  this.status = false;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  this.restoredAt = null;
  this.restoredBy = null;
  return this.save();
};

// Instance method to restore location
locationSchema.methods.restore = function (userId = null) {
  this.status = true;
  this.deletedAt = null;
  this.deletedBy = null;
  this.restoredAt = new Date();
  this.restoredBy = userId;
  return this.save();
};

// Instance method to check if location is soft deleted
locationSchema.methods.isDeleted = function () {
  return this.deletedAt !== null;
};

// Instance method to toggle status
locationSchema.methods.toggleStatus = function (userId = null) {
  this.status = !this.status;
  this.updatedBy = userId;
  return this.save();
};

// Instance method to update coordinates
locationSchema.methods.updateCoordinates = function (latitude, longitude, userId = null) {
  if (latitude < -90 || latitude > 90) {
    throw new Error('Latitude must be between -90 and 90');
  }
  if (longitude < -180 || longitude > 180) {
    throw new Error('Longitude must be between -180 and 180');
  }

  this.coordinates = { latitude, longitude };
  this.updatedBy = userId;
  return this.save();
};

// Static method to find active locations (excluding soft deleted)
locationSchema.statics.findActive = function (query = {}) {
  return this.find({
    ...query,
    deletedAt: null
  });
};

// Static method to find deleted locations
locationSchema.statics.findDeleted = function (query = {}) {
  return this.find({
    ...query,
    deletedAt: { $ne: null }
  }).sort({ deletedAt: -1 });
};

// Static method to find locations by city
locationSchema.statics.findByCity = function (city, activeOnly = true) {
  const query = { city: new RegExp(city, 'i') };
  if (activeOnly) {
    query.deletedAt = null;
    query.status = true;
  }
  return this.find(query);
};

// Static method to find locations by province
locationSchema.statics.findByProvince = function (province, activeOnly = true) {
  const query = { province: new RegExp(province, 'i') };
  if (activeOnly) {
    query.deletedAt = null;
    query.status = true;
  }
  return this.find(query);
};

// Static method to find locations by status
locationSchema.statics.findByStatus = function (status, activeOnly = true) {
  const query = { status };
  if (activeOnly) {
    query.deletedAt = null;
  }
  return this.find(query);
};

// Static method to search locations
locationSchema.statics.searchLocations = function (searchTerm, activeOnly = true) {
  const query = {
    $text: { $search: searchTerm }
  };
  if (activeOnly) {
    query.deletedAt = null;
  }
  return this.find(query, { score: { $meta: 'textScore' } })
    .sort({ score: { $meta: 'textScore' } });
};

// Virtual for full address
locationSchema.virtual('fullAddress').get(function () {
  return `${this.address}, ${this.city}, ${this.province}${this.country ? `, ${this.country}` : ''}`;
});

// Virtual for display name
locationSchema.virtual('displayName').get(function () {
  return `${this.city} - ${this.address}`;
});

// Virtual for business hours display
locationSchema.virtual('businessHoursDisplay').get(function () {
  if (this.businessHours.isOpen24Hours) {
    return '24 Hours';
  }
  if (this.businessHours.openTime && this.businessHours.closeTime) {
    return `${this.businessHours.openTime} - ${this.businessHours.closeTime}`;
  }
  return 'Hours not specified';
});

// Pre-save middleware for location validation and formatting
locationSchema.pre('save', function (next) {
  // Capitalize city and province names
  if (this.city) {
    this.city = this.city.charAt(0).toUpperCase() + this.city.slice(1).toLowerCase();
  }
  if (this.province) {
    this.province = this.province.charAt(0).toUpperCase() + this.province.slice(1).toLowerCase();
  }
  if (this.country) {
    this.country = this.country.charAt(0).toUpperCase() + this.country.slice(1).toLowerCase();
  }

  // Validate business hours consistency
  if (this.businessHours.isOpen24Hours) {
    this.businessHours.openTime = undefined;
    this.businessHours.closeTime = undefined;
  }

  next();
});

module.exports = mongoose.model('Location', locationSchema);