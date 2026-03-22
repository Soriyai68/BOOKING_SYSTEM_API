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
        $match: {
          $or: [
            { customer: { $exists: false } },
            { "customer.isActive": { $ne: false } },
          ],
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
      {
        $match: {
          $or: [
            { customer: { $exists: false } },
            { "customer.isActive": { $ne: false } },
          ],
        },
      },
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
      {
        $match: {
          $or: [
            { customer: { $exists: false } },
            { "customer.isActive": { $ne: false } },
          ],
        },
      },
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

// get payment method analysis report
exports.getPaymentMethodAnalysisReport = async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;

    const match = { deletedAt: null };

    if (dateFrom || dateTo) {
      match.createdAt = {};
      if (dateFrom) match.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        match.createdAt.$lte = end;
      }
    }

    const paymentMethodData = await reports.Payment.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$payment_method",
          total_transactions: { $sum: 1 },
          total_revenue: { $sum: "$amount" },
          successful_transactions: {
            $sum: { $cond: [{ $eq: ["$status", "Completed"] }, 1, 0] },
          },
          failed_transactions: {
            $sum: { $cond: [{ $eq: ["$status", "Failed"] }, 1, 0] },
          },
          pending_transactions: {
            $sum: { $cond: [{ $eq: ["$status", "Pending"] }, 1, 0] },
          },
          avg_transaction_value: { $avg: "$amount" },
          first_transaction_date: { $min: "$createdAt" },
          last_transaction_date: { $max: "$createdAt" },
        },
      },
      {
        $project: {
          _id: 1,
          payment_method: "$_id",
          total_transactions: 1,
          total_revenue: { $round: ["$total_revenue", 2] },
          successful_transactions: 1,
          failed_transactions: 1,
          pending_transactions: 1,
          success_rate: {
            $round: [
              {
                $multiply: [
                  {
                    $divide: ["$successful_transactions", "$total_transactions"],
                  },
                  100,
                ],
              },
              2,
            ],
          },
          failed_rate: {
            $round: [
              {
                $multiply: [
                  { $divide: ["$failed_transactions", "$total_transactions"] },
                  100,
                ],
              },
              2,
            ],
          },
          avg_transaction_value: { $round: ["$avg_transaction_value", 2] },
          first_transaction_date: 1,
          last_transaction_date: 1,
        },
      },
      { $sort: { total_revenue: -1 } },
    ]);

    // Calculate total revenue for contribution percentage
    const totalRevenue = paymentMethodData.reduce(
      (sum, item) => sum + item.total_revenue,
      0
    );

    // Add revenue contribution percentage
    const enrichedData = paymentMethodData.map((item) => ({
      ...item,
      revenue_contribution_percentage:
        totalRevenue > 0
          ? parseFloat(((item.total_revenue / totalRevenue) * 100).toFixed(2))
          : 0,
    }));

    res.status(200).json({ success: true, data: enrichedData });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// get showtime utilization report
exports.getShowtimeUtilizationReport = async (req, res) => {
  try {
    const { dateFrom, dateTo, page = 1, limit = 10 } = req.query;
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
          from: "halls",
          localField: "showtime.hall_id",
          foreignField: "_id",
          as: "hall",
        },
      },
      { $unwind: { path: "$hall", preserveNullAndEmptyArrays: true } },
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
        $lookup: {
          from: "theaters",
          localField: "hall.theater_id",
          foreignField: "_id",
          as: "theater",
        },
      },
      { $unwind: { path: "$theater", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$showtimeId",
          showtime_date: { $first: "$showtime.show_date" },
          start_time: { $first: "$showtime.start_time" },
          end_time: { $first: "$showtime.end_time" },
          movie_title: { $first: "$movie.title" },
          hall_name: { $first: "$hall.hall_name" },
          theater_name: { $first: "$theater.name" },
          total_seats_available: { $first: "$hall.total_seats" },
          seats_booked: { $sum: "$seat_count" },
          total_revenue: { $sum: "$total_price" },
          booking_count: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 1,
          showtime_date: 1,
          start_time: 1,
          end_time: 1,
          movie_title: 1,
          hall_name: 1,
          theater_name: 1,
          total_seats_available: 1,
          seats_booked: 1,
          seats_available: {
            $subtract: ["$total_seats_available", "$seats_booked"],
          },
          occupancy_rate: {
            $round: [
              {
                $multiply: [
                  {
                    $divide: ["$seats_booked", "$total_seats_available"],
                  },
                  100,
                ],
              },
              2,
            ],
          },
          total_revenue: { $round: ["$total_revenue", 2] },
          booking_count: 1,
          revenue_per_seat: {
            $round: [
              {
                $divide: ["$total_revenue", "$seats_booked"],
              },
              2,
            ],
          },
        },
      },
      { $sort: { showtime_date: -1, start_time: -1 } },
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

