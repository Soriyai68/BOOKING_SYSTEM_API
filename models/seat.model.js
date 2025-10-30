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
            type: Number,
            required: true,
            default: 1,
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
seatSchema.index({hall_id: 1, row: 1, seat_number: 1});
// Additional index for multi-seat queries
seatSchema.index({hall_id: 1, row: 1});
seatSchema.index({seat_type: 1});

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
    return this.find({seat_type: seatType});
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
