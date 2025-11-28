const mongoose = require("mongoose");
const { Booking, Showtime, User, SeatBooking } = require("../models");
const { Role } = require("../data");
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

    if (
      filters.showtimeId &&
      mongoose.Types.ObjectId.isValid(filters.showtimeId)
    ) {
      query.showtimeId = new mongoose.Types.ObjectId(filters.showtimeId);
    }

    // Date range filter
    if (filters.dateFrom || filters.dateTo) {
      query.booking_date = {};
      if (filters.dateFrom)
        query.booking_date.$gte = new Date(filters.dateFrom);
      if (filters.dateTo) query.booking_date.$lte = new Date(filters.dateTo);
    }

    return query;
  }
  // Build search query
  static buildSearchQuery(query) {
    const { search } = query;
    if (!search) return {};
    const searchConditions = [
      { reference_code: { $regex: search, $options: "i" } },
      { "user.name": { $regex: search, $options: "i" } },
      { "user.phone": { $regex: search, $options: "i" } },
      { "movie.title": { $regex: search, $options: "i" } },
      { "hall.hall_name": { $regex: search, $options: "i" } },
    ];
    return { $or: searchConditions };
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

      const matchQuery = { ...BookingController.buildFilterQuery(filters) };
      const searchQuery = BookingController.buildSearchQuery({ search });
      if (!includeDeleted || includeDeleted === "false")
        matchQuery.deletedAt = null;

      const pipeline = [
        { $match: matchQuery },

        // Lookup user
        {
          $lookup: {
            from: "users",
            localField: "userId",
            foreignField: "_id",
            as: "user",
          },
        },
        {
          $unwind: {
            path: "$user",
            preserveNullAndEmptyArrays: true,
          },
        },

        // Lookup showtime
        {
          $lookup: {
            from: "showtimes",
            localField: "showtimeId",
            foreignField: "_id",
            as: "showtime",
          },
        },
        {
          $unwind: {
            path: "$showtime",
            preserveNullAndEmptyArrays: true,
          },
        },

        // Lookup movie
        {
          $lookup: {
            from: "movies",
            localField: "showtime.movie_id",
            foreignField: "_id",
            as: "movie",
          },
        },
        {
          $unwind: {
            path: "$movie",
            preserveNullAndEmptyArrays: true,
          },
        },

        // Lookup hall
        {
          $lookup: {
            from: "halls",
            localField: "showtime.hall_id",
            foreignField: "_id",
            as: "hall",
          },
        },
        {
          $unwind: {
            path: "$hall",
            preserveNullAndEmptyArrays: true,
          },
        },
      ];

      if (search) {
        pipeline.push({ $match: searchQuery });
      }

      // Add seat processing stages after search
      pipeline.push(
        // Handle mixed seat ID types (string/ObjectId)
        {
          $addFields: {
            seatObjectIds: {
              $map: {
                input: "$seats",
                as: "s",
                in: {
                  $cond: {
                    if: { $eq: [{ $type: "$$s" }, "string"] },
                    then: { $toObjectId: "$$s" },
                    else: "$$s",
                  },
                },
              },
            },
          },
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
                    $concat: ["$row", { $toString: "$seat_number" }],
                  },
                },
              },
            ],
            as: "seats",
          },
        }
      );
      // Count total
      const totalCountResult = await Booking.aggregate([
        ...pipeline,
        { $count: "total" },
      ]);
      const totalCount = totalCountResult[0]?.total || 0;

      // Sort, skip, limit
      pipeline.push({ $sort: { [sortBy]: sortOrder === "desc" ? -1 : 1 } });
      pipeline.push({ $skip: skip }, { $limit: limitNum });

      // Project final output
      pipeline.push({
        $project: {
          user: { _id: 1, name: 1, phone: 1 },
          showtime: { _id: 1, show_date: 1, start_time: 1, end_time: 1 },
          movie: { _id: 1, title: 1, poster_url: 1, duration_minutes: 1 },
          hall: { _id: 1, hall_name: 1 },
          seats: 1,
          seat_count: 1,
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
        },
      });

      const bookings = await Booking.aggregate(pipeline);

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
      logger.error("Get all bookings error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to retrieve bookings" });
    }
  }

  // --- GET BOOKING BY ID ---
  static async getById(req, res) {
    try {
      const { id } = req.params;
      BookingController.validateObjectId(id);

      const booking = await Booking.findById(id)
        .populate("userId", "name email phone")
        .populate({
          path: "showtimeId",
          populate: [
            { path: "movie_id", select: "title poster_url duration_minutes" },
            { path: "hall_id", select: "hall_name screen_type" },
          ],
        });

      if (!booking)
        return res
          .status(404)
          .json({ success: false, message: "Booking not found" });

      // Populate seats safely
      const Seat = mongoose.model("Seat");
      const seatObjectIds = (booking.seats || [])
        .filter((id) => id && mongoose.Types.ObjectId.isValid(id.toString()))
        .map((id) => new mongoose.Types.ObjectId(id.toString()));

      const populatedSeatDocs =
        seatObjectIds.length > 0
          ? await Seat.find({
              _id: { $in: seatObjectIds },
              deletedAt: null,
            }).select("row seat_number seat_type status")
          : [];

      const populatedSeats = populatedSeatDocs.map((seat) => {
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

      res.status(200).json({ success: true, data: { booking: bookingObject } });
    } catch (error) {
      logger.error("Get booking by ID error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to retrieve booking" });
    }
  }

  // --- CREATE BOOKING ---
  static async create(req, res) {
    try {
      const {
        userId,
        showtimeId,
        seats, // Expecting an array of Seat IDs
        total_price,
        payment_method,
        noted = "",
      } = req.body;

      // 1. Validations
      if (
        !userId ||
        !showtimeId ||
        !seats ||
        !Array.isArray(seats) ||
        seats.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Missing required details: userId, showtimeId, and seats are required.",
        });
      }

      const [user, showtime] = await Promise.all([
        User.findById(userId),
        Showtime.findById(showtimeId),
      ]);

      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }
      if (!showtime) {
        return res
          .status(404)
          .json({ success: false, message: "Showtime not found" });
      }

      // Check if the showtime is active for booking
      if (!showtime.isActiveForBooking()) {
        return res.status(400).json({
          success: false,
          message:
            "This showtime is not available for booking. It might be completed, cancelled, or in the past.",
        });
      }
      const seatObjectIds = seats
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
        .map((id) => new mongoose.Types.ObjectId(id));

      if (seatObjectIds.length !== seats.length) {
        return res.status(400).json({
          success: false,
          message: "Invalid seat ID format found in request.",
        });
      }

      // 2. Check Seat Availability using SeatBooking model
      const existingSeatBookings = await SeatBooking.find({
        showtimeId: showtimeId,
        seatId: { $in: seatObjectIds },
      });

      if (existingSeatBookings.length > 0) {
        const populatedBookings = await SeatBooking.populate(
          existingSeatBookings,
          {
            path: "seatId",
            select: "row seat_number",
          }
        );
        const bookedSeatLabels = populatedBookings.map((sb) =>
          sb.seatId ? `${sb.seatId.row}${sb.seatId.seat_number}` : "UnknownSeat"
        );
        return res.status(409).json({
          success: false,
          message: `Some selected seats are already booked or locked: ${bookedSeatLabels.join(
            ", "
          )}. Please choose different seats.`,
        });
      }

      // 3. Create Booking & SeatBookings (Note: Not an atomic operation)
      const reference_code = await Booking.generateReferenceCode();
      const booking = new Booking({
        userId,
        showtimeId,
        seats: seatObjectIds,
        seat_count: seats.length,
        total_price,
        reference_code,
        payment_status: "Pending",
        booking_status: "Pending",
        payment_method,
        noted,
      });

      // Set a 15-minute expiration for the booking itself if payment is pending
      booking.expired_at = new Date(Date.now() + 15 * 60 * 1000);

      await booking.save();

      // Lock the seats by creating SeatBooking documeants
      const seatBookingDocs = seatObjectIds.map((seatId) => ({
        showtimeId,
        seatId,
        bookingId: booking._id,
        status: "locked",
        locked_until: booking.expired_at, // Align seat lock with booking expiration
      }));
      await SeatBooking.insertMany(seatBookingDocs);

      // 4. Populate and Respond
      await booking.populate([
        { path: "userId", select: "name email phone" },
        {
          path: "showtimeId",
          populate: [
            { path: "movie_id", select: "title poster_url duration_minutes" },
            { path: "hall_id", select: "hall_name screen_type" },
          ],
        },
      ]);

      res.status(201).json({
        success: true,
        message:
          "Booking created successfully. Seats are locked for 15 minutes.",
        data: { booking },
      });
    } catch (error) {
      // Note: Without a transaction, if booking.save() succeeds but SeatBooking.insertMany() fails,
      // the booking will exist without any locked seats. This would require manual cleanup.
      logger.error("Create booking error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to create booking" });
    }
  }

  // 4. UPDATE BOOKING
  static async update(req, res) {
    try {
      const { id } = req.params;
      BookingController.validateObjectId(id);

      const updateData = req.body;

      const booking = await Booking.findById(id);
      if (!booking) {
        return res
          .status(404)
          .json({ success: false, message: "Booking not found" });
      }

      const originalShowtimeId = booking.showtimeId;
      const originalSeatIds = booking.seats.map((s) => s.toString());

      // --- Handle Showtime Change ---
      if (
        updateData.showtimeId &&
        updateData.showtimeId.toString() !== booking.showtimeId.toString()
      ) {
        const newShowtime = await Showtime.findById(updateData.showtimeId);
        if (!newShowtime)
          throw new Error("The new showtime specified was not found.");
        if (!newShowtime.isActiveForBooking())
          throw new Error("The new showtime is not available for booking.");
        booking.showtimeId = newShowtime._id;
      }

      // --- Handle Seat and Other Data Changes ---
      const showtimeChanged =
        booking.showtimeId.toString() !== originalShowtimeId.toString();
      const newSeatIds = updateData.seats
        ? updateData.seats.map((s) => s.toString())
        : originalSeatIds;

      // If showtime changed OR seats changed, we need to update SeatBookings
      if (
        showtimeChanged ||
        JSON.stringify(newSeatIds) !== JSON.stringify(originalSeatIds)
      ) {
        // 1. Release all original seats from the original showtime context
        await SeatBooking.deleteMany({
          bookingId: booking._id,
          showtimeId: originalShowtimeId,
        });

        // 2. Check availability of new seats for the potentially new showtime
        if (newSeatIds.length > 0) {
          const existingBookings = await SeatBooking.find({
            showtimeId: booking.showtimeId,
            seatId: { $in: newSeatIds },
          });

          if (existingBookings.length > 0) {
            const populated = await SeatBooking.populate(existingBookings, {
              path: "seatId",
              select: "row seat_number",
            });
            const labels = populated.map((sb) =>
              sb.seatId ? `${sb.seatId.row}${sb.seatId.seat_number}` : "Unknown"
            );
            throw new Error(
              `Cannot update booking. The following seats are already taken for the showtime: ${labels.join(
                ", "
              )}`
            );
          }

          // 3. Lock the new set of seats
          const seatBookingDocs = newSeatIds.map((seatId) => ({
            showtimeId: booking.showtimeId,
            seatId,
            bookingId: booking._id,
            status: "locked",
            locked_until:
              booking.expired_at || new Date(Date.now() + 15 * 60 * 1000),
          }));
          await SeatBooking.insertMany(seatBookingDocs);
        }
      }

      // --- Apply remaining updates to the booking document ---
      Object.keys(updateData).forEach((key) => {
        booking[key] = updateData[key];
      });
      booking.seats = newSeatIds;
      booking.seat_count = newSeatIds.length;

      await booking.save();

      // Populate for response
      await booking.populate([
        { path: "userId", select: "name email phone" },
        {
          path: "showtimeId",
          populate: [
            { path: "movie_id", select: "title poster_url" },
            { path: "hall_id", select: "hall_name" },
          ],
        },
      ]);

      res.status(200).json({
        success: true,
        message: "Booking updated successfully",
        data: { booking },
      });
    } catch (error) {
      logger.error("Update booking error:", error);
      const errorMessage = error.message || "Failed to update booking";
      const statusCode = error.message.includes("already taken") ? 409 : 500;
      res.status(statusCode).json({ success: false, message: errorMessage });
    }
  }

  // 5. CANCEL BOOKING (SOFT DELETE)
  static async cancel(req, res) {
    try {
      const { id } = req.params;
      BookingController.validateObjectId(id);

      const booking = await Booking.findById(id);

      if (!booking) {
        return res
          .status(404)
          .json({ success: false, message: "Booking not found" });
      }

      if (booking.deletedAt) {
        return res
          .status(400)
          .json({ success: false, message: "Booking is already cancelled" });
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
        .json({ success: false, message: "Failed to cancel booking" });
    }
  }

  // 6. RESTORE DELETED BOOKING
  static async restore(req, res) {
    try {
      const { id } = req.params;
      BookingController.validateObjectId(id);

      const booking = await Booking.findByIdAndUpdate(
        id,
        { deletedAt: null },
        { new: true }
      );

      if (!booking) {
        return res
          .status(404)
          .json({ success: false, message: "Booking not found" });
      }

      res.status(200).json({
        success: true,
        message: "Booking restored successfully",
        data: { booking },
      });
    } catch (error) {
      logger.error("Restore booking error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to restore booking" });
    }
  }

  // 7. FORCE DELETE BOOKING
  static async forceDelete(req, res) {
    try {
      const { id } = req.params;
      BookingController.validateObjectId(id);

      // Find the booking first to ensure it exists
      const booking = await Booking.findById(id);
      if (!booking) {
        return res
          .status(404)
          .json({ success: false, message: "Booking not found" });
      }

      // Delete associated SeatBooking records
      const { deletedCount: sbDeletedCount } = await SeatBooking.deleteMany({
        bookingId: id,
      });
      logger.info(
        `Deleted ${sbDeletedCount} SeatBooking records for permanently deleted booking ID: ${id}`
      );

      // Perform permanent deletion of the Booking
      await Booking.findByIdAndDelete(id);

      res.status(200).json({
        success: true,
        message: "Booking permanently deleted",
      });
    } catch (error) {
      logger.error("Force delete booking error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to permanently delete booking",
      });
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

      const query = { deletedAt: { $ne: null } };

      const totalCount = await Booking.countDocuments(query);

      const bookings = await Booking.find(query)
        .populate("userId", "username email phone")
        .populate({
          path: "showtimeId",
          populate: [
            { path: "movie_id", select: "title poster_url" },
            { path: "hall_id", select: "hall_name" },
          ],
        })
        .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
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
      res.status(500).json({
        success: false,
        message: "Failed to retrieve deleted bookings",
      });
    }
  }

  // 9. GET BOOKING ANALYTICS
  static async getAnalytics(req, res) {
    try {
      const totalBookings = await Booking.countDocuments({ deletedAt: null });
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
        { $match: { payment_status: "Completed", deletedAt: null } },
        { $group: { _id: null, total: { $sum: "$total_price" } } },
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
      res.status(500).json({
        success: false,
        message: "Failed to retrieve booking analytics",
      });
    }
  }

  // 10. GET BOOKING BY REFERENCE CODE
  static async getByReferenceCode(req, res) {
    try {
      const { reference_code } = req.params;
      if (!reference_code) {
        return res
          .status(400)
          .json({ success: false, message: "Reference code is required" });
      }

      const booking = await Booking.findByReferenceCode(reference_code)
        .populate("userId", "username email phone")
        .populate({
          path: "showtimeId",
          populate: [
            { path: "movie_id", select: "title poster_url duration_minutes" },
            { path: "hall_id", select: "hall_name screen_type" },
          ],
        });

      if (!booking) {
        return res
          .status(404)
          .json({ success: false, message: "Booking not found" });
      }

      // Optional: Check if the booking is expired and update status if needed
      if (
        booking.isExpired() &&
        booking.booking_status === "Confirmed" &&
        booking.payment_status === "Pending"
      ) {
        await booking.cancelBooking(
          "Found expired while fetching by reference"
        );
      }

      res.status(200).json({
        success: true,
        data: { booking },
      });
    } catch (error) {
      logger.error("Get booking by reference code error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to retrieve booking" });
    }
  }

  // 11. CANCEL A BOOKING (USER)
  static async cancelUserBooking(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id; // from auth middleware

      BookingController.validateObjectId(id);

      const booking = await Booking.findById(id);

      if (!booking) {
        return res
          .status(404)
          .json({ success: false, message: "Booking not found" });
      }

      // Ensure the booking belongs to the user trying to cancel it
      if (booking.userId.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: You cannot cancel this booking",
        });
      }

      if (booking.booking_status === "Cancelled") {
        return res
          .status(400)
          .json({ success: false, message: "Booking is already cancelled" });
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
        .json({ success: false, message: "Failed to cancel your booking" });
    }
  }
}

module.exports = BookingController;
