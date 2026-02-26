const { Booking, BookingTicket } = require("../models");
const logger = require("../utils/logger");
const mongoose = require("mongoose");

class CustomerBookingController {
  // --- GET CUSTOMER'S BOOKINGS (Upcoming & History) ---
  static async getMyBookings(req, res) {
    try {
      const customerId = req.customer.customerId;
      const { type = "upcoming", page = 1, limit = 10 } = req.query;

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      const now = new Date();

      // Match query for customer
      const matchQuery = {
        customerId: new mongoose.Types.ObjectId(customerId),
        deletedAt: null,
      };

      // Pipeline starting point
      const pipeline = [
        { $match: matchQuery },
        // Lookup showtime to filter by upcoming/past
        {
          $lookup: {
            from: "showtimes",
            localField: "showtimeId",
            foreignField: "_id",
            as: "showtime",
          },
        },
        { $unwind: "$showtime" },
      ];

      // Filter by upcoming or past
      if (type === "upcoming") {
        // Upcoming: Show date is today or future
        // If today, check if start_time hasn't passed
        pipeline.push({
          $match: {
            "showtime.show_date": { $gte: new Date(now.setHours(0, 0, 0, 0)) },
            booking_status: { $in: ["Pending", "Confirmed"] },
          },
        });
      } else {
        // History: Past dates or cancelled/completed bookings
        pipeline.push({
          $match: {
            $or: [
              {
                "showtime.show_date": {
                  $lt: new Date(now.setHours(0, 0, 0, 0)),
                },
              },
              { booking_status: { $in: ["Cancelled", "Completed"] } },
            ],
          },
        });
      }

      // Populate more data
      pipeline.push(
        {
          $lookup: {
            from: "movies",
            localField: "showtime.movie_id",
            foreignField: "_id",
            as: "movie",
          },
        },
        { $unwind: "$movie" },
        {
          $lookup: {
            from: "halls",
            localField: "showtime.hall_id",
            foreignField: "_id",
            as: "hall",
          },
        },
        { $unwind: "$hall" },
        // Handle seats population
        {
          $addFields: {
            seatObjectIds: {
              $map: {
                input: "$seats",
                as: "s",
                in: { $toObjectId: "$$s" },
              },
            },
          },
        },
        {
          $lookup: {
            from: "seats",
            localField: "seatObjectIds",
            foreignField: "_id",
            as: "populatedSeats",
          },
        },
        {
          $sort: {
            "showtime.show_date": type === "upcoming" ? 1 : -1,
            createdAt: -1,
          },
        },
        {
          $facet: {
            metadata: [{ $count: "total" }],
            data: [{ $skip: skip }, { $limit: limitNum }],
          },
        },
      );

      const result = await Booking.aggregate(pipeline);
      const bookings = result[0].data;
      const totalCount = result[0].metadata[0]?.total || 0;

      res.status(200).json({
        success: true,
        data: {
          bookings,
          pagination: {
            currentPage: pageNum,
            totalPages: Math.ceil(totalCount / limitNum),
            totalCount,
            limit: limitNum,
          },
        },
      });
    } catch (error) {
      logger.error("Get my bookings error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch bookings" });
    }
  }

  // --- GET CUSTOMER'S TICKETS ---
  static async getMyTickets(req, res) {
    try {
      const customerId = req.customer.customerId;
      const { page = 1, limit = 10 } = req.query;

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(50, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      const tickets = await BookingTicket.find({ customer_id: customerId })
        .populate({
          path: "showtime_id",
          populate: [
            { path: "movie_id", select: "title poster_url duration_minutes" },
            { path: "hall_id", select: "hall_name" },
          ],
        })
        .populate("booking_id", "reference_code total_price booking_status")
        .sort({ issuedAt: -1 })
        .skip(skip)
        .limit(limitNum);

      const totalCount = await BookingTicket.countDocuments({
        customer_id: customerId,
      });

      res.status(200).json({
        success: true,
        data: {
          tickets,
          pagination: {
            currentPage: pageNum,
            totalPages: Math.ceil(totalCount / limitNum),
            totalCount,
            limit: limitNum,
          },
        },
      });
    } catch (error) {
      logger.error("Get my tickets error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to fetch tickets" });
    }
  }
}

module.exports = CustomerBookingController;
