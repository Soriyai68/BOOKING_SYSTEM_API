const mongoose = require('mongoose');
const Hall = require('../models/hall.model');
const { Role } = require('../data');
const logger = require('../utils/logger');

/**
 * HallController - Comprehensive CRUD operations for hall management
 * Handles: getById, getAll, create, update, delete (soft), restore, forceDelete, listDeleted, updateStatus, updateCapacity
 */
class HallController {
  // Helper method to validate ObjectId
  static validateObjectId(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid hall ID format');
    }
  }

  // Helper method to build search query
  static buildSearchQuery(search) {
    if (!search) return {};

    return {
      $or: [
        { hall_name: { $regex: search, $options: 'i' } },
        { screen_type: { $regex: search, $options: 'i' } },
        { theater_id: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } }
      ]
    };
  }

  // Helper method to build filter query
  static buildFilterQuery(filters) {
    const query = {};

    // Handle screen type filter
    if (filters.screen_type) {
      query.screen_type = filters.screen_type;
    }

    // Handle status filter
    if (filters.status) {
      query.status = filters.status;
    }

    // Handle theater filter
    if (filters.theater_id) {
      query.theater_id = filters.theater_id;
    }

    // Handle seat count range filters
    if (filters.minSeats !== undefined || filters.maxSeats !== undefined) {
      query.total_seats = {};
      if (filters.minSeats !== undefined) {
        query.total_seats.$gte = parseInt(filters.minSeats);
      }
      if (filters.maxSeats !== undefined) {
        query.total_seats.$lte = parseInt(filters.maxSeats);
      }
    }

    // Handle features filter
    if (filters.hasFeatures && filters.hasFeatures.length > 0) {
      query.features = { $in: filters.hasFeatures };
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

  // 1. GET ALL HALLS - with pagination, filtering, and sorting
  static async getAll(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'hall_name',
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
        query = { ...query, ...HallController.buildSearchQuery(search) };
      }

      // Handle filters
      query = { ...query, ...HallController.buildFilterQuery(filters) };

      // Handle soft deleted records
      if (!includeDeleted || includeDeleted === 'false') {
        query.deletedAt = null; // Only get non-deleted halls
      }

      // Build sort object
      const sortObj = {};
      sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Execute queries
      const [halls, totalCount] = await Promise.all([
        Hall.find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Hall.countDocuments(query)
      ]);

      // Calculate pagination info
      const totalPages = Math.ceil(totalCount / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      logger.info(`Retrieved ${halls.length} halls`);

      res.status(200).json({
        success: true,
        data: {
          halls,
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
      logger.error('Get all halls error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve halls'
      });
    }
  }

  // 2. GET HALL BY ID
  static async getById(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Hall ID is required'
        });
      }

      HallController.validateObjectId(id);

      const hall = await Hall.findById(id).lean();

      if (!hall) {
        return res.status(404).json({
          success: false,
          message: 'Hall not found'
        });
      }

      logger.info(`Retrieved hall by ID: ${id}`);

      res.status(200).json({
        success: true,
        data: { hall }
      });
    } catch (error) {
      if (error.message === 'Invalid hall ID format') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      logger.error('Get hall by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve hall'
      });
    }
  }

  // 3. CREATE HALL
  static async create(req, res) {
    try {
      const hallData = req.body;

      // Validate required fields
      if (!hallData.hall_name) {
        return res.status(400).json({
          success: false,
          message: 'Hall name is required'
        });
      }

      // Check if hall already exists in the same theater
      const existingQuery = {
        hall_name: hallData.hall_name.trim()
      };

      if (hallData.theater_id) {
        existingQuery.theater_id = hallData.theater_id;
      }

      const existingHall = await Hall.findOne(existingQuery);
      if (existingHall) {
        return res.status(409).json({
          success: false,
          message: 'Hall with this name already exists in this theater'
        });
      }

      // Set default values
      const hallToCreate = {
        ...hallData,
        screen_type: hallData.screen_type || 'standard',
        status: hallData.status || 'active',
        features: hallData.features || [],
        capacity: hallData.capacity || {
          standard: 0,
          premium: 0,
          vip: 0,
          wheelchair: 0,
          recliner: 0
        },
        dimensions: hallData.dimensions || {
          width: 10,
          height: 10
        }
      };

      // Add creator info if available
      if (req.user) {
        hallToCreate.createdBy = req.user.userId;
      }

      const hall = new Hall(hallToCreate);
      await hall.save();

      // Update theater's halls_id array
      if (hall.theater_id) {
        const Theater = require('../models/theater.model');
        try {
          const theater = await Theater.findById(hall.theater_id);
          if (theater) {
            await theater.addHall(hall._id);
            logger.info(`Added hall ${hall._id} to theater ${theater._id}`);
          }
        } catch (theaterError) {
          logger.error(`Failed to add hall to theater: ${theaterError.message}`);
          // Don't fail the hall creation, just log the error
        }
      }

      logger.info(`Created new hall: ${hall._id} (${hall.hall_name})`);

      res.status(201).json({
        success: true,
        message: 'Hall created successfully',
        data: { hall }
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
          message: 'Hall with this name already exists in this theater'
        });
      }

      logger.error('Create hall error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create hall'
      });
    }
  }

  // 4. UPDATE HALL
  static async update(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Hall ID is required'
        });
      }

      HallController.validateObjectId(id);

      // Remove sensitive fields that shouldn't be updated directly
      delete updateData._id;
      delete updateData.createdAt;
      delete updateData.updatedAt;
      delete updateData.deletedAt;
      delete updateData.deletedBy;
      delete updateData.restoredAt;
      delete updateData.restoredBy;
      delete updateData.total_seats; // total_seats is auto-calculated from seats

      // Add updater info if available
      if (req.user) {
        updateData.updatedBy = req.user.userId;
      }

      // Get current hall to check for theater changes
      const currentHall = await Hall.findById(id);
      if (!currentHall) {
        return res.status(404).json({
          success: false,
          message: 'Hall not found'
        });
      }

      // Validate unique constraint if hall_name is being updated
      if (updateData.hall_name) {
        const checkQuery = {
          hall_name: updateData.hall_name.trim(),
          theater_id: updateData.theater_id || currentHall.theater_id,
          _id: { $ne: id }
        };

        const existingHall = await Hall.findOne(checkQuery);
        if (existingHall) {
          return res.status(409).json({
            success: false,
            message: 'Hall with this name already exists in this theater'
          });
        }
      }

      const hall = await Hall.findByIdAndUpdate(
        id,
        updateData,
        {
          new: true,
          runValidators: true,
          context: 'query'
        }
      );

      // Handle theater change
      if (updateData.theater_id && currentHall.theater_id) {
        const oldTheaterId = currentHall.theater_id.toString();
        const newTheaterId = updateData.theater_id.toString();
        
        if (oldTheaterId !== newTheaterId) {
          const Theater = require('../models/theater.model');
          
          try {
            // Remove from old theater
            const oldTheater = await Theater.findById(oldTheaterId);
            if (oldTheater) {
              await oldTheater.removeHall(id);
              logger.info(`Removed hall ${id} from old theater ${oldTheaterId}`);
            }
            
            // Add to new theater
            const newTheater = await Theater.findById(newTheaterId);
            if (newTheater) {
              await newTheater.addHall(id);
              logger.info(`Added hall ${id} to new theater ${newTheaterId}`);
            }
          } catch (theaterError) {
            logger.error(`Failed to update theater associations: ${theaterError.message}`);
            // Don't fail the hall update, just log the error
          }
        }
      }

      if (!hall) {
        return res.status(404).json({
          success: false,
          message: 'Hall not found'
        });
      }

      logger.info(`Updated hall: ${id} (${hall.hall_name})`);

      res.status(200).json({
        success: true,
        message: 'Hall updated successfully',
        data: { hall }
      });
    } catch (error) {
      if (error.message === 'Invalid hall ID format') {
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

      logger.error('Update hall error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update hall'
      });
    }
  }

  // 5. SOFT DELETE HALL (Deactivate)
  static async delete(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Hall ID is required'
        });
      }

      HallController.validateObjectId(id);

      // Find the hall first
      const hall = await Hall.findById(id);

      if (!hall) {
        return res.status(404).json({
          success: false,
          message: 'Hall not found'
        });
      }

      // Check if hall is already soft deleted
      if (hall.isDeleted()) {
        return res.status(409).json({
          success: false,
          message: 'Hall is already deactivated'
        });
      }

      // Check if hall has associated seats
      const seatCheck = await hall.hasActiveSeats();
      if (seatCheck.hasSeats) {
        return res.status(409).json({
          success: false,
          message: `Cannot delete hall. It has ${seatCheck.count} associated seat(s). Please delete or reassign the seats first.`,
          data: {
            associatedSeatsCount: seatCheck.count,
            seatIdentifiers: seatCheck.identifiers
          }
        });
      }

      // Soft delete using model method
      const deletedHall = await hall.softDelete(req.user?.userId);

      // Remove hall from theater's halls_id array
      if (deletedHall.theater_id) {
        const Theater = require('../models/theater.model');
        try {
          const theater = await Theater.findById(deletedHall.theater_id);
          if (theater) {
            await theater.removeHall(deletedHall._id);
            logger.info(`Removed hall ${deletedHall._id} from theater ${theater._id}`);
          }
        } catch (theaterError) {
          logger.error(`Failed to remove hall from theater: ${theaterError.message}`);
          // Don't fail the hall deletion, just log the error
        }
      }

      logger.info(`Soft deleted hall: ${id} (${deletedHall.hall_name})`);

      res.status(200).json({
        success: true,
        message: 'Hall deactivated successfully',
        data: { hall: deletedHall }
      });
    } catch (error) {
      if (error.message === 'Invalid hall ID format') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      logger.error('Delete hall error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to deactivate hall'
      });
    }
  }

  // 6. RESTORE HALL (Reactivate)
  static async restore(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Hall ID is required'
        });
      }

      HallController.validateObjectId(id);

      // Find the hall first
      const hall = await Hall.findById(id);

      if (!hall) {
        return res.status(404).json({
          success: false,
          message: 'Hall not found'
        });
      }

      // Check if hall is not deleted (already active)
      if (!hall.isDeleted()) {
        return res.status(409).json({
          success: false,
          message: 'Hall is already active'
        });
      }

      // Restore using model method
      const restoredHall = await hall.restore(req.user?.userId);

      // Re-add hall to theater's halls_id array
      if (restoredHall.theater_id) {
        const Theater = require('../models/theater.model');
        try {
          const theater = await Theater.findById(restoredHall.theater_id);
          if (theater) {
            await theater.addHall(restoredHall._id);
            logger.info(`Re-added hall ${restoredHall._id} to theater ${theater._id}`);
          }
        } catch (theaterError) {
          logger.error(`Failed to re-add hall to theater: ${theaterError.message}`);
          // Don't fail the hall restoration, just log the error
        }
      }

      logger.info(`Restored hall: ${id} (${restoredHall.hall_name})`);

      res.status(200).json({
        success: true,
        message: 'Hall restored successfully',
        data: { hall: restoredHall }
      });
    } catch (error) {
      if (error.message === 'Invalid hall ID format') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      logger.error('Restore hall error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to restore hall'
      });
    }
  }

  // 7. FORCE DELETE HALL (Permanent deletion - Admin/SuperAdmin only)
  static async forceDelete(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Hall ID is required'
        });
      }

      // Enforce Admin/SuperAdmin access
      if (req.user?.role !== Role.ADMIN && req.user?.role !== Role.SUPERADMIN) {
        return res.status(403).json({
          success: false,
          message: 'Only Admin or SuperAdmin can permanently delete halls'
        });
      }

      HallController.validateObjectId(id);

      // Find the hall first
      const hall = await Hall.findById(id);

      if (!hall) {
        return res.status(404).json({
          success: false,
          message: 'Hall not found'
        });
      }

      // Check if hall has associated seats (even soft deleted ones)
      const Seat = require('../models/seat.model');
      const associatedSeats = await Seat.find({
        hall_id: id
        // Note: We check all seats (including soft deleted) for force delete
      });

      if (associatedSeats.length > 0) {
        const activeSeats = associatedSeats.filter(seat => !seat.deletedAt);
        const deletedSeats = associatedSeats.filter(seat => seat.deletedAt);
        
        return res.status(409).json({
          success: false,
          message: `Cannot permanently delete hall. It has ${associatedSeats.length} associated seat(s) (${activeSeats.length} active, ${deletedSeats.length} deleted). Please permanently delete all seats first.`,
          data: {
            totalSeats: associatedSeats.length,
            activeSeats: activeSeats.length,
            deletedSeats: deletedSeats.length,
            seatIdentifiers: associatedSeats.map(seat => ({
              identifier: seat.seat_identifier || `${seat.row}${seat.seat_number}`,
              status: seat.deletedAt ? 'deleted' : 'active'
            }))
          }
        });
      }

      // Store hall info for logging before deletion
      const hallInfo = {
        id: hall._id,
        hall_name: hall.hall_name,
        screen_type: hall.screen_type,
        theater_id: hall.theater_id,
        total_seats: hall.total_seats,
        wasDeleted: hall.isDeleted()
      };

      // Remove hall from theater's halls_id array before deletion
      if (hallInfo.theater_id) {
        const Theater = require('../models/theater.model');
        try {
          const theater = await Theater.findById(hallInfo.theater_id);
          if (theater) {
            await theater.removeHall(id);
            logger.info(`Removed hall ${id} from theater ${theater._id} (permanent deletion)`);
          }
        } catch (theaterError) {
          logger.error(`Failed to remove hall from theater during force delete: ${theaterError.message}`);
          // Don't fail the deletion, just log the error
        }
      }

      // Perform permanent deletion
      await Hall.findByIdAndDelete(id);

      logger.warn(`⚠️  PERMANENT DELETION: Hall permanently deleted by ${req.user.role} ${req.user.userId}`, {
        deletedHall: hallInfo,
        deletedBy: req.user.userId,
        deletedAt: new Date().toISOString(),
        action: 'FORCE_DELETE_HALL'
      });

      res.status(200).json({
        success: true,
        message: 'Hall permanently deleted',
        data: {
          deletedHall: {
            id: hallInfo.id,
            hall_name: hallInfo.hall_name,
            screen_type: hallInfo.screen_type,
            theater_id: hallInfo.theater_id,
            total_seats: hallInfo.total_seats
          },
          warning: 'This action is irreversible'
        }
      });
    } catch (error) {
      if (error.message === 'Invalid hall ID format') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      logger.error('Force delete hall error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to permanently delete hall'
      });
    }
  }

  // 8. LIST DELETED HALLS
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

      // Query for soft deleted halls only
      const query = { deletedAt: { $ne: null } };
      const sortObj = {};
      sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const [halls, totalCount] = await Promise.all([
        Hall.find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Hall.countDocuments(query)
      ]);

      // Add delete info to each hall
      const hallsWithDeleteInfo = halls.map(hall => ({
        ...hall,
        deleteInfo: {
          deletedAt: hall.deletedAt,
          deletedBy: hall.deletedBy,
          daysSinceDeleted: hall.deletedAt ? Math.floor((Date.now() - new Date(hall.deletedAt)) / (1000 * 60 * 60 * 24)) : null
        },
        restoreInfo: {
          restoredAt: hall.restoredAt,
          restoredBy: hall.restoredBy
        }
      }));

      const totalPages = Math.ceil(totalCount / limitNum);

      logger.info(`Retrieved ${halls.length} deleted halls`);

      res.status(200).json({
        success: true,
        data: {
          halls: hallsWithDeleteInfo,
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
      logger.error('Get deleted halls error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve deleted halls'
      });
    }
  }

  // 9. UPDATE HALL STATUS
  static async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Hall ID is required'
        });
      }

      if (!status) {
        return res.status(400).json({
          success: false,
          message: 'Status is required'
        });
      }

      HallController.validateObjectId(id);

      // Find the hall first
      const hall = await Hall.findById(id);

      if (!hall) {
        return res.status(404).json({
          success: false,
          message: 'Hall not found'
        });
      }

      // Check if hall is deleted
      if (hall.isDeleted()) {
        return res.status(409).json({
          success: false,
          message: 'Cannot update status of deleted hall. Please restore it first.'
        });
      }

      // Update status using model method
      const updatedHall = await hall.updateStatus(status, req.user?.userId);

      logger.info(`Updated hall status: ${id} (${hall.hall_name}) to ${status}`);

      res.status(200).json({
        success: true,
        message: 'Hall status updated successfully',
        data: { hall: updatedHall }
      });
    } catch (error) {
      if (error.message === 'Invalid hall ID format') {
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

      logger.error('Update hall status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update hall status'
      });
    }
  }

  // 10. UPDATE HALL CAPACITY
  static async updateCapacity(req, res) {
    try {
      const { id } = req.params;
      const { capacity } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Hall ID is required'
        });
      }

      if (!capacity) {
        return res.status(400).json({
          success: false,
          message: 'Capacity is required'
        });
      }

      HallController.validateObjectId(id);

      // Find the hall first
      const hall = await Hall.findById(id);

      if (!hall) {
        return res.status(404).json({
          success: false,
          message: 'Hall not found'
        });
      }

      // Check if hall is deleted
      if (hall.isDeleted()) {
        return res.status(409).json({
          success: false,
          message: 'Cannot update capacity of deleted hall. Please restore it first.'
        });
      }

      // Update capacity using model method
      const updatedHall = await hall.updateCapacity(capacity);

      logger.info(`Updated hall capacity: ${id} (${hall.hall_name})`);

      res.status(200).json({
        success: true,
        message: 'Hall capacity updated successfully',
        data: { hall: updatedHall }
      });
    } catch (error) {
      if (error.message === 'Invalid hall ID format') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      logger.error('Update hall capacity error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update hall capacity'
      });
    }
  }

  // Additional utility methods

  // Get hall statistics
  static async getStats(req, res) {
    try {
      const stats = await Promise.all([
        Hall.countDocuments({}), // Total halls
        Hall.countDocuments({ deletedAt: null }), // Active halls
        Hall.countDocuments({ deletedAt: { $ne: null } }), // Deleted halls
        Hall.countDocuments({ status: 'active', deletedAt: null }), // Available halls
        Hall.countDocuments({ screen_type: 'standard', deletedAt: null }),
        Hall.countDocuments({ screen_type: 'imax', deletedAt: null }),
        Hall.countDocuments({ screen_type: '3d', deletedAt: null }),
        Hall.countDocuments({ screen_type: '4dx', deletedAt: null }),
        Hall.countDocuments({ screen_type: 'vip', deletedAt: null }),
        Hall.countDocuments({ status: 'active', deletedAt: null }),
        Hall.countDocuments({ status: 'maintenance', deletedAt: null }),
        Hall.countDocuments({ status: 'closed', deletedAt: null }),
        Hall.countDocuments({ status: 'renovation', deletedAt: null }),
        Hall.aggregate([
          { $match: { deletedAt: null } },
          { $group: { _id: null, totalSeats: { $sum: '$total_seats' }, avgSeats: { $avg: '$total_seats' } } }
        ])
      ]);

      const [
        total, active, deleted, available,
        standard, imax, threeDimension, fourDX, vip,
        activeStatus, maintenance, closed, renovation,
        seatsStats
      ] = stats;

      const totalSeats = seatsStats[0]?.totalSeats || 0;
      const avgSeats = seatsStats[0]?.avgSeats || 0;

      res.status(200).json({
        success: true,
        data: {
          total,
          active,
          deleted,
          available,
          screenTypes: {
            standard,
            imax,
            '3d': threeDimension,
            '4dx': fourDX,
            vip
          },
          statuses: {
            active: activeStatus,
            maintenance,
            closed,
            renovation
          },
          seating: {
            totalSeats,
            averageSeats: Math.round(avgSeats)
          },
          percentageActive: total > 0 ? Math.round((active / total) * 100) : 0,
          percentageAvailable: active > 0 ? Math.round((available / active) * 100) : 0
        }
      });
    } catch (error) {
      logger.error('Get hall stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve hall statistics'
      });
    }
  }

  // Get halls by screen type
  static async getHallsByScreenType(req, res) {
    try {
      const { type } = req.params;
      const { page = 1, limit = 10, activeOnly = true } = req.query;

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      const query = { screen_type: type };
      if (activeOnly === 'true') {
        query.deletedAt = null;
      }

      const [halls, totalCount] = await Promise.all([
        Hall.find(query)
          .sort({ hall_name: 1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Hall.countDocuments(query)
      ]);

      res.status(200).json({
        success: true,
        data: {
          halls,
          screenType: type,
          pagination: {
            currentPage: pageNum,
            totalPages: Math.ceil(totalCount / limitNum),
            totalCount,
            limit: limitNum
          }
        }
      });
    } catch (error) {
      logger.error('Get halls by screen type error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve halls by screen type'
      });
    }
  }

  // Get halls by theater
  static async getHallsByTheater(req, res) {
    try {
      const { theaterId } = req.params;
      const { activeOnly = true } = req.query;

      let query = { theater_id: theaterId };
      if (activeOnly === 'true') {
        query.deletedAt = null;
        query.status = 'active';
      }

      const halls = await Hall.find(query)
        .sort({ hall_name: 1 })
        .lean();

      res.status(200).json({
        success: true,
        data: {
          halls,
          theater_id: theaterId,
          count: halls.length
        }
      });
    } catch (error) {
      logger.error('Get halls by theater error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve halls by theater'
      });
    }
  }

  // Get halls with seat counts
  static async getHallsWithSeatCounts(req, res) {
    try {
      const { theater_id, screen_type, activeOnly = true } = req.query;

      let matchQuery = {};
      if (theater_id) matchQuery.theater_id = theater_id;
      if (screen_type) matchQuery.screen_type = screen_type;
      if (activeOnly === 'true') {
        matchQuery.deletedAt = null;
        matchQuery.status = 'active';
      }

      const halls = await Hall.getHallsWithSeatCounts(matchQuery);

      res.status(200).json({
        success: true,
        data: {
          halls,
          count: halls.length,
          filters: {
            theater_id: theater_id || null,
            screen_type: screen_type || null,
            activeOnly: activeOnly === 'true'
          }
        }
      });
    } catch (error) {
      logger.error('Get halls with seat counts error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve halls with seat counts'
      });
    }
  }
}

module.exports = HallController;