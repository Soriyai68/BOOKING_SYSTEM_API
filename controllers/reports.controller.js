const mongoose = require("mongoose");
const reports = require("../models");

// Helper to calculate trend percentage
const calculateTrend = (current, previous) => {
  if (previous === 0) return current > 0 ? 100 : 0;
  const trend = ((current - previous) / previous) * 100;
  return parseFloat(trend.toFixed(1));
};

//repost total customers
exports.getTotalCustomers = async (req, res) => {
  try {
    const totalCustomers = await reports.Customer.countDocuments();

    // Trend calculation (Last 30 days vs Previous 30 days)
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const [currentPeriod, previousPeriod] = await Promise.all([
      reports.Customer.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      reports.Customer.countDocuments({
        createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
      }),
    ]);

    const trend = calculateTrend(currentPeriod, previousPeriod);

    res.status(200).json({ totalCustomers, trend });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//report total bookings
exports.getTotalBookings = async (req, res) => {
  try {
    const totalBookings = await reports.Booking.countDocuments();

    // Trend calculation
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const [currentPeriod, previousPeriod] = await Promise.all([
      reports.Booking.countDocuments({
        createdAt: { $gte: thirtyDaysAgo },
        deletedAt: null,
      }),
      reports.Booking.countDocuments({
        createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
        deletedAt: null,
      }),
    ]);

    const trend = calculateTrend(currentPeriod, previousPeriod);

    res.status(200).json({ totalBookings, trend });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//report total revenue
exports.getTotalRevenue = async (req, res) => {
  try {
    const totalRevenueResult = await reports.Payment.aggregate([
      { $match: { status: "Completed", deletedAt: null } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" },
        },
      },
    ]);

    const totalRevenue =
      totalRevenueResult.length > 0 ? totalRevenueResult[0].totalRevenue : 0;

    // Trend calculation
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const getRevenueForPeriod = async (start, end) => {
      const match = {
        status: "Completed",
        deletedAt: null,
        createdAt: { $gte: start },
      };
      if (end) match.createdAt.$lt = end;

      const result = await reports.Payment.aggregate([
        { $match: match },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);
      return result.length > 0 ? result[0].total : 0;
    };

    const [currentPeriod, previousPeriod] = await Promise.all([
      getRevenueForPeriod(thirtyDaysAgo),
      getRevenueForPeriod(sixtyDaysAgo, thirtyDaysAgo),
    ]);

    const trend = calculateTrend(currentPeriod, previousPeriod);

    res.status(200).json({ totalRevenue, trend });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//total movies
exports.getTotalMovies = async (req, res) => {
  try {
    const totalMovies = await reports.Movie.countDocuments();

    // Trend for movies is less dynamic, but we can compare recently added ones
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const [currentPeriod, previousPeriod] = await Promise.all([
      reports.Movie.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      reports.Movie.countDocuments({
        createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
      }),
    ]);

    const trend = calculateTrend(currentPeriod, previousPeriod);

    res.status(200).json({ totalMovies, trend });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

//report customer booking frequency
exports.getCustomerBookingFrequency = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const pipeline = [
      {
        $match: {
          deletedAt: null,
          booking_status: { $in: ["Confirmed", "Completed"] },
        },
      },
      {
        $group: {
          _id: "$customerId",
          total_bookings: { $sum: 1 },
          total_spend: { $sum: "$total_price" },
        },
      },
      {
        $lookup: {
          from: "customers",
          localField: "_id",
          foreignField: "_id",
          as: "customer",
        },
      },
      {
        $unwind: {
          path: "$customer",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          _id: 0,
          user_id: "$_id",
          customer_type: "$customer.customerType",
          customer_name: "$customer.name",
          customer_phone: "$customer.phone",
          customer_email: "$customer.email",
          total_bookings: 1,
          total_spend: 1,
        },
      },
      {
        $sort: { total_bookings: -1 },
      },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [{ $skip: skip }, { $limit: limitNum }],
        },
      },
    ];

    const result = await reports.Booking.aggregate(pipeline);
    const total = result[0].metadata[0]?.total || 0;
    const data = result[0].data;

    res.status(200).json({
      success: true,
      data,
      total,
      page: parseInt(page),
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// get revenue report (grouped by date)
exports.getRevenueReport = async (req, res) => {
  try {
    const { timeframe = "month" } = req.query;
    let groupBy = {
      $dateToString: { format: "%Y-%m-%d", date: "$payment_date" },
    };

    if (timeframe === "year") {
      groupBy = { $dateToString: { format: "%Y-%m", date: "$payment_date" } };
    }

    const revenueData = await reports.Payment.aggregate([
      { $match: { status: "Completed", deletedAt: null } },
      {
        $group: {
          _id: groupBy,
          revenue: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.status(200).json({ success: true, data: revenueData });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// get booking status report
exports.getBookingStatusReport = async (req, res) => {
  try {
    const statusData = await reports.Booking.aggregate([
      { $match: { deletedAt: null } },
      {
        $group: {
          _id: "$booking_status",
          count: { $sum: 1 },
        },
      },
    ]);
    res.status(200).json({ success: true, data: statusData });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// get popular movies report
exports.getPopularMoviesReport = async (req, res) => {
  try {
    const popularMovies = await reports.Booking.aggregate([
      { $match: { deletedAt: null, booking_status: { $ne: "Cancelled" } } },
      {
        $lookup: {
          from: "showtimes",
          localField: "showtimeId",
          foreignField: "_id",
          as: "showtime",
        },
      },
      { $unwind: "$showtime" },
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
        $group: {
          _id: "$movie.title",
          bookings: { $sum: 1 },
        },
      },
      { $sort: { bookings: -1 } },
      { $limit: 10 },
    ]);
    res.status(200).json({ success: true, data: popularMovies });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// get seat type revenue report
exports.getSeatTypeRevenueReport = async (req, res) => {
  try {
    const seatTypeRevenue = await reports.Booking.aggregate([
      {
        $match: {
          booking_status: { $in: ["Confirmed", "Completed"] },
          deletedAt: null,
        },
      },
      // Convert string seat IDs to ObjectIds for lookup
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
      { $unwind: "$seatObjectIds" },
      {
        $lookup: {
          from: "seats",
          localField: "seatObjectIds",
          foreignField: "_id",
          as: "seatDetails",
        },
      },
      { $unwind: "$seatDetails" },
      {
        $group: {
          _id: "$seatDetails.seat_type",
          revenue: { $sum: "$seatDetails.price" },
        },
      },
    ]);
    res.status(200).json({ success: true, data: seatTypeRevenue });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// get detailed revenue report with filters
exports.getDetailedRevenueReport = async (req, res) => {
  try {
    const {
      dateFrom,
      dateTo,
      payment_method,
      customerType,
      page = 1,
      limit = 10,
    } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const match = { status: "Completed", deletedAt: null };

    if (dateFrom || dateTo) {
      match.payment_date = {};
      if (dateFrom) match.payment_date.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        match.payment_date.$lte = end;
      }
    }

    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: "bookings",
          localField: "bookingId",
          foreignField: "_id",
          as: "booking",
        },
      },
      { $unwind: { path: "$booking", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "customers",
          localField: "booking.customerId",
          foreignField: "_id",
          as: "customer",
        },
      },
      { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
    ];

    if (payment_method) {
      pipeline.push({ $match: { payment_method } });
    }

    if (customerType) {
      pipeline.push({ $match: { "customer.customerType": customerType } });
    }

    pipeline.push(
      {
        $project: {
          _id: 1,
          amount: 1,
          payment_method: 1,
          payment_date: 1,
          transaction_id: 1,
          customer_name: "$customer.name",
          customerType: "$customer.customerType",
          reference_code: "$booking.reference_code",
        },
      },
      { $sort: { payment_date: -1 } },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [{ $skip: skip }, { $limit: limitNum }],
        },
      },
    );

    const result = await reports.Payment.aggregate(pipeline);
    const total = result[0].metadata[0]?.total || 0;
    const data = result[0].data;

    res.status(200).json({
      success: true,
      data,
      total,
      page: parseInt(page),
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// get detailed booking report
exports.getDetailedBookingReport = async (req, res) => {
  try {
    const {
      dateFrom,
      dateTo,
      booking_status,
      customerType,
      page = 1,
      limit = 10,
    } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const match = { deletedAt: null };

    if (dateFrom || dateTo) {
      match.booking_date = {};
      if (dateFrom) match.booking_date.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        match.booking_date.$lte = end;
      }
    }

    if (booking_status) {
      match.booking_status = booking_status;
    }

    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: "customers",
          localField: "customerId",
          foreignField: "_id",
          as: "customer",
        },
      },
      { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
    ];

    if (customerType) {
      pipeline.push({ $match: { "customer.customerType": customerType } });
    }

    pipeline.push(
      {
        $lookup: {
          from: "showtimes",
          localField: "showtimeId",
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
      {
        $project: {
          _id: 1,
          reference_code: 1,
          booking_date: 1,
          booking_status: 1,
          total_price: 1,
          seat_count: 1,
          customer_name: "$customer.name",
          customerType: "$customer.customerType",
          movie_title: "$movie.title",
          show_date: "$showtime.show_date",
          start_time: "$showtime.start_time",
        },
      },
      { $sort: { booking_date: -1 } },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [{ $skip: skip }, { $limit: limitNum }],
        },
      },
    );

    const result = await reports.Booking.aggregate(pipeline);
    const total = result[0].metadata[0]?.total || 0;
    const data = result[0].data;

    res.status(200).json({
      success: true,
      data,
      total,
      page: parseInt(page),
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// get detailed movie performance report
exports.getDetailedMovieReport = async (req, res) => {
  try {
    const { dateFrom, dateTo, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const match = { deletedAt: null, booking_status: { $ne: "Cancelled" } };

    if (dateFrom || dateTo) {
      match.booking_date = {};
      if (dateFrom) match.booking_date.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        match.booking_date.$lte = end;
      }
    }

    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: "showtimes",
          localField: "showtimeId",
          foreignField: "_id",
          as: "showtime",
        },
      },
      { $unwind: "$showtime" },
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
        $group: {
          _id: "$movie._id",
          title: { $first: "$movie.title" },
          total_bookings: { $sum: 1 },
          total_seats: { $sum: "$seat_count" },
          total_revenue: { $sum: "$total_price" },
          showtime_count: { $addToSet: "$showtimeId" },
        },
      },
      {
        $project: {
          _id: 1,
          title: 1,
          total_bookings: 1,
          total_seats: 1,
          total_revenue: 1,
          showtimes: { $size: "$showtime_count" },
        },
      },
      { $sort: { total_revenue: -1 } },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [{ $skip: skip }, { $limit: limitNum }],
        },
      },
    ];

    const result = await reports.Booking.aggregate(pipeline);
    const total = result[0].metadata[0]?.total || 0;
    const data = result[0].data;

    res.status(200).json({
      success: true,
      data,
      total,
      page: parseInt(page),
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
