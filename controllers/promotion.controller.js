const mongoose = require('mongoose');
const Promotion = require('../models/promotion.model');
const logger = require('../utils/logger');

/**
 * PromotionController - CRUD operations for promotion management
 * Handles: getAll, getById, create, update, delete (hard), deleteBulk
 */
class PromotionController {
  // Helper: validate ObjectId
  static validateObjectId(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid promotion ID format');
    }
  }

  // Helper: build search query (by code/title)
  static buildSearchQuery(search) {
    if (!search) return {};

    return {
      $or: [
        { code: { $regex: search, $options: 'i' } },
        { title: { $regex: search, $options: 'i' } },
      ],
    };
  }

  // Helper: build filter query (status + date ranges)
  static buildFilterQuery(filters) {
    const query = {};

    if (filters.status) {
      query.status = filters.status;
    }

    // Filter by start_date range
    if (filters.startFrom || filters.startTo) {
      query.start_date = {};
      if (filters.startFrom) {
        query.start_date.$gte = new Date(filters.startFrom);
      }
      if (filters.startTo) {
        query.start_date.$lte = new Date(filters.startTo);
      }
    }

    // Filter by end_date range
    if (filters.endFrom || filters.endTo) {
      query.end_date = {};
      if (filters.endFrom) {
        query.end_date.$gte = new Date(filters.endFrom);
      }
      if (filters.endTo) {
        query.end_date.$lte = new Date(filters.endTo);
      }
    }

    // Active-only filter: status=Active and current date within range
    if (filters.activeOnly === 'true' || filters.activeOnly === true) {
      const now = new Date();
      query.status = 'Active';

      query.start_date = query.start_date || {};
      query.end_date = query.end_date || {};

      query.start_date.$lte = query.start_date.$lte || now;
      query.end_date.$gte = query.end_date.$gte || now;
    }

    return query;
  }

  // 1. LIST / GET ALL PROMOTIONS with pagination + filter + search
  static async getAll(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'start_date',
        sortOrder = 'desc',
        search,
        ...filters
      } = req.query;

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      let query = PromotionController.buildFilterQuery(filters);

      if (search) {
        query = { ...query, ...PromotionController.buildSearchQuery(search) };
      }

      const sortObj = {};
      sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const [promotions, totalCount] = await Promise.all([
        Promotion.find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Promotion.countDocuments(query),
      ]);

      const totalPages = Math.ceil(totalCount / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      logger.info(`Retrieved ${promotions.length} promotions`);

      res.status(200).json({
        success: true,
        data: {
          promotions,
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
      logger.error('Get all promotions error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve promotions',
      });
    }
  }

  // 2. GET ONE PROMOTION BY ID
  static async getById(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Promotion ID is required',
        });
      }

      PromotionController.validateObjectId(id);

      const promotion = await Promotion.findById(id).lean();

      if (!promotion) {
        return res.status(404).json({
          success: false,
          message: 'Promotion not found',
        });
      }

      res.status(200).json({
        success: true,
        data: { promotion },
      });
    } catch (error) {
      if (error.message === 'Invalid promotion ID format') {
        return res.status(400).json({ success: false, message: error.message });
      }

      logger.error('Get promotion by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve promotion',
      });
    }
  }

  // 3. CREATE PROMOTION
  static async create(req, res) {
    try {
      const promotionData = req.body;
      const { code, start_date, end_date } = promotionData;

      if (!code || !start_date || !end_date) {
        return res.status(400).json({
          success: false,
          message: 'code, start_date and end_date are required',
        });
      }

      // Normalize and trim code/title
      promotionData.code = promotionData.code.trim();
      if (promotionData.title) {
        promotionData.title = promotionData.title.trim();
      }

      // Normalize empty image_url to null so it behaves like Movie.poster_url
      if (promotionData.image_url === '' || promotionData.image_url === undefined) {
        promotionData.image_url = null;
      }

      // Check if promotion with same code already exists
      const existing = await Promotion.findOne({ code: promotionData.code });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'Promotion with this code already exists',
        });
      }

      const promotion = new Promotion(promotionData);
      await promotion.save();

      logger.info(`Created new promotion: ${promotion._id} (${promotion.code})`);

      res.status(201).json({
        success: true,
        message: 'Promotion created successfully',
        data: { promotion },
      });
    } catch (error) {
      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: Object.values(error.errors).map((err) => err.message),
        });
      }

      logger.error('Create promotion error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create promotion',
      });
    }
  }

  // 4. UPDATE PROMOTION
  static async update(req, res) {
    try {
      const { id } = req.params;
      const updateData = { ...req.body };

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Promotion ID is required',
        });
      }

      PromotionController.validateObjectId(id);

      // Prevent modifying immutable fields
      delete updateData._id;
      delete updateData.createdAt;
      delete updateData.updatedAt;

      // Normalize/trim code & title if present
      if (updateData.code) {
        updateData.code = updateData.code.trim();

        // Ensure code is unique when changing
        const existing = await Promotion.findOne({
          code: updateData.code,
          _id: { $ne: id },
        });

        if (existing) {
          return res.status(409).json({
            success: false,
            message: 'Another promotion with this code already exists',
          });
        }
      }

      if (updateData.title) {
        updateData.title = updateData.title.trim();
      }

      // Normalize image_url if explicitly cleared
      if (Object.prototype.hasOwnProperty.call(updateData, 'image_url')) {
        if (updateData.image_url === '' || updateData.image_url === undefined) {
          updateData.image_url = null;
        }
      }

      const promotion = await Promotion.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
        context: 'query',
      });

      if (!promotion) {
        return res.status(404).json({
          success: false,
          message: 'Promotion not found',
        });
      }

      logger.info(`Updated promotion: ${id} (${promotion.code})`);

      res.status(200).json({
        success: true,
        message: 'Promotion updated successfully',
        data: { promotion },
      });
    } catch (error) {
      if (error.message === 'Invalid promotion ID format') {
        return res.status(400).json({ success: false, message: error.message });
      }

      if (error.name === 'ValidationError') {
        return res.status(400).json({
          success: false,
          message: 'Validation error',
          errors: Object.values(error.errors).map((err) => err.message),
        });
      }

      logger.error('Update promotion error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update promotion',
      });
    }
  }

  // 5. DELETE PROMOTION (hard delete)
  static async delete(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Promotion ID is required',
        });
      }

      PromotionController.validateObjectId(id);

      const promotion = await Promotion.findByIdAndDelete(id);

      if (!promotion) {
        return res.status(404).json({
          success: false,
          message: 'Promotion not found',
        });
      }

      logger.info(`Deleted promotion: ${id} (${promotion.code})`);

      res.status(200).json({
        success: true,
        message: 'Promotion deleted successfully',
      });
    } catch (error) {
      if (error.message === 'Invalid promotion ID format') {
        return res.status(400).json({ success: false, message: error.message });
      }

      logger.error('Delete promotion error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete promotion',
      });
    }
  }

  // 6. BULK DELETE PROMOTIONS (hard delete)
  static async deleteBulk(req, res) {
    try {
      const { ids } = req.body;

      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'A non-empty array of promotion IDs is required',
        });
      }

      // Convert to ObjectIds (Joi already validated format)
      const objectIds = ids.map((id) => new mongoose.Types.ObjectId(id));

      const result = await Promotion.deleteMany({ _id: { $in: objectIds } });

      logger.warn('Bulk deleted promotions', {
        requestedCount: ids.length,
        deletedCount: result.deletedCount,
      });

      return res.status(200).json({
        success: true,
        message: `${result.deletedCount} promotion(s) deleted successfully`,
        data: {
          requestedCount: ids.length,
          deletedCount: result.deletedCount,
          ids,
        },
      });
    } catch (error) {
      logger.error('Bulk delete promotions error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to bulk delete promotions',
      });
    }
  }
}

module.exports = PromotionController;
