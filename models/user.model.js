const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Role } = require('../data');
const Providers = require('../data/providers');

const userSchema = new mongoose.Schema({
  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    match: [/^\+?[1-9]\d{1,14}$/, 'Please enter a valid phone number']
  },
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 50
  },
  // Password field for admin and superadmin
  password: {
    type: String,
    required: function() {
      // Require password for all roles except 'user'
      return this.role && this.role.toLowerCase() !== 'user';
    },
    minlength: [6, 'Password must be at least 6 characters long'],
    select: false // Don't include password in queries by default
  },
  role: {
    type: String,
    trim: true,
    lowercase: true,
    default: Role.USER
  },
  provider: {
    type: String,
    enum: Object.values(Providers),
    default: Providers.PHONE
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date
  },
  isActive: {
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
  // Track password changes
  passwordChangedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  // Only hash password if it's modified and user is admin/superadmin
  if (!this.isModified('password') || (!this.password)) {
    return next();
  }
  
  try {
    // Hash password with cost of 12
    const saltRounds = 12;
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  if (!this.password) {
    return false;
  }
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to check if user requires password authentication
userSchema.methods.requiresPassword = function() {
  return this.role && this.role.toLowerCase() !== 'user';
};

// Instance method to soft delete user
userSchema.methods.softDelete = function(userId = null) {
  this.isActive = false;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  this.restoredAt = null;
  this.restoredBy = null;
  return this.save();
};

// Instance method to restore user
userSchema.methods.restore = function(userId = null) {
  this.isActive = true;
  this.deletedAt = null;
  this.deletedBy = null;
  this.restoredAt = new Date();
  this.restoredBy = userId;
  return this.save();
};

// Instance method to check if user is soft deleted
userSchema.methods.isDeleted = function() {
  return this.deletedAt !== null;
};

// Static method to find active users (excluding soft deleted)
userSchema.statics.findActive = function(query = {}) {
  return this.find({
    ...query,
    isActive: true,
    deletedAt: null
  });
};

// Static method to find deleted users
userSchema.statics.findDeleted = function(query = {}) {
  return this.find({
    ...query,
    deletedAt: { $ne: null }
  }).sort({ deletedAt: -1 });
};

// Static method to find users by role (active only)
userSchema.statics.findByRole = function(role) {
  return this.find({
    role: role,
    isActive: true,
    deletedAt: null
  });
};

// Index for faster queries
userSchema.index({ role: 1 });
userSchema.index({ deletedAt: 1 });
userSchema.index({ isActive: 1, deletedAt: 1 });

module.exports = mongoose.model('User', userSchema);