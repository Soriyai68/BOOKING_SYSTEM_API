const moongose = require("mongoose");

const showtimeDetailSchema = new mongoose.Schema(
  {
    showtime_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Showtime",
      required: true,
    },
    movie_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Movie",
      required: true,
    },
    start_time: {
      type: String, // start from start time till end time of the showtime's model
      required: true,
    },
    end_time: {
      type: String, // auto-calculated based on movie duration
      required: true,
    },
    language: { type: String, default: "Original" },
    subtitle: { type: String, default: "Original" },

    status: {
      type: String,
      enum: ["scheduled", "completed", "cancelled"],
      default: "scheduled",
    },
    //Soft delete
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

module.exports = mongoose.model("ShowtimeDetails", showtimeDetailSchema);
