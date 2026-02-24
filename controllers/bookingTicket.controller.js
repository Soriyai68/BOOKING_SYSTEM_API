const mongoose = require("mongoose");
const { BookingTicket, Seat, Booking } = require("../models");
const logger = require("../utils/logger");

class BookingTicketController {
  // --- GET ALL BOOKING TICKETS ---
  static async getAll(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = "issuedAt",
        sortOrder = "desc",
        ...filters
      } = req.query;

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      const pipeline = [];

      // 1. Initial Match for non-search filters that don't require lookups
      const matchQuery = {};
      if (
        filters.bookingId &&
        mongoose.Types.ObjectId.isValid(filters.bookingId)
      ) {
        matchQuery.booking_id = new mongoose.Types.ObjectId(filters.bookingId);
      }
      if (filters.seatId && mongoose.Types.ObjectId.isValid(filters.seatId)) {
        matchQuery["seat.seat_id"] = new mongoose.Types.ObjectId(
          filters.seatId,
        );
      }
      if (filters.ticket_type) {
        matchQuery["seat.ticket_type"] = filters.ticket_type;
      }

      if (Object.keys(matchQuery).length > 0) {
        pipeline.push({ $match: matchQuery });
      }

      // 2. Lookups to get related data for searching and populating
      pipeline.push(
        {
          $lookup: {
            from: "customers",
            localField: "customer_id",
            foreignField: "_id",
            as: "customer",
          },
        },
        { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "bookings",
            localField: "booking_id",
            foreignField: "_id",
            as: "booking",
          },
        },
        { $unwind: { path: "$booking", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "showtimes",
            localField: "showtime_id",
            foreignField: "_id",
            as: "showtime",
          },
        },
        { $unwind: { path: "$showtime", preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: "movies",
            localField: "showtime.movie_id",
            foreignField: "_id",
            as: "movie",
          },
        },
        { $unwind: { path: "$movie", preserveNullAndEmptyArrays: true } },
      );

      // 3. Normalize seat/seats into a unified seats array and Unwind
      pipeline.push(
        {
          $addFields: {
            seats: {
              $cond: {
                if: { $isArray: "$seats" },
                then: "$seats",
                else: { $ifNull: ["$seat", []] },
              },
            },
          },
        },
        {
          $addFields: {
            seats: {
              $cond: {
                if: { $isArray: "$seats" },
                then: "$seats",
                else: ["$seats"],
              },
            },
          },
        },
        { $unwind: { path: "$seats", preserveNullAndEmptyArrays: true } },
      );

      // 4. Group by booking_id
      pipeline.push({
        $group: {
          _id: "$booking_id",
          booking: { $first: "$booking" },
          customer: { $first: "$customer" },
          showtime: { $first: "$showtime" },
          movie: { $first: "$movie" },
          seats: {
            $push: {
              seat_id: "$seats.seat_id",
              seat_number: "$seats.seat_number",
              price: "$seats.price",
              ticket_type: "$seats.ticket_type",
              _id: "$_id",
            },
          },
          // We use the booking reference code to generate a consistent ticket code
          ticket_code: {
            $first: { $concat: ["TKT-", "$booking.reference_code"] },
          },
          payment_method: { $first: "$payment_method" },
          issuedAt: { $max: "$issuedAt" },
        },
      });

      // 5. Match for the search filter
      if (filters.search) {
        const searchQuery = {
          $or: [
            { ticket_code: { $regex: filters.search, $options: "i" } },
            { "seats.seat_number": { $regex: filters.search, $options: "i" } },
            { "customer.name": { $regex: filters.search, $options: "i" } },
            { "movie.title": { $regex: filters.search, $options: "i" } },
            {
              "booking.reference_code": {
                $regex: filters.search,
                $options: "i",
              },
            },
          ],
        };
        pipeline.push({ $match: searchQuery });
      }

      // 6. Facet for pagination and total count
      const facet = {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [
            { $sort: { [sortBy]: sortOrder === "desc" ? -1 : 1 } },
            { $skip: skip },
            { $limit: limitNum },
            {
              $project: {
                _id: 1,
                ticket_code: 1,
                payment_method: 1,
                issuedAt: 1,
                seats: 1,
                customer_id: {
                  _id: "$customer._id",
                  name: "$customer.name",
                  email: "$customer.email",
                },
                booking_id: {
                  _id: "$booking._id",
                  reference_code: "$booking.reference_code",
                },
                showtime_id: {
                  _id: "$showtime._id",
                  show_date: "$showtime.show_date",
                  start_time: "$showtime.start_time",
                  movie_id: {
                    _id: "$movie._id",
                    title: "$movie.title",
                  },
                },
              },
            },
          ],
        },
      };
      pipeline.push(facet);

      const result = await BookingTicket.aggregate(pipeline);

      const tickets = result[0].data;
      const totalCount = result[0].metadata[0]
        ? result[0].metadata[0].total
        : 0;
      const totalPages = Math.ceil(totalCount / limitNum);

      res.status(200).json({
        success: true,
        data: {
          tickets,
          pagination: {
            currentPage: pageNum,
            totalPages,
            totalCount,
            limit: limitNum,
          },
        },
      });
    } catch (error) {
      logger.error("Get all booking tickets error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve booking tickets",
      });
    }
  }

  // --- GET BOOKING TICKET BY ID ---
  static async getById(req, res) {
    try {
      const { id } = req.params;

      const ticket = await BookingTicket.findById(id)
        .populate("customer_id", "name email")
        .populate("booking_id")
        .populate({
          path: "showtime_id",
          populate: [
            { path: "movie_id", select: "title poster_url" },
            { path: "hall_id", select: "hall_name" },
          ],
        });

      if (!ticket) {
        return res
          .status(404)
          .json({ success: false, message: "Booking ticket not found" });
      }

      res.status(200).json({ success: true, data: { ticket } });
    } catch (error) {
      logger.error("Get booking ticket by ID error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to retrieve booking ticket" });
    }
  }

  // --- CREATE BOOKING TICKET ---
  static async create(req, res) {
    try {
      const { bookingId, seatId, price, ticket_type } = req.body;

      const booking = await Booking.findById(bookingId);
      if (!booking) {
        return res
          .status(404)
          .json({ success: false, message: "Booking not found" });
      }

      const seat = await Seat.findById(seatId);
      if (!seat) {
        return res
          .status(404)
          .json({ success: false, message: "Seat not found" });
      }

      // Generate a unique ticket code
      const ticket_code = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

      const newTicket = new BookingTicket({
        booking_id: bookingId,
        customer_id: booking.customerId,
        showtime_id: booking.showtimeId,
        payment_method: booking.payment_method,
        ticket_code,
        seat: {
          seat_id: seatId,
          price,
          ticket_type,
          seat_number: seat.seat_identifier,
        },
      });

      await newTicket.save();

      res.status(201).json({
        success: true,
        message: "Booking ticket created successfully",
        data: { ticket: newTicket },
      });
    } catch (error) {
      logger.error("Create booking ticket error:", error);
      if (error.name === "ValidationError") {
        return res.status(400).json({ success: false, message: error.message });
      }
      res
        .status(500)
        .json({ success: false, message: "Failed to create booking ticket" });
    }
  }

  // --- UPDATE BOOKING TICKET ---
  static async update(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const ticket = await BookingTicket.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true },
      );

      if (!ticket) {
        return res
          .status(404)
          .json({ success: false, message: "Booking ticket not found" });
      }

      res.status(200).json({
        success: true,
        message: "Booking ticket updated successfully",
        data: { ticket },
      });
    } catch (error) {
      logger.error("Update booking ticket error:", error);
      if (error.name === "ValidationError") {
        return res.status(400).json({ success: false, message: error.message });
      }
      res
        .status(500)
        .json({ success: false, message: "Failed to update booking ticket" });
    }
  }

  // --- DELETE BOOKING TICKET ---
  static async delete(req, res) {
    try {
      const { id } = req.params;

      const ticket = await BookingTicket.findByIdAndDelete(id);

      if (!ticket) {
        return res
          .status(404)
          .json({ success: false, message: "Booking ticket not found" });
      }

      res.status(200).json({
        success: true,
        message: "Booking ticket deleted successfully",
      });
    } catch (error) {
      logger.error("Delete booking ticket error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to delete booking ticket" });
    }
  }
}

module.exports = BookingTicketController;
