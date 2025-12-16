const mongoose = require("mongoose");
const { Payment, Booking } = require("../models");
const { Role } = require("../data");
const logger = require("../utils/logger");
const { BakongKHQR, khqrData, IndividualInfo } = require("bakong-khqr");

class PaymentController {
  // Helper method to validate ObjectId
  static validateObjectId(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("Invalid Payment ID format");
    }
  }

  // Build filter query
  static buildFilterQuery(filters) {
    const query = {};

    if (
      filters.bookingId &&
      mongoose.Types.ObjectId.isValid(filters.bookingId)
    ) {
      query.bookingId = new mongoose.Types.ObjectId(filters.bookingId);
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.payment_method) {
      query.payment_method = filters.payment_method;
    }

    if (filters.currency) {
      query.currency = filters.currency;
    }

    // Date range filter
    if (filters.dateFrom || filters.dateTo) {
      query.payment_date = {};
      if (filters.dateFrom)
        query.payment_date.$gte = new Date(filters.dateFrom);
      if (filters.dateTo) query.payment_date.$lte = new Date(filters.dateTo);
    }

    // Amount range filter
    if (filters.amountFrom || filters.amountTo) {
      query.amount = {};
      if (filters.amountFrom)
        query.amount.$gte = parseFloat(filters.amountFrom);
      if (filters.amountTo) query.amount.$lte = parseFloat(filters.amountTo);
    }

    return query;
  }

  // 1. GET ALL PAYMENTS
  static async getAll(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = "payment_date",
        sortOrder = "desc",
        search,
        includeDeleted = false,
        ...filters
      } = req.query;

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      const matchQuery = { ...PaymentController.buildFilterQuery(filters) };

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
      ];

      // Optional search on description
      if (search) {
        pipeline.push({
          $match: {
            $or: [
              { description: { $regex: search, $options: "i" } },
              { "booking.reference_code": { $regex: search, $options: "i" } },
            ],
          },
        });
      }

      // Count total
      const totalCountResult = await Payment.aggregate([
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
          amount: 1,
          bakongHash: 1,
          payment_method: 1,
          payment_date: 1,
          currency: 1,
          status: 1,
          fromAccount_id: 1,
          toAccount_id: 1,
          paid: 1,
          paidAt: 1,
          description: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      });

      const payments = await Payment.aggregate(pipeline);

      const totalPages = Math.ceil(totalCount / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      res.status(200).json({
        success: true,
        data: {
          payments,
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
      logger.error("Get all payments error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to retrieve payments" });
    }
  }

  // 2. GET PAYMENT BY ID
  static async getById(req, res) {
    try {
      const { id } = req.params;
      if (!id) {
        return res
          .status(400)
          .json({ success: false, message: "Payment ID is required" });
      }

      PaymentController.validateObjectId(id);

      const payment = await Payment.findById(id).populate(
        "bookingId",
        "reference_code booking_status total_price"
      );

      if (!payment) {
        return res
          .status(404)
          .json({ success: false, message: "Payment not found" });
      }

      res.status(200).json({
        success: true,
        data: { payment },
      });
    } catch (error) {
      logger.error("Get payment by ID error:", error);
      if (error.message === "Invalid Payment ID format") {
        return res.status(400).json({ success: false, message: error.message });
      }
      res
        .status(500)
        .json({ success: false, message: "Failed to retrieve payment" });
    }
  }

  // 3. GET PAYMENTS BY BOOKING ID
  static async getByBookingId(req, res) {
    try {
      const { bookingId } = req.params;
      if (!bookingId) {
        return res
          .status(400)
          .json({ success: false, message: "Booking ID is required" });
      }

      PaymentController.validateObjectId(bookingId);

      const payments = await Payment.find({
        bookingId,
        deletedAt: null,
      }).sort({ payment_date: -1 });

      res.status(200).json({
        success: true,
        data: { payments },
      });
    } catch (error) {
      logger.error("Get payments by booking ID error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to retrieve payments" });
    }
  }

  // 4. CREATE PAYMENT
  static async create(req, res) {
    try {
      const { bookingId, payment_method, currency } = req.body;

      // Validate booking exists
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        return res
          .status(404)
          .json({ success: false, message: "Booking not found" });
      }

      if (payment_method === "Bakong") {
        // generate KHQR (expires in 5 mins)
        const expirationTimestamp = Date.now() + 5 * 60 * 1000;
        const optionalData = {
          currency:
            currency === "KHR" ? khqrData.currency.khr : khqrData.currency.usd,
          amount: booking.total_price,
          expirationTimestamp,
        };

        const individualInfo = new IndividualInfo(
          process.env.BAKONG_ACCOUNT_USERNAME,
          "Movie Booking System", // Using a placeholder name
          "BATTAMBANG", // Using a placeholder city
          optionalData
        );
        // generate qr
        const khqr = new BakongKHQR();
        const qrData = khqr.generateIndividual(individualInfo);
        if (!qrData.data || qrData.status?.code !== 0) {
          return res.status(400).json({
            success: false,
            message: qrData.status?.message || "Failed to generate KHQR",
            error: qrData.status || null,
          });
        }

        const deepLink = `bakong://khqr?qr=${encodeURIComponent(
          qrData.data.qr
        )}`;
        const deepLinkWeb = `https://www.bakong.com.kh/khqr?qr=${encodeURIComponent(
          qrData.data.qr
        )}`;

        const payment = new Payment({
          bookingId,
          amount: booking.total_price,
          payment_method,
          currency: currency || "USD",
          status: "Pending",
          qr: qrData.data.qr,
          md5: qrData.data.md5,
          expiration: expirationTimestamp,
          qr_method: currency === "KHR" ? "KHQR" : "USD", // Dynamically set qr_method
          description: `Payment for booking ${booking.reference_code}`,
        });

        await payment.save();

        const populatedPayment = await Payment.findById(payment._id).populate(
          "bookingId",
          "reference_code booking_status total_price"
        );

        return res.status(201).json({
          success: true,
          message: "Payment initiated successfully. Please scan the QR code.",
          data: { payment: populatedPayment, deepLink, deepLinkWeb },
        });
      } else {
        // Handle other payment methods like Cash
        const payment = new Payment({
          bookingId,
          amount: booking.total_price,
          payment_method,
          currency: currency || "USD",
          status: "Completed",
          description: `Payment for booking ${booking.reference_code}`,
        });

        await payment.save();
        await booking.markAsCompleted(payment._id);

        const populatedPayment = await Payment.findById(payment._id).populate(
          "bookingId",
          "reference_code booking_status total_price"
        );

        return res.status(201).json({
          success: true,
          message: "Payment created successfully",
          data: { payment: populatedPayment },
        });
      }
    } catch (error) {
      logger.error("Create payment error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to create payment" });
    }
  }

  static async checkPayment(req, res) {
    const { md5 } = req.body;
    if (!md5) {
      return res
        .status(400)
        .json({ success: false, message: "md5 is required" });
    }
    return PaymentController.checkBakongPayment(req, res);
  }

