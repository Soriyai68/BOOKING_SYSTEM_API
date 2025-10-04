const mongoose = require('mongoose');
const Theater = require('../models/theater.model');
const Screen = require('../models/screen.model');
const { Role } = require('../data');

/**
 * TheaterController - Comprehensive CRUD operations for theater management
 * Handles: getById, getAll, create, update, delete (soft), restore, forceDelete, listDeleted, 
 * updateStatus, addScreen, removeScreen, updateLocation, updateOperatingHours, analytics
 */
class TheaterController {
  // Helper method to validate ObjectId
  static validateObjectId(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid theater ID format');
    }
  }

  // Helper method to build search query
  static buildSearchQuery(search) {
    if (!search) return {};

    return {
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { address: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
        { province: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } }
      ]
    };
  }

  // Helper method to build filter query
  static buildFilterQuery(filters) {
    const query = {};

    // Handle status filter
    if (filters.status) {
      query.status = filters.status;
    }

    // Handle city filter
    if (filters.city) {
      query.city = new RegExp(filters.city, 'i');
    }

    // Handle province filter
    if (filters.province) {
      query.province = new RegExp(filters.province, 'i');
    }

    // Handle screen count range filters
    if (filters.minScreens !== undefined || filters.maxScreens !== undefined) {
      query.total_screens = {};
      if (filters.minScreens !== undefined) {
        query.total_screens.$gte = parseInt(filters.minScreens);
      }
      if (filters.maxScreens !== undefined) {
        query.total_screens.$lte = parseInt(filters.maxScreens);
      }
    }

    // Handle capacity range filters
    if (filters.minCapacity !== undefined || filters.maxCapacity !== undefined) {
      query.total_capacity = {};
      if (filters.minCapacity !== undefined) {
        query.total_capacity.$gte = parseInt(filters.minCapacity);
      }
      if (filters.maxCapacity !== undefined) {
        query.total_capacity.$lte = parseInt(filters.maxCapacity);
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

    // Handle nearby location filter
    if (filters.nearLocation) {
      const [longitude, latitude] = filters.nearLocation.split(',').map(Number);
      if (!isNaN(longitude) && !isNaN(latitude)) {
        query['location.coordinates'] = {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [longitude, latitude]
            },
            $maxDistance: parseInt(filters.maxDistance) || 10000
          }
        };
      }
    }

    return query;
  }

  // 1. GET ALL THEATERS - with pagination, filtering, and sorting
  static async getAll(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'name',
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
        query = { ...query, ...TheaterController.buildSearchQuery(search) };
      }

      // Handle filters
      query = { ...query, ...TheaterController.buildFilterQuery(filters) };

      // Handle soft deleted records
      if (!includeDeleted || includeDeleted === 'false') {
        query.deletedAt = null; // Only get non-deleted theaters
      }

      // Build sort object
      const sortObj = {};
      sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Execute queries
      const [theaters, totalCount] = await Promise.all([
        Theater.find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Theater.countDocuments(query)
      ]);

      // Calculate pagination info
      const totalPages = Math.ceil(totalCount / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      console.log(`Retrieved ${theaters.length} theaters`);

      res.status(200).json({
        success: true,
        data: {
          theaters,
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
      console.error('Get all theaters error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve theaters'
      });
    }
  }

  // 2. GET THEATER BY ID
  static async getById(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Theater ID is required'
        });
      }

      TheaterController.validateObjectId(id);

      const theater = await Theater.findById(id).populate('screens_id').lean();

      if (!theater) {
        return res.status(404).json({
          success: false,
          message: 'Theater not found'
        });
      }

      console.log(`Retrieved theater by ID: ${id}`);

      res.status(200).json({
        success: true,
        data: { theater }
      });
    } catch (error) {
      if (error.message === 'Invalid theater ID format') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      console.error('Get theater by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve theater'
      });
    }
  }

  // 3. CREATE THEATER
  static async create(req, res) {
    try {
      const theaterData = req.body;

      // Validate required fields
      if (!theaterData.name || !theaterData.address || !theaterData.city || !theaterData.province) {
        return res.status(400).json({
          success: false,
          message: 'Theater name, address, city, and province are required'
        });
      }

      // Check if theater already exists in the same city with same name
      const existingTheater = await Theater.findOne({
        name: theaterData.name.trim(),
        city: theaterData.city.trim()
      });

      if (existingTheater) {
        return res.status(409).json({
          success: false,
          message: 'Theater with this name already exists in this city'
        });
      }

      // Set default values
      const theaterToCreate = {
        ...theaterData,
        status: theaterData.status || 'active',
        features: theaterData.features || [],
        total_screens: theaterData.screens_id?.length || 0,
        total_capacity: theaterData.total_capacity || 0,
        screens_id: theaterData.screens_id || []
      };

      // Add creator info if available
      if (req.user) {
        theaterToCreate.createdBy = req.user.userId;
      }

      const theater = new Theater(theaterToCreate);
      await theater.save();

      console.log(`Created new theater: ${theater._id} (${theater.name})`);

      res.status(201).json({
        success: true,
        message: 'Theater created successfully',
        data: { theater }
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
          message: 'Theater with this name already exists in this city'
        });
      }

      console.error('Create theater error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create theater'
      });
    }
  }

  // 4. UPDATE THEATER
  static async update(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Theater ID is required'
        });
      }

      TheaterController.validateObjectId(id);

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

      // Validate unique constraint if name is being updated
      if (updateData.name) {
        const currentTheater = await Theater.findById(id);
        if (!currentTheater) {
          return res.status(404).json({
            success: false,
            message: 'Theater not found'
          });
        }

        const checkQuery = {
          name: updateData.name.trim(),
          city: updateData.city || currentTheater.city,
          _id: { $ne: id }
        };

        const existingTheater = await Theater.findOne(checkQuery);
        if (existingTheater) {
          return res.status(409).json({
            success: false,
            message: 'Theater with this name already exists in this city'
          });
        }
      }

      const theater = await Theater.findByIdAndUpdate(
        id,
        updateData,
        {
          new: true,
          runValidators: true,
          context: 'query'
        }
      );

      if (!theater) {
        return res.status(404).json({
          success: false,
          message: 'Theater not found'
        });
      }

      console.log(`Updated theater: ${id} (${theater.name})`);

      res.status(200).json({
        success: true,
        message: 'Theater updated successfully',
        data: { theater }
      });
    } catch (error) {
      if (error.message === 'Invalid theater ID format') {
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

      console.error('Update theater error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update theater'
      });
    }
  }

  // 5. SOFT DELETE THEATER (Deactivate)
  static async delete(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Theater ID is required'
        });
      }

      TheaterController.validateObjectId(id);

      // Find the theater first
      const theater = await Theater.findById(id);

      if (!theater) {
        return res.status(404).json({
          success: false,
          message: 'Theater not found'
        });
      }

      // Check if theater is already soft deleted
      if (theater.isDeleted()) {
        return res.status(409).json({
          success: false,
          message: 'Theater is already deactivated'
        });
      }

      // Soft delete using model method
      const deletedTheater = await theater.softDelete(req.user?.userId);

      console.log(`Soft deleted theater: ${id} (${deletedTheater.name})`);

      res.status(200).json({
        success: true,
        message: 'Theater deactivated successfully',
        data: { theater: deletedTheater }
      });
    } catch (error) {
      if (error.message === 'Invalid theater ID format') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      console.error('Delete theater error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to deactivate theater'
      });
    }
  }

  // 6. RESTORE THEATER (Reactivate)
  static async restore(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Theater ID is required'
        });
      }

      TheaterController.validateObjectId(id);

      // Find the theater first
      const theater = await Theater.findById(id);

      if (!theater) {
        return res.status(404).json({
          success: false,
          message: 'Theater not found'
        });
      }

      // Check if theater is not deleted (already active)
      if (!theater.isDeleted()) {
        return res.status(409).json({
          success: false,
          message: 'Theater is already active'
        });
      }

      // Restore using model method
      const restoredTheater = await theater.restore(req.user?.userId);

      console.log(`Restored theater: ${id} (${restoredTheater.name})`);

      res.status(200).json({
        success: true,
        message: 'Theater restored successfully',
        data: { theater: restoredTheater }
      });
    } catch (error) {
      if (error.message === 'Invalid theater ID format') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      console.error('Restore theater error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to restore theater'
      });
    }
  }

  // 7. FORCE DELETE THEATER (Permanent deletion - Admin/SuperAdmin only)
  static async forceDelete(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Theater ID is required'
        });
      }

      // Enforce Admin/SuperAdmin access
      if (req.user?.role !== Role.ADMIN && req.user?.role !== Role.SUPERADMIN) {
        return res.status(403).json({
          success: false,
          message: 'Only Admin or SuperAdmin can permanently delete theaters'
        });
      }

      TheaterController.validateObjectId(id);

      // Find the theater first
      const theater = await Theater.findById(id);

      if (!theater) {
        return res.status(404).json({
          success: false,
          message: 'Theater not found'
        });
      }

      // Store theater info for logging before deletion
      const theaterInfo = {
        id: theater._id,
        name: theater.name,
        address: theater.address,
        city: theater.city,
        province: theater.province,
        total_screens: theater.total_screens,
        total_capacity: theater.total_capacity,
        wasDeleted: theater.isDeleted()
      };

      // Perform permanent deletion
      await Theater.findByIdAndDelete(id);

      console.warn(`⚠️  PERMANENT DELETION: Theater permanently deleted by ${req.user.role} ${req.user.userId}`, {
        deletedTheater: theaterInfo,
        deletedBy: req.user.userId,
        deletedAt: new Date().toISOString(),
        action: 'FORCE_DELETE_THEATER'
      });

      res.status(200).json({
        success: true,
        message: 'Theater permanently deleted',
        data: {
          deletedTheater: {
            id: theaterInfo.id,
            name: theaterInfo.name,
            address: theaterInfo.address,
            city: theaterInfo.city,
            province: theaterInfo.province,
            total_screens: theaterInfo.total_screens,
            total_capacity: theaterInfo.total_capacity
          },
          warning: 'This action is irreversible'
        }
      });
    } catch (error) {
      if (error.message === 'Invalid theater ID format') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      console.error('Force delete theater error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to permanently delete theater'
      });
    }
  }

  // 8. LIST DELETED THEATERS
  static async listDeleted(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'deletedAt',
        sortOrder = 'desc'
      } = req.query;

      // Convert and validate pagination
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      // Build sort object
      const sortObj = {};
      sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Query only deleted theaters
      const query = { deletedAt: { $ne: null } };

      // Execute queries
      const [theaters, totalCount] = await Promise.all([
        Theater.find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum)
          .populate('deletedBy', 'username email')
          .lean(),
        Theater.countDocuments(query)
      ]);

      // Calculate pagination info
      const totalPages = Math.ceil(totalCount / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      console.log(`Retrieved ${theaters.length} deleted theaters`);

      res.status(200).json({
        success: true,
        data: {
          theaters,
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
      console.error('List deleted theaters error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve deleted theaters'
      });
    }
  }

  // 9. UPDATE THEATER STATUS
  static async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Theater ID is required'
        });
      }

      if (!status) {
        return res.status(400).json({
          success: false,
          message: 'Status is required'
        });
      }

      TheaterController.validateObjectId(id);

      const theater = await Theater.findById(id);

      if (!theater) {
        return res.status(404).json({
          success: false,
          message: 'Theater not found'
        });
      }

      // Update status using model method
      const updatedTheater = await theater.updateStatus(status, req.user?.userId);

      console.log(`Updated theater status: ${id} (${theater.name}) -> ${status}`);

      res.status(200).json({
        success: true,
        message: 'Theater status updated successfully',
        data: { theater: updatedTheater }
      });
    } catch (error) {
      if (error.message === 'Invalid theater ID format' || error.message === 'Invalid status provided') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      console.error('Update theater status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update theater status'
      });
    }
  }

  // 10. ADD SCREEN TO THEATER
  static async addScreen(req, res) {
    try {
      const { id } = req.params;
      const { screen_id } = req.body;

      if (!id || !screen_id) {
        return res.status(400).json({
          success: false,
          message: 'Theater ID and Screen ID are required'
        });
      }

      TheaterController.validateObjectId(id);
      TheaterController.validateObjectId(screen_id);

      // Check if theater exists
      const theater = await Theater.findById(id);
      if (!theater) {
        return res.status(404).json({
          success: false,
          message: 'Theater not found'
        });
      }

      // Check if screen exists
      const screen = await Screen.findById(screen_id);
      if (!screen) {
        return res.status(404).json({
          success: false,
          message: 'Screen not found'
        });
      }

      // Check if screen is already assigned to this theater
      if (theater.screens_id.includes(screen_id)) {
        return res.status(409).json({
          success: false,
          message: 'Screen is already assigned to this theater'
        });
      }

      // Add screen using model method
      const updatedTheater = await theater.addScreen(screen_id);

      // Update screen's theater_id
      screen.theater_id = id;
      if (req.user) {
        screen.updatedBy = req.user.userId;
      }
      await screen.save();

      console.log(`Added screen ${screen_id} to theater ${id}`);

      res.status(200).json({
        success: true,
        message: 'Screen added to theater successfully',
        data: { theater: updatedTheater }
      });
    } catch (error) {
      if (error.message === 'Invalid theater ID format') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      console.error('Add screen to theater error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add screen to theater'
      });
    }
  }

  // 11. REMOVE SCREEN FROM THEATER
  static async removeScreen(req, res) {
    try {
      const { id } = req.params;
      const { screen_id } = req.body;

      if (!id || !screen_id) {
        return res.status(400).json({
          success: false,
          message: 'Theater ID and Screen ID are required'
        });
      }

      TheaterController.validateObjectId(id);
      TheaterController.validateObjectId(screen_id);

      // Check if theater exists
      const theater = await Theater.findById(id);
      if (!theater) {
        return res.status(404).json({
          success: false,
          message: 'Theater not found'
        });
      }

      // Check if screen is assigned to this theater
      if (!theater.screens_id.includes(screen_id)) {
        return res.status(409).json({
          success: false,
          message: 'Screen is not assigned to this theater'
        });
      }

      // Remove screen using model method
      const updatedTheater = await theater.removeScreen(screen_id);

      // Update screen's theater_id
      const screen = await Screen.findById(screen_id);
      if (screen) {
        screen.theater_id = null;
        if (req.user) {
          screen.updatedBy = req.user.userId;
        }
        await screen.save();
      }

      console.log(`Removed screen ${screen_id} from theater ${id}`);

      res.status(200).json({
        success: true,
        message: 'Screen removed from theater successfully',
        data: { theater: updatedTheater }
      });
    } catch (error) {
      if (error.message === 'Invalid theater ID format') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      console.error('Remove screen from theater error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to remove screen from theater'
      });
    }
  }

  // 12. UPDATE THEATER LOCATION
  static async updateLocation(req, res) {
    try {
      const { id } = req.params;
      const { longitude, latitude } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Theater ID is required'
        });
      }

      if (longitude === undefined || latitude === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Longitude and latitude are required'
        });
      }

      TheaterController.validateObjectId(id);

      const theater = await Theater.findById(id);

      if (!theater) {
        return res.status(404).json({
          success: false,
          message: 'Theater not found'
        });
      }

      // Update location using model method
      const updatedTheater = await theater.updateLocation(longitude, latitude);

      console.log(`Updated theater location: ${id} -> [${longitude}, ${latitude}]`);

      res.status(200).json({
        success: true,
        message: 'Theater location updated successfully',
        data: { theater: updatedTheater }
      });
    } catch (error) {
      if (error.message === 'Invalid theater ID format') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      console.error('Update theater location error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update theater location'
      });
    }
  }

  // 13. GET THEATERS BY CITY
  static async getByCity(req, res) {
    try {
      const { city } = req.params;
      const { activeOnly = 'true', includeScreens = 'false' } = req.query;

      if (!city) {
        return res.status(400).json({
          success: false,
          message: 'City is required'
        });
      }

      let query = {};
      if (activeOnly === 'true') {
        query.status = 'active';
      }

      let theaterQuery = Theater.findByCity(city, query);

      if (includeScreens === 'true') {
        theaterQuery = theaterQuery.populate('screens_id');
      }

      const theaters = await theaterQuery.lean();

      console.log(`Retrieved ${theaters.length} theaters in ${city}`);

      res.status(200).json({
        success: true,
        data: { theaters, city }
      });
    } catch (error) {
      console.error('Get theaters by city error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve theaters by city'
      });
    }
  }

  // 14. GET THEATERS BY PROVINCE
  static async getByProvince(req, res) {
    try {
      const { province } = req.params;
      const { activeOnly = 'true', includeScreens = 'false' } = req.query;

      if (!province) {
        return res.status(400).json({
          success: false,
          message: 'Province is required'
        });
      }

      let query = {};
      if (activeOnly === 'true') {
        query.status = 'active';
      }

      let theaterQuery = Theater.findByProvince(province, query);

      if (includeScreens === 'true') {
        theaterQuery = theaterQuery.populate('screens_id');
      }

      const theaters = await theaterQuery.lean();

      console.log(`Retrieved ${theaters.length} theaters in ${province}`);

      res.status(200).json({
        success: true,
        data: { theaters, province }
      });
    } catch (error) {
      console.error('Get theaters by province error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve theaters by province'
      });
    }
  }

  // 15. GET NEARBY THEATERS
  static async getNearby(req, res) {
    try {
      const { longitude, latitude, maxDistance = 10000, activeOnly = 'true' } = req.query;

      if (!longitude || !latitude) {
        return res.status(400).json({
          success: false,
          message: 'Longitude and latitude are required'
        });
      }

      const lon = parseFloat(longitude);
      const lat = parseFloat(latitude);
      const distance = parseInt(maxDistance);

      if (isNaN(lon) || isNaN(lat)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid coordinates provided'
        });
      }

      let query = {};
      if (activeOnly === 'true') {
        query.status = 'active';
      }

      const theaters = await Theater.findNearby(lon, lat, distance, query).lean();

      console.log(`Retrieved ${theaters.length} nearby theaters`);

      res.status(200).json({
        success: true,
        data: { 
          theaters,
          searchCriteria: {
            coordinates: [lon, lat],
            maxDistance: distance
          }
        }
      });
    } catch (error) {
      console.error('Get nearby theaters error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve nearby theaters'
      });
    }
  }

  // 16. GET THEATER ANALYTICS
  static async getAnalytics(req, res) {
    try {
      const { city, province, status, dateFrom, dateTo, groupBy = 'province' } = req.query;

      let query = {};

      if (city) {
        query.city = new RegExp(city, 'i');
      }

      if (province) {
        query.province = new RegExp(province, 'i');
      }

      if (status) {
        query.status = status;
      }

      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) {
          query.createdAt.$gte = new Date(dateFrom);
        }
        if (dateTo) {
          query.createdAt.$lte = new Date(dateTo);
        }
      }

      const analytics = await Theater.getAnalytics(query);

      console.log('Generated theater analytics');

      res.status(200).json({
        success: true,
        data: {
          analytics: analytics[0] || {},
          filters: { city, province, status, dateFrom, dateTo, groupBy }
        }
      });
    } catch (error) {
      console.error('Get theater analytics error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve theater analytics'
      });
    }
  }
}

module.exports = TheaterController;