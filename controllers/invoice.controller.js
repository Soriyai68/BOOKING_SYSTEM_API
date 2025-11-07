const mongoose = require("mongoose");
const { Invoice, Payment, User } = require("../models");
const { Role } = require("../data");
const logger = require("../utils/logger");

class InvoiceController {
  // Helper method to validate ObjectId
  static validateObjectId(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("Invalid Invoice ID format");
    }
  }

  // Build filter query
  static buildFilterQuery(filters) {
    const query = {};

    if (filters.paymentId && mongoose.Types.ObjectId.isValid(filters.paymentId)) {
      query.paymentId = new mongoose.Types.ObjectId(filters.paymentId);
    }

    if (filters.cashierId && mongoose.Types.ObjectId.isValid(filters.cashierId)) {
      query.cashierId = new mongoose.Types.ObjectId(filters.cashierId);
    }

    if (filters.tracking_status) {
      query.tracking_status = filters.tracking_status;
    }

    if (filters.currency) {
      query.currency = filters.currency;
    }

    if (filters.paid !== undefined) {
      query.paid = filters.paid === "true" || filters.paid === true;
    }

    if (filters.location) {
      query.location = { $regex: filters.location, $options: "i" };
    }

    // Date range filter
    if (filters.dateFrom || filters.dateTo) {
      query.createdAt = {};
      if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
      if (filters.dateTo) query.createdAt.$lte = new Date(filters.dateTo);
    }

    return query;
  }

  // 1. GET ALL INVOICES
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

      const matchQuery = { ...InvoiceController.buildFilterQuery(filters) };

      if (!includeDeleted || includeDeleted === "false") {
        matchQuery.deletedAt = null;
      }

      const pipeline = [
        { $match: matchQuery },

        // Lookup payment
        {
          $lookup: {
            from: "payments",
            localField: "paymentId",
            foreignField: "_id",
            as: "payment",
          },
        },
        { $unwind: { path: "$payment", preserveNullAndEmptyArrays: true } },

        // Lookup cashier (User)
        {
          $lookup: {
            from: "users",
            localField: "cashierId",
            foreignField: "_id",
            as: "cashier",
          },
        },
        { $unwind: { path: "$cashier", preserveNullAndEmptyArrays: true } },
      ];

      // Optional search on invoice_number or location
      if (search) {
        pipeline.push({
          $match: {
            $or: [
              { invoice_number: { $regex: search, $options: "i" } },
              { location: { $regex: search, $options: "i" } },
              { description: { $regex: search, $options: "i" } },
            ],
          },
        });
      }

      // Count total
      const totalCountResult = await Invoice.aggregate([
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
          payment: { _id: 1, payment_method: 1, status: 1 },
          cashier: { _id: 1, username: 1, email: 1 },
          invoice_number: 1,
          qr: 1,
          location: 1,
          currency: 1,
          amount: 1,
          description: 1,
          paid: 1,
          tracking_status: 1,
          acknowledged_at: 1,
          paid_at: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      });

      const invoices = await Invoice.aggregate(pipeline);

      const totalPages = Math.ceil(totalCount / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      res.status(200).json({
        success: true,
        data: {
          invoices,
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
      logger.error("Get all invoices error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to retrieve invoices" });
    }
  }

  // 2. GET INVOICE BY ID
  static async getById(req, res) {
    try {
      const { id } = req.params;
      if (!id) {
        return res
          .status(400)
          .json({ success: false, message: "Invoice ID is required" });
      }

      InvoiceController.validateObjectId(id);

      const invoice = await Invoice.findById(id)
        .populate("paymentId", "payment_method status amount")
        .populate("cashierId", "username email phone");

      if (!invoice) {
        return res
          .status(404)
          .json({ success: false, message: "Invoice not found" });
      }

      res.status(200).json({
        success: true,
        data: { invoice },
      });
    } catch (error) {
      logger.error("Get invoice by ID error:", error);
      if (error.message === "Invalid Invoice ID format") {
        return res.status(400).json({ success: false, message: error.message });
      }
      res
        .status(500)
        .json({ success: false, message: "Failed to retrieve invoice" });
    }
  }

  // 3. GET INVOICE BY INVOICE NUMBER
  static async getByInvoiceNumber(req, res) {
    try {
      const { invoiceNumber } = req.params;
      if (!invoiceNumber) {
        return res
          .status(400)
          .json({ success: false, message: "Invoice number is required" });
      }

      const invoice = await Invoice.findOne({
        invoice_number: invoiceNumber,
        deletedAt: null,
      })
        .populate("paymentId", "payment_method status amount")
        .populate("cashierId", "username email phone");

      if (!invoice) {
        return res
          .status(404)
          .json({ success: false, message: "Invoice not found" });
      }

      res.status(200).json({
        success: true,
        data: { invoice },
      });
    } catch (error) {
      logger.error("Get invoice by invoice number error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to retrieve invoice" });
    }
  }

  // 4. CREATE INVOICE
  static async create(req, res) {
    try {
      const {
        paymentId,
        invoice_number,
        qr,
        cashierId,
        location,
        currency,
        amount,
        description,
        paid,
        tracking_status,
      } = req.body;

      // Validate payment exists
      const payment = await Payment.findById(paymentId);
      if (!payment) {
        return res
          .status(404)
          .json({ success: false, message: "Payment not found" });
      }

      // Validate cashier exists
      const cashier = await User.findById(cashierId);
      if (!cashier) {
        return res
          .status(404)
          .json({ success: false, message: "Cashier not found" });
      }

      // Check if invoice number already exists
      const existingInvoice = await Invoice.findOne({ invoice_number });
      if (existingInvoice) {
        return res
          .status(400)
          .json({ success: false, message: "Invoice number already exists" });
      }

      const invoice = new Invoice({
        paymentId,
        invoice_number,
        qr,
        cashierId,
        location,
        currency: currency || "USD",
        amount,
        description: description || "",
        paid: paid || false,
        tracking_status: tracking_status || "Waiting",
      });

      await invoice.save();

      const populatedInvoice = await Invoice.findById(invoice._id)
        .populate("paymentId", "payment_method status amount")
        .populate("cashierId", "username email phone");

      res.status(201).json({
        success: true,
        message: "Invoice created successfully",
        data: { invoice: populatedInvoice },
      });
    } catch (error) {
      logger.error("Create invoice error:", error);
      if (error.code === 11000) {
        return res
          .status(400)
          .json({ success: false, message: "Invoice number already exists" });
      }
      res
        .status(500)
        .json({ success: false, message: "Failed to create invoice" });
    }
  }

  // 5. UPDATE INVOICE
  static async update(req, res) {
    try {
      const { id } = req.params;
      InvoiceController.validateObjectId(id);

      const updateData = { ...req.body };
      delete updateData._id;
      delete updateData.createdAt;

      const invoice = await Invoice.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      )
        .populate("paymentId", "payment_method status amount")
        .populate("cashierId", "username email phone");

      if (!invoice) {
        return res
          .status(404)
          .json({ success: false, message: "Invoice not found" });
      }

      res.status(200).json({
        success: true,
        message: "Invoice updated successfully",
        data: { invoice },
      });
    } catch (error) {
      logger.error("Update invoice error:", error);
      if (error.message === "Invalid Invoice ID format") {
        return res.status(400).json({ success: false, message: error.message });
      }
      res
        .status(500)
        .json({ success: false, message: "Failed to update invoice" });
    }
  }

  // 6. UPDATE INVOICE STATUS
  static async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { tracking_status, paid } = req.body;

      InvoiceController.validateObjectId(id);

      const updateData = {};
      if (tracking_status) updateData.tracking_status = tracking_status;
      if (paid !== undefined) updateData.paid = paid;

      // Set timestamps based on status
      if (tracking_status === "Acknowledged" && !updateData.acknowledged_at) {
        updateData.acknowledged_at = new Date();
      }
      if (tracking_status === "Paid" || paid === true) {
        updateData.paid = true;
        updateData.paid_at = new Date();
        updateData.tracking_status = "Paid";
      }

      const invoice = await Invoice.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      )
        .populate("paymentId", "payment_method status amount")
        .populate("cashierId", "username email phone");

      if (!invoice) {
        return res
          .status(404)
          .json({ success: false, message: "Invoice not found" });
      }

      res.status(200).json({
        success: true,
        message: "Invoice status updated successfully",
        data: { invoice },
      });
    } catch (error) {
      logger.error("Update invoice status error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to update invoice status" });
    }
  }

  // 7. SOFT DELETE INVOICE
  static async delete(req, res) {
    try {
      const { id } = req.params;
      InvoiceController.validateObjectId(id);

      const invoice = await Invoice.findByIdAndUpdate(
        id,
        { deletedAt: new Date() },
        { new: true }
      );

      if (!invoice) {
        return res
          .status(404)
          .json({ success: false, message: "Invoice not found" });
      }

      res.status(200).json({
        success: true,
        message: "Invoice deleted successfully",
      });
    } catch (error) {
      logger.error("Delete invoice error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to delete invoice" });
    }
  }

  // 8. RESTORE DELETED INVOICE
  static async restore(req, res) {
    try {
      const { id } = req.params;
      InvoiceController.validateObjectId(id);

      const invoice = await Invoice.findByIdAndUpdate(
        id,
        { deletedAt: null },
        { new: true }
      );

      if (!invoice) {
        return res
          .status(404)
          .json({ success: false, message: "Invoice not found" });
      }

      res.status(200).json({
        success: true,
        message: "Invoice restored successfully",
        data: { invoice },
      });
    } catch (error) {
      logger.error("Restore invoice error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to restore invoice" });
    }
  }

  // 9. FORCE DELETE INVOICE
  static async forceDelete(req, res) {
    try {
      const { id } = req.params;
      InvoiceController.validateObjectId(id);

      const invoice = await Invoice.findByIdAndDelete(id);

      if (!invoice) {
        return res
          .status(404)
          .json({ success: false, message: "Invoice not found" });
      }

      res.status(200).json({
        success: true,
        message: "Invoice permanently deleted",
      });
    } catch (error) {
      logger.error("Force delete invoice error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to permanently delete invoice" });
    }
  }

  // 10. GET DELETED INVOICES
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

      const totalCount = await Invoice.countDocuments(query);

      const invoices = await Invoice.find(query)
        .populate("paymentId", "payment_method status amount")
        .populate("cashierId", "username email phone")
        .sort({ [sortBy]: sortOrder === "desc" ? -1 : 1 })
        .skip(skip)
        .limit(limitNum);

      const totalPages = Math.ceil(totalCount / limitNum);

      res.status(200).json({
        success: true,
        data: {
          invoices,
          pagination: {
            currentPage: pageNum,
            totalPages,
            totalCount,
            limit: limitNum,
          },
        },
      });
    } catch (error) {
      logger.error("List deleted invoices error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to retrieve deleted invoices" });
    }
  }

  // 11. GET INVOICE ANALYTICS
  static async getAnalytics(req, res) {
    try {
      const totalInvoices = await Invoice.countDocuments({ deletedAt: null });
      const paidInvoices = await Invoice.countDocuments({
        paid: true,
        deletedAt: null,
      });
      const unpaidInvoices = await Invoice.countDocuments({
        paid: false,
        deletedAt: null,
      });

      const totalRevenue = await Invoice.aggregate([
        { $match: { paid: true, deletedAt: null } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);

      const statusBreakdown = await Invoice.aggregate([
        { $match: { deletedAt: null } },
        { $group: { _id: "$tracking_status", count: { $sum: 1 } } },
      ]);

      const currencyBreakdown = await Invoice.aggregate([
        { $match: { paid: true, deletedAt: null } },
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
          totalInvoices,
          paidInvoices,
          unpaidInvoices,
          totalRevenue: totalRevenue[0]?.total || 0,
          statusBreakdown,
          currencyBreakdown,
        },
      });
    } catch (error) {
      logger.error("Get invoice analytics error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to retrieve invoice analytics" });
    }
  }
}

module.exports = InvoiceController;
