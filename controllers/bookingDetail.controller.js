const mongoose = require("mongoose");
const { BookingDetail, Booking, Seat } = require("../models");
const { Role } = require("../data");
const logger = require("../utils/logger");

class BookingDetailController {
  // Helper method to validate ObjectId
  static validateObjectId(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("Invalid BookingDetail ID format");
    }
  }

  // Build filter query
  static buildFilterQuery(filters) {
    const query = {};

    if (filters.bookingId && mongoose.Types.ObjectId.isValid(filters.bookingId)) {
      query.bookingId = new mongoose.Types.ObjectId(filters.bookingId);
    }

    if (filters.seatId && mongoose.Types.ObjectId.isValid(filters.seatId)) {
      query.seatId = new mongoose.Types.ObjectId(filters.seatId);
    }

    if (filters.seat_type) {
      query.seat_type = filters.seat_type;
    }

    if (filters.row_label) {
      query.row_label = filters.row_label;
    }

    return query;
  }

  // 1. GET ALL BOOKING DETAILS
  static async getAll(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        sortOrder = "desc",
        search,
        includeDeleted = false,
        ...filters
      } = req.query;

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      const matchQuery = { ...BookingDetailController.buildFilterQuery(filters) };

      if (!includeDeleted || includeDeleted === "false") {
        matchQuery.deletedAt = null;
      }

      const pipeline = [
        { $match: matchQuery },

        // Lookup booking
        {
          $lookup: {
            from: "bookings",
            localField: "bookingId",
            foreignField: "_id",
            as: "booking",
          },
        },
        { $unwind: { path: "$booking", preserveNullAndEmptyArrays: true } },

        // Lookup seat
        {
          $lookup: {
            from: "seats",
            localField: "seatId",
            foreignField: "_id",
            as: "seat",
          },
        },
        { $unwind: { path: "$seat", preserveNullAndEmptyArrays: true } },
      ];

      // Optional search on row_label or seat_number
      if (search) {
        pipeline.push({
          $match: {
            $or: [
              { row_label: { $regex: search, $options: "i" } },
              { seat_number: parseInt(search) || 0 },
            ],
          },
        });
      }

      // Count total
      const totalCountResult = await BookingDetail.aggregate([
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
          booking: { _id: 1, reference_code: 1, booking_status: 1 },
          seat: { _id: 1, row_label: 1, seat_number: 1, seat_type: 1 },
          row_label: 1,
          seat_number: 1,
          seat_type: 1,
          price: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      });

      const bookingDetails = await BookingDetail.aggregate(pipeline);

      const totalPages = Math.ceil(totalCount / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      res.status(200).json({
        success: true,
        data: {
          bookingDetails,
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
      logger.error("Get all booking details error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to retrieve booking details" });
    }
  }

  // 2. GET BOOKING DETAIL BY ID
  static async getById(req, res) {
    try {
      const { id } = req.params;
      if (!id) {
        return res
          .status(400)
          .json({ success: false, message: "BookingDetail ID is required" });
      }

      BookingDetailController.validateObjectId(id);

      const bookingDetail = await BookingDetail.findById(id)
        .populate("bookingId", "reference_code booking_status total_price")
        .populate("seatId", "row_label seat_number seat_type");

      if (!bookingDetail) {
        return res
          .status(404)
          .json({ success: false, message: "Booking detail not found" });
      }

      res.status(200).json({
        success: true,
        data: { bookingDetail },
      });
    } catch (error) {
      logger.error("Get booking detail by ID error:", error);
      if (error.message === "Invalid BookingDetail ID format") {
        return res.status(400).json({ success: false, message: error.message });
      }
      res
        .status(500)
        .json({ success: false, message: "Failed to retrieve booking detail" });
    }
  }

  // 3. GET BOOKING DETAILS BY BOOKING ID
  static async getByBookingId(req, res) {
    try {
      const { bookingId } = req.params;
      if (!bookingId) {
        return res
          .status(400)
          .json({ success: false, message: "Booking ID is required" });
      }

      BookingDetailController.validateObjectId(bookingId);

      const bookingDetails = await BookingDetail.find({
        bookingId,
        deletedAt: null,
      })
        .populate("seatId", "row_label seat_number seat_type")
        .sort({ row_label: 1, seat_number: 1 });

      res.status(200).json({
        success: true,
        data: { bookingDetails },
      });
    } catch (error) {
      logger.error("Get booking details by booking ID error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to retrieve booking details" });
    }
  }

  // 4. CREATE BOOKING DETAIL
  static async create(req, res) {
    try {
      const { bookingId, seatId, row_label, seat_number, seat_type, price } =
        req.body;

      // Validate booking exists
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        return res
          .status(404)
          .json({ success: false, message: "Booking not found" });
      }

      // Validate seat exists
      const seat = await Seat.findById(seatId);
      if (!seat) {
        return res
          .status(404)
          .json({ success: false, message: "Seat not found" });
      }

      // Check if seat is already booked in this booking
      const existingDetail = await BookingDetail.findOne({
        bookingId,
        seatId,
        deletedAt: null,
      });
      if (existingDetail) {
        return res.status(400).json({
          success: false,
          message: "This seat is already in this booking",
        });
      }

      const bookingDetail = new BookingDetail({
        bookingId,
        seatId,
        row_label,
        seat_number,
        seat_type,
        price,
      });

      await bookingDetail.save();

      const populatedDetail = await BookingDetail.findById(bookingDetail._id)
        .populate("bookingId", "reference_code booking_status")
        .populate("seatId", "row_label seat_number seat_type");

      res.status(201).json({
        success: true,
        message: "Booking detail created successfully",
        data: { bookingDetail: populatedDetail },
      });
    } catch (error) {
      logger.error("Create booking detail error:", error);
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: "This seat is already in this booking",
        });
      }
      res
        .status(500)
        .json({ success: false, message: "Failed to create booking detail" });
    }
  }

  // 5. CREATE MULTIPLE BOOKING DETAILS
  static async createBulk(req, res) {
    try {
      const { bookingId, seats } = req.body;

      // Validate booking exists
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        return res
          .status(404)
          .json({ success: false, message: "Booking not found" });
      }

      // Validate all seats exist
      const seatIds = seats.map((s) => s.seatId);
      const existingSeats = await Seat.find({ _id: { $in: seatIds } });
      if (existingSeats.length !== seatIds.length) {
        return res
          .status(404)
          .json({ success: false, message: "One or more seats not found" });
      }

      // Check for existing booking details
      const existingDetails = await BookingDetail.find({
        bookingId,
        seatId: { $in: seatIds },
        deletedAt: null,
      });
      if (existingDetails.length > 0) {
        return res.status(400).json({
          success: false,
          message: "One or more seats are already in this booking",
        });
      }

      // Create booking details
      const bookingDetails = seats.map((seat) => ({
        bookingId,
        seatId: seat.seatId,
        row_label: seat.row_label,
        seat_number: seat.seat_number,
        seat_type: seat.seat_type,
        price: seat.price,
      }));

      const createdDetails = await BookingDetail.insertMany(bookingDetails);

      const populatedDetails = await BookingDetail.find({
        _id: { $in: createdDetails.map((d) => d._id) },
      })
        .populate("bookingId", "reference_code booking_status")
        .populate("seatId", "row_label seat_number seat_type");

      res.status(201).json({
        success: true,
        message: "Booking details created successfully",
        data: { bookingDetails: populatedDetails },
      });
    } catch (error) {
      logger.error("Create bulk booking details error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to create booking details" });
    }
  }

  // 6. UPDATE BOOKING DETAIL
  static async update(req, res) {
    try {
      const { id } = req.params;
      BookingDetailController.validateObjectId(id);

      const updateData = { ...req.body };
      delete updateData._id;
      delete updateData.createdAt;

      const bookingDetail = await BookingDetail.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      )
        .populate("bookingId", "reference_code booking_status")
        .populate("seatId", "row_label seat_number seat_type");

      if (!bookingDetail) {
        return res
          .status(404)
          .json({ success: false, message: "Booking detail not found" });
      }

      res.status(200).json({
        success: true,
        message: "Booking detail updated successfully",
        data: { bookingDetail },
      });
    } catch (error) {
      logger.error("Update booking detail error:", error);
      if (error.message === "Invalid BookingDetail ID format") {
        return res.status(400).json({ success: false, message: error.message });
      }
      res
        .status(500)
        .json({ success: false, message: "Failed to update booking detail" });
    }
  }

  // 7. SOFT DELETE BOOKING DETAIL
  static async delete(req, res) {
    try {
      const { id } = req.params;
      BookingDetailController.validateObjectId(id);

      const bookingDetail = await BookingDetail.findByIdAndUpdate(
        id,
        { deletedAt: new Date() },
        { new: true }
      );

      if (!bookingDetail) {
        return res
          .status(404)
          .json({ success: false, message: "Booking detail not found" });
      }

      res.status(200).json({
        success: true,
        message: "Booking detail deleted successfully",
      });
    } catch (error) {
      logger.error("Delete booking detail error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to delete booking detail" });
    }
  }

  // 8. DELETE MULTIPLE BOOKING DETAILS
  static async deleteBulk(req, res) {
    try {
      const { ids } = req.body;

      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "IDs array is required" });
      }

      const result = await BookingDetail.updateMany(
        { _id: { $in: ids } },
        { $set: { deletedAt: new Date() } }
      );

      res.status(200).json({
        success: true,
        message: `${result.modifiedCount} booking detail(s) deleted successfully`,
      });
    } catch (error) {
      logger.error("Delete bulk booking details error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to delete booking details" });
    }
  }

  // 9. RESTORE DELETED BOOKING DETAIL
  static async restore(req, res) {
    try {
      const { id } = req.params;
      BookingDetailController.validateObjectId(id);

      const bookingDetail = await BookingDetail.findByIdAndUpdate(
        id,
        { deletedAt: null },
        { new: true }
      );

      if (!bookingDetail) {
        return res
          .status(404)
          .json({ success: false, message: "Booking detail not found" });
      }

      res.status(200).json({
        success: true,
        message: "Booking detail restored successfully",
        data: { bookingDetail },
      });
    } catch (error) {
      logger.error("Restore booking detail error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to restore booking detail" });
    }
  }

  // 10. FORCE DELETE BOOKING DETAIL
  static async forceDelete(req, res) {
    try {
      const { id } = req.params;
      BookingDetailController.validateObjectId(id);

      const bookingDetail = await BookingDetail.findByIdAndDelete(id);

      if (!bookingDetail) {
        return res
          .status(404)
          .json({ success: false, message: "Booking detail not found" });
      }

      res.status(200).json({
        success: true,
        message: "Booking detail permanently deleted",
      });
    } catch (error) {
      logger.error("Force delete booking detail error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to permanently delete booking detail" });
    }
  }

  // 11. GET DELETED BOOKING DETAILS
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

      const totalCount = await BookingDetail.countDocuments(query);

      const bookingDetails = await BookingDetail.find(query)
        .populate("bookingId", "reference_code booking_status")
        .populate("seatId", "row_label seat_number seat_type")
        .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
        .skip(skip)
        .limit(limitNum);

      const totalPages = Math.ceil(totalCount / limitNum);

      res.status(200).json({
        success: true,
        data: {
          bookingDetails,
          pagination: {
            currentPage: pageNum,
            totalPages,
            totalCount,
            limit: limitNum,
          },
        },
      });
    } catch (error) {
      logger.error("List deleted booking details error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to retrieve deleted booking details" });
    }
  }
}

module.exports = BookingDetailController;
