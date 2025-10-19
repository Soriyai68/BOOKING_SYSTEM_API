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
      type: mongoose.Schema.Types.Mixed, // Can be String or Array
      required: true,
      validate: {
        validator: function(value) {
          if (typeof value === 'string') {
            return value.trim().length >= 1 && value.trim().length <= 10;
          }
          if (Array.isArray(value)) {
            return value.length > 0 && value.every(seat => 
              typeof seat === 'string' && 
              seat.trim().length >= 1 && 
              seat.trim().length <= 10
            );
          }
          return false;
        },
        message: 'Seat number must be a string (1-10 chars) or array of strings (1-10 chars each)'
      }
    },
    seat_type: {
      type: String,
      required: true,
      enum: ["regular", "vip", "couple", "queen"],
      default: "regular",
    },
    status: {
      type: String,
      enum: ["active", "maintenance", "out_of_order", "reserved", "closed"],
      default: "active",
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
    hall_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hall",
      required: true,
      index: true,
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

// Index for faster queries - Note: unique constraint will be handled in application logic for multi-seat
seatSchema.index({ hall_id: 1, row: 1, seat_number: 1 });
// Additional index for multi-seat queries
seatSchema.index({ hall_id: 1, row: 1 });
seatSchema.index({ seat_type: 1 });

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

// Virtual for full seat identifier
seatSchema.virtual("seat_identifier").get(function () {
  if (typeof this.seat_number === 'string') {
    return `${this.row}${this.seat_number}`;
  } else if (Array.isArray(this.seat_number)) {
    return this.seat_number.map(seat => `${this.row}${seat}`).join(', ');
  }
  return `${this.row}${this.seat_number}`;
});

// Virtual for seat display name
seatSchema.virtual("display_name").get(function () {
  if (typeof this.seat_number === 'string') {
    return `Seat ${this.row}${this.seat_number} (${this.seat_type})`;
  } else if (Array.isArray(this.seat_number)) {
    const seatNumbers = this.seat_number.join(', ');
    return `Seats ${this.row}${seatNumbers} (${this.seat_type})`;
  }
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
    if (typeof this.seat_number === 'string') {
      this.seat_number = this.seat_number.toString().toUpperCase();
    } else if (Array.isArray(this.seat_number)) {
      this.seat_number = this.seat_number.map(seat => seat.toString().toUpperCase());
    }
  }
  if (this.row) {
    this.row = this.row.toString().toUpperCase();
  }
  next();
});
// After a seat is saved
seatSchema.post("save", async function () {
  const Hall = mongoose.model("Hall");
  await Hall.updateTotalSeatsForHall(this.hall_id);
});

// After a seat is deleted
seatSchema.post("findOneAndDelete", async function (doc) {
  if (doc) {
    const Hall = mongoose.model("Hall");
    await Hall.updateTotalSeatsForHall(doc.hall_id);
  }
});

module.exports = mongoose.model("Seat", seatSchema);
