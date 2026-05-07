const mongoose = require("mongoose");

/**
 * Movie Model
 * Stores movie information for the booking system
 */
const movieSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 200,
      index: true,
      validate: {
        validator: function(value) {
          // Check for proper format - no leading/trailing spaces
          if (value !== value.trim()) return false;
          
          // Must start with alphanumeric characters
          if (!/^[a-zA-Z0-9]/.test(value)) {
            return false;
          }
          
          // Must end with alphanumeric or allowed punctuation: ! ? ) "
          if (!/[a-zA-Z0-9\!\?\)\"]$/.test(value)) {
            return false;
          }
          
          // Only allow letters, numbers, spaces, and basic punctuation
          return /^[a-zA-Z0-9\s\-\.\,\:\!\?\'\"\(\)]+$/.test(value);
        },
        message: 'Movie title must start with a letter or number, end with a letter, number, or allowed punctuation (! ? ) "), and can only contain letters, numbers, spaces, and basic punctuation (- . , : ! ? \' " ( ))'
      }
    },
    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },
    genres: {
      type: [String],
      enum: [
        "action",
        "adventure",
        "animation",
        "comedy",
        "crime",
        "documentary",
        "drama",
        "family",
        "fantasy",
        "horror",
        "mystery",
        "romance",
        "sci-fi",
        "thriller",
        "war",
        "western",
      ],
      default: [],
      index: true,
    },
    languages: {
      type: [String],
      default: [],
    },
    duration_minutes: {
      type: Number,
      required: true,
      min: 1,
      max: 500,
      index: true,
    },
    release_date: {
      type: Date,
      required: true,
      index: true,
    },
    end_date: {
      type: Date,
      required: true,
      index: true,
    },
    rating: {
      type: Number,
      min: 0,
      max: 10,
      default: 0,
      index: true,
    },
    poster_url: {
      type: String,
      trim: true,
      default: null,
    },
    trailer_url: {
      type: String,
      trim: true,
      default: null,
    },
    director: {
      type: String,
      trim: true,
      default: "",
    },
    producers: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ["coming_soon", "now_showing", "ended"],
      default: "coming_soon",
      index: true,
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
movieSchema.index({ title: 1 });
movieSchema.index({ status: 1, release_date: -1 });
movieSchema.index({ genres: 1, status: 1 });
movieSchema.index({ rating: -1 });
movieSchema.index({ release_date: -1 });
movieSchema.index({ deletedAt: 1 });
movieSchema.index({ createdAt: -1 });

// Compound indexes for common queries
movieSchema.index({ status: 1, release_date: -1, rating: -1 });
movieSchema.index({ genres: 1, release_date: -1 });

// Text index for search functionality
movieSchema.index({
  title: "text",
  description: "text",
  director: "text",
});

// Pre-save middleware to check for duplicate titles (case-insensitive)
movieSchema.pre('save', async function(next) {
  if (this.isModified('title')) {
    const titleRegex = new RegExp(`^${this.title.trim()}$`, 'i');
    const existingMovie = await this.constructor.findOne({
      title: titleRegex,
      _id: { $ne: this._id },
      deletedAt: null
    });
    
    if (existingMovie) {
      const error = new Error('A movie with this title already exists');
      error.code = 11000; // Duplicate key error code
      return next(error);
    }
  }
  next();
});

