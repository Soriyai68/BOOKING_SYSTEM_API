const mongoose = require('mongoose');
const Screen = require('../models/screen.model');
const { Role } = require('../data');
const logger = require('../utils/logger');

/**
 * ScreenController - Comprehensive CRUD operations for screen management
 * Handles: getById, getAll, create, update, delete (soft), restore, forceDelete, listDeleted, updateStatus, updateCapacity
 */
class ScreenController {
  // Helper method to validate ObjectId
  static validateObjectId(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid screen ID format');
    }
  }

  // Helper method to build search query
  static buildSearchQuery(search) {
    if (!search) return {};

    return {
      $or: [
        { screen_name: { $regex: search, $options: 'i' } },
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

  // 1. GET ALL SCREENS - with pagination, filtering, and sorting
  static async getAll(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'screen_name',
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
        query = { ...query, ...ScreenController.buildSearchQuery(search) };
      }

      // Handle filters
      query = { ...query, ...ScreenController.buildFilterQuery(filters) };

      // Handle soft deleted records
      if (!includeDeleted || includeDeleted === 'false') {
        query.deletedAt = null; // Only get non-deleted screens
      }

      // Build sort object
      const sortObj = {};
      sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Execute queries
      const [screens, totalCount] = await Promise.all([
        Screen.find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Screen.countDocuments(query)
      ]);

      // Calculate pagination info
      const totalPages = Math.ceil(totalCount / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      logger.info(`Retrieved ${screens.length} screens`);

      res.status(200).json({
        success: true,
        data: {
          screens,
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
      logger.error('Get all screens error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve screens'
      });
    }
  }

  // 2. GET SCREEN BY ID
  static async getById(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Screen ID is required'
        });
      }

      ScreenController.validateObjectId(id);

      const screen = await Screen.findById(id).lean();

      if (!screen) {
        return res.status(404).json({
          success: false,
          message: 'Screen not found'
        });
      }

      logger.info(`Retrieved screen by ID: ${id}`);

      res.status(200).json({
        success: true,
        data: { screen }
      });
    } catch (error) {
      if (error.message === 'Invalid screen ID format') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      logger.error('Get screen by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve screen'
      });
    }
  }

  // 3. CREATE SCREEN
  static async create(req, res) {
    try {
      const screenData = req.body;

      // Validate required fields
      if (!screenData.screen_name || !screenData.total_seats) {
        return res.status(400).json({
          success: false,
          message: 'Screen name and total seats are required'
        });
      }

      // Check if screen already exists in the same theater
      const existingQuery = {
        screen_name: screenData.screen_name.trim()
      };

      if (screenData.theater_id) {
        existingQuery.theater_id = screenData.theater_id;
      }

      const existingScreen = await Screen.findOne(existingQuery);
      if (existingScreen) {
        return res.status(409).json({
          success: false,
          message: 'Screen with this name already exists in this theater'
        });
      }

      // Set default values
      const screenToCreate = {
        ...screenData,
        screen_type: screenData.screen_type || 'standard',
        status: screenData.status || 'active',
        features: screenData.features || [],
        capacity: screenData.capacity || {
          standard: 0,
          premium: 0,
          vip: 0,
          wheelchair: 0,
          recliner: 0
        },
        dimensions: screenData.dimensions || {
          width: 10,
          height: 10
        }
      };

      // Add creator info if available
      if (req.user) {
        screenToCreate.createdBy = req.user.userId;
      }

      const screen = new Screen(screenToCreate);
      await screen.save();

      // Update theater's screens_id array
      if (screen.theater_id) {
        const Theater = require('../models/theater.model');
        try {
          const theater = await Theater.findById(screen.theater_id);
          if (theater) {
            await theater.addScreen(screen._id);
            logger.info(`Added screen ${screen._id} to theater ${theater._id}`);
          }
        } catch (theaterError) {
          logger.error(`Failed to add screen to theater: ${theaterError.message}`);
          // Don't fail the screen creation, just log the error
        }
      }

      logger.info(`Created new screen: ${screen._id} (${screen.screen_name})`);

      res.status(201).json({
        success: true,
        message: 'Screen created successfully',
        data: { screen }
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
          message: 'Screen with this name already exists in this theater'
        });
      }

      logger.error('Create screen error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create screen'
      });
    }
  }

  // 4. UPDATE SCREEN
  static async update(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Screen ID is required'
        });
      }

      ScreenController.validateObjectId(id);

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

      // Get current screen to check for theater changes
      const currentScreen = await Screen.findById(id);
      if (!currentScreen) {
        return res.status(404).json({
          success: false,
          message: 'Screen not found'
        });
      }

      // Validate unique constraint if screen_name is being updated
      if (updateData.screen_name) {
        const checkQuery = {
          screen_name: updateData.screen_name.trim(),
          theater_id: updateData.theater_id || currentScreen.theater_id,
          _id: { $ne: id }
        };

        const existingScreen = await Screen.findOne(checkQuery);
        if (existingScreen) {
          return res.status(409).json({
            success: false,
            message: 'Screen with this name already exists in this theater'
          });
        }
      }

      const screen = await Screen.findByIdAndUpdate(
        id,
        updateData,
        {
          new: true,
          runValidators: true,
          context: 'query'
        }
      );

      // Handle theater change
      if (updateData.theater_id && currentScreen.theater_id) {
        const oldTheaterId = currentScreen.theater_id.toString();
        const newTheaterId = updateData.theater_id.toString();
        
        if (oldTheaterId !== newTheaterId) {
          const Theater = require('../models/theater.model');
          
          try {
            // Remove from old theater
            const oldTheater = await Theater.findById(oldTheaterId);
            if (oldTheater) {
              await oldTheater.removeScreen(id);
              logger.info(`Removed screen ${id} from old theater ${oldTheaterId}`);
            }
            
            // Add to new theater
            const newTheater = await Theater.findById(newTheaterId);
            if (newTheater) {
              await newTheater.addScreen(id);
              logger.info(`Added screen ${id} to new theater ${newTheaterId}`);
            }
          } catch (theaterError) {
            logger.error(`Failed to update theater associations: ${theaterError.message}`);
            // Don't fail the screen update, just log the error
          }
        }
      }

      if (!screen) {
        return res.status(404).json({
          success: false,
          message: 'Screen not found'
        });
      }

      logger.info(`Updated screen: ${id} (${screen.screen_name})`);

      res.status(200).json({
        success: true,
        message: 'Screen updated successfully',
        data: { screen }
      });
    } catch (error) {
      if (error.message === 'Invalid screen ID format') {
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

      logger.error('Update screen error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update screen'
      });
    }
  }

  // 5. SOFT DELETE SCREEN (Deactivate)
  static async delete(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Screen ID is required'
        });
      }

      ScreenController.validateObjectId(id);

      // Find the screen first
      const screen = await Screen.findById(id);

      if (!screen) {
        return res.status(404).json({
          success: false,
          message: 'Screen not found'
        });
      }

      // Check if screen is already soft deleted
      if (screen.isDeleted()) {
        return res.status(409).json({
          success: false,
          message: 'Screen is already deactivated'
        });
      }

      // Check if screen has associated seats
      const Seat = require('../models/seat.model');
      const associatedSeats = await Seat.find({
        screen_id: id,
        deletedAt: null // Only count active seats
      });

      if (associatedSeats.length > 0) {
        return res.status(409).json({
          success: false,
          message: `Cannot delete screen. It has ${associatedSeats.length} associated seat(s). Please delete or reassign the seats first.`,
          data: {
            associatedSeatsCount: associatedSeats.length,
            seatIdentifiers: associatedSeats.map(seat => seat.seat_identifier || `${seat.row}${seat.seat_number}`)
          }
        });
      }

      // Soft delete using model method
      const deletedScreen = await screen.softDelete(req.user?.userId);

      // Remove screen from theater's screens_id array
      if (deletedScreen.theater_id) {
        const Theater = require('../models/theater.model');
        try {
          const theater = await Theater.findById(deletedScreen.theater_id);
          if (theater) {
            await theater.removeScreen(deletedScreen._id);
            logger.info(`Removed screen ${deletedScreen._id} from theater ${theater._id}`);
          }
        } catch (theaterError) {
          logger.error(`Failed to remove screen from theater: ${theaterError.message}`);
          // Don't fail the screen deletion, just log the error
        }
      }

      logger.info(`Soft deleted screen: ${id} (${deletedScreen.screen_name})`);

      res.status(200).json({
        success: true,
        message: 'Screen deactivated successfully',
        data: { screen: deletedScreen }
      });
    } catch (error) {
      if (error.message === 'Invalid screen ID format') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      logger.error('Delete screen error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to deactivate screen'
      });
    }
  }

  // 6. RESTORE SCREEN (Reactivate)
  static async restore(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Screen ID is required'
        });
      }

      ScreenController.validateObjectId(id);

      // Find the screen first
      const screen = await Screen.findById(id);

      if (!screen) {
        return res.status(404).json({
          success: false,
          message: 'Screen not found'
        });
      }

      // Check if screen is not deleted (already active)
      if (!screen.isDeleted()) {
        return res.status(409).json({
          success: false,
          message: 'Screen is already active'
        });
      }

      // Restore using model method
      const restoredScreen = await screen.restore(req.user?.userId);

      // Re-add screen to theater's screens_id array
      if (restoredScreen.theater_id) {
        const Theater = require('../models/theater.model');
        try {
          const theater = await Theater.findById(restoredScreen.theater_id);
          if (theater) {
            await theater.addScreen(restoredScreen._id);
            logger.info(`Re-added screen ${restoredScreen._id} to theater ${theater._id}`);
          }
        } catch (theaterError) {
          logger.error(`Failed to re-add screen to theater: ${theaterError.message}`);
          // Don't fail the screen restoration, just log the error
        }
      }

      logger.info(`Restored screen: ${id} (${restoredScreen.screen_name})`);

      res.status(200).json({
        success: true,
        message: 'Screen restored successfully',
        data: { screen: restoredScreen }
      });
    } catch (error) {
      if (error.message === 'Invalid screen ID format') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      logger.error('Restore screen error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to restore screen'
      });
    }
  }

  // 7. FORCE DELETE SCREEN (Permanent deletion - Admin/SuperAdmin only)
  static async forceDelete(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Screen ID is required'
        });
      }

      // Enforce Admin/SuperAdmin access
      if (req.user?.role !== Role.ADMIN && req.user?.role !== Role.SUPERADMIN) {
        return res.status(403).json({
          success: false,
          message: 'Only Admin or SuperAdmin can permanently delete screens'
        });
      }

      ScreenController.validateObjectId(id);

      // Find the screen first
      const screen = await Screen.findById(id);

      if (!screen) {
        return res.status(404).json({
          success: false,
          message: 'Screen not found'
        });
      }

      // Check if screen has associated seats (even soft deleted ones)
      const Seat = require('../models/seat.model');
      const associatedSeats = await Seat.find({
        screen_id: id
        // Note: We check all seats (including soft deleted) for force delete
      });

      if (associatedSeats.length > 0) {
        const activeSeats = associatedSeats.filter(seat => !seat.deletedAt);
        const deletedSeats = associatedSeats.filter(seat => seat.deletedAt);
        
        return res.status(409).json({
          success: false,
          message: `Cannot permanently delete screen. It has ${associatedSeats.length} associated seat(s) (${activeSeats.length} active, ${deletedSeats.length} deleted). Please permanently delete all seats first.`,
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

      // Store screen info for logging before deletion
      const screenInfo = {
        id: screen._id,
        screen_name: screen.screen_name,
        screen_type: screen.screen_type,
        theater_id: screen.theater_id,
        total_seats: screen.total_seats,
        wasDeleted: screen.isDeleted()
      };

      // Remove screen from theater's screens_id array before deletion
      if (screenInfo.theater_id) {
        const Theater = require('../models/theater.model');
        try {
          const theater = await Theater.findById(screenInfo.theater_id);
          if (theater) {
            await theater.removeScreen(id);
            logger.info(`Removed screen ${id} from theater ${theater._id} (permanent deletion)`);
          }
        } catch (theaterError) {
          logger.error(`Failed to remove screen from theater during force delete: ${theaterError.message}`);
          // Don't fail the deletion, just log the error
        }
      }

      // Perform permanent deletion
      await Screen.findByIdAndDelete(id);

      logger.warn(`⚠️  PERMANENT DELETION: Screen permanently deleted by ${req.user.role} ${req.user.userId}`, {
        deletedScreen: screenInfo,
        deletedBy: req.user.userId,
        deletedAt: new Date().toISOString(),
        action: 'FORCE_DELETE_SCREEN'
      });

      res.status(200).json({
        success: true,
        message: 'Screen permanently deleted',
        data: {
          deletedScreen: {
            id: screenInfo.id,
            screen_name: screenInfo.screen_name,
            screen_type: screenInfo.screen_type,
            theater_id: screenInfo.theater_id,
            total_seats: screenInfo.total_seats
          },
          warning: 'This action is irreversible'
        }
      });
    } catch (error) {
      if (error.message === 'Invalid screen ID format') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      logger.error('Force delete screen error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to permanently delete screen'
      });
    }
  }

  // 8. LIST DELETED SCREENS
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

      // Query for soft deleted screens only
      const query = { deletedAt: { $ne: null } };
      const sortObj = {};
      sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const [screens, totalCount] = await Promise.all([
        Screen.find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Screen.countDocuments(query)
      ]);

      // Add delete info to each screen
      const screensWithDeleteInfo = screens.map(screen => ({
        ...screen,
        deleteInfo: {
          deletedAt: screen.deletedAt,
          deletedBy: screen.deletedBy,
          daysSinceDeleted: screen.deletedAt ? Math.floor((Date.now() - new Date(screen.deletedAt)) / (1000 * 60 * 60 * 24)) : null
        },
        restoreInfo: {
          restoredAt: screen.restoredAt,
          restoredBy: screen.restoredBy
        }
      }));

      const totalPages = Math.ceil(totalCount / limitNum);

      logger.info(`Retrieved ${screens.length} deleted screens`);

      res.status(200).json({
        success: true,
        data: {
          screens: screensWithDeleteInfo,
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
      logger.error('Get deleted screens error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve deleted screens'
      });
    }
  }

  // 9. UPDATE SCREEN STATUS
  static async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Screen ID is required'
        });
      }

      if (!status) {
        return res.status(400).json({
          success: false,
          message: 'Status is required'
        });
      }

      ScreenController.validateObjectId(id);

      // Find the screen first
      const screen = await Screen.findById(id);

      if (!screen) {
        return res.status(404).json({
          success: false,
          message: 'Screen not found'
        });
      }

      // Check if screen is deleted
      if (screen.isDeleted()) {
        return res.status(409).json({
          success: false,
          message: 'Cannot update status of deleted screen. Please restore it first.'
        });
      }

      // Update status using model method
      const updatedScreen = await screen.updateStatus(status, req.user?.userId);

      logger.info(`Updated screen status: ${id} (${screen.screen_name}) to ${status}`);

      res.status(200).json({
        success: true,
        message: 'Screen status updated successfully',
        data: { screen: updatedScreen }
      });
    } catch (error) {
      if (error.message === 'Invalid screen ID format') {
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

      logger.error('Update screen status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update screen status'
      });
    }
  }

  // 10. UPDATE SCREEN CAPACITY
  static async updateCapacity(req, res) {
    try {
      const { id } = req.params;
      const { capacity } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Screen ID is required'
        });
      }

      if (!capacity) {
        return res.status(400).json({
          success: false,
          message: 'Capacity is required'
        });
      }

      ScreenController.validateObjectId(id);

      // Find the screen first
      const screen = await Screen.findById(id);

      if (!screen) {
        return res.status(404).json({
          success: false,
          message: 'Screen not found'
        });
      }

      // Check if screen is deleted
      if (screen.isDeleted()) {
        return res.status(409).json({
          success: false,
          message: 'Cannot update capacity of deleted screen. Please restore it first.'
        });
      }

      // Update capacity using model method
      const updatedScreen = await screen.updateCapacity(capacity);

      logger.info(`Updated screen capacity: ${id} (${screen.screen_name})`);

      res.status(200).json({
        success: true,
        message: 'Screen capacity updated successfully',
        data: { screen: updatedScreen }
      });
    } catch (error) {
      if (error.message === 'Invalid screen ID format') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      logger.error('Update screen capacity error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update screen capacity'
      });
    }
  }

  // Additional utility methods

  // Get screen statistics
  static async getStats(req, res) {
    try {
      const stats = await Promise.all([
        Screen.countDocuments({}), // Total screens
        Screen.countDocuments({ deletedAt: null }), // Active screens
        Screen.countDocuments({ deletedAt: { $ne: null } }), // Deleted screens
        Screen.countDocuments({ status: 'active', deletedAt: null }), // Available screens
        Screen.countDocuments({ screen_type: 'standard', deletedAt: null }),
        Screen.countDocuments({ screen_type: 'imax', deletedAt: null }),
        Screen.countDocuments({ screen_type: '3d', deletedAt: null }),
        Screen.countDocuments({ screen_type: '4dx', deletedAt: null }),
        Screen.countDocuments({ screen_type: 'vip', deletedAt: null }),
        Screen.countDocuments({ status: 'active', deletedAt: null }),
        Screen.countDocuments({ status: 'maintenance', deletedAt: null }),
        Screen.countDocuments({ status: 'closed', deletedAt: null }),
        Screen.countDocuments({ status: 'renovation', deletedAt: null }),
        Screen.aggregate([
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
      logger.error('Get screen stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve screen statistics'
      });
    }
  }

  // Get screens by type
  static async getScreensByType(req, res) {
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

      const [screens, totalCount] = await Promise.all([
        Screen.find(query)
          .sort({ screen_name: 1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Screen.countDocuments(query)
      ]);

      res.status(200).json({
        success: true,
        data: {
          screens,
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
      logger.error('Get screens by type error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve screens by type'
      });
    }
  }

  // Get screens by theater
  static async getScreensByTheater(req, res) {
    try {
      const { theaterId } = req.params;
      const { activeOnly = true } = req.query;

      let query = { theater_id: theaterId };
      if (activeOnly === 'true') {
        query.deletedAt = null;
        query.status = 'active';
      }

      const screens = await Screen.find(query)
        .sort({ screen_name: 1 })
        .lean();

      res.status(200).json({
        success: true,
        data: {
          screens,
          theater_id: theaterId,
          count: screens.length
        }
      });
    } catch (error) {
      logger.error('Get screens by theater error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve screens by theater'
      });
    }
  }

  // Get screens with seat counts
  static async getScreensWithSeatCounts(req, res) {
    try {
      const { theater_id, screen_type, activeOnly = true } = req.query;

      let matchQuery = {};
      if (theater_id) matchQuery.theater_id = theater_id;
      if (screen_type) matchQuery.screen_type = screen_type;
      if (activeOnly === 'true') {
        matchQuery.deletedAt = null;
        matchQuery.status = 'active';
      }

      const screens = await Screen.getScreensWithSeatCounts(matchQuery);

      res.status(200).json({
        success: true,
        data: {
          screens,
          count: screens.length,
          filters: {
            theater_id: theater_id || null,
            screen_type: screen_type || null,
            activeOnly: activeOnly === 'true'
          }
        }
      });
    } catch (error) {
      logger.error('Get screens with seat counts error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve screens with seat counts'
      });
    }
  }
}

module.exports = ScreenController;