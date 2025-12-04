const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Providers = require("../data/providers");

const customerSchema = new mongoose.Schema(
  {
    phone: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
      required: true,
      match: [/^\+?[1-9]\d{1,14}$/, "Invalid phone number"],
    },
    // Optional username for password login
    username: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
    },
    // Cusotmer fullname for display in tickets, receipts, profiles
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    // Optional password (only when user wants password login)
    password: {
      type: String,
      minlength: [6, "Password must be at least 6 characters long"],
      select: false,
    },

    provider: {
      type: String,
      enum: Object.values(Providers),
      default: Providers.PHONE,
    },
    // OTP fields
    otp: {
      type: String,
      select: false,
    },
    otpExpiresAt: {
      type: Date,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },

    lastLogin: {
      type: Date,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
    customerType: {
      type: String,
      enum: ["member", "walkin", "guest"],
      default: "member",
    },
    // Soft delete fields
    deletedAt: {
      type: Date,
      default: null,
    },
    deletedBy: {
      type: String,
      default: null,
    },
    restoredAt: {
      type: Date,
      default: null,
    },
    restoredBy: {
      type: String,
      default: null,
    },
    // Track password changes
    passwordChangedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

customerSchema.pre("save", async function (next) {
  // Only hash password if it's modified and user is admin/superadmin
  if (!this.isModified("password") || !this.password) {
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

customerSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) {
    return false;
  }
  return bcrypt.compare(candidatePassword, this.password);
};

customerSchema.methods.softDelete = function (adminId = null) {
  this.isActive = false;
  this.deletedAt = new Date();
  this.deletedBy = adminId;
  this.restoredAt = null;
  this.restoredBy = null;
  return this.save();
};

customerSchema.methods.restore = function (adminId = null) {
  this.isActive = true;
  this.deletedAt = null;
  this.deletedBy = null;
  this.restoredAt = new Date();
  this.restoredBy = adminId;
  return this.save();
};

customerSchema.methods.isDeleted = function () {
  return this.deletedAt !== null;
};

customerSchema.methods.isMemberCustomer = function () {
  return this.customerType === "member";
};
customerSchema.methods.isWalkInCustomer = function () {
  return this.customerType === "walkin";
};

customerSchema.methods.isGuestCustomer = function () {
  return this.customerType === "guest";
};

customerSchema.methods.requiresPassword = function () {
  return !!this.password;
};

customerSchema.statics.findActive = function (query = {}) {
  return this.find({ ...query, isActive: true, deletedAt: null });
};

customerSchema.statics.findDeleted = function (query = {}) {
  return this.find({ ...query, isActive: false, deletedAt: { $ne: null } });
};
// Indexes
customerSchema.index({ phone: 1 });
customerSchema.index({ username: 1 });
customerSchema.index({ isActive: 1, deletedAt: 1 });
customerSchema.index({ otpExpiresAt: 1 });
customerSchema.index({ lastLogin: -1 });

module.exports = mongoose.model("Customer", customerSchema);
