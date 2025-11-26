const mongoose = require("mongoose");
const {Theater, Hall, Movie, Showtime, SeatBooking} = require("../models");
const {Role} = require("../data");
const logger = require("../utils/logger");

class ShowtimeController {


    // Build search query
    static async buildSearchQuery(search) {
        if (!search) return {};
        return {
            $or: [
                {language: {$regex: search, $options: "i"}},
                {subtitle: {$regex: search, $options: "i"}},
                {"movie.title": {$regex: search, $options: "i"}},
            ],
        };
    }

    // Build filter query
    static buildFilterQuery(filters) {
        const query = {};

        if (filters.status) {
            query.status = filters.status;
        }

        if (filters.movie_id && mongoose.Types.ObjectId.isValid(filters.movie_id)) {
            query.movie_id = new mongoose.Types.ObjectId(filters.movie_id);
        }
        if (filters.hall_id && mongoose.Types.ObjectId.isValid(filters.hall_id)) {
            query.hall_id = new mongoose.Types.ObjectId(filters.hall_id);
        }

        // Handle single date filter
        if (filters.show_date) {
            const day = new Date(filters.show_date);
            day.setHours(0, 0, 0, 0); // Start of the day
            const nextDay = new Date(day);
            nextDay.setDate(day.getDate() + 1); // Start of the next day

            query.show_date = {
                $gte: day,
                $lt: nextDay,
            };
        }
        // Date range filter
        else if (filters.dateFrom || filters.dateTo) {
            query.show_date = {};
            if (filters.dateFrom) query.show_date.$gte = new Date(filters.dateFrom);
            if (filters.dateTo) query.show_date.$lte = new Date(filters.dateTo);
        }
        return query;
    }

