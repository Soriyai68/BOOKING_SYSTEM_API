const mongoose = require("mongoose");
const { Booking, Showtime, User } = require("../models");
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

  // 1. GET ALL BOOKINGS
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

      if (!includeDeleted || includeDeleted === "false") {
        matchQuery.deletedAt = null;
      }

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
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },

        // Lookup showtime
        {
          $lookup: {
            from: "showtimes",
            localField: "showtimeId",
            foreignField: "_id",
            as: "showtime",
          },
        },
        { $unwind: { path: "$showtime", preserveNullAndEmptyArrays: true } },

        // Lookup movie from showtime
        {
          $lookup: {
            from: "movies",
            localField: "showtime.movie_id",
            foreignField: "_id",
            as: "movie",
          },
        },
        { $unwind: { path: "$movie", preserveNullAndEmptyArrays: true } },

        // Lookup hall from showtime
        {
          $lookup: {
            from: "halls",
            localField: "showtime.hall_id",
            foreignField: "_id",
            as: "hall",
          },
        },
        { $unwind: { path: "$hall", preserveNullAndEmptyArrays: true } },
      ];

      // Optional search on reference code or user name
      if (search) {
        pipeline.push({
          $match: {
            $or: [
              { reference_code: { $regex: search, $options: "i" } },
              { "user.username": { $regex: search, $options: "i" } },
              { "user.email": { $regex: search, $options: "i" } },
            ],
          },
        });
      }

      // Count total
      const totalCountResult = await Booking.aggregate([
        ...pipeline,
        { $count: "total" },
      ]);
      const totalCount = totalCountResult[0]?.total || 0;

      // Sort, skip, limit
      pipeline.push({ $sort: { [sortBy]: sortOrder === "desc" ? -1 : 1 } });
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limitNum });

      // Project
      pipeline.push({
        $project: {
          user: { _id: 1, username: 1, email: 1, phone: 1 },
          showtime: { _id: 1, show_date: 1, start_time: 1, end_time: 1 },
          movie: { _id: 1, title: 1, poster_url: 1 },
          hall: { _id: 1, hall_name: 1 },
          reference_code: 1,
          total_price: 1,
          seat_count: 1,
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
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      res.status(200).json({
        success: true,
        data: {
          bookings,
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
      logger.error("Get all bookings error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to retrieve bookings" });
    }
  }

  // 2. GET BOOKING BY ID
  static async getById(req, res) {
    try {
      const { id } = req.params;
      if (!id) {
        return res
          .status(400)
          .json({ success: false, message: "Booking ID is required" });
      }

      BookingController.validateObjectId(id);

      const booking = await Booking.findById(id)
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

      res.status(200).json({
        success: true,
        data: { booking },
      });
    } catch (error) {
      logger.error("Get booking by ID error:", error);
      if (error.message === "Invalid Booking ID format") {
        return res.status(400).json({ success: false, message: error.message });
      }
      res
        .status(500)
        .json({ success: false, message: "Failed to retrieve booking" });
    }
  }

  // 3. CREATE BOOKING
  static async create(req, res) {
    try {
      const {
        userId,
        showtimeId,
        total_price,
        seat_count,
        reference_code,
        payment_id,
        payment_status,
        booking_status,
        expired_at,
        noted,
      } = req.body;

      // Validate user exists
      const user = await User.findById(userId);
      if (!user) {
        return res
          .status(404)
          .json({ success: false, message: "User not found" });
      }

      // Validate showtime exists
      const showtime = await Showtime.findById(showtimeId);
      if (!showtime) {
        return res
          .status(404)
          .json({ success: false, message: "Showtime not found" });
      }

      // Check if reference code already exists
      const existingBooking = await Booking.findOne({ reference_code });
      if (existingBooking) {
        return res
          .status(400)
          .json({ success: false, message: "Reference code already exists" });
      }

      const booking = new Booking({
        userId,
        showtimeId,
        total_price,
        seat_count,
        reference_code,
        payment_id,
        payment_status: payment_status || "Pending",
        booking_status: booking_status || "Confirmed",
        expired_at,
        noted: noted || "",
      });

      await booking.save();

      const populatedBooking = await Booking.findById(booking._id)
        .populate("userId", "username email phone")
        .populate({
          path: "showtimeId",
          populate: [
            { path: "movie_id", select: "title poster_url" },
            { path: "hall_id", select: "hall_name" },
          ],
        });

      res.status(201).json({
        success: true,
        message: "Booking created successfully",
        data: { booking: populatedBooking },
      });
    } catch (error) {
      logger.error("Create booking error:", error);
      if (error.code === 11000) {
        return res
          .status(400)
          .json({ success: false, message: "Reference code already exists" });
      }
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

      const updateData = { ...req.body };
      delete updateData._id;
      delete updateData.createdAt;

      const booking = await Booking.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      )
        .populate("userId", "username email phone")
        .populate({
          path: "showtimeId",
          populate: [
            { path: "movie_id", select: "title poster_url" },
            { path: "hall_id", select: "hall_name" },
          ],
        });

      if (!booking) {
        return res
          .status(404)
          .json({ success: false, message: "Booking not found" });
      }

      res.status(200).json({
        success: true,
        message: "Booking updated successfully",
        data: { booking },
      });
    } catch (error) {
      logger.error("Update booking error:", error);
      if (error.message === "Invalid Booking ID format") {
        return res.status(400).json({ success: false, message: error.message });
      }
      res
        .status(500)
        .json({ success: false, message: "Failed to update booking" });
    }
  }

  // 5. SOFT DELETE BOOKING
  static async delete(req, res) {
    try {
      const { id } = req.params;
      BookingController.validateObjectId(id);

      const booking = await Booking.findByIdAndUpdate(
        id,
        { deletedAt: new Date() },
        { new: true }
      );

      if (!booking) {
        return res
          .status(404)
          .json({ success: false, message: "Booking not found" });
      }

      res.status(200).json({
        success: true,
        message: "Booking deleted successfully",
      });
    } catch (error) {
      logger.error("Delete booking error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to delete booking" });
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

      const booking = await Booking.findByIdAndDelete(id);

      if (!booking) {
        return res
          .status(404)
          .json({ success: false, message: "Booking not found" });
      }

      res.status(200).json({
        success: true,
        message: "Booking permanently deleted",
      });
    } catch (error) {
      logger.error("Force delete booking error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to permanently delete booking" });
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
      res
        .status(500)
        .json({ success: false, message: "Failed to retrieve deleted bookings" });
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
      res
        .status(500)
        .json({ success: false, message: "Failed to retrieve booking analytics" });
    }
  }
}

module.exports = BookingController;
