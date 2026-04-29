const mongoose = require("mongoose");
const {
  Booking,
  Showtime,
  Customer,
  SeatBooking,
  SeatBookingHistory,
  ActivityLog,
} = require("../models");
const { Role, Providers } = require("../data");
const logger = require("../utils/logger");
const { createPhoneRegex } = require("../utils/helpers");
const NotificationController = require("./notification.controller");
const { logActivity } = require("../utils/activityLogger");
const { emitEvent } = require("../utils/socket");

class BookingController {
  // Helper method to validate ObjectId
  static validateObjectId(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("Invalid Booking ID format");
    }
  }

  // Helper to validate seat rules (Max 10, Same row, No gaps)
  static validateSeatRules(seats) {
    if (seats.length > 10) {
      throw new Error("A maximum of 10 seats can be booked at a time.");
    }

    if (seats.length > 1) {
      const firstRow = seats[0].row;
      if (!seats.every((s) => s.row === firstRow)) {
        throw new Error("All selected seats must be in the same row.");
      }

      // Sort seats by seat_number to check for gaps
      const sortedSeats = [...seats].sort(
        (a, b) => a.seat_number - b.seat_number,
      );
      for (let i = 0; i < sortedSeats.length - 1; i++) {
        if (sortedSeats[i].seat_number + 1 !== sortedSeats[i + 1].seat_number) {
          throw new Error(
            "Seats must be continuous. No gaps are allowed between selected seats.",
          );
        }
      }
    }
  }

  // Build filter query
  static buildFilterQuery(filters) {
    const query = {};
    const showtimeDateFilter = {};

    if (filters.booking_status) {
      query.booking_status = filters.booking_status;
    }

    if (filters.payment_status) {
      query.payment_status = filters.payment_status;
    }

    if (
      filters.customerId &&
      mongoose.Types.ObjectId.isValid(filters.customerId)
    ) {
      query.customerId = new mongoose.Types.ObjectId(filters.customerId);
    }

    if (
      filters.showtimeId &&
      mongoose.Types.ObjectId.isValid(filters.showtimeId)
    ) {
      query.showtimeId = new mongoose.Types.ObjectId(filters.showtimeId);
    }

    // Date range filter for booking_date
    if (filters.dateFrom || filters.dateTo) {
      query.booking_date = {};
      if (filters.dateFrom)
        query.booking_date.$gte = new Date(filters.dateFrom);
      if (filters.dateTo) query.booking_date.$lte = new Date(filters.dateTo);
    }

    // Date range filter for showtime.show_date
    if (filters.show_date) {
      const startDate = new Date(filters.show_date);
      startDate.setUTCHours(0, 0, 0, 0);

      const endDate = new Date(startDate);
      endDate.setUTCDate(startDate.getUTCDate() + 1);

      showtimeDateFilter["showtime.show_date"] = {
        $gte: startDate,
        $lt: endDate,
      };
    }

    return { query, showtimeDateFilter };
  }
  // Build search query
  static buildSearchQuery(query) {
    const { search } = query;
    if (!search) return {};
    const phoneRegex = createPhoneRegex(search);

    const searchConditions = [
      { reference_code: { $regex: search, $options: "i" } },
      { "customer.name": { $regex: search, $options: "i" } },
      { "customer.email": { $regex: search, $options: "i" } },
      { "movie.title": { $regex: search, $options: "i" } },
      { "hall.hall_name": { $regex: search, $options: "i" } },
    ];

    if (phoneRegex) {
      searchConditions.push({ "customer.phone": { $regex: phoneRegex } });
    }

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

      const { query: matchQuery, showtimeDateFilter } =
        BookingController.buildFilterQuery(filters);
      const searchQuery = BookingController.buildSearchQuery({ search });
      if (!includeDeleted || includeDeleted === "false")
        matchQuery.deletedAt = null;

      const pipeline = [
        { $match: matchQuery },

        // Lookup customer
        {
          $lookup: {
            from: "customers",
            localField: "customerId",
            foreignField: "_id",
            pipeline: [
              {
                $project: {
                  _id: 1,
                  name: 1,
                  phone: 1,
                  email: 1,
                  customerType: 1,
                  isActive: 1,
                },
              },
            ],
            as: "customer",
          },
        },
        {
          $unwind: {
            path: "$customer",
            preserveNullAndEmptyArrays: true,
          },
        },
        // Filter out bookings from inactive customers
        {
          $match: {
            $or: [
              { customer: { $exists: false } }, // Allow bookings without customer (e.g. deleted or walk-in without record)
              { "customer.isActive": { $ne: false } },
            ],
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
      ];

      // Apply showtime date filter if present
      if (Object.keys(showtimeDateFilter).length > 0) {
        pipeline.push({ $match: showtimeDateFilter });
      }

      // Lookup movie
      pipeline.push({
        $lookup: {
          from: "movies",
          localField: "showtime.movie_id",
          foreignField: "_id",
          as: "movie",
        },
      });
      pipeline.push({
        $unwind: {
          path: "$movie",
          preserveNullAndEmptyArrays: true,
        },
      });

      // Lookup hall
      pipeline.push({
        $lookup: {
          from: "halls",
          localField: "showtime.hall_id",
          foreignField: "_id",
          as: "hall",
        },
      });
      pipeline.push({
        $unwind: {
          path: "$hall",
          preserveNullAndEmptyArrays: true,
        },
      });

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
                    $concat: ["$row", "-", { $toString: "$seat_number" }],
                  },
                },
              },
            ],
            as: "seats",
          },
        },
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
          customer: { _id: 1, name: 1, phone: 1, email: 1, customerType: 1 },
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
        .populate("customerId", "name email phone customerType")
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
          seat_identifier: `${seatObj.row}-${seatObj.seat_number}`,
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
      console.log(
        "POST /bookings request body:",
        JSON.stringify(req.body, null, 2),
      );
      const {
        customerId,
        guestEmail,
        phone,
        showtimeId,
        seats,
        total_price,
        payment_method,
        noted = "",
      } = req.body;

      // 1. Determine the customer (member, guest, or walk-in) based on provided identifier
      let customer;

      if (customerId) {
        customer = await Customer.findById(customerId);
        if (!customer) {
          return res
            .status(404)
            .json({ success: false, message: "Customer not found" });
        }
      } else if (guestEmail) {
        // --- Handle Guest Booking via Email ---
        const existingCustomer = await Customer.findOne({ email: guestEmail });

        if (existingCustomer) {
          if (existingCustomer.isMemberCustomer()) {
            return res.status(409).json({
              success: false,
              message:
                "This email is registered to a member account. Please log in to book.",
            });
          }
          customer = existingCustomer;
        } else {
          customer = new Customer({
            email: guestEmail,
            customerType: "guest",
            provider: Providers.EMAIL,
            isVerified: false,
          });
          await customer.save();
        }
      } else if (phone) {
        // --- Handle Walk-in Booking via Phone ---
        const existingCustomer = await Customer.findOne({ phone });

        if (existingCustomer) {
          if (existingCustomer.isMemberCustomer()) {
            return res.status(409).json({
              success: false,
              message:
                "This phone number is registered to a member account. Please log in to book.",
            });
          }
          customer = existingCustomer;
        } else {
          customer = new Customer({
            phone: phone,
            customerType: "walkin",
            provider: Providers.PHONE,
            isVerified: false,
          });
          await customer.save();
        }
      } else {
        // --- Handle Anonymous Walk-in Booking ---
        customer = new Customer({
          customerType: "walkin",
          provider: Providers.PHONE,
          isVerified: false,
        });
        await customer.save();
      }

      // 2. Validations for Booking details (Showtime, Seats)
      if (
        !showtimeId ||
        !seats ||
        !Array.isArray(seats) ||
        seats.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Missing required booking details: showtimeId and seats are required.",
        });
      }

      // --- NEW: Booking Rule - One PayAtCinema booking per showtime per customer ---
      if (
        customer &&
        customer._id &&
        customer.customerType !== "walkin" &&
        payment_method === "PayAtCinema"
      ) {
        const existingBooking = await Booking.findOne({
          customerId: customer._id,
          showtimeId: showtimeId,
          booking_status: { $in: ["Pending", "Confirmed", "Completed"] },
          deletedAt: null,
        });

        if (existingBooking) {
          await logActivity({
            customerId: customer._id,
            userId: req.user?.userId,
            logType: req.user?.userId ? "ADMIN" : "CUSTOMER",
            action: "BOOK_CREATE_PENDING",
            status: "FAILED",
            targetId: showtimeId,
            req,
            metadata: {
              reason: "Already has an active booking for this showtime",
              showtimeId,
            },
          });
          return res.status(400).json({
            success: false,
            message:
              "You already have an active booking for this showtime. One customer can only book once per showtime.",
          });
        }

        // --- NEW: PayAtCinema Guard - Max 3 pending bookings ---
        if (payment_method === "PayAtCinema") {
          const pendingPayAtCinemaCount = await Booking.countDocuments({
            customerId: customer._id,
            payment_method: "PayAtCinema",
            booking_status: "Pending",
            deletedAt: null,
          });

          if (pendingPayAtCinemaCount >= 3) {
            await logActivity({
              customerId: customer._id,
              userId: req.user?.userId,
              logType: req.user?.userId ? "ADMIN" : "CUSTOMER",
              action: "BOOK_CREATE_PENDING",
              status: "FAILED",
              targetId: showtimeId,
              req,
              metadata: {
                reason: "Too many pending PayAtCinema bookings",
                count: pendingPayAtCinemaCount,
              },
            });
            return res.status(400).json({
              success: false,
              message:
                "You have too many pending 'Pay At Cinema' bookings. Please complete or cancel your existing bookings before making a new one.",
            });
          }
        }
      }

      const showtime = await Showtime.findById(showtimeId).populate('hall_id', 'status hall_name');

      if (!showtime) {
        return res
          .status(404)
          .json({ success: false, message: "Showtime not found" });
      }

      // Check if hall is active
      if (showtime.hall_id && showtime.hall_id.status !== "active") {
        return res.status(409).json({
          success: false,
          message: `Cannot create booking. The hall "${showtime.hall_id.hall_name}" is currently ${showtime.hall_id.status}. Bookings are only allowed for active halls.`,
        });
      }

      if (!showtime.isActiveForBooking()) {
        const message = !showtime.isUpcoming()
          ? "This showtime's start time has already passed and cannot be booked."
          : "This showtime is not available for booking. It might be completed or cancelled.";
        return res.status(400).json({ success: false, message });
      }

      if (seats.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
        return res.status(400).json({
          success: false,
          message: "Invalid seat ID format found in request.",
        });
      }

      const seatObjectIds = [...new Set(seats.map((id) => id.toString()))].map(
        (id) => new mongoose.Types.ObjectId(id),
      );

      // --- Seat Rule Validation ---
      const SeatModel = mongoose.model("Seat");
      const validationSeatDocs = await SeatModel.find({
        _id: { $in: seatObjectIds },
      });
      try {
        BookingController.validateSeatRules(validationSeatDocs);
      } catch (validationError) {
        return res
          .status(400)
          .json({ success: false, message: validationError.message });
      }

      // 3. Check Seat Availability
      const existingSeatBookings = await SeatBooking.find({
        showtimeId: showtimeId,
        seatId: { $in: seatObjectIds },
      });

      if (existingSeatBookings.length > 0) {
        const populatedBookings = await SeatBooking.populate(
          existingSeatBookings,
          { path: "seatId", select: "row seat_number" },
        );
        const bookedSeatLabels = populatedBookings.map((sb) =>
          sb.seatId
            ? `${sb.seatId.row}-${sb.seatId.seat_number}`
            : "UnknownSeat",
        );
        return res.status(409).json({
          success: false,
          message: `Some selected seats are already booked or locked: ${bookedSeatLabels.join(
            ", ",
          )}. Please choose different seats.`,
        });
      }

      // 4. Create Booking and Lock Seats
      const reference_code = await Booking.generateReferenceCode();

      let expirationTime;
      let expirationMessage =
        "Booking created successfully. Seats are locked for 15 minutes.";

      if (payment_method === "PayAtCinema") {
        const showDateTime = new Date(showtime.show_date);
        const [hours, minutes] = showtime.start_time.split(":");
        showDateTime.setHours(parseInt(hours, 10));
        showDateTime.setMinutes(parseInt(minutes, 10));
        showDateTime.setSeconds(0);
        showDateTime.setMilliseconds(0);

        const thirtyMinutesBeforeShow = new Date(
          showDateTime.getTime() - 30 * 60 * 1000,
        );

        if (new Date() > thirtyMinutesBeforeShow) {
          return res.status(400).json({
            success: false,
            message:
              "The 'Pay at Cinema' option is not available within 30 minutes of the show's start time.",
          });
        }
        expirationTime = thirtyMinutesBeforeShow;
        expirationMessage =
          "Booking created successfully. Your reservation is held until 30 minutes before the show starts.";
      } else {
        expirationTime = new Date(Date.now() + 15 * 60 * 1000);
      }

      const booking = new Booking({
        customerId: customer._id, // Use the determined customer ID
        showtimeId,
        seats: seatObjectIds,
        seat_count: seatObjectIds.length,
        total_price,
        reference_code,
        payment_status: "Pending",
        booking_status: "Pending",
        payment_method,
        noted,
        expired_at: expirationTime,
      });

      await booking.save();

      const seatBookingDocs = seatObjectIds.map((seatId) => ({
        showtimeId,
        seatId,
        bookingId: booking._id,
        status: "locked",
        locked_until: booking.expired_at,
      }));
      await SeatBooking.insertMany(seatBookingDocs);

      const seatBookingHistoryDocs = seatObjectIds.map((seatId) => ({
        showtimeId,
        seatId,
        bookingId: booking._id,
        action: "booked",
      }));
      await SeatBookingHistory.insertMany(seatBookingHistoryDocs);

      // 5. Populate and Respond
      await booking.populate([
        { path: "customerId", select: "name email phone" },
        {
          path: "showtimeId",
          populate: [
            { path: "movie_id", select: "title poster_url duration_minutes" },
            { path: "hall_id", select: "hall_name screen_type" },
          ],
        },
      ]);

      // Manually populate seats for notification helper (since seats is [String])
      const Seat = mongoose.model("Seat");
      const seatDocs = await Seat.find({ _id: { $in: booking.seats } }).select(
        "row seat_number",
      );
      booking.populatedSeats = seatDocs.map((s) => ({
        ...s.toObject(),
        seat_identifier: `${s.row}-${s.seat_number}`,
      }));

      // Prepare notification data
      const movieTitle = booking.showtimeId?.movie_id?.title || "Movie";
      const seatsLabel = booking.populatedSeats
        .map((s) => s.seat_identifier)
        .join(", ");

      NotificationController.notifyAdmins({
        type: "admin_booking_created",
        title: "New Booking Created",
        message: `New booking ${booking.reference_code} for "${movieTitle}" by ${
          booking.customerId?.name || "Guest"
        }. Seats: ${seatsLabel}`,
        metadata: {
          ref: booking.reference_code,
          customer: booking.customerId?.name || "Guest",
          movie: movieTitle,
          seats: seatsLabel,
        },
        relatedId: booking._id,
        req,
      });

      // Notify customer of new booking
      if (booking.customerId) {
        const {
          message: dynamicMessage,
          metadata,
          type: notifType,
        } = NotificationController.generateBookingMessage(booking, movieTitle);
        NotificationController.notifyCustomer(
          booking.customerId._id,
          {
            type: notifType,
            title: "Booking Confirmed",
            message: dynamicMessage,
            metadata,
            relatedId: booking._id,
          },
          req,
        );
      }

      if (booking.customerId) {
        await logActivity({
          customerId: booking.customerId._id,
          userId: req.user?.userId,
          logType: req.user?.userId ? "ADMIN" : "CUSTOMER",
          action: "BOOK_CREATE_PENDING",
          status: "SUCCESS",
          targetId: booking._id,
          req,
          metadata: {
            referenceCode: booking.reference_code,
            totalPrice: booking.total_price,
            paymentMethod: booking.payment_method,
          },
        });
      }

      // Notify via Socket.io
      emitEvent("booking:created", { booking: booking.toObject() });
      emitEvent("seat:booked", { 
        showtimeId: booking.showtimeId._id, 
        seats: booking.seats 
      });

      res.status(201).json({
        success: true,
        message: expirationMessage,
        data: { booking },
      });
    } catch (error) {
      console.error("Create booking error detail:", error);
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
      const originalStatus = booking.booking_status;

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

      const statusChangedToCancelled =
        updateData.booking_status === "Cancelled" &&
        booking.booking_status !== "Cancelled";

      // If showtime changed OR seats changed OR status changed to cancelled, we need to update SeatBookings
      if (
        showtimeChanged ||
        JSON.stringify(newSeatIds) !== JSON.stringify(originalSeatIds) ||
        statusChangedToCancelled
      ) {
        // 1. Release all original seats and update history
        if (originalSeatIds.length > 0) {
          await SeatBooking.deleteMany({
            bookingId: booking._id,
            showtimeId: originalShowtimeId,
          });

          // Update history records to 'canceled' instead of creating new ones
          await SeatBookingHistory.updateMany(
            {
              bookingId: booking._id,
              seatId: { $in: originalSeatIds },
              action: "booked",
            },
            { $set: { action: "canceled" } },
          );
        }

        if (statusChangedToCancelled) {
          booking.noted = "Cancelled by admin (Edit)";
        }

        // 2. Check availability of new seats for the potentially new showtime
        // ONLY if the booking is NOT being cancelled
        if (
          newSeatIds.length > 0 &&
          updateData.booking_status !== "Cancelled"
        ) {
          // --- Seat Rule Validation ---
          const SeatModel = mongoose.model("Seat");
          const validationSeatDocs = await SeatModel.find({
            _id: { $in: newSeatIds },
          });
          BookingController.validateSeatRules(validationSeatDocs);

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
              sb.seatId
                ? `${sb.seatId.row}-${sb.seatId.seat_number}`
                : "Unknown",
            );
            throw new Error(
              `Cannot update booking. The following seats are already taken for the showtime: ${labels.join(
                ", ",
              )}`,
            );
          }

          // 3. Lock the new set of seats and create history
          const seatBookingDocs = newSeatIds.map((seatId) => ({
            showtimeId: booking.showtimeId,
            seatId,
            bookingId: booking._id,
            status: "locked",
            locked_until:
              booking.expired_at || new Date(Date.now() + 15 * 60 * 1000),
          }));
          await SeatBooking.insertMany(seatBookingDocs);

          const historyDocs = newSeatIds.map((seatId) => ({
            showtimeId: booking.showtimeId,
            seatId,
            bookingId: booking._id,
            action: "booked",
          }));
          await SeatBookingHistory.insertMany(historyDocs);
        }
      }

      // --- Apply remaining updates to the booking document ---
      Object.keys(updateData).forEach((key) => {
        booking[key] = updateData[key];
      });
      booking.seats = newSeatIds;
      booking.seat_count = newSeatIds.length;

      await booking.save();

      const populatedBooking = await booking.populate([
        { path: "customerId", select: "name email phone" },
        {
          path: "showtimeId",
          populate: [
            { path: "movie_id", select: "title poster_url" },
            { path: "hall_id", select: "hall_name" },
          ],
        },
      ]);

      // Manually populate seats for notification helper
      const updatedSeats = await mongoose
        .model("Seat")
        .find({ _id: { $in: booking.seats } })
        .select("row seat_number");
      populatedBooking.populatedSeats = updatedSeats.map((s) => ({
        ...s.toObject(),
        seat_identifier: `${s.row}-${s.seat_number}`,
      }));

      // Notify customer of booking update
      if (booking.customerId) {
        const movieTitle =
          populatedBooking.showtimeId?.movie_id?.title || "Movie";
        const {
          message: dynamicMessage,
          metadata,
          type: notifType,
        } = NotificationController.generateBookingMessage(
          populatedBooking,
          movieTitle,
        );

        // Use the correct title based on actual notification type
        const titleMap = {
          booking_cancelled: "Booking Cancelled",
          booking_confirmed: "Payment Confirmed",
          pay_at_cinema: "Booking Confirmed",
          pending_payment: "Booking Created",
          booking_created: "Booking Confirmed",
        };

        NotificationController.notifyCustomer(
          booking.customerId._id,
          {
            type: notifType,
            title: titleMap[notifType] || "Booking Updated",
            message: dynamicMessage,
            metadata,
            relatedId: booking._id,
          },
          req,
        );
      }

      // Log activity
      let actionType = "BOOK_UPDATE";
      if (statusChangedToCancelled) {
        actionType =
          originalStatus === "Pending"
            ? "BOOK_CANCEL_PENDING"
            : "BOOK_CANCEL_CONFIRMED";
      } else if (
        updateData.booking_status === "Confirmed" &&
        originalStatus === "Pending"
      ) {
        actionType = "BOOK_CONFIRMED";
      }

      await logActivity({
        customerId: booking.customerId,
        userId: req.user?.userId || req.user?.id || req.user?._id,
        action: actionType,
        status: "SUCCESS",
        targetId: booking._id,
        req,
        metadata: {
          referenceCode: booking.reference_code,
          updatedFields: Object.keys(updateData),
          reason: statusChangedToCancelled
            ? "Cancelled by admin (Edit)"
            : undefined,
        },
      });

      // Notify via Socket.io
      emitEvent("booking:updated", { booking: populatedBooking });
      if (statusChangedToCancelled) {
        emitEvent("seat:released", { 
          showtimeId: booking.showtimeId._id, 
          seats: originalSeatIds 
        });
      }

      res.status(200).json({
        success: true,
        message: "Booking updated successfully",
        data: { booking: populatedBooking },
      });
    } catch (error) {
      logger.error("Update booking error:", error);
      const errorMessage = error.message || "Failed to update booking";
      const statusCode = error.message.includes("already taken") ? 409 : 500;
      res.status(statusCode).json({ success: false, message: errorMessage });
    }
  }

  // 4a. CHANGE SEATS
  static async changeSeat(req, res) {
    try {
      const { id } = req.params;
      const { seats, totalPrice } = req.body;
      BookingController.validateObjectId(id);

      const booking = await Booking.findById(id);
      if (!booking) {
        return res
          .status(404)
          .json({ success: false, message: "Booking not found" });
      }

      // Check if booking allows seat changes
      if (booking.booking_status === "Cancelled") {
        return res
          .status(400)
          .json({ success: false, message: "Cannot edit seats for cancelled bookings" });
      }

      const originalSeatIds = booking.seats.map((s) => s.toString());
      const newSeatIds = seats.map((s) => s.toString());

      // 1. Release original seats
      if (originalSeatIds.length > 0) {
        await SeatBooking.deleteMany({
          bookingId: booking._id,
          showtimeId: booking.showtimeId,
        });

        await SeatBookingHistory.updateMany(
          {
            bookingId: booking._id,
            seatId: { $in: originalSeatIds },
            action: "booked",
          },
          { $set: { action: "canceled" } },
        );
      }

      // 2. Lock/Book new seats based on booking status
      if (newSeatIds.length > 0) {
        const existingBookings = await SeatBooking.find({
          showtimeId: booking.showtimeId,
          seatId: { $in: newSeatIds },
        });

        if (existingBookings.length > 0) {
          throw new Error("One or more selected seats are already taken.");
        }

        // For completed bookings, directly book the seats. For others, lock them.
        const seatStatus = booking.booking_status === "Completed" ? "booked" : "locked";
        const seatBookingDocs = newSeatIds.map((seatId) => ({
          showtimeId: booking.showtimeId,
          seatId,
          bookingId: booking._id,
          status: seatStatus,
          ...(seatStatus === "locked" && {
            locked_until: booking.expired_at || new Date(Date.now() + 15 * 60 * 1000)
          })
        }));
        await SeatBooking.insertMany(seatBookingDocs);

        const historyDocs = newSeatIds.map((seatId) => ({
          showtimeId: booking.showtimeId,
          seatId,
          bookingId: booking._id,
          action: "booked",
        }));
        await SeatBookingHistory.insertMany(historyDocs);
      }

      booking.seats = newSeatIds;
      booking.seat_count = newSeatIds.length;
      if (totalPrice) booking.total_price = totalPrice;

      await booking.save();

      res.status(200).json({
        success: true,
        message: "Seats updated successfully",
        data: { booking },
      });

      // Log activity
      await logActivity({
        customerId: booking.customerId,
        userId: req.user?.userId,
        action: "BOOK_UPDATE_SEATS",
        status: "SUCCESS",
        targetId: booking._id,
        req,
        metadata: {
          referenceCode: booking.reference_code,
          seatCount: booking.seat_count,
          bookingStatus: booking.booking_status,
        },
      });
    } catch (error) {
      logger.error("Change seat error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  }

  // 5. DELETE BOOKING (SOFT DELETE)
  static async delete(req, res) {
    try {
      const { id } = req.params;
      BookingController.validateObjectId(id);

      const booking = await Booking.findById(id);

      if (!booking) {
        return res
          .status(404)
          .json({ success: false, message: "Booking not found" });
      }

      const userRole = req.user?.role || (req.customer ? Role.CUSTOMER : null);
      const userId =
        req.user?.userId ||
        req.user?.id ||
        req.user?._id ||
        req.customer?.customerId ||
        req.customer?.id;

      // Ownership check for normal users/customers
      if (
        (userRole === Role.USER || userRole === Role.CUSTOMER) &&
        booking.customerId &&
        userId &&
        booking.customerId.toString() !== userId.toString()
      ) {
        return res.status(403).json({
          success: false,
          message: "Forbidden: You can only cancel your own bookings",
        });
      }

      const isDeletion = req.method === "DELETE";
      const actionType = isDeletion ? "BOOK_DELETE" : "BOOK_CANCEL";
      const successMessage = isDeletion
        ? "Booking deleted successfully"
        : "Booking cancelled successfully";
      const logReason = isDeletion
        ? "Deleted by admin"
        : userRole === Role.USER || userRole === Role.CUSTOMER
          ? "Cancelled by user"
          : "Cancelled by admin";

      await booking.cancelBooking(logReason);

      // If it's a hard "delete" request, set deletedAt manually
      if (isDeletion) {
        booking.deletedAt = new Date();
        await booking.save();
      }

      // Notify customer of cancellation/deletion
      if (booking.customerId) {
        // Populate showtime + movie for the notification message
        const populatedBooking = await Booking.findById(booking._id).populate({
          path: "showtimeId",
          populate: { path: "movie_id", select: "title" },
        });

        const movieTitle =
          populatedBooking?.showtimeId?.movie_id?.title || "Movie";

        NotificationController.notifyCustomer(
          booking.customerId,
          {
            type: isDeletion ? "booking_deleted" : "booking_cancelled",
            title: isDeletion ? "Booking Deleted" : "Booking Cancelled",
            message: `Your booking ${booking.reference_code} for "${movieTitle}" has been ${isDeletion ? "deleted" : "cancelled"}.`,
            metadata: {
              ref: booking.reference_code,
              movie: movieTitle,
            },
            relatedId: booking._id,
          },
          req,
        );
      }

      // Log activity
      await logActivity({
        customerId: booking.customerId,
        userId: req.user?.userId || req.user?.id || req.user?._id,
        action: actionType,
        status: "SUCCESS",
        targetId: booking._id,
        req,
        metadata: {
          referenceCode: booking.reference_code,
          reason: logReason,
        },
      });

      // Notify via Socket.io
      emitEvent("booking:cancelled", { id: booking._id });
      emitEvent("seat:released", { 
        showtimeId: booking.showtimeId, 
        seats: booking.seats 
      });

      res.status(200).json({
        success: true,
        message: successMessage,
      });
    } catch (error) {
      logger.error(
        `${req.method === "DELETE" ? "Delete" : "Cancel"} booking error:`,
        error,
      );
      res.status(500).json({
        success: false,
        message: `Failed to ${req.method === "DELETE" ? "delete" : "cancel"} booking`,
      });
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
        { new: true },
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

      // Log activity
      await logActivity({
        customerId: booking.customerId,
        userId: req.user?.userId || req.user?.id || req.user?._id,
        action: "BOOK_RESTORE",
        status: "SUCCESS",
        targetId: booking._id,
        req,
        metadata: {
          referenceCode: booking.reference_code,
        },
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

      // Find the booking first to ensure it exists and to get its details
      const booking = await Booking.findById(id);
      if (!booking) {
        return res
          .status(404)
          .json({ success: false, message: "Booking not found" });
      }

      // Create cancellation history before deleting
      if (booking.seats && booking.seats.length > 0) {
        await SeatBookingHistory.updateMany(
          { bookingId: booking._id, action: "booked" },
          { $set: { action: "canceled" } },
        );
      }

      // Delete associated SeatBooking records
      const { deletedCount: sbDeletedCount } = await SeatBooking.deleteMany({
        bookingId: id,
      });
      logger.info(
        `Deleted ${sbDeletedCount} SeatBooking records for permanently deleted booking ID: ${id}`,
      );

      // Perform permanent deletion of the Booking
      await Booking.findByIdAndDelete(id);

      res.status(200).json({
        success: true,
        message: "Booking permanently deleted",
      });

      // Log activity
      await logActivity({
        customerId: booking.customerId,
        userId: req.user?.userId || req.user?.id || req.user?._id,
        action: "BOOK_FORCE_DELETE",
        status: "SUCCESS",
        targetId: booking._id,
        req,
        metadata: {
          referenceCode: booking.reference_code,
          reason: "Permanently deleted by admin",
        },
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
        .populate("customerId", "username email phone")
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
        .populate("customerId", "username email phone")
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
          "Found expired while fetching by reference",
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
      // Staff uses userId, Customer uses customerId
      const customerId =
        req.customer?.customerId ||
        req.customer?.id ||
        req.user?.userId ||
        req.user?.id ||
        req.user?._id;

      BookingController.validateObjectId(id);

      const booking = await Booking.findById(id);

      if (!booking) {
        return res
          .status(404)
          .json({ success: false, message: "Booking not found" });
      }

      // Ensure the booking belongs to the user trying to cancel it
      if (
        booking.customerId &&
        customerId &&
        booking.customerId.toString() !== customerId.toString()
      ) {
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

      const originalStatus = booking.booking_status;
      await booking.cancelBooking("Cancelled by user");

      await logActivity({
        customerId: customerId,
        action:
          originalStatus === "Pending"
            ? "BOOK_CANCEL_PENDING"
            : "BOOK_CANCEL_CONFIRMED",
        status: "SUCCESS",
        targetId: booking._id,
        req,
        metadata: {
          referenceCode: booking.reference_code,
          reason: "Cancelled by user",
        },
      });

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
