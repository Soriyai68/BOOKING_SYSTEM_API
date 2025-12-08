const mongoose = require("mongoose");
const {Seat, Hall, SeatBooking} = require("../models");
const {Role} = require("../data");
const logger = require("../utils/logger");

/**
 * SeatController - Comprehensive CRUD operations for seat management
 * Handles: getById, getAll, create, update, delete (soft), restore, forceDelete, listDeleted, updateStatus
 */
class SeatController {
    // Helper method to validate ObjectId
    static validateObjectId(id) {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new Error("Invalid seat ID format");
        }
    }

    // Helper method to build search query
    static buildSearchQuery(search) {
        if (!search) return {};

        const searchConditions = [
            {row: {$regex: search, $options: "i"}},
            {seat_type: {$regex: search, $options: "i"}},
            {notes: {$regex: search, $options: "i"}},
        ];

        if (!isNaN(search)) {
            searchConditions.push({seat_number: Number(search)});
        }

        return {
            $or: searchConditions,
        };
    }

    // Helper method to build filter query
    static async buildFilterQuery(filters) {
        const query = {};
        // Handle seat by row
        if (filters.row) {
            query.row = filters.row;
        }
        // Handle seat type filter
        if (filters.seat_type) {
            query.seat_type = filters.seat_type;
        }

        // Handle status filter
        if (filters.status) {
            query.status = filters.status;
        }

        // Handle filter by hall_id and theater_id
        if (filters.hall_id) {
            query.hall_id = new mongoose.Types.ObjectId(filters.hall_id);
        } else if (filters.theater_id) {
            const hallsInTheater = await Hall.find({
                theater_id: filters.theater_id,
            }).select("_id");
            const hallIds = hallsInTheater.map((h) => h._id);
            query.hall_id = {$in: hallIds};
        }
        // Handle date range filters
        if (filters.dateFrom || filters.dateTo) {
            query.createdAt = {};
            if (filters.dateFrom) {
                query.createdAt.$gte = new Date(filters.dateFrom);
            }
            if (filters.dateTo) {
                query.createdAt.$lte = new Date(filters.dateTo);
            }
        }

        return query;
    }

    // 1. GET ALL SEATS - with pagination, filtering, and sorting
    static async getAll(req, res) {
        try {
            const {
                page = 1,
                limit = 10,
                sortBy = "row",
                sortOrder = "asc",
                search,
                includeDeleted = false,
                ...filters
            } = req.query;

            // Convert and validate pagination
            const pageNum = Math.max(1, parseInt(page));
            const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
            const skip = (pageNum - 1) * limitNum;

            // Build query
            let query = {};

            // Handle search
            if (search) {
                query = {...query, ...SeatController.buildSearchQuery(search)};
            }

            // Handle filters
            query = {...query, ...(await SeatController.buildFilterQuery(filters))};

            // Handle soft deleted records
            if (!includeDeleted || includeDeleted === "false") {
                query.deletedAt = null; // Only get non-deleted seats
            }

            // Build sort object
            const sortObj = {};
            sortObj[sortBy] = sortOrder === "desc" ? -1 : 1;

            // Execute queries
            const [seats, totalCount] = await Promise.all([
                Seat.find(query)
                    .sort(sortObj)
                    .skip(skip)
                    .limit(limitNum)
                    .populate({
                        path: "hall_id",
                        select: "hall_name theater_id",
                        populate: {path: "theater_id", select: "name"},
                    })
                    .lean(),
                Seat.countDocuments(query),
            ]);

            // Calculate pagination info
            const totalPages = Math.ceil(totalCount / limitNum);
            const hasNextPage = pageNum < totalPages;
            const hasPrevPage = pageNum > 1;

            logger.info(`Retrieved ${seats.length} seats`);

            res.status(200).json({
                success: true,
                data: {
                    seats,
                    pagination: {
                        currentPage: pageNum,
                        totalPages,
                        totalCount,
                        limit: limitNum,
                        hasNextPage,
                        hasPrevPage,
                        nextPage: hasNextPage ? pageNum + 1 : null,
                        prevPage: hasPrevPage ? pageNum - 1 : null,
                    },
                },
            });
        } catch (error) {
            logger.error("Get all seats error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to retrieve seats",
            });
        }
    }

    // 2. GET SEAT BY ID
    static async getById(req, res) {
        try {
            const {id} = req.params;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: "Seat ID is required",
                });
            }

            SeatController.validateObjectId(id);

            const seat = await Seat.findById(id)
                .populate({
                    path: "hall_id",
                    select: "hall_name theater_id",
                    populate: {path: "theater_id", select: "name"},
                })
                .lean();

            if (!seat) {
                return res.status(404).json({
                    success: false,
                    message: "Seat not found",
                });
            }

            logger.info(`Retrieved seat by ID: ${id}`);

            res.status(200).json({
                success: true,
                data: {seat},
            });
        } catch (error) {
            if (error.message === "Invalid seat ID format") {
                return res.status(400).json({
                    success: false,
                    message: error.message,
                });
            }

            logger.error("Get seat by ID error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to retrieve seat",
            });
        }
    }

    // 3. CREATE SEAT
    static async create(req, res) {
        try {
            const seatData = req.body;

            // ✅ Validate required fields
            if (!seatData.hall_id || !seatData.row || !seatData.seat_number) {
                return res.status(400).json({
                    success: false,
                    message: "Hall, row, and seat number are required",
                });
            }

            // ✅ Find hall to get its theater_id
            const hall = await Hall.findById(seatData.hall_id);
            if (!hall) {
                return res.status(404).json({
                    success: false,
                    message: "Hall not found",
                });
            }

            // ✅ Automatically assign theater_id based on the hall
            seatData.theater_id = hall.theater_id;

            // Check if seat number already exists in the same hall and row
            const existingSeat = await Seat.findOne({
                hall_id: seatData.hall_id,
                row: seatData.row.toUpperCase(),
                seat_number: seatData.seat_number,
            });

            if (existingSeat) {
                return res.status(400).json({
                    success: false,
                    message: `Seat ${seatData.seat_number} already exists in row ${seatData.row} of this hall`,
                });
            }

            // ✅ Create new seat
            const processedSeatData = {
                ...seatData,
                price: seatData.price,
                row: seatData.row.toUpperCase(),
            };

            const newSeat = await Seat.create(processedSeatData);

            return res.status(201).json({
                success: true,
                message: "Seat created successfully",
                data: newSeat,
            });
        } catch (error) {
            console.error("Error creating seat:", error);
            return res.status(500).json({
                success: false,
                message: "Failed to create seat",
                error: error.message,
            });
        }
    }

    // 4. UPDATE SEAT
    static async update(req, res) {
        try {
            const {id} = req.params;
            const updateData = req.body;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: "Seat ID is required",
                });
            }

            SeatController.validateObjectId(id);

            // Remove sensitive fields that shouldn't be updated directly
            delete updateData._id;
            delete updateData.createdAt;
            delete updateData.updatedAt;
            delete updateData.deletedAt;
            delete updateData.deletedBy;
            delete updateData.restoredAt;
            delete updateData.restoredBy;

            // Find current seat
            const currentSeat = await Seat.findById(id);
            if (!currentSeat) {
                return res.status(404).json({
                    success: false,
                    message: "Seat not found",
                });
            }

            // Add updater info
            if (req.user) {
                updateData.updatedBy = req.user.userId;
            }

            // Handle hall change: sync theater_id
            if (
                updateData.hall_id &&
                updateData.hall_id !== currentSeat.hall_id.toString()
            ) {
                const newHall = await Hall.findById(updateData.hall_id).lean();
                if (!newHall) {
                    return res.status(404).json({
                        success: false,
                        message: "New hall not found",
                    });
                }
                updateData.theater_id = newHall.theater_id;
            }

            // Ensure uppercase row
            if (updateData.row) updateData.row = updateData.row.toUpperCase();

            // Validate unique constraint if row/seat_number or hall changes
            if (updateData.row || updateData.seat_number || updateData.hall_id) {
                const query = {
                    hall_id: updateData.hall_id || currentSeat.hall_id,
                    row: updateData.row || currentSeat.row,
                    seat_number: updateData.seat_number || currentSeat.seat_number,
                    _id: {$ne: id},
                };
                const existingSeat = await Seat.findOne(query);

                if (existingSeat) {
                    return res.status(409).json({
                        success: false,
                        message: `Seat ${query.seat_number} already exists in row ${query.row} of this hall`,
                    });
                }
            }

            // Update seat
            const seat = await Seat.findByIdAndUpdate(id, updateData, {
                new: true,
                runValidators: true,
                context: "query",
            })
                .populate({
                    path: "hall_id",
                    select: "hall_name theater_id",
                    populate: {path: "theater_id", select: "name"},
                })
                .lean();

            res.status(200).json({
                success: true,
                message: "Seat updated successfully",
                data: {seat},
            });
        } catch (error) {
            if (error.message === "Invalid seat ID format") {
                return res.status(400).json({
                    success: false,
                    message: error.message,
                });
            }

            if (error.name === "ValidationError") {
                return res.status(400).json({
                    success: false,
                    message: "Validation error",
                    errors: Object.values(error.errors).map((err) => err.message),
                });
            }

            console.error("Update seat error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to update seat",
            });
        }
    }

    // 5. SOFT DELETE SEAT (Deactivate)
    static async delete(req, res) {
        try {
            const {id} = req.params;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: "Seat ID is required",
                });
            }

            SeatController.validateObjectId(id);

            // Find the seat first
            const seat = await Seat.findById(id);

            if (!seat) {
                return res.status(404).json({
                    success: false,
                    message: "Seat not found",
                });
            }

            // Check if seat is already soft deleted
            if (seat.isDeleted()) {
                return res.status(409).json({
                    success: false,
                    message: "Seat is already deactivated",
                });
            }

            // Soft delete using model method
            const deletedSeat = await seat.softDelete(req.user?.userId);

            // Update hall's total_seats count
            if (deletedSeat.hall_id) {
                try {
                    await Hall.updateTotalSeatsForHall(deletedSeat.hall_id);
                    logger.info(`Updated total_seats for hall ${deletedSeat.hall_id}`);
                } catch (hallError) {
                    logger.error(
                        `Failed to update total_seats for hall ${deletedSeat.hall_id}: ${hallError.message}`
                    );
                    // Don't fail the seat deletion, just log the error
                }
            }

            logger.info(
                `Soft deleted seat: ${id} (${deletedSeat.row}${deletedSeat.seat_number})`
            );

            res.status(200).json({
                success: true,
                message: "Seat deactivated successfully",
                data: {seat: deletedSeat},
            });
        } catch (error) {
            if (error.message === "Invalid seat ID format") {
                return res.status(400).json({
                    success: false,
                    message: error.message,
                });
            }

            logger.error("Delete seat error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to deactivate seat",
            });
        }
    }

    // 6. RESTORE SEAT (Reactivate)
    static async restore(req, res) {
        try {
            const {id} = req.params;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: "Seat ID is required",
                });
            }

            SeatController.validateObjectId(id);

            // Find the seat first
            const seat = await Seat.findById(id);

            if (!seat) {
                return res.status(404).json({
                    success: false,
                    message: "Seat not found",
                });
            }

            // Check if seat is not deleted (already active)
            if (!seat.isDeleted()) {
                return res.status(409).json({
                    success: false,
                    message: "Seat is already active",
                });
            }

            // Restore using model method
            const restoredSeat = await seat.restore(req.user?.userId);

            // Update hall's total_seats count
            if (restoredSeat.hall_id) {
                try {
                    await Hall.updateTotalSeatsForHall(restoredSeat.hall_id);
                    logger.info(`Updated total_seats for hall ${restoredSeat.hall_id}`);
                } catch (hallError) {
                    logger.error(
                        `Failed to update total_seats for hall ${restoredSeat.hall_id}: ${hallError.message}`
                    );
                    // Don't fail the seat restoration, just log the error
                }
            }

            logger.info(
                `Restored seat: ${id} (${restoredSeat.row}${restoredSeat.seat_number})`
            );

            res.status(200).json({
                success: true,
                message: "Seat restored successfully",
                data: {seat: restoredSeat},
            });
        } catch (error) {
            if (error.message === "Invalid seat ID format") {
                return res.status(400).json({
                    success: false,
                    message: error.message,
                });
            }

            logger.error("Restore seat error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to restore seat",
            });
        }
    }

    // 7. FORCE DELETE SEAT (Permanent deletion - Admin/SuperAdmin only)
    static async forceDelete(req, res) {
        try {
            const {id} = req.params;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: "Seat ID is required",
                });
            }

            // Enforce Admin/SuperAdmin access
            if (req.user?.role !== Role.ADMIN && req.user?.role !== Role.SUPERADMIN) {
                return res.status(403).json({
                    success: false,
                    message: "Only Admin or SuperAdmin can permanently delete seats",
                });
            }

            SeatController.validateObjectId(id);

            // Find the seat first
            const seat = await Seat.findById(id);

            if (!seat) {
                return res.status(404).json({
                    success: false,
                    message: "Seat not found",
                });
            }

            // Store seat info for logging before deletion
            const seatInfo = {
                id: seat._id,
                row: seat.row,
                seat_number: seat.seat_number,
                seat_type: seat.seat_type,
                wasDeleted: seat.isDeleted(),
                hall_id: seat.hall_id,
            };

            // Update hall's total_seats count before deletion
            if (seatInfo.hall_id) {
                try {
                    await Hall.updateTotalSeatsForHall(seatInfo.hall_id);
                    logger.info(`Updated total_seats for hall ${seatInfo.hall_id}`);
                } catch (hallError) {
                    logger.error(
                        `Failed to update total_seats for hall ${seatInfo.hall_id}: ${hallError.message}`
                    );
                    // Don't fail the seat deletion, just log the error
                }
            }

            // Perform permanent deletion
            // // Delete associated SeatBooking records
            // await seatBooking.deleteMany({seatId: id});
            // logger.info(`Deleted SeatBooking records for permanently deleted seat ID: ${id}`);

            await Seat.findByIdAndDelete(id);

            logger.warn(
                `⚠️  PERMANENT DELETION: Seat permanently deleted by ${req.user.role} ${req.user.userId}`,
                {
                    deletedSeat: seatInfo,
                    deletedBy: req.user.userId,
                    deletedAt: new Date().toISOString(),
                    action: "FORCE_DELETE_SEAT",
                }
            );

            res.status(200).json({
                success: true,
                message: "Seat permanently deleted",
                data: {
                    deletedSeat: {
                        id: seatInfo.id,
                        row: seatInfo.row,
                        seat_number: seatInfo.seat_number,
                        seat_type: seatInfo.seat_type,
                    },
                    warning: "This action is irreversible",
                },
            });
        } catch (error) {
            if (error.message === "Invalid seat ID format") {
                return res.status(400).json({
                    success: false,
                    message: error.message,
                });
            }

            logger.error("Force delete seat error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to permanently delete seat",
            });
        }
    }

    // 8. LIST DELETED SEATS
    static async listDeleted(req, res) {
        try {
            const {
                page = 1,
                limit = 10,
                sortBy = "deletedAt",
                sortOrder = "desc",
            } = req.query;

            const pageNum = Math.max(1, parseInt(page));
            const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
            const skip = (pageNum - 1) * limitNum;

            // Query for soft deleted seats only
            const query = {deletedAt: {$ne: null}};
            const sortObj = {};
            sortObj[sortBy] = sortOrder === "desc" ? -1 : 1;

            const [seats, totalCount] = await Promise.all([
                Seat.find(query).sort(sortObj).skip(skip).limit(limitNum).lean(),
                Seat.countDocuments(query),
            ]);

            // Add delete info to each seat
            const seatsWithDeleteInfo = seats.map((seat) => ({
                ...seat,
                deleteInfo: {
                    deletedAt: seat.deletedAt,
                    deletedBy: seat.deletedBy,
                    daysSinceDeleted: seat.deletedAt
                        ? Math.floor(
                            (Date.now() - new Date(seat.deletedAt)) / (1000 * 60 * 60 * 24)
                        )
                        : null,
                },
                restoreInfo: {
                    restoredAt: seat.restoredAt,
                    restoredBy: seat.restoredBy,
                },
            }));

            const totalPages = Math.ceil(totalCount / limitNum);

            logger.info(`Retrieved ${seats.length} deleted seats`);

            res.status(200).json({
                success: true,
                data: {
                    seats: seatsWithDeleteInfo,
                    pagination: {
                        currentPage: pageNum,
                        totalPages,
                        totalCount,
                        limit: limitNum,
                        hasNextPage: pageNum < totalPages,
                        hasPrevPage: pageNum > 1,
                    },
                },
            });
        } catch (error) {
            logger.error("Get deleted seats error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to retrieve deleted seats",
            });
        }
    }

    // 9. UPDATE SEAT STATUS
    static async updateStatus(req, res) {
        try {
            const {id} = req.params;
            const {status} = req.body;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: "Seat ID is required",
                });
            }

            if (!status) {
                return res.status(400).json({
                    success: false,
                    message: "Status is required",
                });
            }

            SeatController.validateObjectId(id);

            // Find the seat first
            const seat = await Seat.findById(id);

            if (!seat) {
                return res.status(404).json({
                    success: false,
                    message: "Seat not found",
                });
            }

            // Check if seat is deleted
            if (seat.isDeleted()) {
                return res.status(409).json({
                    success: false,
                    message:
                        "Cannot update status of deleted seat. Please restore it first.",
                });
            }

            // Update status using model method
            const updatedSeat = await seat.updateStatus(status, req.user?.userId);

            logger.info(
                `Updated seat status: ${id} (${seat.row}${seat.seat_number}) to ${status}`
            );

            res.status(200).json({
                success: true,
                message: "Seat status updated successfully",
                data: {seat: updatedSeat},
            });
        } catch (error) {
            if (error.message === "Invalid seat ID format") {
                return res.status(400).json({
                    success: false,
                    message: error.message,
                });
            }

            if (error.message === "Invalid status provided") {
                return res.status(400).json({
                    success: false,
                    message: error.message,
                });
            }

            logger.error("Update seat status error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to update seat status",
            });
        }
    }

    // Additional utility methods

    // Get seat statistics
    static async getStats(req, res) {
        try {
            const stats = await Promise.all([
                Seat.countDocuments({}), // Total seats
                Seat.countDocuments({deletedAt: null}), // Active seats
                Seat.countDocuments({deletedAt: {$ne: null}}), // Deleted seats
                Seat.countDocuments({seat_type: "standard", deletedAt: null}),
                Seat.countDocuments({seat_type: "premium", deletedAt: null}),
                Seat.countDocuments({seat_type: "vip", deletedAt: null}),
                Seat.countDocuments({seat_type: "wheelchair", deletedAt: null}),
                Seat.countDocuments({seat_type: "recliner", deletedAt: null}),
                Seat.countDocuments({status: "active", deletedAt: null}),
                Seat.countDocuments({status: "maintenance", deletedAt: null}),
                Seat.countDocuments({status: "out_of_order", deletedAt: null}),
            ]);

            const [
                total,
                active,
                deleted,
                standard,
                premium,
                vip,
                wheelchair,
                recliner,
                activeStatus,
                maintenance,
                outOfOrder,
            ] = stats;

            res.status(200).json({
                success: true,
                data: {
                    total,
                    active,
                    deleted,
                    seatTypes: {
                        standard,
                        premium,
                        vip,
                        wheelchair,
                        recliner,
                    },
                    statuses: {
                        active: activeStatus,
                        maintenance,
                        outOfOrder,
                    },
                    percentageActive: total > 0 ? Math.round((active / total) * 100) : 0,
                },
            });
        } catch (error) {
            logger.error("Get seat stats error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to retrieve seat statistics",
            });
        }
    }

    // Get seats by type
    static async getSeatsByType(req, res) {
        try {
            const {type} = req.params;
            const {page = 1, limit = 10, activeOnly = true} = req.query;

            const pageNum = Math.max(1, parseInt(page));
            const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
            const skip = (pageNum - 1) * limitNum;

            const query = {seat_type: type};
            if (activeOnly === "true") {
                query.deletedAt = null;
            }

            const [seats, totalCount] = await Promise.all([
                Seat.find(query)
                    .sort({row: 1, seat_number: 1})
                    .skip(skip)
                    .limit(limitNum)
                    .lean(),
                Seat.countDocuments(query),
            ]);

            res.status(200).json({
                success: true,
                data: {
                    seats,
                    seatType: type,
                    pagination: {
                        currentPage: pageNum,
                        totalPages: Math.ceil(totalCount / limitNum),
                        totalCount,
                        limit: limitNum,
                    },
                },
            });
        } catch (error) {
            logger.error("Get seats by type error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to retrieve seats by type",
            });
        }
    }

    // bulk create for insert multiple seats
    static async bulkCreateSeats(req, res) {
        try {
            const {hall_id, row, range, seat_type, price} = req.body;
            const createdBy = req.user?.userId;

            if (!hall_id || !row || !range?.start || !range?.end) {
                return res.status(400).json({
                    success: false,
                    message: "Missing required fields: hall_id, row, and range are required.",
                });
            }

            // Find hall to get its theater_id and validate it
            const hall = await Hall.findById(hall_id);
            if (!hall) {
                return res.status(404).json({
                    success: false,
                    message: "Hall not found",
                });
            }
            const theater_id = hall.theater_id;

            const start = parseInt(range?.start);
            const end = parseInt(range?.end);

            if (isNaN(start) || isNaN(end) || start > end) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid range provided.",
                });
            }

            const seatCount = end - start + 1;
            if (seatCount > 15) {
                return res
                    .status(400)
                    .json({message: `Seat range is limited to 15 per request. You tried to create ${seatCount}.`});
            }
            // const seatNumbers = [];
            // for (let i = start; i < start + seatCount; i++) {
            //   seatNumbers.push(i);
            // }
            const seatNumbers = Array.from({length: seatCount}, (_, i) => start + i);

            const existingSeats = await Seat.find({
                row: row.toUpperCase(),
                seat_number: {$in: seatNumbers},
                hall_id,
                deletedAt: null, // Only check against active seats
            }).select("seat_number row");

            if (existingSeats.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: "Some of the seats you are trying to create already exist.",
                    existingSeats: existingSeats.map(
                        (s) => `${s.row}${s.seat_number}`
                    ),
                });
            }

            const newSeats = seatNumbers.map((num) => ({
                hall_id: new mongoose.Types.ObjectId(hall_id),
                theater_id, // Assign theater_id from hall
                row: row.toUpperCase(),
                seat_number: num,
                seat_type: seat_type || "standard", // Default to 'standard'
                price: price,
                status: "active", // Default status
                createdBy,
            }));

            const createdSeats = await Seat.insertMany(newSeats, {lean: true});

            // Update hall's total_seats count
            if (createdSeats.length > 0) {
                try {
                    await Hall.updateTotalSeatsForHall(hall_id);
                    logger.info(`Updated total_seats for hall ${hall_id} after bulk creation.`);
                } catch (hallError) {
                    logger.error(
                        `Failed to update total_seats for hall ${hall_id} after bulk creation: ${hallError.message}`
                    );
                    // This is not a critical failure, so just log it.
                }
            }

            logger.info(`Bulk created ${createdSeats.length} seats for hall ${hall_id}.`);

            return res.status(201).json({ // Changed to 201 for resource creation
                success: true,
                message: `${createdSeats.length} seats created successfully in row ${row.toUpperCase()}.`,
                data: {
                    count: createdSeats.length,
                    seats: createdSeats,
                }
            });
        } catch (error) {
            logger.error("Bulk seat creation failed:", error);
            return res.status(500).json({
                success: false,
                message: "An unexpected server error occurred during bulk seat creation.",
                error: error.message,
            });
        }
    }

    //  bulk update for insert multiple seats
    static async bulkUpdateSeats(req, res) {
        try {
            const {seatUpdates} = req.body;
            const updatedBy = req.user?.userId;
            if (!seatUpdates || !Array.isArray(seatUpdates) || seatUpdates.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Request body must contain a non-empty array of seat updates.",
                });
            }
            const results = [];

            for (const seatUpdate of seatUpdates) {
                const {id, ...updateData} = seatUpdate;
                if (!id) {
                    results.push({
                        id: null,
                        success: false,
                        message: "Seat ID is required for each update.",
                    });
                    continue;
                }
                if (!mongoose.Types.ObjectId.isValid(id)) {
                    results.push({
                        id,
                        success: false,
                        message: "Invalid seat ID format.",
                    });
                    continue;
                }
                try {
                    const updatedSeat = await Seat.findByIdAndUpdate(
                        id,
                        {
                            ...updateData,
                            updatedBy,
                            updatedAt: new Date(),
                        },
                        {new: true, lean: true}
                    );
                    if (!updatedSeat) {
                        results.push({
                            id,
                            success: false,
                            message: "Seat not found.",
                        });
                    } else {
                        results.push({
                            id,
                            success: true,
                            message: "Seat updated successfully.",
                            data: updatedSeat,
                        });
                    }
                } catch (error) {
                    results.push({
                        id,
                        success: false,
                        message: `Failed to update seat: ${error.message}`,
                    });
                }
            }
            return res.status(200).json({
                success: true,
                message: "Bulk seat update completed.",
                data: results,
            });
        } catch (error) {
            logger.error("Bulk seat update failed:", error);
            return res.status(500).json({
                success: false,
                message: "An unexpected server error occurred during bulk seat update.",
                error: error.message,
            });
        }
    }

    // bulk duplicate seats to create multiple seats in a new hall
    static async bulkDuplicateSeats(req, res) {
        try {
            const {seat_ids, target_hall_id, seat_type, price, status} = req.body;
            const createdBy = req.user?.userId;

            // Validate required fields
            if (!seat_ids || !Array.isArray(seat_ids) || seat_ids.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "seat_ids array is required and cannot be empty.",
                });
            }

            if (!target_hall_id) {
                return res.status(400).json({
                    success: false,
                    message: "target_hall_id is required.",
                });
            }

            // Validate target hall ObjectId
            if (!mongoose.Types.ObjectId.isValid(target_hall_id)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid target hall ID format.",
                });
            }

            // Validate all seat IDs
            const invalidIds = seat_ids.filter(id => !mongoose.Types.ObjectId.isValid(id));
            if (invalidIds.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid seat ID format.",
                    invalidIds,
                });
            }

            // Validate target hall exists and get its theater_id
            const targetHall = await Hall.findById(target_hall_id);
            if (!targetHall) {
                return res.status(404).json({
                    success: false,
                    message: "Target hall not found.",
                });
            }

            // Get selected seats
            const sourceSeats = await Seat.find({
                _id: {$in: seat_ids},
                deletedAt: null,
            }).lean();

            if (sourceSeats.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "No valid seats found to duplicate.",
                });
            }

            // Check for existing seats in target hall with same row/seat_number
            const existingTargetSeats = await Seat.find({
                hall_id: target_hall_id,
                deletedAt: null,
            }).lean();

            const existingKeys = new Set(
                existingTargetSeats.map(s => `${s.row}-${Array.isArray(s.seat_number) ? s.seat_number.join(',') : s.seat_number}`)
            );

            // Filter out seats that already exist in target hall
            const seatsToCreate = [];
            const skippedSeats = [];

            for (const seat of sourceSeats) {
                const key = `${seat.row}-${Array.isArray(seat.seat_number) ? seat.seat_number.join(',') : seat.seat_number}`;
                if (existingKeys.has(key)) {
                    skippedSeats.push({
                        row: seat.row,
                        seat_number: seat.seat_number,
                        reason: "Already exists in target hall",
                    });
                } else {
                    seatsToCreate.push({
                        hall_id: new mongoose.Types.ObjectId(target_hall_id),
                        theater_id: targetHall.theater_id,
                        row: seat.row,
                        seat_number: seat.seat_number,
                        seat_type: seat_type || seat.seat_type,
                        price: price !== undefined ? price : seat.price,
                        status: status || seat.status || "active",
                        notes: seat.notes || "",
                        createdBy,
                    });
                }
            }

            if (seatsToCreate.length === 0) {
                return res.status(409).json({
                    success: false,
                    message: "All selected seats already exist in target hall.",
                    data: {skippedSeats},
                });
            }

            // Create new seats in target hall
            const createdSeats = await Seat.insertMany(seatsToCreate, {lean: true});

            // Update target hall's total_seats count
            try {
                await Hall.updateTotalSeatsForHall(target_hall_id);
                logger.info(`Updated total_seats for target hall ${target_hall_id} after bulk duplication.`);
            } catch (hallError) {
                logger.error(`Failed to update total_seats for hall ${target_hall_id}: ${hallError.message}`);
            }

            logger.info(`Bulk duplicated ${createdSeats.length} seats to hall ${target_hall_id}.`);

            return res.status(201).json({
                success: true,
                message: `${createdSeats.length} seats duplicated successfully to target hall.`,
                data: {
                    createdCount: createdSeats.length,
                    skippedCount: skippedSeats.length,
                    seats: createdSeats,
                    skippedSeats: skippedSeats.length > 0 ? skippedSeats : undefined,
                },
            });
        } catch (error) {
            logger.error("Bulk duplicate seats failed:", error);
            return res.status(500).json({
                success: false,
                message: "An unexpected server error occurred during bulk seat duplication.",
                error: error.message,
            });
        }
    }

    // bulk force delete seats
    static async bulkForceDeleteSeats(req, res) {
        try {
            const {seatIds} = req.body;

            // 1. Validate input
            if (!seatIds || !Array.isArray(seatIds) || seatIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Request body must contain a non-empty array of seat IDs.",
                });
            }

            // 2. Authorization check
            if (req.user?.role !== Role.ADMIN && req.user?.role !== Role.SUPERADMIN) {
                return res.status(403).json({
                    success: false,
                    message: "Forbidden: Only Admins or SuperAdmins can permanently delete seats.",
                });
            }

            const deletedSeatIds = [];
            const errors = [];

            // 3. Validate all IDs
            const validIds = seatIds.filter((id) => {
                if (mongoose.Types.ObjectId.isValid(id)) {
                    return true;
                }
                errors.push({id, error: "Invalid ID format."});
                return false;
            });

            if (validIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "No valid seat IDs provided.",
                    data: {errors}
                });
            }

            // 4. Find all seats to get their hall_ids before deletion
            const seatsToDelete = await Seat.find({
                _id: {$in: validIds.map(id => new mongoose.Types.ObjectId(id))}
            }).select('_id hall_id').lean();

            const seatMap = new Map(seatsToDelete.map(seat => [seat._id.toString(), seat]));
            const hallIdsToUpdate = new Set();

            // 5. Process each seat for permanent deletion
            for (const id of validIds) {
                const seat = seatMap.get(id);

                if (!seat) {
                    errors.push({id, error: "Seat not found."});
                    continue;
                }

                const result = await Seat.findByIdAndDelete(id);

                if (result) {
                    deletedSeatIds.push(id);
                    if (seat.hall_id) {
                        hallIdsToUpdate.add(seat.hall_id.toString());
                    }
                } else {
                    // This case is unlikely if findByIdAndDelete is used right after find, but good for safety
                    errors.push({id, error: "Seat found but failed to delete."});
                }
            }

            // 6. Update total_seats count for affected halls
            if (hallIdsToUpdate.size > 0) {
                logger.info(`Updating total_seats for halls: ${[...hallIdsToUpdate].join(', ')}`);
                for (const hallId of hallIdsToUpdate) {
                    try {
                        await Hall.updateTotalSeatsForHall(hallId);
                    } catch (hallError) {
                        logger.error(`Failed to update total_seats for hall ${hallId}: ${hallError.message}`);
                        // Log error but don't fail the entire operation
                    }
                }
            }

            // Delete associated SeatBooking records in bulk
            if (deletedSeatIds.length > 0) {
                const {deletedCount: sbDeletedCount} = await SeatBooking.deleteMany({seatId: {$in: deletedSeatIds}});
                logger.info(`Deleted ${sbDeletedCount} SeatBooking records for ${deletedSeatIds.length} permanently deleted seats.`);
            }

            // 7. Log the bulk operation
            if (deletedSeatIds.length > 0) {
                logger.warn(
                    `PERMANENT DELETION: ${deletedSeatIds.length} seats permanently deleted by ${req.user.role} ${req.user.userId}`,
                    {
                        deletedSeatIds,
                        deletedBy: req.user.userId,
                        deletedAt: new Date().toISOString(),
                        action: "BULK_FORCE_DELETE_SEATS",
                    }
                );
            }

            // 8. Send response
            if (errors.length > 0) {
                logger.warn("Bulk force delete seats encountered errors:", {errors});
                return res.status(409).json({
                    success: false,
                    message: "Some seats could not be permanently deleted.",
                    data: {
                        deletedCount: deletedSeatIds.length,
                        failedCount: errors.length,
                        deletedSeatIds,
                        errors,
                        warning: "These actions are irreversible.",
                    },
                });
            }

            res.status(200).json({
                success: true,
                message: `All ${deletedSeatIds.length} specified seats permanently deleted.`,
                data: {
                    deletedCount: deletedSeatIds.length,
                    deletedSeatIds,
                    warning: "These actions are irreversible.",
                },
            });

        } catch (error) {
            logger.error("Bulk force delete seats error:", error);
            res.status(500).json({
                success: false,
                message: "An unexpected error occurred during bulk permanent deletion.",
            });
        }
    }
}

module.exports = SeatController;

