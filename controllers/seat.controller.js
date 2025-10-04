const mongoose = require('mongoose');
const Seat = require('../models/seat.model');
const { Role } = require('../data');
const logger = require('../utils/logger');

/**
 * SeatController - Comprehensive CRUD operations for seat management
 * Handles: getById, getAll, create, update, delete (soft), restore, forceDelete, listDeleted, updateStatus
 */
class SeatController {
  // Helper method to validate ObjectId
  static validateObjectId(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid seat ID format');
    }
  }

  // Helper method to build search query
  static buildSearchQuery(search) {
    if (!search) return {};

    return {
      $or: [
        { row: { $regex: search, $options: 'i' } },
        { seat_number: { $regex: search, $options: 'i' } },
        { seat_type: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } }
      ]
    };
  }

  // Helper method to build filter query
  static buildFilterQuery(filters) {
    const query = {};

    // Handle seat type filter
    if (filters.seat_type) {
      query.seat_type = filters.seat_type;
    }
    
    // Handle status filter
    if (filters.status) {
      query.status = filters.status;
    }

    // Handle availability filter
    if (filters.is_available !== undefined) {
      query.is_available = filters.is_available === 'true' || filters.is_available === true;
    }

    // Handle theater and screen filters
    if (filters.theater_id) {
      query.theater_id = filters.theater_id;
    }

    if (filters.screen_id) {
      query.screen_id = filters.screen_id;
    }

    // Handle price range filters
    if (filters.priceMin !== undefined || filters.priceMax !== undefined) {
      query.price = {};
      if (filters.priceMin !== undefined) {
        query.price.$gte = parseFloat(filters.priceMin);
      }
      if (filters.priceMax !== undefined) {
        query.price.$lte = parseFloat(filters.priceMax);
      }
    }

    // Handle date range filters
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

  // 1. GET ALL SEATS - with pagination, filtering, and sorting
  static async getAll(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'row',
        sortOrder = 'asc',
        search,
        includeDeleted = false,
        ...filters
      } = req.query;

      // Convert and validate pagination
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      // Build query
      let query = {};

      // Handle search
      if (search) {
        query = { ...query, ...SeatController.buildSearchQuery(search) };
      }

      // Handle filters
      query = { ...query, ...SeatController.buildFilterQuery(filters) };

      // Handle soft deleted records
      if (!includeDeleted || includeDeleted === 'false') {
        query.deletedAt = null; // Only get non-deleted seats
      }

      // Build sort object
      const sortObj = {};
      sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Execute queries
      const [seats, totalCount] = await Promise.all([
        Seat.find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Seat.countDocuments(query)
      ]);

      // Calculate pagination info
      const totalPages = Math.ceil(totalCount / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      logger.info(`Retrieved ${seats.length} seats`);

      res.status(200).json({
        success: true,
        data: {
          seats,
          pagination: {
            currentPage: pageNum,
            totalPages,
            totalCount,
            limit: limitNum,
            hasNextPage,
            hasPrevPage,
            nextPage: hasNextPage ? pageNum + 1 : null,
            prevPage: hasPrevPage ? pageNum - 1 : null
          }
        }
      });
    } catch (error) {
      logger.error('Get all seats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve seats'
      });
    }
  }

  // 2. GET SEAT BY ID
  static async getById(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Seat ID is required'
        });
      }

      SeatController.validateObjectId(id);

      const seat = await Seat.findById(id).lean();

      if (!seat) {
        return res.status(404).json({
          success: false,
          message: 'Seat not found'
        });
      }

      logger.info(`Retrieved seat by ID: ${id}`);

      res.status(200).json({
        success: true,
        data: { seat }
      });
    } catch (error) {
      if (error.message === 'Invalid seat ID format') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      logger.error('Get seat by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve seat'
      });
    }
  }

  // 3. CREATE SEAT
  static async create(req, res) {
    try {
      const seatData = req.body;

      // Validate required fields
      if (!seatData.row || !seatData.seat_number) {
        return res.status(400).json({
          success: false,
          message: 'Row and seat number are required'
        });
      }

      // Check if seat already exists in the same theater/screen
      const existingQuery = {
        row: seatData.row.toUpperCase(),
        seat_number: seatData.seat_number.toString().toUpperCase()
      };

      if (seatData.theater_id) existingQuery.theater_id = seatData.theater_id;
      if (seatData.screen_id) existingQuery.screen_id = seatData.screen_id;

      const existingSeat = await Seat.findOne(existingQuery);
      if (existingSeat) {
        return res.status(409).json({
          success: false,
          message: 'Seat with this row and seat number already exists in this theater/screen'
        });
      }

      // Set default values
      const seatToCreate = {
        ...seatData,
        seat_type: seatData.seat_type || 'standard',
        is_available: seatData.is_available !== undefined ? seatData.is_available : true,
        status: seatData.status || 'active',
        price: seatData.price || 0
      };

      // Add creator info if available
      if (req.user) {
        seatToCreate.createdBy = req.user.userId;
      }

      const seat = new Seat(seatToCreate);
      await seat.save();

      logger.info(`Created new seat: ${seat._id} (${seat.row}${seat.seat_number})`);

      res.status(201).json({
        success: true,
        message: 'Seat created successfully',
        data: { seat }
      });
    } catch (error) {
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: Object.values(error.errors).map(err => err.message)
        });
      }

      if (error.code === 11000) {
        return res.status(409).json({
          success: false,
          message: 'Seat with this row and seat number already exists'
        });
      }

      logger.error('Create seat error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create seat'
      });
    }
  }

  // 4. UPDATE SEAT
  static async update(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Seat ID is required'
        });
      }

      SeatController.validateObjectId(id);

      // Remove sensitive fields that shouldn't be updated directly
      delete updateData._id;
      delete updateData.createdAt;
      delete updateData.updatedAt;
      delete updateData.deletedAt;
      delete updateData.deletedBy;
      delete updateData.restoredAt;
      delete updateData.restoredBy;

      // Add updater info if available
      if (req.user) {
        updateData.updatedBy = req.user.userId;
      }

      // Validate unique constraint if row/seat_number is being updated
      if (updateData.row || updateData.seat_number) {
        const currentSeat = await Seat.findById(id);
        if (!currentSeat) {
          return res.status(404).json({
            success: false,
            message: 'Seat not found'
          });
        }

        const checkQuery = {
          row: (updateData.row || currentSeat.row).toUpperCase(),
          seat_number: (updateData.seat_number || currentSeat.seat_number).toString().toUpperCase(),
          theater_id: updateData.theater_id || currentSeat.theater_id,
          screen_id: updateData.screen_id || currentSeat.screen_id,
          _id: { $ne: id }
        };

        const existingSeat = await Seat.findOne(checkQuery);
        if (existingSeat) {
          return res.status(409).json({
            success: false,
            message: 'Seat with this row and seat number already exists in this theater/screen'
          });
        }
      }

      const seat = await Seat.findByIdAndUpdate(
        id,
        updateData,
        {
          new: true,
          runValidators: true,
          context: 'query'
        }
      );

      if (!seat) {
        return res.status(404).json({
          success: false,
          message: 'Seat not found'
        });
      }

      logger.info(`Updated seat: ${id} (${seat.row}${seat.seat_number})`);

      res.status(200).json({
        success: true,
        message: 'Seat updated successfully',
        data: { seat }
      });
    } catch (error) {
      if (error.message === 'Invalid seat ID format') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: Object.values(error.errors).map(err => err.message)
        });
      }

      logger.error('Update seat error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update seat'
      });
    }
  }

  // 5. SOFT DELETE SEAT (Deactivate)
  static async delete(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Seat ID is required'
        });
      }

      SeatController.validateObjectId(id);

      // Find the seat first
      const seat = await Seat.findById(id);

      if (!seat) {
        return res.status(404).json({
          success: false,
          message: 'Seat not found'
        });
      }

      // Check if seat is already soft deleted
      if (seat.isDeleted()) {
        return res.status(409).json({
          success: false,
          message: 'Seat is already deactivated'
        });
      }

      // Soft delete using model method
      const deletedSeat = await seat.softDelete(req.user?.userId);

      logger.info(`Soft deleted seat: ${id} (${deletedSeat.row}${deletedSeat.seat_number})`);

      res.status(200).json({
        success: true,
        message: 'Seat deactivated successfully',
        data: { seat: deletedSeat }
      });
    } catch (error) {
      if (error.message === 'Invalid seat ID format') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      logger.error('Delete seat error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to deactivate seat'
      });
    }
  }

  // 6. RESTORE SEAT (Reactivate)
  static async restore(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Seat ID is required'
        });
      }

      SeatController.validateObjectId(id);

      // Find the seat first
      const seat = await Seat.findById(id);

      if (!seat) {
        return res.status(404).json({
          success: false,
          message: 'Seat not found'
        });
      }

      // Check if seat is not deleted (already active)
      if (!seat.isDeleted()) {
        return res.status(409).json({
          success: false,
          message: 'Seat is already active'
        });
      }

      // Restore using model method
      const restoredSeat = await seat.restore(req.user?.userId);

      logger.info(`Restored seat: ${id} (${restoredSeat.row}${restoredSeat.seat_number})`);

      res.status(200).json({
        success: true,
        message: 'Seat restored successfully',
        data: { seat: restoredSeat }
      });
    } catch (error) {
      if (error.message === 'Invalid seat ID format') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      logger.error('Restore seat error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to restore seat'
      });
    }
  }

  // 7. FORCE DELETE SEAT (Permanent deletion - Admin/SuperAdmin only)
  static async forceDelete(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Seat ID is required'
        });
      }

      // Enforce Admin/SuperAdmin access
      if (req.user?.role !== Role.ADMIN && req.user?.role !== Role.SUPERADMIN) {
        return res.status(403).json({
          success: false,
          message: 'Only Admin or SuperAdmin can permanently delete seats'
        });
      }

      SeatController.validateObjectId(id);

      // Find the seat first
      const seat = await Seat.findById(id);

      if (!seat) {
        return res.status(404).json({
          success: false,
          message: 'Seat not found'
        });
      }

      // Store seat info for logging before deletion
      const seatInfo = {
        id: seat._id,
        row: seat.row,
        seat_number: seat.seat_number,
        seat_type: seat.seat_type,
        theater_id: seat.theater_id,
        screen_id: seat.screen_id,
        wasDeleted: seat.isDeleted()
      };

      // Perform permanent deletion
      await Seat.findByIdAndDelete(id);

      logger.warn(`⚠️  PERMANENT DELETION: Seat permanently deleted by ${req.user.role} ${req.user.userId}`, {
        deletedSeat: seatInfo,
        deletedBy: req.user.userId,
        deletedAt: new Date().toISOString(),
        action: 'FORCE_DELETE_SEAT'
      });

      res.status(200).json({
        success: true,
        message: 'Seat permanently deleted',
        data: {
          deletedSeat: {
            id: seatInfo.id,
            row: seatInfo.row,
            seat_number: seatInfo.seat_number,
            seat_type: seatInfo.seat_type,
            theater_id: seatInfo.theater_id,
            screen_id: seatInfo.screen_id
          },
          warning: 'This action is irreversible'
        }
      });
    } catch (error) {
      if (error.message === 'Invalid seat ID format') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      logger.error('Force delete seat error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to permanently delete seat'
      });
    }
  }

  // 8. LIST DELETED SEATS
  static async listDeleted(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'deletedAt',
        sortOrder = 'desc'
      } = req.query;

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      // Query for soft deleted seats only
      const query = { deletedAt: { $ne: null } };
      const sortObj = {};
      sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const [seats, totalCount] = await Promise.all([
        Seat.find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Seat.countDocuments(query)
      ]);

      // Add delete info to each seat
      const seatsWithDeleteInfo = seats.map(seat => ({
        ...seat,
        deleteInfo: {
          deletedAt: seat.deletedAt,
          deletedBy: seat.deletedBy,
          daysSinceDeleted: seat.deletedAt ? Math.floor((Date.now() - new Date(seat.deletedAt)) / (1000 * 60 * 60 * 24)) : null
        },
        restoreInfo: {
          restoredAt: seat.restoredAt,
          restoredBy: seat.restoredBy
        }
      }));

      const totalPages = Math.ceil(totalCount / limitNum);

      logger.info(`Retrieved ${seats.length} deleted seats`);

      res.status(200).json({
        success: true,
        data: {
          seats: seatsWithDeleteInfo,
          pagination: {
            currentPage: pageNum,
            totalPages,
            totalCount,
            limit: limitNum,
            hasNextPage: pageNum < totalPages,
            hasPrevPage: pageNum > 1
          }
        }
      });
    } catch (error) {
      logger.error('Get deleted seats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve deleted seats'
      });
    }
  }

  // 9. UPDATE SEAT STATUS
  static async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Seat ID is required'
        });
      }

      if (!status) {
        return res.status(400).json({
          success: false,
          message: 'Status is required'
        });
      }

      SeatController.validateObjectId(id);

      // Find the seat first
      const seat = await Seat.findById(id);

      if (!seat) {
        return res.status(404).json({
          success: false,
          message: 'Seat not found'
        });
      }

      // Check if seat is deleted
      if (seat.isDeleted()) {
        return res.status(409).json({
          success: false,
          message: 'Cannot update status of deleted seat. Please restore it first.'
        });
      }

      // Update status using model method
      const updatedSeat = await seat.updateStatus(status, req.user?.userId);

      logger.info(`Updated seat status: ${id} (${seat.row}${seat.seat_number}) to ${status}`);

      res.status(200).json({
        success: true,
        message: 'Seat status updated successfully',
        data: { seat: updatedSeat }
      });
    } catch (error) {
      if (error.message === 'Invalid seat ID format') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      if (error.message === 'Invalid status provided') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      logger.error('Update seat status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update seat status'
      });
    }
  }

  // Additional utility methods

  // Get seat statistics
  static async getStats(req, res) {
    try {
      const stats = await Promise.all([
        Seat.countDocuments({}), // Total seats
        Seat.countDocuments({ deletedAt: null }), // Active seats
        Seat.countDocuments({ deletedAt: { $ne: null } }), // Deleted seats
        Seat.countDocuments({ is_available: true, deletedAt: null }), // Available seats
        Seat.countDocuments({ seat_type: 'standard', deletedAt: null }),
        Seat.countDocuments({ seat_type: 'premium', deletedAt: null }),
        Seat.countDocuments({ seat_type: 'vip', deletedAt: null }),
        Seat.countDocuments({ seat_type: 'wheelchair', deletedAt: null }),
        Seat.countDocuments({ seat_type: 'recliner', deletedAt: null }),
        Seat.countDocuments({ status: 'active', deletedAt: null }),
        Seat.countDocuments({ status: 'maintenance', deletedAt: null }),
        Seat.countDocuments({ status: 'out_of_order', deletedAt: null }),
        Seat.countDocuments({ status: 'reserved', deletedAt: null })
      ]);

      const [
        total, active, deleted, available,
        standard, premium, vip, wheelchair, recliner,
        activeStatus, maintenance, outOfOrder, reserved
      ] = stats;

      res.status(200).json({
        success: true,
        data: {
          total,
          active,
          deleted,
          available,
          seatTypes: {
            standard,
            premium,
            vip,
            wheelchair,
            recliner
          },
          statuses: {
            active: activeStatus,
            maintenance,
            outOfOrder,
            reserved
          },
          percentageAvailable: active > 0 ? Math.round((available / active) * 100) : 0,
          percentageActive: total > 0 ? Math.round((active / total) * 100) : 0
        }
      });
    } catch (error) {
      logger.error('Get seat stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve seat statistics'
      });
    }
  }

  // Get seats by type
  static async getSeatsByType(req, res) {
    try {
      const { type } = req.params;
      const { page = 1, limit = 10, activeOnly = true } = req.query;

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      const query = { seat_type: type };
      if (activeOnly === 'true') {
        query.deletedAt = null;
      }

      const [seats, totalCount] = await Promise.all([
        Seat.find(query)
          .sort({ row: 1, seat_number: 1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Seat.countDocuments(query)
      ]);

      res.status(200).json({
        success: true,
        data: {
          seats,
          seatType: type,
          pagination: {
            currentPage: pageNum,
            totalPages: Math.ceil(totalCount / limitNum),
            totalCount,
            limit: limitNum
          }
        }
      });
    } catch (error) {
      logger.error('Get seats by type error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve seats by type'
      });
    }
  }

  // Get available seats
  static async getAvailableSeats(req, res) {
    try {
      const { theater_id, screen_id, seat_type } = req.query;

      let query = {
        is_available: true,
        deletedAt: null,
        status: 'active'
      };

      if (theater_id) query.theater_id = theater_id;
      if (screen_id) query.screen_id = screen_id;
      if (seat_type) query.seat_type = seat_type;

      const seats = await Seat.find(query)
        .sort({ row: 1, seat_number: 1 })
        .lean();

      res.status(200).json({
        success: true,
        data: {
          seats,
          count: seats.length,
          filters: {
            theater_id: theater_id || null,
            screen_id: screen_id || null,
            seat_type: seat_type || null
          }
        }
      });
    } catch (error) {
      logger.error('Get available seats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve available seats'
      });
    }
  }
}

module.exports = SeatController;