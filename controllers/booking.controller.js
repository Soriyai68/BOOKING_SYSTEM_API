const mongoose = require("mongoose");
const {Booking, Showtime, User} = require("../models");
const {Role} = require("../data");
const logger = require("../utils/logger");

class BookingController {
    // Helper method to validate ObjectId
    static validateObjectId(id) {
        if (!mongoose.Types.ObjectId.isValid(id)) {
            throw new Error("Invalid Booking ID format");
        }
    }

    // Build filter query
    static buildFilterQuery(filters) {
        const query = {};

        if (filters.booking_status) {
            query.booking_status = filters.booking_status;
        }

        if (filters.payment_status) {
            query.payment_status = filters.payment_status;
        }

        if (filters.userId && mongoose.Types.ObjectId.isValid(filters.userId)) {
            query.userId = new mongoose.Types.ObjectId(filters.userId);
        }

        if (filters.showtimeId && mongoose.Types.ObjectId.isValid(filters.showtimeId)) {
            query.showtimeId = new mongoose.Types.ObjectId(filters.showtimeId);
        }

        // Date range filter
        if (filters.dateFrom || filters.dateTo) {
            query.booking_date = {};
            if (filters.dateFrom) query.booking_date.$gte = new Date(filters.dateFrom);
            if (filters.dateTo) query.booking_date.$lte = new Date(filters.dateTo);
        }

        return query;
    }

