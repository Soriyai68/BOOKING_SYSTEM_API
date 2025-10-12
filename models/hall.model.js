const { required } = require("joi");
const mongoose = require("mongoose");

const hallSchema = new mongoose.Schema(
  {
    hall_name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
      index: true,
    },
    total_seats: {
      type: Number,
      required: false,
      min: 0,
      max: 1000,
      default: 0,
    },
    seat_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seat",
      default: null,
    },
    theater_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Theater",
      required: true,
    },
    screen_type: {
      type: String,
      enum: ["2d", "standard", "imax", "3d", "4dx", "vip"],
      default: "standard",
    },
    capacity: {
      type: Object,
      default: {
        standard: 0,
        premium: 0,
        vip: 0,
        wheelchair: 0,
        recliner: 0,
      },
    },
    dimensions: {
      width: {
        type: Number,
        min: 1,
        max: 100,
        default: 10,
      },
      height: {
        type: Number,
        min: 1,
        max: 100,
        default: 10,
      },
    },
    status: {
      type: String,
      enum: ["active", "maintenance", "closed", "renovation"],
      default: "active",
      index: true,
    },
    features: {
      type: [String],
      enum: [
        "dolby_atmos",
        "surround_sound",
        "premium_seating",
        "wheelchair_accessible",
        "air_conditioning",
        "heating",
      ],
      default: [],
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 1000,
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

// Indexes for faster queries
hallSchema.index({ hall_name: 1, theater_id: 1 }, { unique: true });
hallSchema.index({ screen_type: 1 });
hallSchema.index({ status: 1 });
hallSchema.index({ total_seats: 1 });
hallSchema.index({ deletedAt: 1 });
hallSchema.index({ createdAt: 1 });
hallSchema.index({ "capacity.standard": 1 });
hallSchema.index({ "capacity.premium": 1 });
hallSchema.index({ "capacity.vip": 1 });

// Instance method for soft delete
hallSchema.methods.softDelete = function (deletedBy = null) {
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  this.status = "closed"; // Change status when deleted
  return this.save();
};

// Instance method for restore
hallSchema.methods.restore = function (restoredBy = null) {
  this.deletedAt = null;
  this.deletedBy = null;
  this.restoredAt = new Date();
  this.restoredBy = restoredBy;
  this.status = "active"; // Restore to active status
  return this.save();
};

// Instance method to check if deleted
hallSchema.methods.isDeleted = function () {
  return this.deletedAt !== null;
};

// Instance method to check for associated active seats
hallSchema.methods.hasActiveSeats = async function () {
  const Seat = mongoose.model("Seat");
  const associatedSeats = await Seat.find({
    hall_id: this._id,
    deletedAt: null, // Only count active seats
  });

  if (associatedSeats.length > 0) {
    return {
      hasSeats: true,
      count: associatedSeats.length,
      identifiers: associatedSeats.map(
        (seat) => seat.seat_identifier || `${seat.row}${seat.seat_number}`
      ),
    };
  }

  return { hasSeats: false };
};

// Instance method to update status
hallSchema.methods.updateStatus = function (newStatus, updatedBy = null) {
  const validStatuses = ["active", "maintenance", "closed", "renovation"];
  if (!validStatuses.includes(newStatus)) {
    throw new Error("Invalid status provided");
  }

  this.status = newStatus;
  this.updatedBy = updatedBy;

  return this.save();
};

// Instance method to calculate total capacity
hallSchema.methods.calculateTotalCapacity = function () {
  if (!this.capacity) return 0;

  const {
    standard = 0,
    premium = 0,
    vip = 0,
    wheelchair = 0,
    recliner = 0,
  } = this.capacity;
  return standard + premium + vip + wheelchair + recliner;
};

// Instance method to update capacity
hallSchema.methods.updateCapacity = function (capacityUpdate) {
  this.capacity = {
    ...this.capacity,
    ...capacityUpdate,
  };

  // Recalculate total seats
  this.total_seats = this.calculateTotalCapacity();

  return this.save();
};

// Static method to find halls by screen type
hallSchema.statics.findByScreenType = function (screenType) {
  return this.find({ screen_type: screenType, deletedAt: null });
};

// Static method to find active halls
hallSchema.statics.findActive = function (query = {}) {
  return this.find({
    ...query,
    deletedAt: null,
    status: "active",
  });
};

// Static method to find halls by theater
hallSchema.statics.findByTheater = function (theaterId, query = {}) {
  return this.find({
    ...query,
    theater_id: theaterId,
    deletedAt: null,
  });
};

// Static method to find deleted halls
hallSchema.statics.findDeleted = function (query = {}) {
  return this.find({
    ...query,
    deletedAt: { $ne: null },
  });
};

// Static method to get halls with seat counts
hallSchema.statics.getHallsWithSeatCounts = async function (query = {}) {
  const Seat = mongoose.model("Seat");

  return this.aggregate([
    {
      $match: {
        ...query,
        deletedAt: null,
      },
    },
    {
      $lookup: {
        from: "seats",
        let: { hallId: { $toString: "$_id" } },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$hall_id", "$$hallId"] },
                  { $eq: ["$deletedAt", null] },
                ],
              },
            },
          },
          {
            $group: {
              _id: "$seat_type",
              count: { $sum: 1 },
            },
          },
        ],
        as: "actualSeats",
      },
    },
    {
      $addFields: {
        actualCapacity: {
          $arrayToObject: {
            $map: {
              input: "$actualSeats",
              as: "seat",
              in: {
                k: "$$seat._id",
                v: "$$seat.count",
              },
            },
          },
        },
        actualTotalSeats: {
          $sum: "$actualSeats.count",
        },
      },
    },
  ]);
};

