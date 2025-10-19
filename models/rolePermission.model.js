const mongoose = require('mongoose');

const rolePermissionSchema = new mongoose.Schema({
  role: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  permission: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Permission',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Ensure unique role-permission combinations
rolePermissionSchema.index({ role: 1, permission: 1 }, { unique: true });
rolePermissionSchema.index({ role: 1 });
rolePermissionSchema.index({ permission: 1 });
rolePermissionSchema.index({ isActive: 1 });

// Static method to get permissions for a role
rolePermissionSchema.statics.getPermissionsForRole = async function(role) {
  const rolePermissions = await this.find({ role, isActive: true })
    .populate('permission')
    .exec();
  
  return rolePermissions
    .filter(rp => rp.permission && rp.permission.isActive)
    .map(rp => rp.permission);
};

// Static method to check if role has specific permission
rolePermissionSchema.statics.hasPermission = async function(role, permissionName) {
  const Permission = mongoose.model('Permission');
  const permission = await Permission.findOne({ name: permissionName, isActive: true });
  
  if (!permission) return false;
  
  const rolePermission = await this.findOne({
    role,
    permission: permission._id,
    isActive: true
  });
  
  return !!rolePermission;
};

module.exports = mongoose.model('RolePermission', rolePermissionSchema);