    //1.GET ALL SHOWTIMES
    static async getAll(req, res) {
        try {
            const {
                page = 1,
                limit = 10,
                sortBy = "start_time",
                sortOrder = "asc",
                search,
                includeDeleted = false,
                theater_id, // Extract theater_id to handle it separately
                ...filters
            } = req.query;

            const pageNum = Math.max(1, parseInt(page));
            const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
            const skip = (pageNum - 1) * limitNum;

            const matchQuery = {...ShowtimeController.buildFilterQuery(filters)};

            if (!includeDeleted || includeDeleted === "false") {
                matchQuery.deletedAt = null;
            }

            const pipeline = [
                {$match: matchQuery},

                // Lookup movie
                {
                    $lookup: {
                        from: "movies",
                        localField: "movie_id",
                        foreignField: "_id",
                        as: "movie",
                    },
                },
                {$unwind: {path: "$movie", preserveNullAndEmptyArrays: true}},

                // Lookup hall
                {
                    $lookup: {
                        from: "halls",
                        localField: "hall_id",
                        foreignField: "_id",
                        as: "hall",
                    },
                },
                {$unwind: {path: "$hall", preserveNullAndEmptyArrays: true}},

                // Lookup theater from hall
                {
                    $lookup: {
                        from: "theaters",
                        localField: "hall.theater_id",
                        foreignField: "_id",
                        as: "theater",
                    },
                },
                {$unwind: {path: "$theater", preserveNullAndEmptyArrays: true}},
            ];

            // Filter by theater_id after lookup
            if (theater_id && mongoose.Types.ObjectId.isValid(theater_id)) {
                pipeline.push({
                    $match: {
                        "hall.theater_id": new mongoose.Types.ObjectId(theater_id),
                    },
                });
            }

            // Optional search on movie title
            if (search) {
                pipeline.push({
                    $match: {
                        "movie.title": {$regex: search, $options: "i"},
                    },
                });
            }

            // Count total
            const totalCountResult = await Showtime.aggregate([
                ...pipeline,
                {$count: "total"},
            ]);
            const totalCount = totalCountResult[0]?.total || 0;

            // Sort, skip, limit
            pipeline.push({$sort: {[sortBy]: sortOrder === "desc" ? -1 : 1}});
            pipeline.push({$skip: skip});
            pipeline.push({$limit: limitNum});

            // Project
            pipeline.push({
                $project: {
                    movie: {_id: 1, title: 1, poster_url: 1, duration_minutes: 1},
                    hall: {_id: 1, hall_name: 1, screen_type: 1},
                    theater: {_id: 1, name: 1, province: 1, city: 1},
                    show_date: 1,
                    start_time: 1,
                    end_time: 1,
                    status: 1,
                    createdAt: 1,
                },
            });

            const showtimes = await Showtime.aggregate(pipeline);

            const totalPages = Math.ceil(totalCount / limitNum);
            const hasNextPage = pageNum < totalPages;
            const hasPrevPage = pageNum > 1;

            res.status(200).json({
                success: true,
                data: {
                    showtimes,
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
            logger.error("Get all showtimes error:", error);
            res
                .status(500)
                .json({success: false, message: "Failed to retrieve showtimes"});
        }
    }

    //2. GET SHOWTIME BY ID
    static async getById(req, res) {
        try {
            const {id} = req.params;
            if (!id)
                return res
                    .status(400)
                    .json({success: false, message: "Showtime ID is required"});

            if (!mongoose.Types.ObjectId.isValid(id)) {
                throw new Error("Invalid ID format");
            }

            const showtimeResult = await Showtime.aggregate([
                {$match: {_id: new mongoose.Types.ObjectId(id), deletedAt: null}},

                // Lookup movie
                {
                    $lookup: {
                        from: "movies",
                        localField: "movie_id",
                        foreignField: "_id",
                        as: "movie",
                    },
                },
                {$unwind: {path: "$movie", preserveNullAndEmptyArrays: true}},

                // Lookup hall
                {
                    $lookup: {
                        from: "halls",
                        localField: "hall_id",
                        foreignField: "_id",
                        as: "hall",
                    },
                },
                {$unwind: {path: "$hall", preserveNullAndEmptyArrays: true}},

                // Lookup theater from hall
                {
                    $lookup: {
                        from: "theaters",
                        localField: "hall.theater_id",
                        foreignField: "_id",
                        as: "theater",
                    },
                },
                {$unwind: {path: "$theater", preserveNullAndEmptyArrays: true}},

                {
                    $project: {
                        movie: {_id: 1, title: 1, poster_url: 1, duration_minutes: 1},
                        hall: {_id: 1, hall_name: 1, screen_type: 1},
                        theater: {_id: 1, name: 1, province: 1, city: 1},
                        show_date: 1,
                        start_time: 1,
                        end_time: 1,
                        status: 1,
                        createdAt: 1,
                    },
                },
            ]);

            if (!showtimeResult || showtimeResult.length === 0) {
                return res
                    .status(404)
                    .json({success: false, message: "Showtime not found"});
            }

            res
                .status(200)
                .json({success: true, data: {showtime: showtimeResult[0]}});
        } catch (error) {
            if (error.message === "Invalid ID format") {
                return res.status(400).json({success: false, message: error.message});
            }
            logger.error("Get showtime by ID error:", error);
            res
                .status(500)
                .json({success: false, message: "Failed to retrieve showtime"});
        }
    }

    // 3. CREATE SHOWTIME
    static async create(req, res) {
        try {
            const showTimeData = req.body;
            const {movie_id, hall_id, show_date, start_time} = showTimeData;

            // Basic validation
            if (!movie_id || !hall_id || !show_date || !start_time) {
                return res.status(400).json({
                    success: false,
                    message: "movie_id, hall_id, show_date, and start_time are required.",
                });
            }

            // Check if referenced documents exist and are active
            const [movie, hall] = await Promise.all([
                Movie.findOne({_id: movie_id, deletedAt: null}),
                Hall.findOne({_id: hall_id, deletedAt: null}),
            ]);

            if (!movie) {
                return res.status(404).json({
                    success: false,
                    message: "Movie not found or has been deleted.",
                });
            }
            if (!hall) {
                return res.status(404).json({
                    success: false,
                    message: "Hall not found or has been deleted.",
                });
            }

            // The overlap check is now handled by the pre-save middleware in the model
            // which also calculates the end_time.

            // Prepare and save the new showtime
            const showtimeToCreate = {...showTimeData};
            if (req.user) {
                showtimeToCreate.createdBy = req.user.userId;
            }

            const showtime = new Showtime(showtimeToCreate);
            await showtime.save();

            logger.info(`Created new showtime: ${showtime._id}`);

            // Send success response
            res.status(201).json({
                success: true,
                message: "Showtime created successfully",
                data: {showtime},
            });
        } catch (error) {
            // Handle known validation errors from the model's pre-save hook
            if (error.message.includes("cannot be in the past")) {
                return res.status(409).json({
                    success: false,
                    message:
                        "Showtime cannot be in the past. Please choose a future date and time.",
                    errors: error.message,
                });
            }
            if (error.message.includes("overlaps")) {
                return res.status(409).json({
                    success: false,
                    message:
                        "Showtime conflict. The selected time overlaps with an existing showtime in this hall.",
                    errors: error.message,
                });
            }

            if (error.name === "ValidationError") {
                return res.status(400).json({
                    success: false,
                    message: "Validation failed",
                    errors: error.message,
                });
            }

            logger.error("Create showtime error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to create showtime",
            });
        }
    }

    // 4. UPDATE SHOWTIME
    static async update(req, res) {
        try {
            const {id} = req.params;
            const updateData = req.body;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                throw new Error("Invalid Showtime ID format");
            }

            const showtime = await Showtime.findById(id);
            if (!showtime) {
                return res
                    .status(404)
                    .json({success: false, message: "Showtime not found"});
            }

            // Update fields
            Object.assign(showtime, updateData);
            if (req.user) {
                showtime.updatedBy = req.user.userId;
            }

            // .save() will trigger the pre-save hook which handles end_time calculation and overlap validation
            const updatedShowtime = await showtime.save();

            logger.info(`Updated showtime: ${id}`);
            res.status(200).json({
                success: true,
                message: "Showtime updated successfully",
                data: {showtime: updatedShowtime},
            });
        } catch (error) {
            // Handle known validation errors from the model's pre-save hook
            if (error.message.includes("cannot be in the past")) {
                return res.status(409).json({
                    success: false,
                    message:
                        "Showtime cannot be in the past. Please choose a future date and time.",
                    errors: error.message,
                });
            }
            if (error.message.includes("overlaps")) {
                return res.status(409).json({
                    success: false,
                    message:
                        "Showtime conflict. The selected time overlaps with an existing showtime in this hall.",
                    errors: error.message,
                });
            }

            if (error.name === "ValidationError") {
                // This will now catch Mongoose validation errors from .save()
                return res.status(400).json({
                    success: false,
                    message: "Validation failed",
                    errors: error.message,
                });
            }
            logger.error("Update showtime error:", error);
            res
                .status(500)
                .json({success: false, message: "Failed to update showtime"});
        }
    }

    // 5. SOFT DELETE SHOWTIME
    static async delete(req, res) {
        try {
            const {id} = req.params;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: "Showtime ID is required",
                });
            }
            if (!mongoose.Types.ObjectId.isValid(id)) {
                throw new Error("Invalid Showtime ID format");
            }

