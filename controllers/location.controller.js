const mongoose = require('mongoose');
const Location = require('../models/location.model');
const { Role } = require('../data');
const logger = require('../utils/logger');

/**
 * LocationController - Comprehensive CRUD operations for location management
 * Handles: getById, getAll, create, update, delete (soft), restore, forceDelete, listDeleted, and utility methods
 */
class LocationController {
  // Helper method to validate ObjectId
  static validateObjectId(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid location ID format');
    }
  }

  // Helper method to build search query
  static buildSearchQuery(search) {
    if (!search) return {};

    return {
      $or: [
        { address: { $regex: search, $options: 'i' } },
        { city: { $regex: search, $options: 'i' } },
        { province: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { country: { $regex: search, $options: 'i' } }
      ]
    };
  }

  // Helper method to build filter query
  static buildFilterQuery(filters) {
    const query = {};

    // Handle city filter
    if (filters.city) {
      query.city = new RegExp(filters.city, 'i');
    }

    // Handle province filter
    if (filters.province) {
      query.province = new RegExp(filters.province, 'i');
    }

    // Handle country filter
    if (filters.country) {
      query.country = new RegExp(filters.country, 'i');
    }

    // Handle status filter
    if (filters.status !== undefined) {
      query.status = filters.status === 'true' || filters.status === true;
    }

    // Handle coordinates filter
    if (filters.hasCoordinates !== undefined) {
      const hasCoords = filters.hasCoordinates === 'true' || filters.hasCoordinates === true;
      if (hasCoords) {
        query['coordinates.latitude'] = { $exists: true };
        query['coordinates.longitude'] = { $exists: true };
      } else {
        query.$or = [
          { 'coordinates.latitude': { $exists: false } },
          { 'coordinates.longitude': { $exists: false } },
          { coordinates: null }
        ];
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

  // 1. GET ALL LOCATIONS - with pagination, filtering, and sorting
  static async getAll(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'city',
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
        query = { ...query, ...LocationController.buildSearchQuery(search) };
      }

      // Handle filters
      query = { ...query, ...LocationController.buildFilterQuery(filters) };

      // Handle soft deleted records
      if (!includeDeleted || includeDeleted === 'false') {
        query.deletedAt = null; // Only get non-deleted locations
      }

      // Build sort object
      const sortObj = {};
      sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Execute queries
      const [locations, totalCount] = await Promise.all([
        Location.find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Location.countDocuments(query)
      ]);

      // Calculate pagination info
      const totalPages = Math.ceil(totalCount / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      logger.info(`Retrieved ${locations.length} locations`);

      res.status(200).json({
        success: true,
        data: {
          locations,
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
      logger.error('Get all locations error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve locations'
      });
    }
  }

  // 2. GET LOCATION BY ID
  static async getById(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Location ID is required'
        });
      }

      LocationController.validateObjectId(id);

      const location = await Location.findById(id).lean();

      if (!location) {
        return res.status(404).json({
          success: false,
          message: 'Location not found'
        });
      }

      logger.info(`Retrieved location by ID: ${id}`);

      res.status(200).json({
        success: true,
        data: { location }
      });
    } catch (error) {
      if (error.message === 'Invalid location ID format') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      logger.error('Get location by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve location'
      });
    }
  }

  // 3. CREATE LOCATION
  static async create(req, res) {
    try {
      const locationData = req.body;

      // Validate required fields
      if (!locationData.address || !locationData.city || !locationData.province) {
        return res.status(400).json({
          success: false,
          message: 'Address, city, and province are required'
        });
      }

      // Check if location already exists
      const existingLocation = await Location.findOne({
        address: new RegExp(`^${locationData.address.trim()}$`, 'i'),
        city: new RegExp(`^${locationData.city.trim()}$`, 'i'),
        province: new RegExp(`^${locationData.province.trim()}$`, 'i')
      });

      if (existingLocation) {
        return res.status(409).json({
          success: false,
          message: 'Location with this address, city, and province already exists'
        });
      }

      // Set default values
      const locationToCreate = {
        ...locationData,
        status: locationData.status !== undefined ? locationData.status : true,
        description: locationData.description || '',
        totalTheaters: locationData.totalTheaters || 0,
        totalSeats: locationData.totalSeats || 0
      };

      // Add creator info if available
      if (req.user) {
        locationToCreate.createdBy = req.user.userId;
      }

      const location = new Location(locationToCreate);
      await location.save();

      logger.info(`Created new location: ${location._id} (${location.city}, ${location.province})`);

      res.status(201).json({
        success: true,
        message: 'Location created successfully',
        data: { location }
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
          message: 'Location with this address already exists'
        });
      }

      logger.error('Create location error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create location'
      });
    }
  }

  // 4. UPDATE LOCATION
  static async update(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Location ID is required'
        });
      }

      LocationController.validateObjectId(id);

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

      // Check for duplicate if address, city, or province is being updated
      if (updateData.address || updateData.city || updateData.province) {
        const currentLocation = await Location.findById(id);
        if (!currentLocation) {
          return res.status(404).json({
            success: false,
            message: 'Location not found'
          });
        }

        const checkAddress = updateData.address || currentLocation.address;
        const checkCity = updateData.city || currentLocation.city;
        const checkProvince = updateData.province || currentLocation.province;

        const existingLocation = await Location.findOne({
          address: new RegExp(`^${checkAddress.trim()}$`, 'i'),
          city: new RegExp(`^${checkCity.trim()}$`, 'i'),
          province: new RegExp(`^${checkProvince.trim()}$`, 'i'),
          _id: { $ne: id }
        });

        if (existingLocation) {
          return res.status(409).json({
            success: false,
            message: 'Location with this address, city, and province already exists'
          });
        }
      }

      const location = await Location.findByIdAndUpdate(
        id,
        updateData,
        {
          new: true,
          runValidators: true,
          context: 'query'
        }
      );

      if (!location) {
        return res.status(404).json({
          success: false,
          message: 'Location not found'
        });
      }

      logger.info(`Updated location: ${id} (${location.city}, ${location.province})`);

      res.status(200).json({
        success: true,
        message: 'Location updated successfully',
        data: { location }
      });
    } catch (error) {
      if (error.message === 'Invalid location ID format') {
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

      logger.error('Update location error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update location'
      });
    }
  }

  // 5. SOFT DELETE LOCATION (Deactivate)
  static async delete(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Location ID is required'
        });
      }

      LocationController.validateObjectId(id);

      // Find the location first
      const location = await Location.findById(id);

      if (!location) {
        return res.status(404).json({
          success: false,
          message: 'Location not found'
        });
      }

      // Check if location is already soft deleted
      if (location.isDeleted()) {
        return res.status(409).json({
          success: false,
          message: 'Location is already deactivated'
        });
      }

      // Soft delete using model method
      const deletedLocation = await location.softDelete(req.user?.userId);

      logger.info(`Soft deleted location: ${id} (${deletedLocation.city}, ${deletedLocation.province})`);

      res.status(200).json({
        success: true,
        message: 'Location deactivated successfully',
        data: { location: deletedLocation }
      });
    } catch (error) {
      if (error.message === 'Invalid location ID format') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      logger.error('Delete location error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to deactivate location'
      });
    }
  }

  // 6. RESTORE LOCATION (Reactivate)
  static async restore(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Location ID is required'
        });
      }

      LocationController.validateObjectId(id);

      // Find the location first
      const location = await Location.findById(id);

      if (!location) {
        return res.status(404).json({
          success: false,
          message: 'Location not found'
        });
      }

      // Check if location is not deleted (already active)
      if (!location.isDeleted()) {
        return res.status(409).json({
          success: false,
          message: 'Location is already active'
        });
      }

      // Restore using model method
      const restoredLocation = await location.restore(req.user?.userId);

      logger.info(`Restored location: ${id} (${restoredLocation.city}, ${restoredLocation.province})`);

      res.status(200).json({
        success: true,
        message: 'Location restored successfully',
        data: { location: restoredLocation }
      });
    } catch (error) {
      if (error.message === 'Invalid location ID format') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      logger.error('Restore location error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to restore location'
      });
    }
  }

  // 7. FORCE DELETE LOCATION (Permanent deletion - Admin/SuperAdmin only)
  static async forceDelete(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Location ID is required'
        });
      }

      // Enforce Admin/SuperAdmin access
      if (req.user?.role !== Role.ADMIN && req.user?.role !== Role.SUPERADMIN) {
        return res.status(403).json({
          success: false,
          message: 'Only Admin or SuperAdmin can permanently delete locations'
        });
      }

      LocationController.validateObjectId(id);

      // Find the location first
      const location = await Location.findById(id);

      if (!location) {
        return res.status(404).json({
          success: false,
          message: 'Location not found'
        });
      }

      // Store location info for logging before deletion
      const locationInfo = {
        id: location._id,
        address: location.address,
        city: location.city,
        province: location.province,
        country: location.country,
        totalTheaters: location.totalTheaters,
        totalSeats: location.totalSeats,
        wasDeleted: location.isDeleted()
      };

      // Perform permanent deletion
      await Location.findByIdAndDelete(id);

      logger.warn(`⚠️  PERMANENT DELETION: Location permanently deleted by ${req.user.role} ${req.user.userId}`, {
        deletedLocation: locationInfo,
        deletedBy: req.user.userId,
        deletedAt: new Date().toISOString(),
        action: 'FORCE_DELETE_LOCATION'
      });

      res.status(200).json({
        success: true,
        message: 'Location permanently deleted',
        data: {
          deletedLocation: {
            id: locationInfo.id,
            address: locationInfo.address,
            city: locationInfo.city,
            province: locationInfo.province,
            country: locationInfo.country
          },
          warning: 'This action is irreversible'
        }
      });
    } catch (error) {
      if (error.message === 'Invalid location ID format') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      logger.error('Force delete location error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to permanently delete location'
      });
    }
  }

  // 8. LIST DELETED LOCATIONS
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

      // Query for soft deleted locations only
      const query = { deletedAt: { $ne: null } };
      const sortObj = {};
      sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const [locations, totalCount] = await Promise.all([
        Location.find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Location.countDocuments(query)
      ]);

      // Add delete info to each location
      const locationsWithDeleteInfo = locations.map(location => ({
        ...location,
        deleteInfo: {
          deletedAt: location.deletedAt,
          deletedBy: location.deletedBy,
          daysSinceDeleted: location.deletedAt ? Math.floor((Date.now() - new Date(location.deletedAt)) / (1000 * 60 * 60 * 24)) : null
        },
        restoreInfo: {
          restoredAt: location.restoredAt,
          restoredBy: location.restoredBy
        }
      }));

      const totalPages = Math.ceil(totalCount / limitNum);

      logger.info(`Retrieved ${locations.length} deleted locations`);

      res.status(200).json({
        success: true,
        data: {
          locations: locationsWithDeleteInfo,
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
      logger.error('Get deleted locations error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve deleted locations'
      });
    }
  }

  // 9. UPDATE LOCATION STATUS
  static async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Location ID is required'
        });
      }

      if (status === undefined) {
        return res.status(400).json({
          success: false,
          message: 'Status is required'
        });
      }

      LocationController.validateObjectId(id);

      // Find the location first
      const location = await Location.findById(id);

      if (!location) {
        return res.status(404).json({
          success: false,
          message: 'Location not found'
        });
      }

      // Check if location is deleted
      if (location.isDeleted()) {
        return res.status(409).json({
          success: false,
          message: 'Cannot update status of deleted location. Please restore it first.'
        });
      }

      // Update status
      location.status = status;
      location.updatedBy = req.user?.userId;
      const updatedLocation = await location.save();

      logger.info(`Updated location status: ${id} (${location.city}, ${location.province}) to ${status}`);

      res.status(200).json({
        success: true,
        message: 'Location status updated successfully',
        data: { location: updatedLocation }
      });
    } catch (error) {
      if (error.message === 'Invalid location ID format') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      logger.error('Update location status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update location status'
      });
    }
  }

  // 10. UPDATE LOCATION COORDINATES
  static async updateCoordinates(req, res) {
    try {
      const { id } = req.params;
      const { latitude, longitude } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Location ID is required'
        });
      }

      LocationController.validateObjectId(id);

      // Find the location first
      const location = await Location.findById(id);

      if (!location) {
        return res.status(404).json({
          success: false,
          message: 'Location not found'
        });
      }

      // Update coordinates using model method
      const updatedLocation = await location.updateCoordinates(latitude, longitude, req.user?.userId);

      logger.info(`Updated location coordinates: ${id} (${location.city}, ${location.province})`);

      res.status(200).json({
        success: true,
        message: 'Location coordinates updated successfully',
        data: { location: updatedLocation }
      });
    } catch (error) {
      if (error.message === 'Invalid location ID format') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      if (error.message.includes('Latitude') || error.message.includes('Longitude')) {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      logger.error('Update location coordinates error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update location coordinates'
      });
    }
  }

  // Additional utility methods

  // Get location statistics
  static async getStats(req, res) {
    try {
      const stats = await Promise.all([
        Location.countDocuments({}), // Total locations
        Location.countDocuments({ deletedAt: null }), // Active locations
        Location.countDocuments({ deletedAt: { $ne: null } }), // Deleted locations
        Location.countDocuments({ status: true, deletedAt: null }), // Active and enabled
        Location.countDocuments({ status: false, deletedAt: null }), // Active but disabled
        Location.countDocuments({ 'coordinates.latitude': { $exists: true }, deletedAt: null }), // With coordinates
        Location.aggregate([
          { $match: { deletedAt: null } },
          { $group: { _id: '$province', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 5 }
        ]),
        Location.aggregate([
          { $match: { deletedAt: null } },
          { $group: { _id: '$city', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 5 }
        ])
      ]);

      const [
        total, active, deleted, enabled, disabled, withCoordinates, topProvinces, topCities
      ] = stats;

      res.status(200).json({
        success: true,
        data: {
          total,
          active,
          deleted,
          enabled,
          disabled,
          withCoordinates,
          topProvinces,
          topCities,
          percentageActive: total > 0 ? Math.round((active / total) * 100) : 0,
          percentageEnabled: active > 0 ? Math.round((enabled / active) * 100) : 0,
          percentageWithCoordinates: active > 0 ? Math.round((withCoordinates / active) * 100) : 0
        }
      });
    } catch (error) {
      logger.error('Get location stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve location statistics'
      });
    }
  }

  // Get locations by city
  static async getLocationsByCity(req, res) {
    try {
      const { city } = req.params;
      const { page = 1, limit = 10, activeOnly = true } = req.query;

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      const query = { city: new RegExp(city, 'i') };
      if (activeOnly === 'true') {
        query.deletedAt = null;
        query.status = true;
      }

      const [locations, totalCount] = await Promise.all([
        Location.find(query)
          .sort({ address: 1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Location.countDocuments(query)
      ]);

      res.status(200).json({
        success: true,
        data: {
          locations,
          city: city,
          pagination: {
            currentPage: pageNum,
            totalPages: Math.ceil(totalCount / limitNum),
            totalCount,
            limit: limitNum
          }
        }
      });
    } catch (error) {
      logger.error('Get locations by city error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve locations by city'
      });
    }
  }

  // Get locations by province
  static async getLocationsByProvince(req, res) {
    try {
      const { province } = req.params;
      const { page = 1, limit = 10, activeOnly = true } = req.query;

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      const query = { province: new RegExp(province, 'i') };
      if (activeOnly === 'true') {
        query.deletedAt = null;
        query.status = true;
      }

      const [locations, totalCount] = await Promise.all([
        Location.find(query)
          .sort({ city: 1, address: 1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Location.countDocuments(query)
      ]);

      res.status(200).json({
        success: true,
        data: {
          locations,
          province: province,
          pagination: {
            currentPage: pageNum,
            totalPages: Math.ceil(totalCount / limitNum),
            totalCount,
            limit: limitNum
          }
        }
      });
    } catch (error) {
      logger.error('Get locations by province error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve locations by province'
      });
    }
  }

  // Get active locations
  static async getActiveLocations(req, res) {
    try {
      const { city, province, limit = 50 } = req.query;

      let query = {
        status: true,
        deletedAt: null
      };

      if (city) query.city = new RegExp(city, 'i');
      if (province) query.province = new RegExp(province, 'i');

      const locations = await Location.find(query)
        .sort({ city: 1, address: 1 })
        .limit(parseInt(limit))
        .lean();

      res.status(200).json({
        success: true,
        data: {
          locations,
          count: locations.length,
          filters: {
            city: city || null,
            province: province || null
          }
        }
      });
    } catch (error) {
      logger.error('Get active locations error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve active locations'
      });
    }
  }
}

module.exports = LocationController;