static async checkBakongPayment(req, res) {
  const { md5 } = req.body;

  try {
    // 1. Find payment
    const payment = await Payment.findOne({ md5 });
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: "Payment not found",
      });
    }

    // 2. Call Bakong API
    const response = await fetch(
      `${process.env.BAKONG_PROD_BASE_API_URL}/check_transaction_by_md5`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.BAKONG_ACCESS_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ md5: payment.md5 }),
      }
    );

    // 3. Handle Bakong HTTP errors
    if (!response.ok) {
      const text = await response.text();
      logger.error("Bakong HTTP error:", response.status, text);

      return res.status(502).json({
        success: false,
        message: "Bakong service error",
        status: response.status,
      });
    }

    const data = await response.json();
    logger.info("Bakong response:", data);

    /**
     * Bakong responseCode meaning (common pattern)
     * 0 = completed
     * 1 = pending / not found yet
     * others = error
     */

    // 4. Payment COMPLETED
    if (data.responseCode === 0) {
      // Avoid double update
      if (payment.status !== "Completed") {
        payment.status = "Completed";
        payment.paid = true;
        payment.paidAt = new Date();

        payment.bakongHash = data.data?.hash || null;
        payment.fromAccount_id = data.data?.fromAccountId || null;
        payment.toAccount_id = data.data?.toAccountId || null;

        await payment.save();

        // Update booking if exists
        if (payment.bookingId) {
          const booking = await Booking.findById(payment.bookingId);
          if (booking && booking.status !== "Completed") {
            await booking.markAsCompleted(payment._id);
          }
        }
      }

      return res.status(200).json({
        success: true,
        status: "COMPLETED",
        message: "Payment confirmed",
        data: payment,
      });
    }

    // 5. Payment PENDING (NOT an error)
    if (data.responseCode === 1) {
      return res.status(200).json({
        success: false,
        status: "PENDING",
        message: data.message || "Payment is pending",
      });
    }
    // 6. Other Bakong errors
    return res.status(400).json({
      success: false,
      status: "FAILED",
      message: data.message || "Payment failed",
      code: data.responseCode,
    });
  } catch (error) {
    logger.error("Error in checkBakongPayment:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
}

  // 5. UPDATE PAYMENT
  static async update(req, res) {
    try {
      const { id } = req.params;
      PaymentController.validateObjectId(id);

      const updateData = { ...req.body };
      delete updateData._id;
      delete updateData.createdAt;

      const payment = await Payment.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      ).populate("bookingId", "reference_code booking_status total_price");

      if (!payment) {
        return res
          .status(404)
          .json({ success: false, message: "Payment not found" });
      }

      res.status(200).json({
        success: true,
        message: "Payment updated successfully",
        data: { payment },
      });
    } catch (error) {
      logger.error("Update payment error:", error);
      if (error.message === "Invalid Payment ID format") {
        return res.status(400).json({ success: false, message: error.message });
      }
      res
        .status(500)
        .json({ success: false, message: "Failed to update payment" });
    }
  }

  // 6. UPDATE PAYMENT STATUS
  static async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      PaymentController.validateObjectId(id);

      const payment = await Payment.findByIdAndUpdate(
        id,
        { $set: { status } },
        { new: true, runValidators: true }
      ).populate("bookingId", "reference_code booking_status total_price");

      if (!payment) {
        return res
          .status(404)
          .json({ success: false, message: "Payment not found" });
      }

      // If status is updated to 'Completed', update the booking as well
      if (status === "Completed" && payment.bookingId) {
        const booking = await Booking.findById(payment.bookingId);
        if (booking) {
          await booking.markAsCompleted(payment._id);
        }
      }

      res.status(200).json({
        success: true,
        message: "Payment status updated successfully",
        data: { payment },
      });
    } catch (error) {
      logger.error("Update payment status error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to update payment status" });
    }
  }

  // 7. SOFT DELETE PAYMENT
  static async delete(req, res) {
    try {
      const { id } = req.params;
      PaymentController.validateObjectId(id);

      const payment = await Payment.findByIdAndUpdate(
        id,
        { deletedAt: new Date() },
        { new: true }
      );

      if (!payment) {
        return res
          .status(404)
          .json({ success: false, message: "Payment not found" });
      }

      res.status(200).json({
        success: true,
        message: "Payment deleted successfully",
      });
    } catch (error) {
      logger.error("Delete payment error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to delete payment" });
    }
  }

  // 8. RESTORE DELETED PAYMENT
  static async restore(req, res) {
    try {
      const { id } = req.params;
      PaymentController.validateObjectId(id);

      const payment = await Payment.findByIdAndUpdate(
        id,
        { deletedAt: null },
        { new: true }
      );

      if (!payment) {
        return res
          .status(404)
          .json({ success: false, message: "Payment not found" });
      }

      res.status(200).json({
        success: true,
        message: "Payment restored successfully",
        data: { payment },
      });
    } catch (error) {
      logger.error("Restore payment error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to restore payment" });
    }
  }

  // 9. FORCE DELETE PAYMENT
  static async forceDelete(req, res) {
    try {
      const { id } = req.params;
      PaymentController.validateObjectId(id);

      const payment = await Payment.findByIdAndDelete(id);

      if (!payment) {
        return res
          .status(404)
          .json({ success: false, message: "Payment not found" });
      }

      res.status(200).json({
        success: true,
        message: "Payment permanently deleted",
      });
    } catch (error) {
      logger.error("Force delete payment error:", error);
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to permanently delete payment",
        });
    }
  }

  // 10. GET DELETED PAYMENTS
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

      const totalCount = await Payment.countDocuments(query);

      const payments = await Payment.find(query)
        .populate("bookingId", "reference_code booking_status total_price")
        .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
        .skip(skip)
        .limit(limitNum);

      const totalPages = Math.ceil(totalCount / limitNum);

      res.status(200).json({
        success: true,
        data: {
          payments,
          pagination: {
            currentPage: pageNum,
            totalPages,
            totalCount,
            limit: limitNum,
          },
        },
      });
    } catch (error) {
      logger.error("List deleted payments error:", error);
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to retrieve deleted payments",
        });
    }
  }

  // 11. GET PAYMENT ANALYTICS
  static async getAnalytics(req, res) {
    try {
      const totalPayments = await Payment.countDocuments({ deletedAt: null });
      const completedPayments = await Payment.countDocuments({
        status: "Completed",
        deletedAt: null,
      });
      const pendingPayments = await Payment.countDocuments({
        status: "Pending",
        deletedAt: null,
      });
      const failedPayments = await Payment.countDocuments({
        status: "Failed",
        deletedAt: null,
      });

      const totalRevenue = await Payment.aggregate([
        { $match: { status: "Completed", deletedAt: null } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);

      const paymentMethodBreakdown = await Payment.aggregate([
        { $match: { status: "Completed", deletedAt: null } },
        {
          $group: {
            _id: "$payment_method",
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]);

      const currencyBreakdown = await Payment.aggregate([
        { $match: { status: "Completed", deletedAt: null } },
        {
          $group: {
            _id: "$currency",
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
      ]);

      res.status(200).json({
        success: true,
        data: {
          totalPayments,
          completedPayments,
          pendingPayments,
          failedPayments,
          totalRevenue: totalRevenue[0]?.total || 0,
          paymentMethodBreakdown,
          currencyBreakdown,
        },
      });
    } catch (error) {
      logger.error("Get payment analytics error:", error);
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to retrieve payment analytics",
        });
    }
  }
}

module.exports = PaymentController;
