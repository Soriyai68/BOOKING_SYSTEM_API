const mongoose = require('mongoose');

const permissionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
    maxlength: 50
  },
  displayName: {
    type: String,
    required: true,
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    trim: true,
    maxlength: 255
  },
  module: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    maxlength: 50
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for faster queries
permissionSchema.index({ name: 1 });
permissionSchema.index({ module: 1 });
permissionSchema.index({ isActive: 1 });

module.exports = mongoose.model('Permission', permissionSchema);