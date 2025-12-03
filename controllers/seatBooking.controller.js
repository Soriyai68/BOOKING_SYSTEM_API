const mongoose = require("mongoose");
const {
  Showtime,
  Seat,
  SeatBooking,
  SeatBookingHistory,
} = require("../models");
const logger = require("../utils/logger");

class SeatBookingController {
  // Helper method to validate ObjectId
  static validateObjectId(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("Invalid ID format");
    }
  }

  // Helper method for search and filter
  static filterBuilder(query) {
    const filter = {};
    const { showtimeId, seatId, bookingId, status, seat_type } = query;

    if (showtimeId) {
      SeatBookingController.validateObjectId(showtimeId);
      filter.showtimeId = new mongoose.Types.ObjectId(showtimeId);
    }
    if (seatId) {
      SeatBookingController.validateObjectId(seatId);
      filter.seatId = new mongoose.Types.ObjectId(seatId);
    }

    if (bookingId) {
      SeatBookingController.validateObjectId(bookingId);
      filter.bookingId = new mongoose.Types.ObjectId(bookingId);
    }
    if (status) {
      filter.status = status;
    }
    return { filter, seat_type };
  }

  static searchBuilder(query) {
    const { search } = query;
    if (!search) {
      return {};
    }

    const searchConditions = [];
    // Search in movie title (via showtime)
    searchConditions.push({
      "showtimeId.movie_id.title": { $regex: search, $options: "i" },
    });
    // Search in seat identifier (concatenation of row and number)
    searchConditions.push({
      "seatId.seat_identifier": { $regex: search, $options: "i" },
    });
    // Search in seat number
    // searchConditions.push({
    //     'seatId.seat_number': {$regex: search, $options: 'i'},
    // });
    // Search in booking reference code
    searchConditions.push({
      "bookingId.reference_code": { $regex: search, $options: "i" },
    });

    // If the search term is a valid ObjectId, search by IDs directly
    if (mongoose.Types.ObjectId.isValid(search)) {
      const objectId = new mongoose.Types.ObjectId(search);
      searchConditions.push({ "showtimeId._id": objectId });
      searchConditions.push({ "seatId._id": objectId });
      searchConditions.push({ "bookingId._id": objectId });
    }

    return { $or: searchConditions };
  }

  // 1. GET ALL SEAT BOOKINGS
  static async getAll(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        sortOrder = "desc",
        search,
        ...filterParams // Capture all other query parameters for filtering
      } = req.query;

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;
      const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

      const { filter: initialFilter, seat_type } =
        SeatBookingController.filterBuilder(filterParams);
      const searchFilter = SeatBookingController.searchBuilder({ search });

      const pipeline = [
        // Apply initial filters first on the original document fields
        { $match: initialFilter },

        // Lookup Showtime
        {
          $lookup: {
            from: "showtimes",
            localField: "showtimeId",
            foreignField: "_id",
            as: "showtimeId",
          },
        },
        { $unwind: { path: "$showtimeId", preserveNullAndEmptyArrays: true } },

        // Lookup Movie from Showtime
        {
          $lookup: {
            from: "movies",
            localField: "showtimeId.movie_id",
            foreignField: "_id",
            as: "showtimeId.movie_id",
          },
        },
        {
          $unwind: {
            path: "$showtimeId.movie_id",
            preserveNullAndEmptyArrays: true,
          },
        },

        // Lookup Seat
        {
          $lookup: {
            from: "seats",
            localField: "seatId",
            foreignField: "_id",
            as: "seatId",
          },
        },
        { $unwind: { path: "$seatId", preserveNullAndEmptyArrays: true } },
        // Lookup Booking
        {
          $lookup: {
            from: "bookings",
            localField: "bookingId",
            foreignField: "_id",
            as: "bookingId",
          },
        },
        { $unwind: { path: "$bookingId", preserveNullAndEmptyArrays: true } },

        // Lookup User from Booking
        {
          $lookup: {
            from: "users",
            localField: "bookingId.userId",
            foreignField: "_id",
            as: "bookingId.userId",
          },
        },
        {
          $unwind: {
            path: "$bookingId.userId",
            preserveNullAndEmptyArrays: true,
          },
        },

        // Add seat_identifier for searching and display
        {
          $addFields: {
            "seatId.seat_identifier": {
              $concat: [
                { $toString: "$seatId.row" },
                { $toString: "$seatId.seat_number" },
              ],
            },
          },
        },
      ];

      if (search) {
        pipeline.push({ $match: searchFilter });
      }
      if (seat_type) {
        pipeline.push({
          $match: { "seatId.seat_type": seat_type },
        });
      }
      const [seatBookings, totalCountResult] = await Promise.all([
        SeatBooking.aggregate([
          ...pipeline,
          { $sort: sort },
          { $skip: skip },
          { $limit: limitNum },
          // Project to shape the output similar to populate for consistency if needed
          {
            $project: {
              _id: 1,
              status: 1,
              locked_until: 1,
              createdAt: 1,
              updatedAt: 1,
              showtimeId: {
                _id: "$showtimeId._id",
                show_date: "$showtimeId.show_date",
                start_time: "$showtimeId.start_time",
                end_time: "$showtimeId.end_time",
                status: "$showtimeId.status",
                movie_id: {
                  _id: "$showtimeId.movie_id._id",
                  title: "$showtimeId.movie_id.title",
                },
              },
              seatId: {
                _id: "$seatId._id",
                row: "$seatId.row",
                seat_number: "$seatId.seat_number",
                seat_type: "$seatId.seat_type",
                seat_identifier: "$seatId.seat_identifier",
              },
              bookingId: {
                _id: "$bookingId._id",
                reference_code: "$bookingId.reference_code",
                status: "$bookingId.status",
                userId: {
                  _id: "$bookingId.userId._id",
                  name: "$bookingId.userId.name",
                  phone: "$bookingId.userId.phone",
                },
              },
            },
          },
        ]),
        SeatBooking.aggregate([...pipeline, { $count: "total" }]),
      ]);

      const totalCount =
        totalCountResult.length > 0 ? totalCountResult[0].total : 0;
      const totalPages = Math.ceil(totalCount / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      res.status(200).json({
        success: true,
        data: {
          seatBookings: seatBookings, // Aggregation already returns desired structure
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
      logger.error("Get all seat bookings error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to retrieve seat bookings" });
    }
  }

  // 2. GET SEAT STATUS FOR A SHOWTIME
  static async getShowtimeSeatStatus(req, res) {
    try {
      const { id } = req.params;
      SeatBookingController.validateObjectId(id);

      const showtime = await Showtime.findById(id).populate("hall_id");
      if (!showtime) {
        return res
          .status(404)
          .json({ success: false, message: "Showtime not found" });
      }

      const hall = showtime.hall_id;
      if (!hall) {
        return res.status(404).json({
          success: false,
          message: "Hall for this showtime not found",
        });
      }

      // 1. Get all seats for the hall
      const allSeats = await Seat.find({
        hall_id: hall._id,
        deletedAt: null,
      }).lean();

      // 2. Get all seat bookings for the showtime
      const seatBookings = await SeatBooking.find({ showtimeId: id }).lean();

      // 3. Create a map of seatId -> status for quick lookup
      const seatStatusMap = new Map(
        seatBookings.map((sb) => [sb.seatId.toString(), sb.status])
      );

      // 4. Map final status to each seat
      const seatsWithStatus = allSeats.map((seat) => {
        const physicalSeatStatus = seat.status;
        const bookingStatus = seatStatusMap.get(seat._id.toString());

        let finalStatus = "available";

        if (physicalSeatStatus !== "active") {
          finalStatus = physicalSeatStatus;
        } else if (bookingStatus) {
          finalStatus = bookingStatus;
        }

        return {
          ...seat,
          status: finalStatus,
        };
      });

      res.status(200).json({
        success: true,
        data: {
          showtime: {
            _id: showtime._id,
            show_date: showtime.show_date,
            start_time: showtime.start_time,
            // UPGRADE: Add a flag to indicate if booking is still possible
            isBookable: showtime.isActiveForBooking(),
          },
          hall: {
            _id: hall._id,
            hall_name: hall.hall_name,
            screen_type: hall.screen_type,
          },
          seats: seatsWithStatus,
        },
      });
    } catch (error) {
      logger.error("Get showtime seat status error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to retrieve seat status" });
    }
  }

  // 3. GET RAW SEAT BOOKINGS FOR A SHOWTIME (Admin only)
  static async getSeatBookingsForShowtime(req, res) {
    try {
      const { id } = req.params;
      SeatBookingController.validateObjectId(id);

      const seatBookings = await SeatBooking.find({ showtimeId: id })
        .populate({
          path: "seatId",
          select: "row seat_number seat_type",
          options: { virtuals: true },
        })
        .populate({
          path: "bookingId",
          select: "reference_code userId",
          populate: {
            path: "userId",
            select: "name phone",
          },
        })
        .lean();

      if (!seatBookings || seatBookings.length === 0) {
        return res.status(200).json({
          success: true,
          data: {
            count: 0,
            seatBookings: [],
          },
        });
      }

      res.status(200).json({
        success: true,
        data: {
          count: seatBookings.length,
          seatBookings,
        },
      });
    } catch (error) {
      logger.error("Get seat bookings for showtime error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to retrieve seat bookings" });
    }
  }

  // 4. LOCK SEATS FOR BOOKING (Non-Transactional)
  static async lockSeatsForBooking(req, res) {
    try {
      const { showtimeId, seatIds } = req.body;

      if (!showtimeId || !Array.isArray(seatIds) || seatIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Showtime ID and an array of seat IDs are required.",
        });
      }

      // 1. Validate showtime
      const showtime = await Showtime.findById(showtimeId);
      if (!showtime) {
        return res
          .status(404)
          .json({ success: false, message: "Showtime not found." });
      }
      if (!showtime.isActiveForBooking()) {
        return res.status(400).json({
          success: false,
          message:
            "This showtime is not available for booking. It might be completed, cancelled, or its start time has already passed.",
        });
      }

      // 2. Validate seats
      const seats = await Seat.find({
        _id: { $in: seatIds },
        hall_id: showtime.hall_id,
        deletedAt: null,
      }).sort({ seat_number: "asc" });
      if (seats.length !== seatIds.length) {
        return res.status(404).json({
          success: false,
          message:
            "One or more seats not found or do not belong to the correct hall.",
        });
      }
      // Extended Validation Rules
      // Rule 1: Max 10 seats per booking.
      if (seatIds.length > 10) {
        return res.status(400).json({
          success: false,
          message: "A maximum of 10 seats can be booked at a time.",
        });
      }

      if (seats.length > 1) {
        // Rule 2: All seats must be in the same row.
        const firstSeatRow = seats[0].row;
        if (!seats.every((seat) => seat.row === firstSeatRow)) {
          return res.status(400).json({
            success: false,
            message: "All selected seats must be in the same row.",
          });
        }

        // Rule 3: No gaps between selected seats.
        for (let i = 0; i < seats.length - 1; i++) {
          if (seats[i].seat_number + 1 !== seats[i + 1].seat_number) {
            return res.status(400).json({
              success: false,
              message:
                "Seats must be continuous. No gaps are allowed between selected seats.",
            });
          }
        }
      }
      const unavailablePhysicalSeats = seats.filter(
        (seat) => seat.status !== "active"
      );
      if (unavailablePhysicalSeats.length > 0) {
        const seatIdentifiers = unavailablePhysicalSeats
          .map((s) => s.seat_identifier)
          .join(", ");
        return res.status(409).json({
          success: false,
          message: `The following seats are not available: ${seatIdentifiers}.`,
        });
      }

      // 3. Check for existing bookings (note: race condition exists here, handled by DB unique index)
      const existingSeatBookings = await SeatBooking.find({
        showtimeId,
        seatId: { $in: seatIds },
      });
      if (existingSeatBookings.length > 0) {
        return res.status(409).json({
          success: false,
          message: "One or more selected seats are already booked or locked.",
        });
      }

      // 4. Create seat lock documents
      const lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes lock
      const seatBookingDocs = seatIds.map((seatId) => ({
        showtimeId,
        seatId,
        status: "locked",
        locked_until: lockUntil,
      }));

      const newSeatBookings = await SeatBooking.insertMany(seatBookingDocs);

      res.status(201).json({
        success: true,
        message: "Seats locked successfully.",
        data: {
          lockedUntil: lockUntil.toISOString(),
          lockedSeats: newSeatBookings,
        },
      });
    } catch (error) {
      // Handle potential race condition caught by unique index
      if (error.code === 11000) {
        // Duplicate key error
        logger.warn("Seat lock race condition detected:", error.message);
        return res.status(409).json({
          success: false,
          message:
            "One or more selected seats were just booked by another user. Please try again.",
        });
      }
      logger.error("Lock seats error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to lock seats." });
    }
  }

  // 5. EXTEND SEAT LOCK (Non-Transactional)
  static async extendSeatLock(req, res) {
    try {
      const { seatBookingIds } = req.body;

      if (!Array.isArray(seatBookingIds) || seatBookingIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "An array of seatBookingIds is required.",
        });
      }

      const seatBookings = await SeatBooking.find({
        _id: { $in: seatBookingIds },
        status: "locked",
      });

      if (seatBookings.length !== seatBookingIds.length) {
        return res.status(404).json({
          success: false,
          message:
            "One or more seat locks not found, have expired, or are already booked.",
        });
      }

      const newLockUntil = new Date(Date.now() + 15 * 60 * 1000); // Extend for another 15 minutes

      // This update is not atomic for all documents, but it's acceptable for this feature.
      const updatePromises = seatBookings.map((sb) => {
        sb.locked_until = newLockUntil;
        return sb.save();
      });

      await Promise.all(updatePromises);

      res.status(200).json({
        success: true,
        message: "Seat locks extended successfully.",
        data: {
          lockedUntil: newLockUntil.toISOString(),
          seatBookingIds,
        },
      });
    } catch (error) {
      logger.error("Extend seat lock error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to extend seat locks." });
    }
  }

  // --- Seat Booking History ---

  // Helper method for history search and filter
  static historyFilterBuilder(query) {
    const filter = {};
    const { showtimeId, seatId, bookingId, action, seat_type } = query;

    if (showtimeId) {
      SeatBookingController.validateObjectId(showtimeId);
      filter.showtimeId = new mongoose.Types.ObjectId(showtimeId);
    }
    if (seatId) {
      SeatBookingController.validateObjectId(seatId);
      filter.seatId = new mongoose.Types.ObjectId(seatId);
    }
    if (bookingId) {
      SeatBookingController.validateObjectId(bookingId);
      filter.bookingId = new mongoose.Types.ObjectId(bookingId);
    }
    if (action) {
      filter.action = action;
    }
    return { filter, seat_type };
  }

  static historySearchBuilder(query) {
    const { search } = query;
    if (!search) {
      return {};
    }

    const searchConditions = [];
    // Search in movie title (via showtime)
    searchConditions.push({
      "showtime.movie.title": { $regex: search, $options: "i" },
    });
    // Search in seat identifier (concatenation of row and number)
    searchConditions.push({
      "seat.seat_identifier": { $regex: search, $options: "i" },
    });
    // Search in booking reference code
    searchConditions.push({
      "booking.reference_code": { $regex: search, $options: "i" },
    });

    // If the search term is a valid ObjectId, search by IDs directly
    if (mongoose.Types.ObjectId.isValid(search)) {
      const objectId = new mongoose.Types.ObjectId(search);
      searchConditions.push({ showtimeId: objectId });
      searchConditions.push({ seatId: objectId });
      searchConditions.push({ bookingId: objectId });
    }

    return { $or: searchConditions };
  }

  // 6. GET ALL SEAT BOOKING HISTORIES
  static async getHistory(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        sortOrder = "desc",
        search,
        ...filterParams
      } = req.query;

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;
      const sort = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

      const { filter: initialFilter, seat_type } =
        SeatBookingController.historyFilterBuilder(filterParams);

      const pipeline = [
        { $match: initialFilter },
        // Lookup Showtime
        {
          $lookup: {
            from: "showtimes",
            localField: "showtimeId",
            foreignField: "_id",
            as: "showtime",
          },
        },
        { $unwind: { path: "$showtime", preserveNullAndEmptyArrays: true } },
        // Lookup Movie from Showtime
        {
          $lookup: {
            from: "movies",
            localField: "showtime.movie_id",
            foreignField: "_id",
            as: "showtime.movie",
          },
        },
        {
          $unwind: {
            path: "$showtime.movie",
            preserveNullAndEmptyArrays: true,
          },
        },
        // Lookup Seat
        {
          $lookup: {
            from: "seats",
            localField: "seatId",
            foreignField: "_id",
            as: "seat",
          },
        },
        { $unwind: { path: "$seat", preserveNullAndEmptyArrays: true } },
        // Lookup Booking
        {
          $lookup: {
            from: "bookings",
            localField: "bookingId",
            foreignField: "_id",
            as: "booking",
          },
        },
        { $unwind: { path: "$booking", preserveNullAndEmptyArrays: true } },
        // Lookup User from Booking
        {
          $lookup: {
            from: "users",
            localField: "booking.userId",
            foreignField: "_id",
            as: "booking.user",
          },
        },
        {
          $unwind: { path: "$booking.user", preserveNullAndEmptyArrays: true },
        },
        // Add seat_identifier for searching and display
        {
          $addFields: {
            "seat.seat_identifier": {
              $concat: [
                { $toString: "$seat.row" },
                { $toString: "$seat.seat_number" },
              ],
            },
          },
        },
        // Filter out records where lookups failed
        {
          $match: {
            "showtime._id": { $exists: true, $ne: null },
            "seat._id": { $exists: true, $ne: null },
          },
        },
      ];

      const searchFilter = SeatBookingController.historySearchBuilder({
        search,
      });
      if (search) {
        pipeline.push({ $match: searchFilter });
      }
      if (seat_type) {
        pipeline.push({
          $match: { "seat.seat_type": seat_type },
        });
      }
      const [histories, totalCountResult] = await Promise.all([
        SeatBookingHistory.aggregate([
          ...pipeline,
          { $sort: sort },
          { $skip: skip },
          { $limit: limitNum },
          {
            $project: {
              _id: 1,
              action: 1,
              createdAt: 1,
              updatedAt: 1,
              showtime: {
                _id: "$showtime._id",
                show_date: "$showtime.show_date",
                start_time: "$showtime.start_time",
                movie: "$showtime.movie.title",
              },
              seat: {
                _id: "$seat._id",
                row: "$seat.row",
                seat_number: "$seat.seat_number",
                seat_identifier: "$seat.seat_identifier",
                seat_type: "$seat.seat_type",
              },
              booking: {
                _id: "$booking._id",
                reference_code: "$booking.reference_code",
                user: "$booking.user.name",
                phone: "$booking.user.phone",
              },
            },
          },
        ]),
        SeatBookingHistory.aggregate([...pipeline, { $count: "total" }]),
      ]);

      const totalCount =
        totalCountResult.length > 0 ? totalCountResult[0].total : 0;
      const totalPages = Math.ceil(totalCount / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      res.status(200).json({
        success: true,
        data: {
          histories: histories,
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
      logger.error("Get all seat booking histories error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve seat booking histories",
      });
    }
  }
}

module.exports = SeatBookingController;
