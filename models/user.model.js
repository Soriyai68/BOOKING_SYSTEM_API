const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { Role } = require('../data');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/.+@.+\..+/, 'Please enter a valid email'],
    required: true,
    index: { unique: true }
  },
  username: {
    type: String,
    trim: true,
    required: true,
    minlength: 2,
    maxlength: 50,
    index: { unique: true }
  },
  name: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 50
  },
  photoUrl: {
    type: String,
    trim: true
  },
  password: {
    type: String,
    required: function () {
      // Require password for admin/superadmin
      return this.role && this.role.toLowerCase() !== 'user';
    },
    minlength: [6, 'Password must be at least 6 characters long'],
    select: false
  },
  role: {
    type: String,
    trim: true,
    lowercase: true,
    default: Role.USER
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
  passwordChangedAt: {
    type: Date,
    default: null
  },
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

// Hash password before save
userSchema.pre('save', async function (next) {
  if (!this.isModified('password') || !this.password) return next();
  try {
    const saltRounds = 12;
    this.password = await bcrypt.hash(this.password, saltRounds);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

// Check if user requires password
userSchema.methods.requiresPassword = function () {
  return this.role && this.role.toLowerCase() !== 'user';
};

// Soft delete
userSchema.methods.softDelete = function (userId = null) {
  this.isActive = false;
  this.deletedAt = new Date();
  this.deletedBy = userId;
  this.restoredAt = null;
  this.restoredBy = null;
  return this.save();
};

// Restore user
userSchema.methods.restore = function (userId = null) {
  this.isActive = true;
  this.deletedAt = null;
  this.deletedBy = null;
  this.restoredAt = new Date();
  this.restoredBy = userId;
  return this.save();
};

// Check if soft deleted
userSchema.methods.isDeleted = function () {
  return this.deletedAt !== null;
};

// Static methods
userSchema.statics.findActive = function (query = {}) {
  return this.find({ ...query, isActive: true, deletedAt: null });
};

userSchema.statics.findDeleted = function (query = {}) {
  return this.find({ ...query, deletedAt: { $ne: null } }).sort({ deletedAt: -1 });
};

userSchema.statics.findByRole = function (role) {
  return this.find({ role: role, isActive: true, deletedAt: null });
};

// Indexes
userSchema.index({ role: 1 });
userSchema.index({ deletedAt: 1 });
userSchema.index({ isActive: 1, deletedAt: 1 });

module.exports = mongoose.model('User', userSchema);