const mongoose = require("mongoose");

const showtimeSchema = new mongoose.Schema(
  {
    movie_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Movie",
      required: true,
    },
    hall_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hall",
      required: true,
    },
    start_time: { type: Date, required: true },
    end_time: { type: Date, required: true },
    available_seats: { type: Number, default: 0 }, // initialized from hall
    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled"],
      default: "scheduled",
    },
    language: { type: String, default: "Original" },
    subtitle: { type: String, default: "Original" },
    // Soft delete
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    restoredAt: { type: Date, default: null },
    restoredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // Audit
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
  { timestamps: true }
);

// Indexes
showtimeSchema.index({ movie_id: 1, start_time: 1 });
showtimeSchema.index({ hall_id: 1, start_time: 1 });
showtimeSchema.index({ start_time: 1 });

// Soft delete methods
showtimeSchema.methods.softDelete = function (deletedBy = null) {
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  return this.save();
};

// restore methods
showtimeSchema.methods.restore = function (userId) {
  this.restoredAt = new Date();
  this.restoredBy = userId;
  this.deletedAt = null;
  this.deletedBy = null;
  return this.save();
};

showtimeSchema.methods.isDeleted = function () {
  return this.deletedAt !== null;
};

// Pre-save hook: initialize available seats from hall
showtimeSchema.pre("save", async function (next) {
  if (this.isNew) {
    const Hall = mongoose.model("Hall");
    const hall = await Hall.findById(this.hall_id);
    if (!hall) return next(new Error("Hall not found"));
    this.available_seats = hall.total_seats;
  }
  next();
});

// Method to decrease available seats when booking
showtimeSchema.methods.bookSeats = async function (count) {
  if (count > this.available_seats) {
    throw new Error("Not enough seats available");
  }
  this.available_seats -= count;
  return this.save();
};

//  Method to increase available seats when cancel booking
showtimeSchema.methods.cancelSeats = async function (count) {
  this.available_seats += count;
  return this.save();
};

module.exports = mongoose.model("Showtime", showtimeSchema);