// Pre-validate middleware to ensure title format
movieSchema.pre('validate', function(next) {
  if (this.title) {
    // Check for leading/trailing spaces (before trim)
    if (this.title !== this.title.trim()) {
      return next(new Error('Movie title cannot have leading or trailing spaces'));
    }
    
    // Trim the title
    this.title = this.title.trim();
    
    // Validate start format
    if (!/^[a-zA-Z0-9]/.test(this.title)) {
      return next(new Error('Movie title must start with a letter or number'));
    }
    
    // Validate end format - allow ! ? ) "
    if (!/[a-zA-Z0-9\!\?\)\"]$/.test(this.title)) {
      return next(new Error('Movie title must end with a letter, number, or allowed punctuation (! ? ) ")'));
    }
    
    // Validate allowed characters
    if (!/^[a-zA-Z0-9\s\-\.\,\:\!\?\'\"\(\)]+$/.test(this.title)) {
      return next(new Error('Movie title can only contain letters, numbers, spaces, and basic punctuation (- . , : ! ? \' " ( ))'));
    }
  }
  next();
});

// Instance method for soft delete
movieSchema.methods.softDelete = function (deletedBy = null) {
  this.deletedAt = new Date();
  this.deletedBy = deletedBy;
  this.status = "ended";
  return this.save();
};

// Instance method for restore
movieSchema.methods.restore = function (restoredBy = null) {
  this.deletedAt = null;
  this.deletedBy = null;
  this.restoredAt = new Date();
  this.restoredBy = restoredBy;

  // Determine status based on dates
  const now = new Date();
  if (this.end_date <= now) {
    this.status = "ended";
  } else if (this.release_date > now) {
    this.status = "coming_soon";
  } else {
    this.status = "now_showing";
  }

  return this.save();
};

// Instance method to check if deleted
movieSchema.methods.isDeleted = function () {
  return this.deletedAt !== null;
};

// Instance method to check if currently showing
movieSchema.methods.isNowShowing = function () {
  const now = new Date();
  return (
    this.status === "now_showing" &&
    this.release_date <= now &&
    this.end_date > now &&
    !this.isDeleted()
  );
};

// Instance method to check if coming soon
movieSchema.methods.isComingSoon = function () {
  const now = new Date();
  return (
    this.status === "coming_soon" &&
    this.release_date > now &&
    !this.isDeleted()
  );
};

// Instance method to update status
movieSchema.methods.updateStatus = function (newStatus, updatedBy = null) {
  const validStatuses = ["coming_soon", "now_showing", "ended"];
  if (!validStatuses.includes(newStatus)) {
    throw new Error("Invalid status provided");
  }

  this.status = newStatus;
  this.updatedBy = updatedBy;

  return this.save();
};

// Instance method to update status based on date
movieSchema.methods.updateStatusBasedOnDate = function (updatedBy = null) {
  const now = new Date();
  const originalStatus = this.status;
  let newStatus = originalStatus;

  if (this.status === "coming_soon" || this.status === "now_showing") {
    if (this.end_date <= now) {
      newStatus = "ended";
    } else if (this.release_date <= now) {
      newStatus = "now_showing";
    }
  }

  if (newStatus !== originalStatus) {
    this.status = newStatus;
    this.updatedBy = updatedBy;
    return this.save();
  }

  return Promise.resolve(this);
};

// Middleware to automatically update status on find (but not during bulk operations)
movieSchema.post("find", async function (docs) {
  // Skip auto-update during bulk operations to avoid conflicts
  if (this.getOptions().skipAutoUpdate) {
    return;
  }
  
  if (docs && docs.length > 0) {
    const promises = docs.map(async (doc) => {
      if (doc && typeof doc.updateStatusBasedOnDate === 'function') {
        try {
          return await doc.updateStatusBasedOnDate();
        } catch (error) {
          console.warn('Failed to auto-update movie status:', error.message);
          return doc;
        }
      }
      return doc;
    });
    await Promise.all(promises);
  }
});

movieSchema.post("findOne", async function (doc) {
  // Skip auto-update during bulk operations to avoid conflicts
  if (this.getOptions().skipAutoUpdate) {
    return;
  }
  
  if (doc && typeof doc.updateStatusBasedOnDate === 'function') {
    try {
      await doc.updateStatusBasedOnDate();
    } catch (error) {
      console.warn('Failed to auto-update movie status:', error.message);
    }
  }
});

// Static method to find now showing movies
movieSchema.statics.findNowShowing = function (query = {}) {
  const now = new Date();
  return this.find({
    ...query,
    status: "now_showing",
    release_date: { $lte: now },
    end_date: { $gt: now },
    deletedAt: null,
  }).sort({ release_date: -1 });
};

// Static method to find coming soon movies
movieSchema.statics.findComingSoon = function (query = {}) {
  const now = new Date();
  return this.find({
    ...query,
    status: "coming_soon",
    release_date: { $gt: now },
    deletedAt: null,
  }).sort({ release_date: 1 });
};

// Static method to find by genre
movieSchema.statics.findByGenre = function (genre, query = {}) {
  return this.find({
    ...query,
    genres: genre,
    deletedAt: null,
  }).sort({ release_date: -1 });
};

// Static method to find active movies
movieSchema.statics.findActive = function (query = {}) {
  const now = new Date();
  return this.find({
    ...query,
    end_date: { $gt: now },
    deletedAt: null,
  }).sort({ release_date: -1 });
};

// Virtual for display duration (e.g., "2h 30m")
movieSchema.virtual("duration_display").get(function () {
  const hours = Math.floor(this.duration_minutes / 60);
  const minutes = this.duration_minutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
});

// Virtual for formatted release date
movieSchema.virtual("release_date_formatted").get(function () {
  return this.release_date ? this.release_date.toLocaleDateString() : null;
});

// Ensure virtuals are included in JSON output
movieSchema.set("toJSON", { virtuals: true });
movieSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Movie", movieSchema);