            const showtime = await Showtime.findById(id);
            if (!showtime) {
                return res
                    .status(404)
                    .json({success: false, message: "Showtime not found"});
            }

            // Check for associated active bookings before deactivating
            // const { Booking } = require("../models");
            // if (Booking) {
            //   const activeBookings = await Booking.countDocuments({
            //     showtime_id: id,
            //     status: { $nin: ["Cancelled", "Refunded"] }, // Check for bookings that are not cancelled or refunded
            //   });

            //   if (activeBookings > 0) {
            //     return res.status(409).json({
            //       success: false,
            //       message: `Cannot deactivate showtime. It has ${activeBookings} active booking(s). Please cancel or resolve them first.`,
            //     });
            //   }
            // } else {
            //   logger.warn(
            //     `Booking model not found. Skipping check for associated bookings on showtime deletion. ID: ${id}`
            //   );
            // }
            // Check if showtime is already soft deleted
            if (showtime.isDeleted()) {
                return res.status(409).json({
                    success: false,
                    message: "Showtime is already deactivated",
                });
            }
            await showtime.softDelete(req.user?.userId);

            logger.info(`Soft deleted showtime: ${id}`);
            res.status(200).json({
                success: true,
                message: "Showtime deactivated successfully",
                data: {showtime},
            });
        } catch (error) {
            logger.error("Delete showtime error:", error);
            res
                .status(500)
                .json({success: false, message: "Failed to deactivate showtime"});
        }
    }

    // 6. RESTORE SHOWTIME
    static async restore(req, res) {
        try {
            const {id} = req.params;
            ShowtimeController.validateObjectId(id);

            // Find among deleted documents
            const showtime = await Showtime.findOne({
                _id: id,
                deletedAt: {$ne: null},
            });
            if (!showtime) {
                return res.status(404).json({
                    success: false,
                    message: "Showtime not found or is not deleted.",
                });
            }

            // When restoring, check for conflicts as if it were a new showtime
            const overlapping = await Showtime.findOverlappingShowtimes(
                showtime.hall_id,
                showtime.show_date,
                showtime.start_time,
                showtime.end_time
            );

            if (overlapping.length > 0) {
                return res.status(409).json({
                    success: false,
                    message:
                        "Cannot restore showtime because it overlaps with an existing active showtime.",
                    data: {overlappingShowtimes: overlapping},
                });
            }

            await showtime.restore(req.user?.userId);

            logger.info(`Restored showtime: ${id}`);
            res.status(200).json({
                success: true,
                message: "Showtime restored successfully",
                data: {showtime},
            });
        } catch (error) {
            logger.error("Restore showtime error:", error);
            res
                .status(500)
                .json({success: false, message: "Failed to restore showtime"});
        }
    }

    // 7. FORCE DELETE SHOWTIME (Permanent)
    static async forceDelete(req, res) {
        try {
            const {id} = req.params;
            ShowtimeController.validateObjectId(id);

            // 1. Authorization: Admin/SuperAdmin only
            if (req.user?.role !== Role.ADMIN && req.user?.role !== Role.SUPERADMIN) {
                return res.status(403).json({
                    success: false,
                    message:
                        "Forbidden: Only Admins or SuperAdmins can permanently delete showtimes.",
                });
            }

            // 2. Find the showtime (including soft-deleted ones)
            const showtime = await Showtime.collection.findOne({
                _id: new mongoose.Types.ObjectId(id),
            });
            if (!showtime) {
                return res
                    .status(404)
                    .json({success: false, message: "Showtime not found"});
            }

            // 3. Strict check for any associated bookings
            // const { Booking } = require("../models");
            // if (Booking) {
            //   const bookingCount = await Booking.countDocuments({ showtime_id: id });
            //   if (bookingCount > 0) {
            //     return res.status(409).json({
            //       success: false,
            //       message: `Cannot permanently delete showtime. It has ${bookingCount} associated booking(s). Please permanently delete them first.`,
            //     });
            //   }
            // } else {
            //   logger.warn(
            //     `Booking model not found. Skipping check for associated bookings on showtime force deletion. ID: ${id}`
            //   );
            // }

            // 4. Perform permanent deletion
            // Delete associated SeatBooking records
            await SeatBooking.deleteMany({showtimeId: id});
            logger.info(`Deleted SeatBooking records for permanently deleted showtime ID: ${id}`);

            await Showtime.findByIdAndDelete(id);

            logger.warn(
                `PERMANENT DELETION: Showtime permanently deleted by ${req.user.role} ${req.user.userId}`,
                {
                    deletedShowtime: {
                        id: showtime._id,
                        movie_id: showtime.movie_id,
                        hall_id: showtime.hall_id,
                        start_time: showtime.start_time,
                    },
                    deletedBy: req.user.userId,
                    deletedAt: new Date().toISOString(),
                }
            );

            res.status(200).json({
                success: true,
                message: "Showtime permanently deleted.",
                data: {
                    deletedShowtimeId: id,
                    warning: "This action is irreversible.",
                },
            });
        } catch (error) {
            logger.error("Force delete showtime error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to permanently delete showtime",
            });
        }
    }

    // 8. LIST DELETED SHOWTIMES
    static async listDeleted(req, res) {
        try {
            o
            const {
                page = 1,
                limit = 10,
                sortBy = "deletedAt",
                sortOrder = "desc",
            } = req.query;

            const pageNum = Math.max(1, parseInt(page));
            const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
            const skip = (pageNum - 1) * limitNum;

            const query = {deletedAt: {$ne: null}};
            const sortObj = {[sortBy]: sortOrder === "desc" ? -1 : 1};

            const [showtimes, totalCount] = await Promise.all([
                Showtime.find(query)
                    .sort(sortObj)
                    .skip(skip)
                    .limit(limitNum)
                    .populate({path: "movie_id", select: "title"})
                    .populate({path: "hall_id", select: "hall_name"})
                    .lean(),
                Showtime.countDocuments(query),
            ]);

            const totalPages = Math.ceil(totalCount / limitNum);

            logger.info(`Retrieved ${showtimes.length} deleted showtimes`);

            res.status(200).json({
                success: true,
                data: {
                    showtimes,
                    pagination: {
                        currentPage: pageNum,
                        totalPages,
                        totalCount,
                        limit: limitNum,
                    },
                },
            });
        } catch (error) {
            logger.error("Get deleted showtimes error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to retrieve deleted showtimes",
            });
        }
    }

    // 9. UPDATE SHOWTIME STATUS
    static async updateStatus(req, res) {
        try {
            const {id} = req.params;
            const {status} = req.body;

            ShowtimeController.validateObjectId(id);

            if (!status) {
                return res
                    .status(400)
                    .json({success: false, message: "Status is required"});
            }

            const showtime = await Showtime.findById(id);
            if (!showtime) {
                return res
                    .status(404)
                    .json({success: false, message: "Showtime not found"});
            }

            if (showtime.isDeleted()) {
                return res.status(409).json({
                    success: false,
                    message:
                        "Cannot update status of a deactivated showtime. Please restore it first.",
                });
            }

            const updatedShowtime = await showtime.updateStatus(
                status,
                req.user?.userId
            );

            logger.info(`Updated showtime status: ${id} to ${status}`);

            res.status(200).json({
                success: true,
                message: "Showtime status updated successfully",
                data: {showtime},
            });
        } catch (error) {
            if (error.message === "Invalid showtime ID format") {
                return res.status(400).json({success: false, message: error.message});
            }
            if (error.message === "Invalid status provided") {
                return res.status(400).json({
                    success: false,
                    message: error.message,
                });
            }
            logger.error("Update showtime status error:", error);
            res
                .status(500)
                .json({success: false, message: "Failed to update showtime status"});
        }
    }

    // 10. GET SHOWTIME ANALYTICS
    static async getAnalytics(req, res) {
        try {
            const analytics = await Showtime.getAnalytics(req.query);
            logger.info("Retrieved showtime analytics");
            res.status(200).json({
                success: true,
                data: {analytics},
            });
        } catch (error) {
            logger.error("Get showtime analytics error:", error);
            res.status(500).json({
                success: false,
                message: "Failed to retrieve showtime analytics",
            });
        }
    }

    // 11. BULK CREATE SHOWTIMES
    static async createBulk(req, res) {
        try {
            const {showtimes} = req.body;

            if (!showtimes || !Array.isArray(showtimes) || showtimes.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Request body must contain a non-empty array of showtimes.",
                });
            }

            const createdShowtimes = [];
            const errors = [];
            const createdBy = req.user?.userId;

            for (let i = 0; i < showtimes.length; i++) {
                const showtimeData = showtimes[i];
                try {
                    const showtime = new Showtime({...showtimeData, createdBy});
                    await showtime.save();
                    createdShowtimes.push(showtime);
                } catch (error) {
                    let errorMessage = error.message;
                    if (error.message.includes("cannot be in the past")) {
                        errorMessage =
                            "Showtime start date and time cannot be in the past.";
                    } else if (error.message.includes("overlaps")) {
                        errorMessage =
                            "Showtime overlaps with an existing showtime in the same hall.";
                    }
                    errors.push({
                        index: i,
                        data: showtimeData,
                        error: errorMessage,
                    });
                }
            }

            if (errors.length > 0) {
                logger.error("Bulk create showtime encountered errors:", {errors});
                let message = "Some showtimes could not be created.";
                if (errors.length === 1) {
                    message = errors[0].error;
                }
                return res.status(409).json({
                    success: false,
                    message,
                    data: {
                        createdCount: createdShowtimes.length,
                        failedCount: errors.length,
                        createdShowtimes,
                        errors,
                    },
                });
            }

            logger.info(`Bulk created ${createdShowtimes.length} showtimes.`);
            res.status(201).json({
                success: true,
                message: "All showtimes created successfully.",
                data: {
                    createdCount: createdShowtimes.length,
                    createdShowtimes,
                },
            });
        } catch (error) {
            logger.error("Bulk create showtime error:", error);
            res.status(500).json({
                success: false,
                message: "An unexpected error occurred during bulk creation.",
            });
        }
    }

    // 12. BULK SOFT DELETE SHOWTIMES
    static async deleteBulk(req, res) {
        try {
            const {showtimeIds} = req.body;

            if (
                !showtimeIds ||
                !Array.isArray(showtimeIds) ||
                showtimeIds.length === 0
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Request body must contain a non-empty array of showtime IDs.",
                });
            }

            const deletedShowtimes = [];
            const errors = [];
            const deletedBy = req.user?.userId;

            // Fetch all candidate showtimes at once to reduce DB calls
            const validIds = showtimeIds.filter((id) => {
                if (mongoose.Types.ObjectId.isValid(id)) {
                    return true;
                }
                errors.push({id, error: "Invalid ID format."});
                return false;
            });

            const showtimes = await Showtime.find({_id: {$in: validIds}});
            const showtimeMap = new Map(showtimes.map((s) => [s._id.toString(), s]));

            for (const id of validIds) {
                const showtime = showtimeMap.get(id);

                if (!showtime) {
                    errors.push({id, error: "Showtime not found."});
                    continue;
                }

                if (showtime.isDeleted()) {
                    errors.push({id, error: "Showtime is already deactivated."});
                    continue;
                }

                await showtime.softDelete(deletedBy);
                deletedShowtimes.push(id);
            }

            if (errors.length > 0) {
                logger.warn("Bulk delete showtime encountered errors:", {errors});
                return res.status(409).json({
                    success: false,
                    message: "Some showtimes could not be deactivated.",
                    data: {
                        deletedCount: deletedShowtimes.length,
                        failedCount: errors.length,
                        deletedShowtimeIds: deletedShowtimes,
                        errors,
                    },
                });
            }

            logger.info(`Bulk deactivated ${deletedShowtimes.length} showtimes.`);
            res.status(200).json({
                success: true,
                message: "All specified showtimes deactivated successfully.",
                data: {
                    deletedCount: deletedShowtimes.length,
                    deletedShowtimeIds: deletedShowtimes,
                },
            });
        } catch (error) {
            logger.error("Bulk delete showtime error:", error);
            res.status(500).json({
                success: false,
                message: "An unexpected error occurred during bulk deactivation.",
            });
        }
    }

    // 13. BULK FORCE DELETE SHOWTIMES (Permanent)
    static async forceDeleteBulk(req, res) {
        try {
            logger.info("Force delete bulk request received", {body: req.body});
            const {showtimeIds} = req.body;

            // Validate input
            if (
                !showtimeIds ||
                !Array.isArray(showtimeIds) ||
                showtimeIds.length === 0
            ) {
                logger.warn("Invalid showtime IDs array", {showtimeIds});
                return res.status(400).json({
                    success: false,
                    message:
                        "Request body must contain a non-empty array of showtime IDs.",
                });
            }

            // Authorization check
            if (req.user?.role !== Role.ADMIN && req.user?.role !== Role.SUPERADMIN) {
                return res.status(403).json({
                    success: false,
                    message:
                        "Forbidden: Only Admins or SuperAdmins can permanently delete showtimes.",
                });
            }

            const deletedShowtimes = [];
            const errors = [];

            // Validate all IDs
            const validIds = showtimeIds.filter((id) => {
                if (mongoose.Types.ObjectId.isValid(id)) {
                    return true;
                }
                errors.push({id, error: "Invalid ID format."});
                return false;
            });

            // Find all showtimes (including soft-deleted ones)
            const showtimes = await Showtime.collection.find({
                _id: {$in: validIds.map((id) => new mongoose.Types.ObjectId(id))},
            }).toArray();

            const showtimeMap = new Map(
                showtimes.map((s) => [s._id.toString(), s])
            );

            // Process each showtime for permanent deletion
            for (const id of validIds) {
                const showtime = showtimeMap.get(id);

                if (!showtime) {
                    errors.push({id, error: "Showtime not found."});
                    continue;
                }

                // Permanently delete the showtime
                await Showtime.findByIdAndDelete(id);
                deletedShowtimes.push(id);

                logger.warn(
                    `PERMANENT DELETION: Showtime permanently deleted by ${req.user.role} ${req.user.userId}`,
                    {
                        deletedShowtime: {
                            id: showtime._id,
                            movie_id: showtime.movie_id,
                            hall_id: showtime.hall_id,
                            start_time: showtime.start_time,
                        },
                        deletedBy: req.user.userId,
                        deletedAt: new Date().toISOString(),
                    }
                );
            }

            if (errors.length > 0) {
                logger.warn(
                    "Bulk force delete showtime encountered errors:",
                    {errors}
                );
                return res.status(409).json({
                    success: false,
                    message: "Some showtimes could not be permanently deleted.",
                    data: {
                        deletedCount: deletedShowtimes.length,
                        failedCount: errors.length,
                        deletedShowtimeIds: deletedShowtimes,
                        errors,
                        warning: "These actions are irreversible.",
                    },
                });
            }

            logger.info(
                `Bulk permanently deleted ${deletedShowtimes.length} showtimes.`
            );
            res.status(200).json({
                success: true,
                message: "All specified showtimes permanently deleted.",
                data: {
                    deletedCount: deletedShowtimes.length,
                    deletedShowtimeIds: deletedShowtimes,
                    warning: "These actions are irreversible.",
                },
            });
        } catch (error) {
            logger.error("Bulk force delete showtime error:", error);
            res.status(500).json({
                success: false,
                message:
                    "An unexpected error occurred during bulk permanent deletion.",
            });
        }
    }

    //14. Duplicate multiple showtimes at once (edit & create new)
    static async duplicateBulk(req, res, next) {
        try {
            const {showtimes} = req.body;

            if (!Array.isArray(showtimes) || showtimes.length === 0) {
                return res.status(400).json({message: "No showtimes provided"});
            }

            const showtimesToDuplicate = showtimes.filter((s) => s._id);
            const showtimesToCreate = showtimes.filter((s) => !s._id);

            const duplicateIds = showtimesToDuplicate.map((s) => s._id);

            let originalShowtimes = [];
            if (duplicateIds.length > 0) {
                originalShowtimes = await Showtime.find({_id: {$in: duplicateIds}});
            }

            const originalShowtimesMap = new Map(
                originalShowtimes.map((showtime) => [
                    showtime._id.toString(),
                    showtime.toObject(),
                ])
            );

            const duplicatedShowtimes = showtimesToDuplicate
                .map((submittedShowtime) => {
                    const original = originalShowtimesMap.get(submittedShowtime._id);
                    if (!original) return null;

                    return {
                        ...original,
                        ...submittedShowtime,
                        _id: undefined,
                        __v: undefined,
                        createdAt: undefined,
                        updatedAt: undefined,
                    };
                })
                .filter(Boolean);

            const showtimesToInsert = [...duplicatedShowtimes, ...showtimesToCreate];

            if (showtimesToInsert.length === 0) {
                return res
                    .status(400)
                    .json({message: "No valid showtimes to create."});
            }

            const createdShowtimes = [];
            const errors = [];
            const createdBy = req.user?.userId;

            for (let i = 0; i < showtimesToInsert.length; i++) {
                const showtimeData = showtimesToInsert[i];
                try {
                    const showtime = new Showtime({...showtimeData, createdBy});
                    await showtime.save();
                    createdShowtimes.push(showtime);
                } catch (error) {
                    let errorMessage = error.message;
                    if (error.message.includes("cannot be in the past")) {
                        errorMessage =
                            "Showtime start date and time cannot be in the past.";
                    } else if (error.message.includes("overlaps")) {
                        errorMessage =
                            "Showtime overlaps with an existing showtime in the same hall.";
                    }
                    errors.push({
                        index: i,
                        data: showtimeData,
                        error: errorMessage,
                    });
                }
            }

            if (errors.length > 0) {
                logger.error("Bulk duplicate showtime encountered errors:", {
                    errors,
                });
                let message = "Some showtimes could not be created/duplicated.";
                if (errors.length === 1) {
                    message = errors[0].error;
                }
                return res.status(409).json({
                    success: false,
                    message,
                    data: {
                        createdCount: createdShowtimes.length,
                        failedCount: errors.length,
                        createdShowtimes,
                        errors,
                    },
                });
            }

            logger.info(
                `Bulk duplicated/created ${createdShowtimes.length} showtimes.`
            );
            res.status(201).json({
                success: true,
                message: "All showtimes created/duplicated successfully.",
                data: {
                    createdCount: createdShowtimes.length,
                    createdShowtimes,
                },
            });
        } catch (err) {
            console.error("Error in duplicateBulk:", err);
            next(err);
        }
    }

}

module.exports = ShowtimeController;