// Static method to update total_seats for a hall based on actual seat count
hallSchema.statics.updateTotalSeatsForHall = async function (hallId) {
  try {
    const Seat = mongoose.model("Seat");

    // Count active seats for this hall
    const seatCount = await Seat.countDocuments({
      hall_id: hallId,
      deletedAt: null,
    });

    // Update the hall's total_seats field
    await this.findByIdAndUpdate(
      hallId,
      { total_seats: seatCount },
      { new: true, timestamps: false } // Don't update timestamps for auto-calculation
    );

    return seatCount;
  } catch (error) {
    console.error(`Error updating total_seats for hall ${hallId}:`, error);
    throw error;
  }
};

// Virtual for display name
hallSchema.virtual("display_name").get(function () {
  return this.theater_id
    ? `${this.theater_id} - ${this.hall_name}`
    : this.hall_name;
});

// Virtual for status display
hallSchema.virtual("status_display").get(function () {
  if (this.isDeleted()) return "Deleted";
  return (
    this.status.charAt(0).toUpperCase() + this.status.slice(1).replace("_", " ")
  );
});

// Virtual for capacity display
hallSchema.virtual("capacity_display").get(function () {
  const total = this.calculateTotalCapacity();
  return `${total} seats`;
});

// Virtual for utilization percentage
hallSchema.virtual("utilization_percentage").get(function () {
  if (!this.total_seats) return 0;
  const calculatedCapacity = this.calculateTotalCapacity();
  return Math.round((calculatedCapacity / this.total_seats) * 100);
});

// Pre-save middleware
hallSchema.pre("save", function (next) {
  // Ensure hall_name is properly formatted
  if (this.hall_name) {
    this.hall_name = this.hall_name.trim();
  }

  // Set updatedBy for updates
  if (this.isModified() && !this.isNew) {
    this.updatedAt = new Date();
  }

  // Ensure deleted halls are not active
  if (this.deletedAt && this.status === "active") {
    this.status = "closed";
  }

  // For new halls, set total_seats to 0 initially (will be updated when seats are added)
  if (this.isNew && !this.total_seats) {
    this.total_seats = 0;
  }

  next();
});

// Pre-aggregate middleware to exclude deleted halls by default
hallSchema.pre(
  ["find", "findOne", "findOneAndUpdate", "count", "countDocuments"],
  function () {
    // Only apply if deletedAt filter is not already specified
    if (!this.getQuery().hasOwnProperty("deletedAt")) {
      this.where({ deletedAt: null });
    }
  }
);

module.exports = mongoose.model("Hall", hallSchema);
