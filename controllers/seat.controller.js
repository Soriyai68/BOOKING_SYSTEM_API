const mongoose = require('mongoose');
const Seat = require('../models/seats.model');
const logger = require('../utils/logger');

/**
 * SeatController - Comprehensive CRUD operations without Redis
 * Handles: getById, getAll, Create, Delete, restore, force-delete, list-delete, search
 */
class SeatController {
  // Helper method to validate seat ID (UUID format)
  static validateSeatId(id) {
    // Check if it's a valid UUID format (36 characters with hyphens)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
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
        { seat_type: { $regex: search, $options: 'i' } }
      ]
    };
  }

  // Helper method to build filter query
  static buildFilterQuery(filters) {
    const query = {};
    
    // Handle seat type filter
    if (filters.seat_type && ['regular', 'vip', 'couple', 'king', 'queen'].includes(filters.seat_type)) {
      query.seat_type = filters.seat_type;
    }
    
    // Handle availability filter
    if (filters.is_available !== undefined) {
      query.is_available = filters.is_available === 'true' || filters.is_available === true;
    }
    
    // Handle row filter
    if (filters.row) {
      query.row = { $regex: filters.row, $options: 'i' };
    }
    
    // Handle seat number filter
    if (filters.seat_number) {
      query.seat_number = { $regex: filters.seat_number, $options: 'i' };
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

  // Helper method to validate seat data
  static validateSeatData(seatData) {
    const errors = [];
    
    if (!seatData.row || seatData.row.trim().length === 0) {
      errors.push('Row is required');
    }
    
    if (!seatData.seat_number || seatData.seat_number.trim().length === 0) {
      errors.push('Seat number is required');
    }
    
    if (seatData.seat_type && !['regular', 'vip', 'couple', 'king', 'queen'].includes(seatData.seat_type)) {
      errors.push('Invalid seat type. Must be one of: regular, vip, couple, king, queen');
    }
    
    return errors;
  }

  // 1. GET ALL SEATS - with pagination, filtering, and sorting
  static async getAll(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        search,
        includeUnavailable = true,
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
      
      // Handle availability filter
      if (includeUnavailable === 'false') {
        query.is_available = true;
      }

      // Build sort object
      const sortObj = {};
      if (sortBy === 'seat_identifier') {
        // Special handling for virtual field - sort by row then seat_number
        sortObj.row = sortOrder === 'desc' ? -1 : 1;
        sortObj.seat_number = sortOrder === 'desc' ? -1 : 1;
      } else {
        sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;
      }

      // Execute queries
      const [seats, totalCount] = await Promise.all([
        Seat.find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Seat.countDocuments(query)
      ]);

      // Add virtual seat_identifier to each seat
      const seatsWithIdentifier = seats.map(seat => ({
        ...seat,
        seat_identifier: `${seat.row}${seat.seat_number}`
      }));

      // Calculate pagination info
      const totalPages = Math.ceil(totalCount / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      logger.info(`Retrieved ${seats.length} seats`);

      res.status(200).json({
        success: true,
        data: {
          seats: seatsWithIdentifier,
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

      SeatController.validateSeatId(id);

      const seat = await Seat.findById(id).lean();

      if (!seat) {
        return res.status(404).json({
          success: false,
          message: 'Seat not found'
        });
      }

      // Add virtual seat_identifier
      const seatWithIdentifier = {
        ...seat,
        seat_identifier: `${seat.row}${seat.seat_number}`
      };

      logger.info(`Retrieved seat by ID: ${id}`);

      res.status(200).json({
        success: true,
        data: { seat: seatWithIdentifier }
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

      // Validate seat data
      const validationErrors = SeatController.validateSeatData(seatData);
      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: validationErrors
        });
      }

      // Check if seat already exists (row + seat_number combination)
      const existingSeat = await Seat.findOne({
        row: seatData.row.trim(),
        seat_number: seatData.seat_number.trim()
      });

      if (existingSeat) {
        return res.status(409).json({
          success: false,
          message: `Seat ${seatData.row}${seatData.seat_number} already exists`
        });
      }

      // Set default values
      const seatToCreate = {
        row: seatData.row.trim().toUpperCase(),
        seat_number: seatData.seat_number.trim(),
        seat_type: seatData.seat_type || 'regular',
        is_available: seatData.is_available !== undefined ? seatData.is_available : true
      };

      // Add creator info if available
      if (req.user) {
        seatToCreate.createdBy = req.user.userId;
      }

      const seat = new Seat(seatToCreate);
      await seat.save();

      // Add virtual seat_identifier to response
      const seatResponse = {
        ...seat.toObject(),
        seat_identifier: `${seat.row}${seat.seat_number}`
      };

      logger.info(`Created new seat: ${seat._id} (${seat.row}${seat.seat_number})`);

      res.status(201).json({
        success: true,
        message: 'Seat created successfully',
        data: { seat: seatResponse }
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
          message: 'Seat with this row and number combination already exists'
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

      SeatController.validateSeatId(id);

      // Remove sensitive fields that shouldn't be updated directly
      delete updateData._id;
      delete updateData.createdAt;
      delete updateData.updatedAt;

      // Add updater info if available
      if (req.user) {
        updateData.updatedBy = req.user.userId;
      }

      // Check for duplicate if row or seat_number is being updated
      if (updateData.row || updateData.seat_number) {
        const currentSeat = await Seat.findById(id);
        if (!currentSeat) {
          return res.status(404).json({
            success: false,
            message: 'Seat not found'
          });
        }

        const newRow = updateData.row ? updateData.row.trim().toUpperCase() : currentSeat.row;
        const newSeatNumber = updateData.seat_number ? updateData.seat_number.trim() : currentSeat.seat_number;

        const existingSeat = await Seat.findOne({
          row: newRow,
          seat_number: newSeatNumber,
          _id: { $ne: id }
        });

        if (existingSeat) {
          return res.status(409).json({
            success: false,
            message: `Seat ${newRow}${newSeatNumber} already exists`
          });
        }
      }

      // Format the data
      if (updateData.row) {
        updateData.row = updateData.row.trim().toUpperCase();
      }
      if (updateData.seat_number) {
        updateData.seat_number = updateData.seat_number.trim();
      }

      const seat = await Seat.findByIdAndUpdate(
        id,
        updateData,
        { 
          new: true, 
          runValidators: true,
          context: 'query'
        }
      ).lean();

      if (!seat) {
        return res.status(404).json({
          success: false,
          message: 'Seat not found'
        });
      }

      // Add virtual seat_identifier
      const seatWithIdentifier = {
        ...seat,
        seat_identifier: `${seat.row}${seat.seat_number}`
      };

      logger.info(`Updated seat: ${id}`);

      res.status(200).json({
        success: true,
        message: 'Seat updated successfully',
        data: { seat: seatWithIdentifier }
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

  // 5. SOFT DELETE SEAT (Mark as unavailable)
  static async delete(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Seat ID is required'
        });
      }

      SeatController.validateSeatId(id);

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
          message: 'Seat is already marked as unavailable'
        });
      }

      // Soft delete using model method
      const deletedSeat = await seat.softDelete(req.user?.userId);

      // Add virtual seat_identifier
      const seatWithIdentifier = {
        ...deletedSeat.toObject(),
        seat_identifier: `${deletedSeat.row}${deletedSeat.seat_number}`
      };

      logger.info(`Soft deleted seat: ${id} (${deletedSeat.row}${deletedSeat.seat_number})`);

      res.status(200).json({
        success: true,
        message: 'Seat marked as unavailable successfully',
        data: { seat: seatWithIdentifier }
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
        message: 'Failed to mark seat as unavailable'
      });
    }
  }

  // 6. RESTORE SEAT (Mark as available)
  static async restore(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Seat ID is required'
        });
      }

      SeatController.validateSeatId(id);

      // Find the seat first
      const seat = await Seat.findById(id);

      if (!seat) {
        return res.status(404).json({
          success: false,
          message: 'Seat not found'
        });
      }

      // Check if seat is not deleted (already available)
      if (!seat.isDeleted()) {
        return res.status(409).json({
          success: false,
          message: 'Seat is already available'
        });
      }

      // Restore using model method
      const restoredSeat = await seat.restore(req.user?.userId);

      // Add virtual seat_identifier
      const seatWithIdentifier = {
        ...restoredSeat.toObject(),
        seat_identifier: `${restoredSeat.row}${restoredSeat.seat_number}`
      };

      logger.info(`Restored seat: ${id} (${restoredSeat.row}${restoredSeat.seat_number})`);

      res.status(200).json({
        success: true,
        message: 'Seat restored successfully',
        data: { seat: seatWithIdentifier }
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

  // 7. FORCE DELETE SEAT (Permanent deletion)
  static async forceDelete(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Seat ID is required'
        });
      }

      SeatController.validateSeatId(id);

      const deletedSeat = await Seat.findByIdAndDelete(id);

      if (!deletedSeat) {
        return res.status(404).json({
          success: false,
          message: 'Seat not found'
        });
      }

      logger.info(`Force deleted seat: ${id} (${deletedSeat.row}${deletedSeat.seat_number})`);

      res.status(200).json({
        success: true,
        message: 'Seat permanently deleted'
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

  // 8. LIST DELETE - Delete multiple seats
  static async listDelete(req, res) {
    try {
      const { ids = [], permanent = false } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Array of seat IDs is required'
        });
      }

      // Validate all IDs
      for (const id of ids) {
        SeatController.validateSeatId(id);
      }

      let result;
      
      if (permanent === true) {
        result = await Seat.deleteMany({ _id: { $in: ids } });
        logger.info(`Force deleted ${result.deletedCount} seats`);
      } else {
        // Soft delete by marking as unavailable
        result = await Seat.updateMany(
          { _id: { $in: ids } },
          { 
            is_available: false,
            deletedAt: new Date(),
            deletedBy: req.user?.userId
          }
        );
        logger.info(`Soft deleted ${result.modifiedCount} seats`);
      }

      res.status(200).json({
        success: true,
        message: `${result.deletedCount || result.modifiedCount} seats ${permanent ? 'permanently deleted' : 'marked as unavailable'} successfully`,
        data: {
          processedCount: result.deletedCount || result.modifiedCount,
          requestedCount: ids.length
        }
      });
    } catch (error) {
      if (error.message === 'Invalid seat ID format') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      logger.error('List delete seats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete seats'
      });
    }
  }

  // 9. ADVANCED SEARCH
  static async search(req, res) {
    try {
      const {
        query: searchQuery,
        fields = [],
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc',
        exact = false,
        caseSensitive = false,
        dateFrom,
        dateTo,
        seat_type,
        is_available,
        row,
        seat_number
      } = req.body;

      if (!searchQuery) {
        return res.status(400).json({
          success: false,
          message: 'Search query is required'
        });
      }

      // Convert page and limit to numbers
      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      // Build search query
      let query = {};

      // Handle text search
      const searchFields = fields.length > 0 ? fields : ['row', 'seat_number', 'seat_type'];
      const searchOptions = caseSensitive ? '' : 'i';
      const searchPattern = exact ? `^${searchQuery}$` : searchQuery;

      query.$or = searchFields.map(field => ({
        [field]: { $regex: searchPattern, $options: searchOptions }
      }));

      // Handle filters
      if (seat_type) query.seat_type = seat_type;
      if (is_available !== undefined) query.is_available = is_available;
      if (row) query.row = { $regex: row, $options: 'i' };
      if (seat_number) query.seat_number = { $regex: seat_number, $options: 'i' };

      // Handle date range
      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
        if (dateTo) query.createdAt.$lte = new Date(dateTo);
      }

      // Build sort object
      const sortObj = {};
      if (sortBy === 'seat_identifier') {
        sortObj.row = sortOrder === 'desc' ? -1 : 1;
        sortObj.seat_number = sortOrder === 'desc' ? -1 : 1;
      } else {
        sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;
      }

      // Execute search
      const [seats, totalCount] = await Promise.all([
        Seat.find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Seat.countDocuments(query)
      ]);

      // Add virtual seat_identifier to each seat
      const seatsWithIdentifier = seats.map(seat => ({
        ...seat,
        seat_identifier: `${seat.row}${seat.seat_number}`
      }));

      // Calculate pagination
      const totalPages = Math.ceil(totalCount / limitNum);

      logger.info(`Search found ${seats.length} seats`);

      res.status(200).json({
        success: true,
        data: {
          seats: seatsWithIdentifier,
          search: {
            query: searchQuery,
            totalResults: totalCount,
            resultCount: seats.length
          },
          pagination: {
            currentPage: pageNum,
            totalPages,
            totalCount,
            limit: limitNum
          }
        }
      });
    } catch (error) {
      logger.error('Search seats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search seats'
      });
    }
  }

  // Additional utility methods
  
  // Get deleted seats (soft deleted)
  static async getDeleted(req, res) {
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

      // Add virtual seat_identifier to each seat
      const seatsWithIdentifier = seats.map(seat => ({
        ...seat,
        seat_identifier: `${seat.row}${seat.seat_number}`,
        deleteInfo: {
          deletedAt: seat.deletedAt,
          deletedBy: seat.deletedBy,
          daysSinceDeleted: seat.deletedAt ? Math.floor((Date.now() - new Date(seat.deletedAt)) / (1000 * 60 * 60 * 24)) : null
        }
      }));

      const totalPages = Math.ceil(totalCount / limitNum);

      logger.info(`Retrieved ${seats.length} deleted seats`);

      res.status(200).json({
        success: true,
        data: {
          seats: seatsWithIdentifier,
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

  // Get unavailable seats (both deleted and just unavailable)
  static async getUnavailable(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      const query = { is_available: false };
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

      // Add virtual seat_identifier and availability info to each seat
      const seatsWithIdentifier = seats.map(seat => ({
        ...seat,
        seat_identifier: `${seat.row}${seat.seat_number}`,
        isDeleted: seat.deletedAt !== null,
        unavailableInfo: {
          reason: seat.deletedAt ? 'soft_deleted' : 'manually_unavailable',
          deletedAt: seat.deletedAt,
          deletedBy: seat.deletedBy
        }
      }));

      res.status(200).json({
        success: true,
        data: {
          seats: seatsWithIdentifier,
          pagination: {
            currentPage: pageNum,
            totalPages: Math.ceil(totalCount / limitNum),
            totalCount,
            limit: limitNum
          }
        }
      });
    } catch (error) {
      logger.error('Get unavailable seats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve unavailable seats'
      });
    }
  }

  // Get available seats
  static async getAvailable(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        seat_type,
        row,
        sortBy = 'row',
        sortOrder = 'asc'
      } = req.query;

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      const query = { is_available: true };
      
      // Add filters
      if (seat_type) query.seat_type = seat_type;
      if (row) query.row = { $regex: row, $options: 'i' };

      const sortObj = {};
      if (sortBy === 'seat_identifier') {
        sortObj.row = sortOrder === 'desc' ? -1 : 1;
        sortObj.seat_number = sortOrder === 'desc' ? -1 : 1;
      } else {
        sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;
      }

      const [seats, totalCount] = await Promise.all([
        Seat.find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Seat.countDocuments(query)
      ]);

      // Add virtual seat_identifier to each seat
      const seatsWithIdentifier = seats.map(seat => ({
        ...seat,
        seat_identifier: `${seat.row}${seat.seat_number}`
      }));

      res.status(200).json({
        success: true,
        data: {
          seats: seatsWithIdentifier,
          pagination: {
            currentPage: pageNum,
            totalPages: Math.ceil(totalCount / limitNum),
            totalCount,
            limit: limitNum
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

  // Get seat statistics
  static async getStats(req, res) {
    try {
      const stats = await Promise.all([
        Seat.countDocuments({}), // Total seats
        Seat.countDocuments({ is_available: true }), // Available seats
        Seat.countDocuments({ is_available: false }), // Unavailable seats
        Seat.countDocuments({ seat_type: 'regular' }), // Regular seats
        Seat.countDocuments({ seat_type: 'vip' }), // VIP seats
        Seat.countDocuments({ seat_type: 'couple' }), // Couple seats
        Seat.countDocuments({ seat_type: 'king' }), // King seats
        Seat.countDocuments({ seat_type: 'queen' }), // Queen seats
        Seat.aggregate([
          {
            $group: {
              _id: '$row',
              count: { $sum: 1 },
              available: { $sum: { $cond: ['$is_available', 1, 0] } }
            }
          },
          { $sort: { _id: 1 } }
        ])
      ]);

      const [total, available, unavailable, regular, vip, couple, king, queen, rowStats] = stats;

      res.status(200).json({
        success: true,
        data: {
          total,
          available,
          unavailable,
          seatTypes: {
            regular,
            vip,
            couple,
            king,
            queen
          },
          rowStats,
          availabilityPercentage: total > 0 ? Math.round((available / total) * 100) : 0
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

  // Toggle seat availability
  static async toggleAvailability(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Seat ID is required'
        });
      }

      SeatController.validateSeatId(id);

      const seat = await Seat.findById(id);
      if (!seat) {
        return res.status(404).json({
          success: false,
          message: 'Seat not found'
        });
      }

      // Toggle availability
      seat.is_available = !seat.is_available;
      if (req.user) {
        seat.updatedBy = req.user.userId;
      }
      await seat.save();

      // Add virtual seat_identifier
      const seatWithIdentifier = {
        ...seat.toObject(),
        seat_identifier: `${seat.row}${seat.seat_number}`
      };

      logger.info(`Toggled availability for seat: ${id} - Now ${seat.is_available ? 'available' : 'unavailable'}`);

      res.status(200).json({
        success: true,
        message: `Seat is now ${seat.is_available ? 'available' : 'unavailable'}`,
        data: { seat: seatWithIdentifier }
      });
    } catch (error) {
      if (error.message === 'Invalid seat ID format') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      logger.error('Toggle seat availability error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to toggle seat availability'
      });
    }
  }

  // Get seats by type
  static async getSeatsByType(req, res) {
    try {
      const { type } = req.params;
      const { page = 1, limit = 10, is_available } = req.query;

      if (!['regular', 'vip', 'couple', 'king', 'queen'].includes(type)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid seat type. Must be one of: regular, vip, couple, king, queen'
        });
      }

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      const query = { seat_type: type };
      if (is_available !== undefined) {
        query.is_available = is_available === 'true';
      }

      const [seats, totalCount] = await Promise.all([
        Seat.find(query)
          .sort({ row: 1, seat_number: 1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Seat.countDocuments(query)
      ]);

      // Add virtual seat_identifier to each seat
      const seatsWithIdentifier = seats.map(seat => ({
        ...seat,
        seat_identifier: `${seat.row}${seat.seat_number}`
      }));

      res.status(200).json({
        success: true,
        data: {
          seats: seatsWithIdentifier,
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

  // Get seats by row
  static async getSeatsByRow(req, res) {
    try {
      const { row } = req.params;
      const { is_available, seat_type } = req.query;

      if (!row) {
        return res.status(400).json({
          success: false,
          message: 'Row is required'
        });
      }

      const query = { row: row.toUpperCase() };
      if (is_available !== undefined) {
        query.is_available = is_available === 'true';
      }
      if (seat_type) {
        query.seat_type = seat_type;
      }

      const seats = await Seat.find(query)
        .sort({ seat_number: 1 })
        .lean();

      // Add virtual seat_identifier to each seat
      const seatsWithIdentifier = seats.map(seat => ({
        ...seat,
        seat_identifier: `${seat.row}${seat.seat_number}`
      }));

      res.status(200).json({
        success: true,
        data: {
          seats: seatsWithIdentifier,
          row: row.toUpperCase(),
          totalSeats: seats.length,
          availableSeats: seats.filter(seat => seat.is_available).length
        }
      });
    } catch (error) {
      logger.error('Get seats by row error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve seats by row'
      });
    }
  }

  // Create bulk seats
  static async createBulk(req, res) {
    try {
      const { seats } = req.body;

      if (!Array.isArray(seats) || seats.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Seats array is required'
        });
      }

      const createdSeats = [];
      const errors = [];

      for (let i = 0; i < seats.length; i++) {
        try {
          const seatData = seats[i];
          
          // Set default values and format
          const seatToCreate = {
            row: seatData.row.trim().toUpperCase(),
            seat_number: seatData.seat_number.trim(),
            seat_type: seatData.seat_type || 'regular',
            is_available: seatData.is_available !== undefined ? seatData.is_available : true
          };

          if (req.user) {
            seatToCreate.createdBy = req.user.userId;
          }

          const seat = new Seat(seatToCreate);
          await seat.save();
          
          createdSeats.push({
            ...seat.toObject(),
            seat_identifier: `${seat.row}${seat.seat_number}`
          });
        } catch (error) {
          errors.push({
            index: i,
            seat: seats[i],
            error: error.message
          });
        }
      }

      logger.info(`Bulk created ${createdSeats.length} seats with ${errors.length} errors`);

      res.status(201).json({
        success: true,
        message: `Successfully created ${createdSeats.length} seats`,
        data: {
          createdSeats,
          errors,
          totalRequested: seats.length,
          totalCreated: createdSeats.length,
          totalErrors: errors.length
        }
      });
    } catch (error) {
      logger.error('Bulk create seats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create seats in bulk'
      });
    }
  }
}

module.exports = SeatController;