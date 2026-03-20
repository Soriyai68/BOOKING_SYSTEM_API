const mongoose = require("mongoose");
const Customer = require("../models/customer.model");
const { Role } = require("../utils/constants");
const logger = require("../utils/logger");
const { Providers } = require("../data");
const Telegram = require("../utils/telegram");
const AuthService = require("../service/auth.service");
const { emitEvent, emitToRoom } = require("../utils/socket");
const { normalizePhone } = require("../utils/helpers");
const NotificationController = require("./notification.controller");

const PREFIX = "customer_";

class CustomerController {
  static validateObjectId(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error("Invalid ObjectId");
    }
  }
  // Helper to build filter query
  static buildFilterQuery(filters) {
    const query = {};
    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive === "true" || filters.isActive === true;
    }
    if (filters.isVerified !== undefined) {
      query.isVerified =
        filters.isVerified === "true" || filters.isVerified === true;
    }
    // Add filter for customerType
    if (filters.customerType) {
      const validTypes = ["member", "walkin", "guest"]; // Updated validTypes
      if (validTypes.includes(filters.customerType)) {
        query.customerType = filters.customerType;
      }
    }
    if (filters.dateFrom || filters.dateTo) {
      query.createdAt = {};
      if (filters.dateFrom) {
        query.createdAt.$gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        query.createdAt.$lte = new Date(filters.dateTo);
      }
    }
    return query;
  }
  // Helper to build search query
  static buildSearchQuery(search) {
    if (!search) return {};
    const phoneRegex = createPhoneRegex(search);
    const searchConditions = [
      { name: { $regex: search, $options: "i" } },
      { username: { $regex: search, $options: "i" } },
      { telegramId: { $regex: search, $options: "i" } },
    ];
    if (phoneRegex) {
      searchConditions.push({ phone: { $regex: phoneRegex } });
    }
    return { $or: searchConditions };
  }

  // 1. GET ALL CUSTOMERS
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

      const pageNum = Math.max(1, parseInt(page, 10));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
      const skip = (pageNum - 1) * limitNum;

      let query = {};
      if (search) {
        query = { ...query, ...CustomerController.buildSearchQuery(search) };
      }
      query = { ...query, ...CustomerController.buildFilterQuery(filters) };

      if (includeDeleted === "only") {
        query.deletedAt = { $ne: null };
      } else if (includeDeleted !== "true") {
        query.deletedAt = null;
      }

      const sortObj = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

      const [customers, totalCount] = await Promise.all([
        Customer.find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum)
          .select("-__v")
          .lean(),
        Customer.countDocuments(query),
      ]);

      const totalPages = Math.ceil(totalCount / limitNum);

      res.status(200).json({
        success: true,
        data: {
          customers,
          pagination: {
            currentPage: pageNum,
            totalPages,
            totalCount,
            limit: limitNum,
            hasNextPage: pageNum < totalPages,
            hasPrevPage: pageNum > 1,
          },
        },
      });
    } catch (error) {
      logger.error("Get all customers error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to retrieve customers" });
    }
  }

  // 2. GET CUSTOMER BY ID
  static async getById(req, res) {
    try {
      const { id } = req.params;
      CustomerController.validateObjectId(id);

      const customer = await Customer.findById(id).lean();
      if (!customer) {
        return res
          .status(404)
          .json({ success: false, message: "Customer not found" });
      }

      res.status(200).json({ success: true, data: { customer } });
    } catch (error) {
      logger.error("Get customer by ID error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to retrieve customer" });
    }
  }
  // 3. CREATE CUSTOMER
  static async create(req, res) {
    try {
      const { phone, name, username, customerType, provider } = req.body;

      // Note: Identification fields (phone, email, name) are now optional as per user feedback.
      // Validation is primarily handled by the Joi schema.

      // Check uniqueness
      const orConditions = [];
      if (phone) orConditions.push({ phone });
      if (username) orConditions.push({ username });

      if (orConditions.length > 0) {
        const existing = await Customer.findOne({ $or: orConditions });
        if (existing) {
          let field = "details";
          if (existing.phone === phone) field = "phone number";
          if (existing.username === username) field = "username";

          return res.status(409).json({
            success: false,
            message: `Customer with this ${field} already exists`,
          });
        }
      }

      // Create customer object
      let customerData = {
        customerType,
        provider: provider,
        isVerified: false,
      };

      if (customerType === "guest") {
        customerData.provider = Providers.PHONE; // Defaulting to phone for guests now
      } else {
        customerData = {
          ...customerData,
          phone: normalizePhone(phone),
          name,
          username,
        };
      }
      const customer = new Customer(customerData);
      await customer.save();

        await Telegram.sendNotificationToAdmins(
          `👤 <b>New Customer Created by Admin</b>\nName: ${customer.name}\nPhone: ${customer.phone || "N/A"}\nProvider: ${customer.provider || "manual"}\nType: ${customer.customerType}`,
        );

        // Notify Admins Dashboard
        await NotificationController.notifyAdmins({
          type: "customer_registered",
          title: "New Customer Created",
          message: `${customer.name} has been manually created by an admin.`,
          metadata: {
            customerId: customer._id,
            name: customer.name,
            source: "Manual (Admin)",
          },
          req,
        });

      // Notify via Socket.io
      emitEvent("customer:created", customer.toObject());

      res.status(201).json({
        success: true,
        message: "Customer created successfully",
        data: customer,
      });
    } catch (error) {
      logger.error("Create customer error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to create customer" });
    }
  }

  // 4. UPDATE CUSTOMER
  static async update(req, res) {
    try {
      const { id } = req.params;
      CustomerController.validateObjectId(id);

      const { password, ...updateData } = req.body;

      if (updateData.phone || updateData.username) {
        if (updateData.phone) {
          updateData.phone = normalizePhone(updateData.phone);
        }
        const orConditions = [];
        if (updateData.phone) orConditions.push({ phone: updateData.phone });
        if (updateData.username)
          orConditions.push({ username: updateData.username });

        const existing = await Customer.findOne({
          $or: orConditions,
          _id: { $ne: id },
        });

        if (existing) {
          let field = "details";
          if (existing.phone === updateData.phone) field = "phone number";
          if (existing.username === updateData.username) field = "username";
          return res.status(409).json({
            success: false,
            message: `This ${field} is already in use`,
          });
        }
      }

      const customer = await Customer.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      });
      if (!customer) {
        return res
          .status(404)
          .json({ success: false, message: "Customer not found" });
      }

      // If account is being deactivated, clear all sessions immediately
      if (updateData.isActive === false) {
        await AuthService.deleteAllSessions(id, PREFIX);
        emitToRoom(`customer:${id}`, "customer:disabled", {
          message: "Your account has been disabled. You have been logged out.",
        });
        logger.info(
          `Customer account deactivated: ${id}. Cleared sessions and emitted logout event.`,
        );
      }

      res.status(200).json({
        success: true,
        message: "Customer updated successfully",
        data: { customer },
      });
    } catch (error) {
      logger.error("Update customer error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to update customer" });
    }
  }

  // 5. SOFT DELETE CUSTOMER
  static async delete(req, res) {
    try {
      const { id } = req.params;
      CustomerController.validateObjectId(id);

      const customer = await Customer.findById(id);
      if (!customer || customer.isDeleted()) {
        return res.status(404).json({
          success: false,
          message: "Customer not found or already deleted",
        });
      }

      await customer.softDelete(req.user?.userId);

      // Clear all sessions immediately after soft delete
      await AuthService.deleteAllSessions(id, PREFIX);
      logger.info(
        `Customer account soft-deleted: ${id}. Cleared all sessions.`,
      );

      res
        .status(200)
        .json({ success: true, message: "Customer deactivated successfully" });
    } catch (error) {
      logger.error("Delete customer error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to deactivate customer" });
    }
  }

  // 6. RESTORE CUSTOMER
  static async restore(req, res) {
    try {
      const { id } = req.params;
      CustomerController.validateObjectId(id);

      const customer = await Customer.findById(id);
      if (!customer || !customer.isDeleted()) {
        return res.status(404).json({
          success: false,
          message: "Customer not found or is already active",
        });
      }

      await customer.restore(req.user?.userId);
      res.status(200).json({
        success: true,
        message: "Customer restored successfully",
        data: { customer },
      });
    } catch (error) {
      logger.error("Restore customer error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to restore customer" });
    }
  }

  // 7. FORCE DELETE CUSTOMER
  static async forceDelete(req, res) {
    try {
      const { id } = req.params;
      CustomerController.validateObjectId(id);

      if (req.user?.role !== Role.ADMIN && req.user?.role !== Role.SUPERADMIN) {
        return res.status(403).json({
          success: false,
          message: "You are not authorized to perform this action",
        });
      }

      const customer = await Customer.findByIdAndDelete(id);
      if (!customer) {
        return res
          .status(404)
          .json({ success: false, message: "Customer not found" });
      }

      logger.warn(
        `PERMANENT DELETION: Customer ${customer._id} permanently deleted by ${req.user.userId}`,
      );
      res
        .status(200)
        .json({ success: true, message: "Customer permanently deleted" });
    } catch (error) {
      logger.error("Force delete customer error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to permanently delete customer",
      });
    }
  }

  // 8. GET DELETED CUSTOMERS
  static async getDeleted(req, res) {
    try {
      const customers = await Customer.findDeleted();
      res.status(200).json({
        success: true,
        count: customers.length,
        data: { customers },
      });
    } catch (error) {
      logger.error("Get deleted customers error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve deleted customers",
      });
    }
  }

  // 9. GET CUSTOMER STATS
  static async getStats(req, res) {
    try {
      const [total, active, deleted, verified, byType] = await Promise.all([
        Customer.countDocuments(),
        Customer.countDocuments({ isActive: true, deletedAt: null }),
        Customer.countDocuments({ deletedAt: { $ne: null } }),
        Customer.countDocuments({ isVerified: true }),
        Customer.aggregate([
          { $group: { _id: "$customerType", count: { $sum: 1 } } },
        ]),
      ]);
      const typeCounts = byType.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {});

      res.status(200).json({
        success: true,
        data: {
          total,
          active,
          deleted,
          verified,
          inactive: total - active,
          byType: {
            member: typeCounts.member || 0,
            walkin: typeCounts.walkin || 0,
            guest: typeCounts.guest || 0,
          },
        },
      });
    } catch (error) {
      logger.error("Get customer stats error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve customer statistics",
      });
    }
  }

  // 10. GET CUSTOMER BY PHONE
  static async getByPhone(req, res) {
    try {
      const { phone } = req.params;
      const customer = await Customer.findOne({ phone }).lean();
      if (!customer) {
        return res
          .status(404)
          .json({ success: false, message: "Customer not found" });
      }
      res.status(200).json({ success: true, data: { customer } });
    } catch (error) {
      logger.error("Get customer by phone error:", error);
      res
        .status(500)
        .json({ success: false, message: "Failed to retrieve customer" });
    }
  }
  // 11. ADVANCED SEARCH
  static async search(req, res) {
    // This is a simplified version of the user controller's search.
    // For a full implementation, more complex query building is needed.
    CustomerController.getAll(req, res);
  }
}

module.exports = CustomerController;
