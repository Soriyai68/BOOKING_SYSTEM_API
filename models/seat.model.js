const mongoose = require("mongoose");

const seatSchema = new mongoose.Schema(
  {
    row: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: 1,
      maxlength: 5,
    },
    seat_number: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: 1,
      maxlength: 10,
    },
    seat_type: {
      type: String,
      required: true,
      enum: ["regular", "vip", "couple", "queen"],
      default: "regular",
    },
    is_available: {
      type: Boolean,
      default: true,
    },
    status: {
      type: String,
      enum: ["active", "maintenance", "out_of_order", "reserved", "closed"],
      default: "active",
    },
    theater_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Theater",
      default: null,
      index: true,
    },
    screen_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Screen",
      default: null,
      index: true,
    },
    price: {
      type: Number,
      default: 0,
      min: 0,
    },
    notes: {
      type: String,
      maxlength: 500,
      trim: true,
      default: "",
    },
    // Soft delete fields
    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    restoredAt: {
      type: Date,
      default: null,
    },
    restoredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // Audit fields
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
seatSchema.index({ row: 1, seat_number: 1 }, { unique: true });
seatSchema.index({ seat_type: 1 });
seatSchema.index({ is_available: 1 });

// Instance method to toggle availability
seatSchema.methods.toggleAvailability = function () {
  this.is_available = !this.is_available;
  return this.save();
};
// Instance method to soft delete seat
seatSchema.methods.softDelete = function (deletedBy = null) {
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  this.status = "closed";
  return this.save();
};
// Instance method to soft restore seat
seatSchema.methods.restore = function (restoredBy = null) {
  this.deletedAt = null;
  this.deletedBy = null;
  this.restoredAt = new Date();
  this.restoredBy = restoredBy;
  this.status = "active";
  return this.save();
};
// Instance method to check if deleted
seatSchema.methods.isDeleted = function () {
  return this.deletedAt !== null;
};
// Static method to find seats by type
seatSchema.statics.findByType = function (seatType) {
  return this.find({ seat_type: seatType });
};

// Static method to find available seats
seatSchema.statics.findAvailable = function (query = {}) {
  return this.find({
    ...query,
    is_available: true,
  });
};

// Virtual for full seat identifier
seatSchema.virtual("seat_identifier").get(function () {
  return `${this.row}${this.seat_number}`;
});

// Virtual for seat display name
seatSchema.virtual("display_name").get(function () {
  return `Seat ${this.row}${this.seat_number} (${this.seat_type})`;
});

// Instance method to update status
seatSchema.methods.updateStatus = function (newStatus, updatedBy = null) {
  const validStatuses = [
    "active",
    "maintenance",
    "out_of_order",
    "reserved",
    "closed",
  ];
  if (!validStatuses.includes(newStatus)) {
    throw new Error("Invalid status provided");
  }

  this.status = newStatus;
  this.updatedBy = updatedBy;

  return this.save();
};
// Pre-save middleware to ensure uppercase
seatSchema.pre("save", function (next) {
  if (this.seat_number) {
    this.seat_number = this.seat_number.toString().toUpperCase();
  }
  if (this.row) {
    this.row = this.row.toString().toUpperCase();
  }
  next();
});

module.exports = mongoose.model("Seat", seatSchema);