    // --- GET ALL BOOKINGS ---
    static async getAll(req, res) {
        try {
            const {
                page = 1,
                limit = 10,
                sortBy = "booking_date",
                sortOrder = "desc",
                search,
                includeDeleted = false,
                ...filters
            } = req.query;

            const pageNum = Math.max(1, parseInt(page));
            const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
            const skip = (pageNum - 1) * limitNum;

            const matchQuery = {...BookingController.buildFilterQuery(filters)};
            if (!includeDeleted || includeDeleted === "false") matchQuery.deletedAt = null;

            const pipeline = [
                {$match: matchQuery},

                // Lookup user
                {
                    $lookup: {
                        from: "users",
                        localField: "userId",
                        foreignField: "_id",
                        as: "user"
                    }
                },
                {
                    $unwind: {
                        path: "$user",
                        preserveNullAndEmptyArrays: true
                    }
                },

                // Lookup showtime
                {
                    $lookup: {
                        from: "showtimes",
                        localField: "showtimeId",
                        foreignField: "_id",
                        as: "showtime"
                    }
                },
                {
                    $unwind: {
                        path: "$showtime",
                        preserveNullAndEmptyArrays: true
                    }
                },

                // Lookup movie
                {
                    $lookup: {
                        from: "movies",
                        localField: "showtime.movie_id",
                        foreignField: "_id",
                        as: "movie"
                    }
                },
                {
                    $unwind: {
                        path: "$movie",
                        preserveNullAndEmptyArrays: true
                    }
                },

                // Lookup hall
                {
                    $lookup: {
                        from: "halls",
                        localField: "showtime.hall_id",
                        foreignField: "_id",
                        as: "hall"
                    }
                },
                {
                    $unwind: {
                        path: "$hall",
                        preserveNullAndEmptyArrays: true
                    }
                },

                // Handle mixed seat ID types (string/ObjectId)
                {
                    $addFields: {
                        seatObjectIds: {
                            $map: {
                                input: "$seats",
                                as: "s",
                                in: {
                                    $cond: {
                                        if: {$eq: [{$type: "$$s"}, "string"]},
                                        then: {$toObjectId: "$$s"},
                                        else: "$$s"
                                    }
                                }
                            }
                        }
                    }
                },

                // Lookup seats and project specific fields
                {
                    $lookup: {
                        from: "seats",
                        localField: "seatObjectIds",
                        foreignField: "_id",
                        pipeline: [
                            {
                                $project: {
                                    _id: 1,
                                    row: 1,
                                    seat_number: 1,
                                    seat_type: 1,
                                    status: 1,
                                    noted: 1,
                                    seat_identifier: {
                                        $concat: ["$row", {$toString: "$seat_number"}]
                                    }
                                }
                            }
                        ],
                        as: "seats"
                    }
                },
            ];

            // Optional search
            if (search) {
                pipeline.push({
                    $match: {
                        $or: [
                            {reference_code: {$regex: search, $options: "i"}},
                            {"user.username": {$regex: search, $options: "i"}},
                        ]
                    }
                });
            }

            // Count total
            const totalCountResult = await Booking.aggregate([...pipeline, {$count: "total"}]);
            const totalCount = totalCountResult[0]?.total || 0;

            // Sort, skip, limit
            pipeline.push({$sort: {[sortBy]: sortOrder === "desc" ? -1 : 1}});
            pipeline.push({$skip: skip}, {$limit: limitNum});

            // Project final output
            pipeline.push({
                $project: {
                    user: {_id: 1, name: 1, phone: 1},
                    showtime: {_id: 1, show_date: 1, start_time: 1, end_time: 1},
                    movie: {_id: 1, title: 1, poster_url: 1, duration_minutes: 1},
                    hall: {_id: 1, hall_name: 1},
                    seats: 1,
                    reference_code: 1,
                    total_price: 1,
                    booking_status: 1,
                    payment_status: 1,
                    payment_id: 1,
                    booking_date: 1,
                    expired_at: 1,
                    noted: 1,
                    createdAt: 1,
                    updatedAt: 1,
                }
            });

            const bookings = await Booking.aggregate(pipeline);

            const totalPages = Math.ceil(totalCount / limitNum);

            res.status(200).json({
                success: true,
                data: {bookings, pagination: {currentPage: pageNum, totalPages, totalCount, limit: limitNum}}
            });

        } catch (error) {
            logger.error("Get all bookings error:", error);
            res.status(500).json({success: false, message: "Failed to retrieve bookings"});
        }
    }

// --- GET BOOKING BY ID ---
    static async getById(req, res) {
        try {
            const {id} = req.params;
            BookingController.validateObjectId(id);

            const booking = await Booking.findById(id)
                .populate("userId", "name email phone")
                .populate({
                    path: "showtimeId",
                    populate: [
                        {path: "movie_id", select: "title poster_url duration_minutes"},
                        {path: "hall_id", select: "hall_name screen_type"},
                    ]
                });

            if (!booking) return res.status(404).json({success: false, message: "Booking not found"});

            // Populate seats safely
            const Seat = mongoose.model("Seat");
            const seatObjectIds = (booking.seats || [])
                .filter(id => id && mongoose.Types.ObjectId.isValid(id.toString()))
                .map(id => new mongoose.Types.ObjectId(id.toString()));

            const populatedSeatDocs = seatObjectIds.length > 0
                ? await Seat.find({_id: {$in: seatObjectIds}, deletedAt: null})
                    .select('row seat_number seat_type status')
                : [];

            const populatedSeats = populatedSeatDocs.map(seat => {
                const seatObj = seat.toObject();
                return {
                    _id: seatObj._id,
                    row: seatObj.row,
                    seat_number: seatObj.seat_number,
                    seat_type: seatObj.seat_type,
                    status: seatObj.status,
                    seat_identifier: `${seatObj.row}${seatObj.seat_number}`,
                };
            });

            const bookingObject = booking.toObject();
            bookingObject.seats = populatedSeats;

            res.status(200).json({success: true, data: {booking: bookingObject}});
        } catch (error) {
            logger.error("Get booking by ID error:", error);
            res.status(500).json({success: false, message: "Failed to retrieve booking"});
        }
    }

// --- CREATE BOOKING ---
    static async create(req, res) {
        try {
            const {
                userId,
                showtimeId,
                seats,
                total_price,
                payment_method, // Added payment_method
                payment_id,
                payment_status = "Pending",
                booking_status = "Confirmed",
                noted = ""
            } = req.body;

            // Validations
            if (!userId || !showtimeId || !seats || !Array.isArray(seats) || seats.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Missing required booking details. Please provide a user, showtime, and select at least one seat."
                });
            }

            const user = await User.findById(userId);
            if (!user) return res.status(404).json({success: false, message: "User not found"});

            const showtime = await Showtime.findById(showtimeId);
            if (!showtime) return res.status(404).json({success: false, message: "Showtime not found"});

