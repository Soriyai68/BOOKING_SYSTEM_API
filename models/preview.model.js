const mongoose =  require("mongoose");
const logger = require("../utils/logger");

const previewSchema = new mongoose.Schema(
  {
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer", 
      required: true,
      index: true,
    },
    showtime_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Showtime",
      required: true,
      index: true,
    },
    seat_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Seat",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["pending", "confirmed", "cancelled"],
      default: "pending",
      index: true,
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

previewSchema.pre("save", function (next) {
  logger.info(`Preview ${this._id} is being saved.`);
  next();
});

previewSchema.post("save", function (doc) {
  logger.info(`Preview ${doc._id} has been saved.`);
});

previewSchema.pre("remove", function (next) {
  logger.info(`Preview ${this._id} is being removed.`);
  next();
});

previewSchema.post("remove", function (doc) {
  logger.info(`Preview ${doc._id} has been removed.`);
});

const Preview = mongoose.model("Preview", previewSchema);

module.exports = Preview;
