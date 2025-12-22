const mongoose = require("mongoose");

const showtimeSchema = new mongoose.Schema(
  {
    hall_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hall",
      required: true,
    },
    movie_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Movie",
    },
    show_date: {
      type: Date,
      required: true,
    },
    start_time: {
      type: String,
      required: true,
    },
    end_time: {
      type: String,
    },
    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled"],
      default: "scheduled",
    },
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
  }
);

// Indexes
showtimeSchema.index({ movie_id: 1, start_time: 1, status: 1 });
showtimeSchema.index(
  { hall_id: 1, show_date: 1, start_time: 1 },
  { unique: true }
);
showtimeSchema.index({ hall_id: 1, start_time: 1 });
showtimeSchema.index({ start_time: 1 });
showtimeSchema.index({ status: 1 });
showtimeSchema.index({ deletedAt: 1 });
showtimeSchema.index({ createdAt: 1 });

// Static methods
showtimeSchema.statics.findOverlappingShowtimes = function (
  hallId,
  showDate,
  startTime,
  endTime,
  showtimeId = null
) {
  const query = {
    hall_id: hallId,
    show_date: showDate,
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

  return this.find({
    movie_id: movieId,
    show_date: { $gte: startOfDay },
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
    show_date: { $gte: startOfDay, $lte: endOfDay },
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

showtimeSchema.statics.getAnalytics = async function (query = {}) {
  const analytics = await this.aggregate([
    {
      $match: {
        ...query,
        deletedAt: null,
      },
    },
    {
      $facet: {
        generalStats: [
          {
            $group: {
              _id: null,
              totalShowtimes: { $sum: 1 },
              scheduled: {
                $sum: { $cond: [{ $eq: ["$status", "scheduled"] }, 1, 0] },
              },
              completed: {
                $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
              },
              cancelled: {
                $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] },
              },
            },
          },
          {
            $project: {
              _id: 0,
              totalShowtimes: 1,
              statusCounts: {
                scheduled: "$scheduled",
                completed: "$completed",
                cancelled: "$cancelled",
              },
            },
          },
        ],
        byMovie: [
          { $group: { _id: "$movie_id", count: { $sum: 1 } } },
          {
            $lookup: {
              from: "movies",
              localField: "_id",
              foreignField: "_id",
              as: "movie",
            },
          },
          { $unwind: { path: "$movie", preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 0,
              movie: { $ifNull: ["$movie.title", "Unknown"] },
              count: 1,
            },
          },
          { $sort: { count: -1 } },
        ],
        byTheater: [
          {
            $lookup: {
              from: "halls",
              localField: "hall_id",
              foreignField: "_id",
              as: "hall",
            },
          },
          { $unwind: { path: "$hall", preserveNullAndEmptyArrays: true } },
          { $group: { _id: "$hall.theater_id", count: { $sum: 1 } } },
          {
            $lookup: {
              from: "theaters",
              localField: "_id",
              foreignField: "_id",
              as: "theater",
            },
          },
          { $unwind: { path: "$theater", preserveNullAndEmptyArrays: true } },
          {
            $project: {
              _id: 0,
              theater: { $ifNull: ["$theater.name", "Unknown"] },
              count: 1,
            },
          },
          { $sort: { count: -1 } },
        ],
      },
    },
    {
      $project: {
        stats: { $arrayElemAt: ["$generalStats", 0] },
        byMovie: "$byMovie",
        byTheater: "$byTheater",
      },
    },
    {
      $replaceRoot: {
        newRoot: {
          $mergeObjects: [
            { $ifNull: ["$stats", {}] },
            { showtimesByMovie: "$byMovie" },
            { showtimesByTheater: "$byTheater" },
          ],
        },
      },
    },
  ]);

  return (
    analytics[0] || {
      totalShowtimes: 0,
      statusCounts: { scheduled: 0, completed: 0, cancelled: 0 },
      showtimesByMovie: [],
      showtimesByTheater: [],
    }
  );
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
  const [hours, minutes] = this.start_time.split(":");
  const showDateTime = new Date(this.show_date);
  showDateTime.setHours(hours, minutes, 0, 0);
  return showDateTime > new Date();
};

showtimeSchema.methods.isPast = function () {
  const [hours, minutes] = this.end_time.split(":");
  const showEndDateTime = new Date(this.show_date);
  showEndDateTime.setHours(hours, minutes, 0, 0);
  return showEndDateTime < new Date();
};

showtimeSchema.methods.updateStatus = function (newStatus, updateBy = null) {
  const validStatuses = ["scheduled", "completed", "cancelled"];
  if (!validStatuses.includes(newStatus)) {
    throw new Error("Invalid status provided");
  }
  this.status = newStatus;
  this.updatedBy = updateBy;
  return this.save();
};

showtimeSchema.methods.isActiveForBooking = function () {
  return this.status === "scheduled" && this.isUpcoming();
};

// Middleware
// Exclude soft-deleted documents
showtimeSchema.pre(/^find/, function (next) {
  if (this.getFilter().deletedAt === undefined) {
    this.where({ deletedAt: null });
  }
  next();
});

// Pre-save: auto-calculate end time, validate overlapping, auto-update status
showtimeSchema.pre("save", async function (next) {
  // Auto-calculate end_time from movie duration if not provided or if dependencies change
  if (
    this.isNew ||
    this.isModified("start_time") ||
    this.isModified("movie_id")
  ) {
    if (this.movie_id && this.start_time) {
      try {
        const Movie = mongoose.model("Movie");
        const movie = await Movie.findById(this.movie_id);
        if (movie && movie.duration_minutes) {
          const showDate = new Date(this.show_date);
          const [startHours, startMinutes] = this.start_time
            .split(":")
            .map(Number);
          const startDateTime = new Date(
            showDate.getFullYear(),
            showDate.getMonth(),
            showDate.getDate(),
            startHours,
            startMinutes
          );
          const totalDuration = movie.duration_minutes;
          const endDateTime = new Date(
            startDateTime.getTime() + totalDuration * 60000
          );
          this.end_time = `${String(endDateTime.getHours()).padStart(
            2,
            "0"
          )}:${String(endDateTime.getMinutes()).padStart(2, "0")}`;
        }
      } catch (error) {
        return next(
          new Error(`Failed to calculate end time: ${error.message}`)
        );
      }
    }
  }

  if (!this.end_time) {
    return next(
      new Error(
        "Showtime end_time is required but was not provided and could not be calculated."
      )
    );
  }

  if (
    this.isNew ||
    this.isModified("start_time") ||
    this.isModified("show_date")
  ) {
    const showDate = new Date(this.show_date);
    const [startHours, startMinutes] = this.start_time.split(":").map(Number);
    const startDateTime = new Date(
      showDate.getFullYear(),
      showDate.getMonth(),
      showDate.getDate(),
      startHours,
      startMinutes
    );
    if (startDateTime < new Date()) {
      return next(
        new Error("Showtime start date and time cannot be in the past.")
      );
    }
  }

  if (
    this.isNew ||
    this.isModified("start_time") ||
    this.isModified("end_time") ||
    this.isModified("show_date")
  ) {
    const overlapping = await this.constructor.findOverlappingShowtimes(
      this.hall_id,
      this.show_date,
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

  // Auto-update status if end_time has passed
  if (this.status === "scheduled") {
    const [hours, minutes] = this.end_time.split(":");
    const showEndDateTime = new Date(this.show_date);
    showEndDateTime.setHours(hours, minutes, 0, 0);
    if (showEndDateTime < new Date()) {
      this.status = "completed";
    }
  }

  // If status has been changed to 'completed' (either manually or automatically),
  // we clean up the seat booking records for this showtime.
  if (this.isModified("status") && this.status === "completed") {
    const SeatBooking = mongoose.model("SeatBooking");
    const logger = require("../utils/logger");

    try {
      logger.info(
        `Showtime ${this._id} completed. Deleting associated seat bookings.`
      );
      const { deletedCount } = await SeatBooking.deleteMany({
        showtimeId: this._id,
      });
      logger.info(
        `Deleted ${deletedCount} seat bookings for completed showtime ${this._id}.`
      );
    } catch (error) {
      logger.error(
        `Error deleting seat bookings for showtime ${this._id}: ${error.message}`
      );
    }
  }

  // If status has been changed to 'cancelled', cancel all associated bookings.
  // The updated booking.cancelBooking() method will handle deleting SeatBooking entries.
  if (this.isModified("status") && this.status === "cancelled") {
    const Booking = mongoose.model("Booking");
    const logger = require("../utils/logger");

    try {
      logger.info(
        `Showtime ${this._id} cancelled. Cancelling associated bookings.`
      );
      const bookingsToCancel = await Booking.find({
        showtimeId: this._id,
        booking_status: { $ne: "Cancelled" },
      });

      if (bookingsToCancel.length > 0) {
        const cancellationPromises = bookingsToCancel.map((booking) =>
          booking.cancelBooking(`Showtime was cancelled.`)
        );
        await Promise.all(cancellationPromises);
        logger.info(
          `Cancelled ${bookingsToCancel.length} bookings for showtime ${this._id}.`
        );
      } else {
        logger.info(`No active bookings to cancel for showtime ${this._id}.`);
      }
    } catch (error) {
      logger.error(
        `Error cancelling bookings for showtime ${this._id}: ${error.message}`
      );
    }
  }

  next();
});
// Auto-update status on find operations
showtimeSchema.post(/^find/, async function (result, next) {
  try {
    if (!result) {
      return next();
    }

    const docs = Array.isArray(result) ? result : [result];
    const now = new Date();
    const updates = [];

    for (const doc of docs) {
      if (doc && doc.status === "scheduled" && doc.end_time && doc.show_date) {
        const [hours, minutes] = doc.end_time.split(":");
        const showEndDateTime = new Date(doc.show_date);
        showEndDateTime.setHours(hours, minutes, 0, 0);

        if (showEndDateTime < now) {
          doc.status = "completed";
          updates.push(doc.save()); // This will trigger a save and its own middleware
        }
      }
    }

    if (updates.length > 0) {
      await Promise.all(updates);
    }
  } catch (error) {
    console.error("Error in post-find hook for showtime status update:", error);
    // We call next() anyway to not break the query for the client
  }
  next();
});

module.exports = mongoose.model("Showtime", showtimeSchema);
