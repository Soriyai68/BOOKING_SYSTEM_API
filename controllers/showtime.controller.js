const mongoose = require("mongoose");
const { Theater, Hall, Movie, Showtime } = require("../models");
const { Role } = require("../data");
const logger = require("../utils/logger");

class ShowtimeController {
  // Helper method to validate ObjectId
  static validateObjectId(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("Invalid Showtime ID format");
    }
  }
  // Build search query
  static async buildSearchQuery(search) {
    if (!search) return {};
    return {
      $or: [
        { language: { $regex: search, $options: "i" } },
        { subtitle: { $regex: search, $options: "i" } },
        { "movie.title": { $regex: search, $options: "i" } },
      ],
    };
  }

  // Build filter query
  static buildFilterQuery(filters) {
    const query = {};
    if (filters.status) query.status = filters.status;
    if (filters.movie_id) query.movie_id = filters.movie_id;
    if (filters.hall_id) query.hall_id = filters.hall_id;
    if (filters.theater_id) query.theater_id = filters.theater_id;

    // Date range
    if (filters.dateFrom || filters.dateTo) {
      query.start_time = {};
      if (filters.dateFrom) query.start_time.$gte = new Date(filters.dateFrom);
      if (filters.dateTo) query.start_time.$lte = new Date(filters.dateTo);
    }

    return query;
  }

  // 1. GET ALL SHOWTIMES - with pagination, filtering, and sorting
  static async getAll(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = "start_time",
        sortOrder = "asc",
        search,
        includeDeleted = false,
        ...filters
      } = req.query;

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      const matchQuery = { ...ShowtimeController.buildFilterQuery(filters) };

      // // Handle soft deleted records
      if (!includeDeleted || includeDeleted === "false") {
        matchQuery.deletedAt = null;
      }
      // Aggregation pipeline
      const pipeline = [
        { $match: matchQuery },

        // Lookup movie
        {
          $lookup: {
            from: "movies",
            localField: "movie_id",
            foreignField: "_id",
            as: "movie",
          },
        },
        { $unwind: "$movie" },
        { $match: { "movie.deletedAt": null } },

        // Lookup hall
        {
          $lookup: {
            from: "halls",
            localField: "hall_id",
            foreignField: "_id",
            as: "hall",
          },
        },
        { $unwind: "$hall" },
        { $match: { "hall.deletedAt": null } },

        // Lookup theater
        {
          $lookup: {
            from: "theaters",
            localField: "theater_id",
            foreignField: "_id",
            as: "theater",
          },
        },
        { $unwind: "$theater" },
        { $match: { "theater.deletedAt": null } },
      ];

      // Search (simple $regex, case-insensitive)
      if (search) {
        pipeline.push({
          $match: {
            $or: [
              { language: { $regex: search, $options: "i" } },
              { subtitle: { $regex: search, $options: "i" } },
              { "movie.title": { $regex: search, $options: "i" } },
            ],
          },
        });
      }

      // Count total
      const totalCountResult = await Showtime.aggregate([
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
        // Select only the necessary fields for the response
        $project: {
          movie: { _id: 1, title: 1, poster_url: 1 },
          hall: { _id: 1, hall_name: 1, screen_type: 1 },
          theater: { _id: 1, name: 1, province: 1, city: 1 },
          start_time: 1,
          end_time: 1,
          language: 1,
          subtitle: 1,
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
      res.status(500).json({
        success: false,
        message: "Failed to retrieve showtimes",
      });
    }
  }

  // 2. GET SHOWTIME BY ID
  static async getById(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: "Showtime ID is required",
        });
      }
      ShowtimeController.validateObjectId(id);
      // Aggregation pipeline
      const showtimeResult = await Showtime.aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(id) } },

        // Lookup movie
        {
          $lookup: {
            from: "movies",
            localField: "movie_id",
            foreignField: "_id",
            as: "movie",
          },
        },
        { $unwind: "$movie" },
        { $match: { "movie.deletedAt": null } }, // active movies only

        // Lookup hall
        {
          $lookup: {
            from: "halls",
            localField: "hall_id",
            foreignField: "_id",
            as: "hall",
          },
        },
        { $unwind: "$hall" },
        { $match: { "hall.deletedAt": null } }, // active hall online

        // Lookup theater
        {
          $lookup: {
            from: "theaters",
            localField: "theater_id",
            foreignField: "_id",
            as: "theater",
          },
        },
        { $unwind: "$theater" },
        { $match: { "theater.deletedAt": null } }, // active theater only
        {
          // Select only the necessary fields for the response
          $project: {
            movie: { _id: 1, title: 1, poster_url: 1 },
            hall: { _id: 1, hall_name: 1, screen_type: 1 },
            theater: { _id: 1, name: 1, province: 1, city: 1 },
            start_time: 1,
            end_time: 1,
            language: 1,
            subtitle: 1,
            status: 1,
            createdAt: 1,
          },
        },
      ]);
      if (!showtimeResult || showtimeResult.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Showtime not found or references are deleted",
        });
      }

      const showtime = await showtimeResult[0];
      if (!showtime) {
        return res.status(404).json({
          success: false,
          message: "Showwtime not found",
        });
      }
      logger.info(`Retrieved showtime by ID: ${id}`);

      res.status(200).json({
        success: true,
        data: { showtime },
      });
    } catch (error) {
      if (error.message === "Invalid ID format") {
        return res.status(400).json({
          success: false,
          message: error.message,
        });
      }
      logger.error("Get showtime by ID error:", error);

      res.status(500).json({
        success: false,
        message: "Failed to retrieve showtime",
      });
    }
  }
  // 3. CREATE SHOWTIME
  static async create(req, res) {
    try {
      const showTimeData = req.body;
      const { movie_id, hall_id, theater_id, start_time, end_time } =
        showTimeData;

      // Basic validation
      if (!movie_id || !hall_id || !theater_id || !start_time || !end_time) {
        return res.status(400).json({
          success: false,
          message:
            "movie_id, hall_id, theater_id, start_time, and end_time are required.",
        });
      }

      // Check if referenced documents exist and are active
      const [movie, hall, theater] = await Promise.all([
        Movie.findOne({ _id: movie_id, deletedAt: null }),
        Hall.findOne({ _id: hall_id, deletedAt: null }),
        Theater.findOne({ _id: theater_id, deletedAt: null }),
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
      if (!theater) {
        return res.status(404).json({
          success: false,
          message: "Theater not found or has been deleted.",
        });
      }

      // Check for overlapping showtimes
      const overlapping = await Showtime.findOverlappingShowtimes(
        hall_id,
        new Date(start_time),
        new Date(end_time)
      );

      if (overlapping.length > 0) {
        return res.status(409).json({
          success: false,
          message:
            "This showtime overlaps with an existing showtime in the same hall.",
          data: { overlappingShowtimes: overlapping },
        });
      }

      // Prepare and save the new showtime
      const showtimeToCreate = { ...showTimeData };
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
        data: { showtime },
      });
    } catch (error) {
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
      const { id } = req.params;
      const updateData = req.body;

      ShowtimeController.validateObjectId(id);

      // Sanitize update data
      delete updateData._id;
      delete updateData.createdAt;
      delete updateData.updatedAt;
      delete updateData.deletedAt;
      delete updateData.deletedBy;
      delete updateData.restoredAt;
      delete updateData.restoredBy;

      // Add updater info
      if (req.user) {
        updateData.updatedBy = req.user.userId;
      }

      // If timing or hall is changing, we must check for overlaps
      const OverlapCheck =
        updateData.start_time || updateData.end_time || updateData.hall_id;
      if (OverlapCheck) {
        const originalShowtime = await Showtime.findById(id).lean();
        if (!originalShowtime) {
          return res
            .status(404)
            .json({ success: false, message: "Showtime not found" });
        }

        const hallId = updateData.hall_id || originalShowtime.hall_id;
        const startTime =
          new Date(updateData.start_time) ||
          new Date(originalShowtime.start_time);
        const endTime =
          new Date(updateData.end_time) || new Date(originalShowtime.end_time);

        const overlapping = await Showtime.findOverlappingShowtimes(
          hallId,
          startTime,
          endTime,
          id
        );
        if (overlapping.length > 0) {
          return res.status(409).json({
            success: false,
            message:
              "The updated showtime overlaps with an existing showtime in the same hall.",
            data: { overlappingShowtimes: overlapping },
          });
        }
      }

      const showtime = await Showtime.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      });

      if (!showtime) {
        return res
          .status(404)
          .json({ success: false, message: "Showtime not found" });
      }

      logger.info(`Updated showtime: ${id}`);
      res.status(200).json({
        success: true,
        message: "Showtime updated successfully",
        data: { showtime },
      });
    } catch (error) {
      if (error.name === "ValidationError") {
        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors: error.message,
        });
      }
      logger.error("Update showtime error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to update showtime" });
    }
  }

  // 5. SOFT DELETE SHOWTIME
  static async delete(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: "Showtime ID is required",
        });
      }
      ShowtimeController.validateObjectId(id);

      const showtime = await Showtime.findById(id);
      if (!showtime) {
        return res
          .status(404)
          .json({ success: false, message: "Showtime not found" });
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
        data: { showtime },
      });
    } catch (error) {
      logger.error("Delete showtime error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to deactivate showtime" });
    }
  }

  // 6. RESTORE SHOWTIME
  static async restore(req, res) {
    try {
      const { id } = req.params;
      ShowtimeController.validateObjectId(id);

      // Find among deleted documents
      const showtime = await Showtime.findOne({
        _id: id,
        deletedAt: { $ne: null },
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
        showtime.start_time,
        showtime.end_time,
        showtime._id // Exclude itself from the check
      );

      if (overlapping.length > 0) {
        return res.status(409).json({
          success: false,
          message:
            "Cannot restore showtime because it overlaps with an existing active showtime.",
          data: { overlappingShowtimes: overlapping },
        });
      }

      await showtime.restore(req.user?.userId);

      logger.info(`Restored showtime: ${id}`);
      res.status(200).json({
        success: true,
        message: "Showtime restored successfully",
        data: { showtime },
      });
    } catch (error) {
      logger.error("Restore showtime error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to restore showtime" });
    }
  }

  // 7. FORCE DELETE SHOWTIME (Permanent)
  static async forceDelete(req, res) {
    try {
      const { id } = req.params;
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
          .json({ success: false, message: "Showtime not found" });
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
      await Showtime.findByIdAndDelete(id);

      logger.warn(
        `⚠️ PERMANENT DELETION: Showtime permanently deleted by ${req.user.role} ${req.user.userId}`,
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
      const sortObj = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

      const [showtimes, totalCount] = await Promise.all([
        Showtime.find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum)
          .populate({ path: "movie_id", select: "title" })
          .populate({ path: "hall_id", select: "hall_name" })
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
      const { id } = req.params;
      const { status } = req.body;

      ShowtimeController.validateObjectId(id);

      if (!status) {
        return res
          .status(400)
          .json({ success: false, message: "Status is required" });
      }

      const showtime = await Showtime.findById(id);
      if (!showtime) {
        return res
          .status(404)
          .json({ success: false, message: "Showtime not found" });
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
        data: { showtime: updatedShowtime },
      });
    } catch (error) {
      if (error.message === "Invalid showtime ID format") {
        return res.status(400).json({ success: false, message: error.message });
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
        .json({ success: false, message: "Failed to update showtime status" });
    }
  }

  // 10. GET SHOWTIME ANALYTICS
  static async getAnalytics(req, res) {
    try {
      const analytics = await Showtime.getAnalytics(req.query);
      logger.info("Retrieved showtime analytics");
      res.status(200).json({
        success: true,
        data: { analytics },
      });
    } catch (error) {
      logger.error("Get showtime analytics error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve showtime analytics",
      });
    }
  }
}
module.exports = ShowtimeController;