            // Check if the showtime is active for booking
            if (!showtime.isActiveForBooking()) {
                return res.status(400).json({
                    success: false,
                    message: "This showtime is not available for booking. It might be completed, cancelled, or in the past."
                });
            }

            const Seat = mongoose.model("Seat");
            const seatObjectIds = seats.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));

            // Ensure all seats exist
            const foundSeats = await Seat.find({_id: {$in: seatObjectIds}}).lean();
            if (foundSeats.length !== seats.length) {
                const missingSeatIds = seats.filter(id => !foundSeats.map(s => s._id.toString()).includes(id));
                return res.status(404).json({
                    success: false,
                    message: `Some selected seats could not be found. Please check the seat IDs: ${missingSeatIds.join(", ")}`
                });
            }

            // Ensure all seats belong to the hall
            const validSeats = foundSeats.filter(seat => seat.hall_id.toString() === showtime.hall_id.toString());
            if (validSeats.length !== seats.length) {
                return res.status(400).json({
                    success: false,
                    message: "One or more selected seats do not belong to the chosen hall. Please verify your seat selection."
                });
            }

            // Check if seats already booked
            const existingBookings = await Booking.findActiveBookingsByShowtime(showtimeId);
            const bookedSeatIds = existingBookings.flatMap(b => b.seats.map(id => id.toString()));
            const alreadyBookedSeats = seats.filter(id => bookedSeatIds.includes(id));
            if (alreadyBookedSeats.length > 0) {
                return res.status(409).json({
                    success: false,
                    message: `Some of the selected seats are already booked or reserved. Please choose different seats.`
                });
            }

            // Create booking
            const reference_code = await Booking.generateReferenceCode();

            let expired_at;
            if (payment_method === 'Cash') {
                expired_at = null;
            } else {
                const [hours, minutes] = showtime.start_time.split(':');
                const showtimeDate = new Date(showtime.show_date);
                showtimeDate.setHours(hours, minutes, 0, 0);
                expired_at = new Date(showtimeDate.getTime() - 15 * 60 * 1000);
            }
            const booking = new Booking({
                userId, showtimeId, seats: seatObjectIds, seat_count: seats.length,
                total_price, reference_code, payment_id, payment_status,
                booking_status, expired_at, payment_method,
                noted
            });

            await booking.save();

            // Populate booking for response with consistent details
            await booking.populate([
                {path: "userId", select: "name email phone"},
                {
                    path: "showtimeId",
                    populate: [
                        {path: "movie_id", select: "title poster_url duration_minutes"},
                        {path: "hall_id", select: "hall_name screen_type"},
                    ]
                },
                {path: "seats"}
            ]);

            res.status(201).json({
                success: true,
                message: "Booking created successfully",
                data: {booking}
            });
        } catch (error) {
            logger.error("Create booking error:", error);
            res.status(500).json({success: false, message: "Failed to create booking"});
        }
    }

    // 4. UPDATE BOOKING
    static async update(req, res) {
        try {
            const {id} = req.params;
            BookingController.validateObjectId(id);

            // 1. Fetch the existing booking
            const booking = await Booking.findById(id);
            if (!booking) {
                return res.status(404).json({success: false, message: "Booking not found"});
            }

            const updateData = {...req.body};
            delete updateData._id;
            delete updateData.createdAt;

            let currentShowtime = await Showtime.findById(booking.showtimeId); // Get current showtime object
            let currentSeats = [...booking.seats]; // Get current seats array

            // Store original values for seat release logic later
            const originalSeats = [...booking.seats];
            const originalShowtimeId = booking.showtimeId;


            // --- Primary Showtime Validation ---
            // Unless we are specifically trying to cancel the booking, no updates should be
            // allowed if the associated showtime is no longer active.
            if (updateData.booking_status !== 'Cancelled' && booking.booking_status !== 'Cancelled') {
                if (!currentShowtime) {
                    return res.status(404).json({
                        success: false,
                        message: "The showtime associated with this booking could not be found."
                    });
                }
                if (!currentShowtime.isActiveForBooking()) {
                    return res.status(400).json({
                        success: false,
                        message: "This booking cannot be updated because its showtime is no longer active (it may be completed or cancelled)."
                    });
                }
            }


            // --- Handle Showtime ID Update ---
            // If a new showtimeId is provided in the request, and it's different from the current one.
            if (updateData.showtimeId && updateData.showtimeId.toString() !== booking.showtimeId.toString()) {
                const newShowtime = await Showtime.findById(updateData.showtimeId);
                if (!newShowtime) {
                    return res.status(404).json({success: false, message: "The new showtime specified was not found."});
                }
                // Validate if the new showtime is available for booking (not completed, cancelled, or in the past).
                if (!newShowtime.isActiveForBooking()) {
                    return res.status(400).json({
                        success: false,
                        message: "The new showtime is not available for booking. It might be completed, cancelled, or in the past."
                    });
                }
                // Update the booking's showtimeId and set currentShowtime for subsequent seat validations.
                booking.showtimeId = newShowtime._id;
                currentShowtime = newShowtime;
            }

            // 3. Handle seats update (if provided)
            if (updateData.seats && Array.isArray(updateData.seats)) {
                if (!currentShowtime) { // Should not happen if showtimeId is always valid
                    return res.status(500).json({success: false, message: "Internal error: Showtime details missing."});
                }
                const Seat = mongoose.model("Seat");
                const newSeatObjectIds = updateData.seats.filter(id => mongoose.Types.ObjectId.isValid(id)).map(id => new mongoose.Types.ObjectId(id));

                const foundNewSeats = await Seat.find({_id: {$in: newSeatObjectIds}}).lean();
                if (foundNewSeats.length !== newSeatObjectIds.length) {
                    const missingSeatIds = updateData.seats.filter(id => !foundNewSeats.map(s => s._id.toString()).includes(id));
                    return res.status(404).json({
                        success: false,
                        message: `Some selected seats could not be found for the new selection: ${missingSeatIds.join(", ")}`
                    });
                }

                const validNewSeats = foundNewSeats.filter(seat => seat.hall_id.toString() === currentShowtime.hall_id.toString());
                if (validNewSeats.length !== newSeatObjectIds.length) {
                    return res.status(400).json({
                        success: false,
                        message: "One or more new seats do not belong to the current showtime's hall. Please verify your selection."
                    });
                }

                // Check if new seats are already booked by *other* bookings
                const existingBookingsForShowtime = await Booking.findActiveBookingsByShowtime(currentShowtime._id);
                const bookedSeatIds = existingBookingsForShowtime
                    .filter(b => b._id.toString() !== booking._id.toString()) // Exclude current booking
                    .flatMap(b => b.seats.map(id => id.toString()));

                const alreadyBookedSeats = updateData.seats.filter(id => bookedSeatIds.includes(id));
                if (alreadyBookedSeats.length > 0) {
                    return res.status(409).json({
                        success: false,
                        message: `Some of the newly selected seats are already booked or reserved: ${alreadyBookedSeats.join(", ")}`
                    });
                }
                booking.seats = newSeatObjectIds;
                currentSeats = newSeatObjectIds;
            }

            // 4. Manually manage seat status changes
            const Seat = mongoose.model('Seat');
            const seatsToRelease = [];
            const seatsToReserve = [];

            // Seats that were in original booking but not in current booking (or showtime changed)
            if (originalShowtimeId.toString() !== booking.showtimeId.toString() || originalSeats.toString() !== currentSeats.toString()) {
                // If showtime changed, all original seats must be released
                if (originalShowtimeId.toString() !== booking.showtimeId.toString()) {
                    seatsToRelease.push(...originalSeats);
                } else { // Only seats changed, some might be removed
                    for (const oldSeatId of originalSeats) {
                        if (!currentSeats.some(newSeatId => newSeatId.toString() === oldSeatId.toString())) {
                            seatsToRelease.push(oldSeatId);
                        }
                    }
                }

                // Seats that are in current booking but were not in original booking
                for (const newSeatId of currentSeats) {
                    if (!originalSeats.some(oldSeatId => oldSeatId.toString() === newSeatId.toString())) {
                        seatsToReserve.push(newSeatId);
                    }
                }
            }

            // Execute seat status updates
            if (seatsToRelease.length > 0) {
                const uniqueSeatsToRelease = [...new Set(seatsToRelease)];
                await Seat.updateMany(
                    {_id: {$in: uniqueSeatsToRelease}, status: 'reserved'},
                    {$set: {status: 'active'}}
                );
            }
            if (seatsToReserve.length > 0) {
                const uniqueSeatsToReserve = [...new Set(seatsToReserve)];
                await Seat.updateMany(
                    {_id: {$in: uniqueSeatsToReserve}, status: 'active'},
                    {$set: {status: 'reserved'}}
                );
            }

            // 5. Apply remaining updates
            Object.keys(updateData).forEach(key => {
                if (key !== 'showtimeId' && key !== 'seats') {
                    booking[key] = updateData[key];
                }
            });

            // 6. Save the booking
            await booking.save(); // This will trigger pre('save') middleware for booking_status changes

            // 7. Populate for response
            await booking.populate([
                {path: "userId", select: "name email phone"},
                {
                    path: "showtimeId",
                    populate: [
                        {path: "movie_id", select: "title poster_url duration_minutes"},
                        {path: "hall_id", select: "hall_name screen_type"},
                    ]
                },
                {path: "seats"}
            ]);


            res.status(200).json({
                success: true,
                message: "Booking updated successfully",
                data: {booking},
            });
        } catch (error) {
            logger.error("Update booking error:", error);
            if (error.message === "Invalid Booking ID format") {
                return res.status(400).json({success: false, message: error.message});
            }
            // Catch custom validation errors and send appropriate response
            if (error.message.includes("Showtime not found") || error.message.includes("not available for booking") ||
                error.message.includes("seats could not be found") || error.message.includes("seats do not belong to the hall") ||
                error.message.includes("seats are already booked")) {
                return res.status(400).json({success: false, message: error.message});
            }
            res
                .status(500)
                .json({success: false, message: "Failed to update booking"});
        }
    }

    // 5. CANCEL BOOKING (SOFT DELETE)
    static async cancel(req, res) {
        try {
            const {id} = req.params;
            BookingController.validateObjectId(id);

            const booking = await Booking.findById(id);

            if (!booking) {
                return res
                    .status(404)
                    .json({success: false, message: "Booking not found"});
            }

            if (booking.deletedAt) {
                return res
                    .status(400)
                    .json({success: false, message: "Booking is already cancelled"});
            }

            await booking.cancelBooking("Cancelled by admin");

            res.status(200).json({
                success: true,
                message: "Booking cancelled successfully",
            });
        } catch (error) {
            logger.error("Cancel booking error:", error);
            res
                .status(500)
                .json({success: false, message: "Failed to cancel booking"});
        }
    }

    // 6. RESTORE DELETED BOOKING
    static async restore(req, res) {
        try {
            const {id} = req.params;
            BookingController.validateObjectId(id);

            const booking = await Booking.findByIdAndUpdate(
                id,
                {deletedAt: null},
                {new: true}
            );

            if (!booking) {
                return res
                    .status(404)
                    .json({success: false, message: "Booking not found"});
            }

            res.status(200).json({
                success: true,
                message: "Booking restored successfully",
                data: {booking},
            });
        } catch (error) {
            logger.error("Restore booking error:", error);
            res
                .status(500)
                .json({success: false, message: "Failed to restore booking"});
        }
    }

    // 7. FORCE DELETE BOOKING
    static async forceDelete(req, res) {
        try {
            const {id} = req.params;
            BookingController.validateObjectId(id);

            const booking = await Booking.findByIdAndDelete(id);

            if (!booking) {
                return res
                    .status(404)
                    .json({success: false, message: "Booking not found"});
            }

            res.status(200).json({
                success: true,
                message: "Booking permanently deleted",
            });
        } catch (error) {
            logger.error("Force delete booking error:", error);
            res
                .status(500)
                .json({success: false, message: "Failed to permanently delete booking"});
        }
    }

    // 8. GET DELETED BOOKINGS
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

            const query = {deletedAt: {$ne: null}};

            const totalCount = await Booking.countDocuments(query);

            const bookings = await Booking.find(query)
                .populate("userId", "username email phone")
                .populate({
                    path: "showtimeId",
                    populate: [
                        {path: "movie_id", select: "title poster_url"},
                        {path: "hall_id", select: "hall_name"},
                    ],
                })
                .sort({[sortBy]: sortOrder === "desc" ? -1 : 1})
                .skip(skip)
                .limit(limitNum);

            const totalPages = Math.ceil(totalCount / limitNum);

            res.status(200).json({
                success: true,
                data: {
                    bookings,
                    pagination: {
                        currentPage: pageNum,
                        totalPages,
                        totalCount,
                        limit: limitNum,
                    },
                },
            });
        } catch (error) {
            logger.error("List deleted bookings error:", error);
            res
                .status(500)
                .json({success: false, message: "Failed to retrieve deleted bookings"});
        }
    }

    // 9. GET BOOKING ANALYTICS
    static async getAnalytics(req, res) {
        try {
            const totalBookings = await Booking.countDocuments({deletedAt: null});
            const confirmedBookings = await Booking.countDocuments({
                booking_status: "Confirmed",
                deletedAt: null,
            });
            const cancelledBookings = await Booking.countDocuments({
                booking_status: "Cancelled",
                deletedAt: null,
            });
            const completedBookings = await Booking.countDocuments({
                booking_status: "Completed",
                deletedAt: null,
            });

            const totalRevenue = await Booking.aggregate([
                {$match: {payment_status: "Completed", deletedAt: null}},
                {$group: {_id: null, total: {$sum: "$total_price"}}},
            ]);

            const pendingPayments = await Booking.countDocuments({
                payment_status: "Pending",
                deletedAt: null,
            });

            res.status(200).json({
                success: true,
                data: {
                    totalBookings,
                    confirmedBookings,
                    cancelledBookings,
                    completedBookings,
                    totalRevenue: totalRevenue[0]?.total || 0,
                    pendingPayments,
                },
            });
        } catch (error) {
            logger.error("Get booking analytics error:", error);
            res
                .status(500)
                .json({success: false, message: "Failed to retrieve booking analytics"});
        }
    }

    // 10. GET BOOKING BY REFERENCE CODE
    static async getByReferenceCode(req, res) {
        try {
            const {reference_code} = req.params;
            if (!reference_code) {
                return res
                    .status(400)
                    .json({success: false, message: "Reference code is required"});
            }

            const booking = await Booking.findByReferenceCode(reference_code)
                .populate("userId", "username email phone")
                .populate({
                    path: "showtimeId",
                    populate: [
                        {path: "movie_id", select: "title poster_url duration_minutes"},
                        {path: "hall_id", select: "hall_name screen_type"},
                    ],
                });

            if (!booking) {
                return res
                    .status(404)
                    .json({success: false, message: "Booking not found"});
            }

            // Optional: Check if the booking is expired and update status if needed
            if (booking.isExpired() && booking.booking_status === 'Confirmed' && booking.payment_status === 'Pending') {
                await booking.cancelBooking('Found expired while fetching by reference');
            }

            res.status(200).json({
                success: true,
                data: {booking},
            });
        } catch (error) {
            logger.error("Get booking by reference code error:", error);
            res
                .status(500)
                .json({success: false, message: "Failed to retrieve booking"});
        }
    }

    // 11. CANCEL A BOOKING (USER)
    static async cancelUserBooking(req, res) {
        try {
            const {id} = req.params;
            const userId = req.user.id; // from auth middleware

            BookingController.validateObjectId(id);

            const booking = await Booking.findById(id);

            if (!booking) {
                return res
                    .status(404)
                    .json({success: false, message: "Booking not found"});
            }

            // Ensure the booking belongs to the user trying to cancel it
            if (booking.userId.toString() !== userId) {
                return res
                    .status(403)
                    .json({success: false, message: "Forbidden: You cannot cancel this booking"});
            }

            if (booking.booking_status === "Cancelled") {
                return res
                    .status(400)
                    .json({success: false, message: "Booking is already cancelled"});
            }

            // Optional: Add logic here to prevent cancellation if the showtime is too close

            await booking.cancelBooking("Cancelled by user");

            res.status(200).json({
                success: true,
                message: "Your booking has been successfully cancelled",
            });
        } catch (error) {
            logger.error("User cancel booking error:", error);
            res
                .status(500)
                .json({success: false, message: "Failed to cancel your booking"});
        }
    }
}

module.exports = BookingController;