// get customer demographic report
exports.getCustomerDemographicReport = async (req, res) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // Age group distribution
    const ageGroupDistribution = await reports.Customer.aggregate([
      { $match: { deletedAt: null } },
      {
        $addFields: {
          age: {
            $subtract: [
              new Date().getFullYear(),
              { $year: "$dateOfBirth" },
            ],
          },
        },
      },
      {
        $bucket: {
          groupBy: "$age",
          boundaries: [0, 18, 25, 35, 45, 55, 65, 100],
          default: "Unknown",
          output: {
            count: { $sum: 1 },
          },
        },
      },
      {
        $project: {
          _id: 0,
          age_group: {
            $cond: [
              { $eq: ["$_id", "Unknown"] },
              "Unknown",
              {
                $concat: [
                  { $toString: "$_id" },
                  "-",
                  {
                    $toString: {
                      $subtract: ["$_id", 1],
                    },
                  },
                ],
              },
            ],
          },
          count: 1,
        },
      },
    ]);

    // Geographic distribution (top 20 cities)
    const geographicDistribution = await reports.Customer.aggregate([
      { $match: { deletedAt: null, city: { $exists: true, $ne: null } } },
      {
        $group: {
          _id: "$city",
          province: { $first: "$province" },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
      {
        $project: {
          _id: 1,
          province: 1,
          count: 1,
        },
      },
    ]);

    // New vs Returning customers
    const newVsReturning = await reports.Booking.aggregate([
      { $match: { deletedAt: null } },
      {
        $lookup: {
          from: "customers",
          localField: "customerId",
          foreignField: "_id",
          as: "customer",
        },
      },
      { $unwind: "$customer" },
      {
        $group: {
          _id: null,
          new_customers: {
            $sum: {
              $cond: [
                {
                  $lte: [
                    { $subtract: [new Date(), "$customer.createdAt"] },
                    30 * 24 * 60 * 60 * 1000,
                  ],
                },
                1,
                0,
              ],
            },
          },
          returning_customers: {
            $sum: {
              $cond: [
                {
                  $gt: [
                    { $subtract: [new Date(), "$customer.createdAt"] },
                    30 * 24 * 60 * 60 * 1000,
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    // Growth rate (month-over-month)
    const currentMonthCustomers = await reports.Customer.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
      deletedAt: null,
    });
    const previousMonthCustomers = await reports.Customer.countDocuments({
      createdAt: { $gte: sixtyDaysAgo, $lt: thirtyDaysAgo },
      deletedAt: null,
    });
    const growthRate =
      previousMonthCustomers > 0
        ? parseFloat(
            (
              ((currentMonthCustomers - previousMonthCustomers) /
                previousMonthCustomers) *
              100
            ).toFixed(2),
          )
        : 0;

    // Customer status
    const customerStatus = await reports.Customer.aggregate([
      { $match: { deletedAt: null } },
      {
        $group: {
          _id: null,
          active: {
            $sum: { $cond: [{ $eq: ["$isActive", true] }, 1, 0] },
          },
          inactive: {
            $sum: { $cond: [{ $eq: ["$isActive", false] }, 1, 0] },
          },
          churned: {
            $sum: {
              $cond: [
                {
                  $lt: [
                    "$lastBookingDate",
                    new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    // Retention rate
    const totalCustomers = await reports.Customer.countDocuments({
      deletedAt: null,
    });
    const retainedCustomers = await reports.Customer.countDocuments({
      isActive: true,
      deletedAt: null,
    });
    const retentionRate =
      totalCustomers > 0
        ? parseFloat(((retainedCustomers / totalCustomers) * 100).toFixed(2))
        : 0;

    // Detailed customers with booking info
    const detailedCustomers = await reports.Customer.aggregate([
      { $match: { deletedAt: null } },
      {
        $lookup: {
          from: "bookings",
          localField: "_id",
          foreignField: "customerId",
          as: "bookings",
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          email: 1,
          phone: 1,
          city: 1,
          province: 1,
          customerType: 1,
          createdAt: 1,
          isActive: 1,
          total_bookings: { $size: "$bookings" },
          total_spent: {
            $sum: {
              $map: {
                input: "$bookings",
                as: "booking",
                in: "$$booking.total_price",
              },
            },
          },
          last_booking_date: { $max: "$bookings.booking_date" },
        },
      },
      { $sort: { total_spent: -1 } },
      { $limit: 100 },
    ]);

    res.status(200).json({
      success: true,
      data: {
        ageGroupDistribution,
        geographicDistribution,
        newVsReturning: newVsReturning[0] || {
          new_customers: 0,
          returning_customers: 0,
        },
        growthRate,
        customerStatus: customerStatus[0] || {
          active: 0,
          inactive: 0,
          churned: 0,
        },
        retentionRate,
        detailedCustomers,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// get staff performance report
exports.getStaffPerformanceReport = async (req, res) => {
  try {
    const { dateFrom, dateTo, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    const match = { deletedAt: null };

    if (dateFrom || dateTo) {
      match.createdAt = {};
      if (dateFrom) match.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        match.createdAt.$lte = end;
      }
    }

    // Get all staff members first
    const staffMembers = await reports.User.find(
      { deletedAt: null },
      { _id: 1, name: 1, email: 1, role: 1 }
    );

    // For each staff member, get their activity from bookings and payments
    const staffPerformance = await Promise.all(
      staffMembers.map(async (staff) => {
        // Get bookings created by this staff (if tracked in booking)
        // Since bookings don't track createdBy, we'll use activity logs or count all payments
        
        // Get payments and related booking info
        const paymentPipeline = [
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
            $group: {
              _id: null,
              total_transactions: { $sum: 1 },
              total_revenue: { $sum: "$amount" },
              confirmed_bookings: {
                $sum: { $cond: [{ $eq: ["$booking.booking_status", "Confirmed"] }, 1, 0] },
              },
              completed_bookings: {
                $sum: { $cond: [{ $eq: ["$booking.booking_status", "Completed"] }, 1, 0] },
              },
              cancelled_bookings: {
                $sum: { $cond: [{ $eq: ["$booking.booking_status", "Cancelled"] }, 1, 0] },
              },
              pending_bookings: {
                $sum: { $cond: [{ $eq: ["$booking.booking_status", "Pending"] }, 1, 0] },
              },
              total_seats_sold: { $sum: "$booking.seat_count" },
              avg_transaction_value: { $avg: "$amount" },
            },
          },
        ];

        const result = await reports.Payment.aggregate(paymentPipeline);
        const stats = result[0] || {
          total_transactions: 0,
          total_revenue: 0,
          confirmed_bookings: 0,
          completed_bookings: 0,
          cancelled_bookings: 0,
          pending_bookings: 0,
          total_seats_sold: 0,
          avg_transaction_value: 0,
        };

        const totalBookings = stats.confirmed_bookings + stats.completed_bookings + stats.cancelled_bookings + stats.pending_bookings;
        const completionRate = totalBookings > 0 ? parseFloat(((stats.completed_bookings / totalBookings) * 100).toFixed(2)) : 0;
        const cancellationRate = totalBookings > 0 ? parseFloat(((stats.cancelled_bookings / totalBookings) * 100).toFixed(2)) : 0;

        return {
          _id: staff._id,
          staff_name: staff.name,
          staff_email: staff.email,
          staff_role: staff.role,
          total_bookings_processed: stats.total_transactions,
          total_revenue_generated: parseFloat((stats.total_revenue || 0).toFixed(2)),
          confirmed_bookings: stats.confirmed_bookings,
          completed_bookings: stats.completed_bookings,
          cancelled_bookings: stats.cancelled_bookings,
          pending_bookings: stats.pending_bookings,
          total_seats_sold: stats.total_seats_sold,
          avg_booking_value: parseFloat((stats.avg_transaction_value || 0).toFixed(2)),
          completion_rate: completionRate,
          cancellation_rate: cancellationRate,
        };
      })
    );

    // Filter out staff with no activity and sort by revenue
    const activeStaff = staffPerformance
      .filter(s => s.total_bookings_processed > 0)
      .sort((a, b) => b.total_revenue_generated - a.total_revenue_generated);

    // Apply pagination
    const paginatedData = activeStaff.slice(skip, skip + limitNum);
    const total = activeStaff.length;

    res.status(200).json({
      success: true,
      data: paginatedData,
      total,
      page: parseInt(page),
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// get inventory & seat management report
exports.getInventorySeatManagementReport = async (req, res) => {
  try {
    const { hallId, theaterId, dateFrom, dateTo, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const limitNum = parseInt(limit);

    // Build date match filter
    const dateMatch = {};
    if (dateFrom || dateTo) {
      dateMatch.createdAt = {};
      if (dateFrom) dateMatch.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        dateMatch.createdAt.$lte = end;
      }
    }

    // Get seat inventory by hall
    const seatInventoryPipeline = [
      { $match: { deletedAt: null, ...dateMatch } },
    ];

    if (hallId) {
      seatInventoryPipeline.push({ $match: { hall_id: mongoose.Types.ObjectId(hallId) } });
    }

    seatInventoryPipeline.push(
      {
        $lookup: {
          from: "halls",
          localField: "hall_id",
          foreignField: "_id",
          as: "hall",
        },
      },
      { $unwind: { path: "$hall", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "theaters",
          localField: "hall.theater_id",
          foreignField: "_id",
          as: "theater",
        },
      },
      { $unwind: { path: "$theater", preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id: "$hall_id",
          hall_name: { $first: "$hall.hall_name" },
          theater_name: { $first: "$theater.name" },
          theater_id: { $first: "$hall.theater_id" },
          total_seats: { $first: "$hall.total_seats" },
          seat_types: { $push: "$seat_type" },
          seat_prices: { $push: "$price" },
          seat_count_by_type: {
            $push: {
              type: "$seat_type",
              count: 1,
              price: "$price",
            },
          },
        },
      },
      {
        $lookup: {
          from: "seatbookings",
          localField: "_id",
          foreignField: "seatId",
          as: "bookings",
        },
      },
      {
        $project: {
          _id: 1,
          hall_name: 1,
          theater_name: 1,
          theater_id: 1,
          total_seats: 1,
          booked_seats: { $size: "$bookings" },
          available_seats: {
            $subtract: ["$total_seats", { $size: "$bookings" }],
          },
          occupancy_rate: {
            $round: [
              {
                $multiply: [
                  {
                    $divide: [{ $size: "$bookings" }, "$total_seats"],
                  },
                  100,
                ],
              },
              2,
            ],
          },
          seat_types: 1,
          seat_prices: 1,
        },
      },
      { $sort: { occupancy_rate: -1 } },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [{ $skip: skip }, { $limit: limitNum }],
        },
      },
    );

    const seatInventoryResult = await reports.Seat.aggregate(seatInventoryPipeline);
    const seatInventoryTotal = seatInventoryResult[0].metadata[0]?.total || 0;
    const seatInventoryData = seatInventoryResult[0].data;

    // Get seat type distribution
    const seatTypeDistribution = await reports.Seat.aggregate([
      { $match: { deletedAt: null, ...dateMatch } },
      {
        $group: {
          _id: "$seat_type",
          count: { $sum: 1 },
          avg_price: { $avg: "$price" },
          total_value: { $sum: "$price" },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Get overall inventory summary
    const inventorySummary = await reports.Seat.aggregate([
      { $match: { deletedAt: null, ...dateMatch } },
      {
        $group: {
          _id: null,
          total_seats: { $sum: 1 },
          total_inventory_value: { $sum: "$price" },
        },
      },
    ]);

    // Get booked vs available seats
    const bookedSeats = await reports.SeatBooking.countDocuments({
      status: "booked",
      deletedAt: null,
      createdAt: dateMatch.createdAt ? dateMatch.createdAt : undefined,
    });

    const totalSeats = inventorySummary[0]?.total_seats || 0;
    const availableSeats = totalSeats - bookedSeats;
    const occupancyRate = totalSeats > 0 ? parseFloat(((bookedSeats / totalSeats) * 100).toFixed(2)) : 0;

    // Get seat status breakdown (from Seat model - maintenance status)
    const seatStatusBreakdown = await reports.Seat.aggregate([
      { $match: { deletedAt: null, ...dateMatch } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Get seat booking status breakdown (from SeatBooking model)
    const seatBookingStatus = await reports.SeatBooking.aggregate([
      { $match: { deletedAt: null, ...(dateMatch.createdAt ? { createdAt: dateMatch.createdAt } : {}) } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      data: {
        seatInventoryByHall: seatInventoryData,
        seatTypeDistribution,
        inventorySummary: {
          total_seats: totalSeats,
          booked_seats: bookedSeats,
          available_seats: availableSeats,
          occupancy_rate: occupancyRate,
          total_inventory_value: inventorySummary[0]?.total_inventory_value || 0,
        },
        seatStatusBreakdown,
        seatBookingStatus,
      },
      total: seatInventoryTotal,
      page: parseInt(page),
      limit: limitNum,
      totalPages: Math.ceil(seatInventoryTotal / limitNum),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
