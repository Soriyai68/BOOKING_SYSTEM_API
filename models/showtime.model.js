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
    theater_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Theater",
      required: true,
    },
    start_time: { type: Date, required: true },
    end_time: { type: Date, required: true },
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
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
showtimeSchema.index({ movie_id: 1, start_time: 1, status: 1 });
showtimeSchema.index({ hall_id: 1, start_time: 1 });
showtimeSchema.index({ start_time: 1 });
showtimeSchema.index({ status: 1 });
showtimeSchema.index({ deletedAt: 1 });
showtimeSchema.index({ createdAt: 1 });

// Static methods
showtimeSchema.statics.findOverlappingShowtimes = function (
  hallId,
  startTime,
  endTime,
  showtimeId = null
) {
  const query = {
    hall_id: hallId,
    start_time: { $lt: endTime },
    end_time: { $gt: startTime },
    deletedAt: null,
  };

  if (showtimeId) {
    query._id = { $ne: showtimeId };
  }
  return this.find(query);
};

showtimeSchema.statics.findAvailableByMovie = function (movieId, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return this.find({
    movie_id: movieId,
    start_time: { $gte: startOfDay, $lte: endOfDay },
    status: "scheduled",
    deletedAt: null,
  });
};

// Find showtimes by hall for a specific date
showtimeSchema.statics.findByHallAndDate = function (hallId, date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return this.find({
    hall_id: hallId,
    start_time: { $gte: startOfDay, $lte: endOfDay },
    deletedAt: null,
  }).sort("start_time");
};

// Soft-deleted / active showtimes
showtimeSchema.statics.findDeleted = function () {
  return this.find({ deletedAt: { $ne: null } });
};

showtimeSchema.statics.findActive = function () {
  return this.find({ deletedAt: null });
};

// Instance methods
showtimeSchema.methods.softDelete = function (deletedBy = null) {
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  return this.save();
};

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

showtimeSchema.methods.isUpcoming = function () {
  return this.start_time > new Date();
};

showtimeSchema.methods.isPast = function () {
  return this.end_time < new Date();
};

showtimeSchema.methods.updateStatus = function (newStatus, updateBy = null) {
  const validStatuses = ["scheduled", "completed", "cancelled"];
  if (!validStatuses.includes(newStatus)) {
    throw new Error("Invalid status provided");
  }
  this.status = newStatus;
  this.updatedBy = updateBy
  ;
  return this.save();
};

// Middleware
// Exclude soft-deleted documents
showtimeSchema.pre(/^find/, function (next) {
  if (this.getFilter().deletedAt === undefined) {
    this.where({ deletedAt: null });
  }
  next();
});

// Pre-save: validate overlapping, auto-update status
showtimeSchema.pre("save", async function (next) {
  // Check for overlapping showtimes
  if (
    this.isNew ||
    this.isModified("start_time") ||
    this.isModified("end_time")
  ) {
    const overlapping = await this.constructor.findOverlappingShowtimes(
      this.hall_id,
      this.start_time,
      this.end_time,
      this._id
    );

    if (overlapping.length > 0) {
      return next(
        new Error(
          "Showtime overlaps with an existing showtime in the same hall."
        )
      );
    }
  }

  // Auto-update status if end_time passed
  if (this.status === "scheduled" && this.end_time < new Date()) {
    this.status = "completed";
  }

  next();
});
module.exports = mongoose.model("Showtime", showtimeSchema);
