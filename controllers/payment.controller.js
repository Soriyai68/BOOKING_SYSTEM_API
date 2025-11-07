const mongoose = require("mongoose");
const { Payment, Booking } = require("../models");
const { Role } = require("../data");
const logger = require("../utils/logger");

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

    if (filters.bookingId && mongoose.Types.ObjectId.isValid(filters.bookingId)) {
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

    if (filters.transaction_id) {
      query.transaction_id = { $regex: filters.transaction_id, $options: "i" };
    }

    // Date range filter
    if (filters.dateFrom || filters.dateTo) {
      query.payment_date = {};
      if (filters.dateFrom) query.payment_date.$gte = new Date(filters.dateFrom);
      if (filters.dateTo) query.payment_date.$lte = new Date(filters.dateTo);
    }

    // Amount range filter
    if (filters.amountFrom || filters.amountTo) {
      query.amount = {};
      if (filters.amountFrom) query.amount.$gte = parseFloat(filters.amountFrom);
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

      // Optional search on transaction_id or description
      if (search) {
        pipeline.push({
          $match: {
            $or: [
              { transaction_id: { $regex: search, $options: "i" } },
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
          payment_method: 1,
          payment_date: 1,
          currency: 1,
          status: 1,
          transaction_id: 1,
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

  // 3. GET PAYMENT BY TRANSACTION ID
  static async getByTransactionId(req, res) {
    try {
      const { transactionId } = req.params;
      if (!transactionId) {
        return res
          .status(400)
          .json({ success: false, message: "Transaction ID is required" });
      }

      const payment = await Payment.findOne({
        transaction_id: transactionId,
        deletedAt: null,
      }).populate("bookingId", "reference_code booking_status total_price");

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
      logger.error("Get payment by transaction ID error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to retrieve payment" });
    }
  }

  // 4. GET PAYMENTS BY BOOKING ID
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

  // 5. CREATE PAYMENT
  static async create(req, res) {
    try {
      const {
        bookingId,
        amount,
        payment_method,
        currency,
        status,
        transaction_id,
        description,
      } = req.body;

      // Validate booking exists
      const booking = await Booking.findById(bookingId);
      if (!booking) {
        return res
          .status(404)
          .json({ success: false, message: "Booking not found" });
      }

      // Check if transaction_id already exists (if provided)
      if (transaction_id) {
        const existingPayment = await Payment.findOne({ transaction_id });
        if (existingPayment) {
          return res
            .status(400)
            .json({ success: false, message: "Transaction ID already exists" });
        }
      }

      const payment = new Payment({
        bookingId,
        amount,
        payment_method,
        currency: currency || "USD",
        status: status || "Pending",
        transaction_id,
        description: description || "",
      });

      await payment.save();

      const populatedPayment = await Payment.findById(payment._id).populate(
        "bookingId",
        "reference_code booking_status total_price"
      );

      res.status(201).json({
        success: true,
        message: "Payment created successfully",
        data: { payment: populatedPayment },
      });
    } catch (error) {
      logger.error("Create payment error:", error);
      if (error.code === 11000) {
        return res
          .status(400)
          .json({ success: false, message: "Transaction ID already exists" });
      }
      res
        .status(500)
        .json({ success: false, message: "Failed to create payment" });
    }
  }

  // 6. UPDATE PAYMENT
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

  // 7. UPDATE PAYMENT STATUS
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

  // 8. SOFT DELETE PAYMENT
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

  // 9. RESTORE DELETED PAYMENT
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

  // 10. FORCE DELETE PAYMENT
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
        .json({ success: false, message: "Failed to permanently delete payment" });
    }
  }

  // 11. GET DELETED PAYMENTS
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
        .json({ success: false, message: "Failed to retrieve deleted payments" });
    }
  }

  // 12. GET PAYMENT ANALYTICS
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
        .json({ success: false, message: "Failed to retrieve payment analytics" });
    }
  }
}

module.exports = PaymentController;
