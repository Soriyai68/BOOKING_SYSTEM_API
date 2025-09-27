const mongoose = require('mongoose');
const User = require('../models/user.model');
const { Role } = require('../data');
const Providers = require('../data/providers');
const logger = require('../utils/logger');

/**
 * UserController - Comprehensive CRUD operations without Redis
 * Handles: getById, getAll, Create, Delete, restore, force-delete, list-delete, search
 */
class UserController {
  // Helper method to validate ObjectId
  static validateObjectId(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid user ID format');
    }
  }

  // Helper method to build search query
  static buildSearchQuery(search) {
    if (!search) return {};

    return {
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ]
    };
  }

  // Helper method to build filter query
  static buildFilterQuery(filters) {
    const query = {};

    // Handle role filter
    if (filters.role && Object.values(Role).includes(filters.role)) {
      query.role = filters.role;
    }

    // Handle provider filter
    if (filters.provider && Object.values(Providers).includes(filters.provider)) {
      query.provider = filters.provider;
    }

    // Handle status filter
    if (filters.status !== undefined) {
      query.isActive = filters.status === 'true' || filters.status === true;
    }

    // Handle verification status filter
    if (filters.isVerified !== undefined) {
      query.isVerified = filters.isVerified === 'true' || filters.isVerified === true;
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

  // 1. GET ALL USERS - with pagination, filtering, and sorting
  static async getAll(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = 'desc',
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
        query = { ...query, ...UserController.buildSearchQuery(search) };
      }

      // Handle filters
      query = { ...query, ...UserController.buildFilterQuery(filters) };

      // Handle soft deleted records
      if (!includeDeleted || includeDeleted === 'false') {
        query.deletedAt = null; // Only get non-deleted users
      }

      // Build sort object
      const sortObj = {};
      sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Execute queries
      const [users, totalCount] = await Promise.all([
        User.find(query)
          .select('-password') // Never return passwords
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        User.countDocuments(query)
      ]);

      // Calculate pagination info
      const totalPages = Math.ceil(totalCount / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      logger.info(`Retrieved ${users.length} users`);

      res.status(200).json({
        success: true,
        data: {
          users,
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
      logger.error('Get all users error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve users'
      });
    }
  }

  // 2. GET USER BY ID
  static async getById(req, res) {
    try {
      const { id } = req.params;
      const { includePassword = false } = req.query;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      UserController.validateObjectId(id);

      let selectFields = '-password';
      if (includePassword === 'true' && req.user?.role === Role.SUPERADMIN) {
        selectFields = '+password';
      }

      const user = await User.findById(id).select(selectFields).lean();

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      logger.info(`Retrieved user by ID: ${id}`);

      res.status(200).json({
        success: true,
        data: { user }
      });
    } catch (error) {
      if (error.message === 'Invalid user ID format') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      logger.error('Get user by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve user'
      });
    }
  }

  // 3. CREATE USER
  static async create(req, res) {
    try {
      const userData = req.body;

      // Validate required fields
      if (!userData.phone || !userData.name) {
        return res.status(400).json({
          success: false,
          message: 'Phone and name are required'
        });
      }

      // Validate phone format
      const phoneRegex = /^\+?[1-9]\d{1,14}$/;
      if (!phoneRegex.test(userData.phone)) {
        return res.status(400).json({
          success: false,
          message: 'Please enter a valid phone number'
        });
      }

      // Check if user already exists
      const existingUser = await User.findOne({ phone: userData.phone });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: 'User with this phone number already exists'
        });
      }

      // Set default values
      const userToCreate = {
        ...userData,
        role: userData.role || Role.USER,
        provider: userData.provider || Providers.PHONE,
        isVerified: userData.isVerified || false,
        isActive: userData.isActive !== undefined ? userData.isActive : true
      };

      // Add creator info if available
      if (req.user) {
        userToCreate.createdBy = req.user.userId;
      }

      const user = new User(userToCreate);
      await user.save();

      // Remove password from response
      const userResponse = user.toObject();
      delete userResponse.password;

      logger.info(`Created new user: ${user._id}`);

      res.status(201).json({
        success: true,
        message: 'User created successfully',
        data: { user: userResponse }
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
          message: 'User with this phone number already exists'
        });
      }

      logger.error('Create user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create user'
      });
    }
  }

  // 4. UPDATE USER
  static async update(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      UserController.validateObjectId(id);

      // Remove sensitive fields that shouldn't be updated directly
      delete updateData._id;
      delete updateData.createdAt;
      delete updateData.updatedAt;

      // Add updater info if available
      if (req.user) {
        updateData.updatedBy = req.user.userId;
      }

      // Validate phone if being updated
      if (updateData.phone) {
        const phoneRegex = /^\+?[1-9]\d{1,14}$/;
        if (!phoneRegex.test(updateData.phone)) {
          return res.status(400).json({
            success: false,
            message: 'Please enter a valid phone number'
          });
        }

        // Check if phone is already taken by another user
        const existingUser = await User.findOne({
          phone: updateData.phone,
          _id: { $ne: id }
        });
        if (existingUser) {
          return res.status(409).json({
            success: false,
            message: 'Phone number is already in use'
          });
        }
      }

      const user = await User.findByIdAndUpdate(
        id,
        updateData,
        {
          new: true,
          runValidators: true,
          context: 'query'
        }
      ).select('-password');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      logger.info(`Updated user: ${id}`);

      res.status(200).json({
        success: true,
        message: 'User updated successfully',
        data: { user }
      });
    } catch (error) {
      if (error.message === 'Invalid user ID format') {
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

      logger.error('Update user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update user'
      });
    }
  }

  // 5. SOFT DELETE USER (Deactivate)
  static async delete(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      UserController.validateObjectId(id);

      // Find the user first
      const user = await User.findById(id).select('-password');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check if user is already soft deleted
      if (user.isDeleted()) {
        return res.status(409).json({
          success: false,
          message: 'User is already deactivated'
        });
      }

      // Prevent self-deletion
      if (id === req.user?.userId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot delete your own account'
        });
      }

      // Additional protection for admin users
      if (user.role === Role.SUPERADMIN && req.user?.role !== Role.SUPERADMIN) {
        return res.status(403).json({
          success: false,
          message: 'Only SuperAdmin can delete other SuperAdmin accounts'
        });
      }

      // Soft delete using model method
      const deletedUser = await user.softDelete(req.user?.userId);

      logger.info(`Soft deleted user: ${id} (${deletedUser.phone})`);

      res.status(200).json({
        success: true,
        message: 'User deactivated successfully',
        data: {
          user: {
            ...deletedUser.toObject(),
            password: undefined // Ensure password is not returned
          }
        }
      });
    } catch (error) {
      if (error.message === 'Invalid user ID format') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      logger.error('Delete user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to deactivate user'
      });
    }
  }

  // 6. RESTORE USER (Reactivate)
  static async restore(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      UserController.validateObjectId(id);

      // Find the user first
      const user = await User.findById(id).select('-password');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Check if user is not deleted (already active)
      if (!user.isDeleted()) {
        return res.status(409).json({
          success: false,
          message: 'User is already active'
        });
      }

      // Restore using model method
      const restoredUser = await user.restore(req.user?.userId);

      logger.info(`Restored user: ${id} (${restoredUser.phone})`);

      res.status(200).json({
        success: true,
        message: 'User restored successfully',
        data: {
          user: {
            ...restoredUser.toObject(),
            password: undefined // Ensure password is not returned
          }
        }
      });
    } catch (error) {
      if (error.message === 'Invalid user ID format') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      logger.error('Restore user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to restore user'
      });
    }
  }

  // 7. FORCE DELETE USER (Permanent deletion - SuperAdmin only)
  static async forceDelete(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'User ID is required'
        });
      }

      // Enforce SuperAdmin-only access
      if (req.user?.role !== Role.SUPERADMIN) {
        return res.status(403).json({
          success: false,
          message: 'Only SuperAdmin can permanently delete users'
        });
      }

      UserController.validateObjectId(id);

      // Find the user first
      const user = await User.findById(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Prevent self-deletion
      if (id === req.user?.userId) {
        return res.status(403).json({
          success: false,
          message: 'Cannot permanently delete your own account'
        });
      }

      // Extra protection: Cannot permanently delete any admin/superadmin users
      if (user.role === Role.ADMIN || user.role === Role.SUPERADMIN) {
        return res.status(403).json({
          success: false,
          message: 'Cannot permanently delete admin or superadmin users. This is a safety restriction.'
        });
      }

      // Store user info for logging before deletion
      const userInfo = {
        id: user._id,
        phone: user.phone,
        name: user.name,
        role: user.role,
        wasDeleted: user.isDeleted()
      };

      // Perform permanent deletion
      const deletedUser = await User.findByIdAndDelete(id);

      logger.warn(`⚠️  PERMANENT DELETION: User permanently deleted by SuperAdmin ${req.user.userId}`, {
        deletedUser: userInfo,
        deletedBy: req.user.userId,
        deletedAt: new Date().toISOString(),
        action: 'FORCE_DELETE_USER'
      });

      res.status(200).json({
        success: true,
        message: 'User permanently deleted',
        data: {
          deletedUser: {
            id: userInfo.id,
            phone: userInfo.phone,
            name: userInfo.name,
            role: userInfo.role
          },
          warning: 'This action is irreversible'
        }
      });
    } catch (error) {
      if (error.message === 'Invalid user ID format') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      logger.error('Force delete user error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to permanently delete user'
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
        role,
        provider,
        isActive,
        isVerified
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
      const searchFields = fields.length > 0 ? fields : ['name', 'phone'];
      const searchOptions = caseSensitive ? '' : 'i';
      const searchPattern = exact ? `^${searchQuery}$` : searchQuery;

      query.$or = searchFields.map(field => ({
        [field]: { $regex: searchPattern, $options: searchOptions }
      }));

      // Handle filters
      if (role) query.role = role;
      if (provider) query.provider = provider;
      if (isActive !== undefined) query.isActive = isActive;
      if (isVerified !== undefined) query.isVerified = isVerified;

      // Handle date range
      if (dateFrom || dateTo) {
        query.createdAt = {};
        if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
        if (dateTo) query.createdAt.$lte = new Date(dateTo);
      }

      // Build sort object
      const sortObj = {};
      sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Execute search
      const [users, totalCount] = await Promise.all([
        User.find(query)
          .select('-password')
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        User.countDocuments(query)
      ]);

      // Calculate pagination
      const totalPages = Math.ceil(totalCount / limitNum);

      logger.info(`Search found ${users.length} users`);

      res.status(200).json({
        success: true,
        data: {
          users,
          search: {
            query: searchQuery,
            totalResults: totalCount,
            resultCount: users.length
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
      logger.error('Search users error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to search users'
      });
    }
  }

  // Additional utility methods

  // Get soft deleted users
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

      // Query for soft deleted users only
      const query = { deletedAt: { $ne: null } };
      const sortObj = {};
      sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const [users, totalCount] = await Promise.all([
        User.find(query)
          .select('-password')
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum)
          .lean(),
        User.countDocuments(query)
      ]);

      // Add delete info to each user
      const usersWithDeleteInfo = users.map(user => ({
        ...user,
        deleteInfo: {
          deletedAt: user.deletedAt,
          deletedBy: user.deletedBy,
          daysSinceDeleted: user.deletedAt ? Math.floor((Date.now() - new Date(user.deletedAt)) / (1000 * 60 * 60 * 24)) : null
        },
        restoreInfo: {
          restoredAt: user.restoredAt,
          restoredBy: user.restoredBy
        }
      }));

      const totalPages = Math.ceil(totalCount / limitNum);

      logger.info(`Retrieved ${users.length} deleted users`);

      res.status(200).json({
        success: true,
        data: {
          users: usersWithDeleteInfo,
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
      logger.error('Get deleted users error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve deleted users'
      });
    }
  }

  // Get user statistics
  static async getStats(req, res) {
    try {
      const stats = await Promise.all([
        User.countDocuments({}), // Total users
        User.countDocuments({ isActive: true }), // Active users
        User.countDocuments({ isActive: false }), // Inactive users
        User.countDocuments({ role: Role.USER }), // Regular users
        User.countDocuments({ role: Role.ADMIN }), // Admin users
        User.countDocuments({ role: Role.SUPERADMIN }), // Super admin users
        User.countDocuments({ isVerified: true }), // Verified users
        User.countDocuments({ provider: Providers.PHONE }), // Phone users
        User.aggregate([
          {
            $group: {
              _id: null,
              avgCreatedThisMonth: {
                $sum: {
                  $cond: [
                    {
                      $gte: [
                        '$createdAt',
                        new Date(new Date().getFullYear(), new Date().getMonth(), 1)
                      ]
                    },
                    1,
                    0
                  ]
                }
              }
            }
          }
        ])
      ]);

      const [total, active, inactive, users, admins, superAdmins, verified, phoneUsers, monthlyStats] = stats;

      res.status(200).json({
        success: true,
        data: {
          total,
          active,
          inactive,
          users,
          admins,
          superAdmins,
          verified,
          phoneUsers,
          createdThisMonth: monthlyStats[0]?.avgCreatedThisMonth || 0,
          percentageActive: total > 0 ? Math.round((active / total) * 100) : 0,
          percentageVerified: total > 0 ? Math.round((verified / total) * 100) : 0
        }
      });
    } catch (error) {
      logger.error('Get user stats error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve user statistics'
      });
    }
  }

  // Get users by role
  static async getUsersByRole(req, res) {
    try {
      const { role } = req.params;
      const { page = 1, limit = 10 } = req.query;

      if (!Object.values(Role).includes(role)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role specified'
        });
      }

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      const query = { role, isActive: true };

      const [users, totalCount] = await Promise.all([
        User.find(query)
          .select('-password')
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        User.countDocuments(query)
      ]);

      res.status(200).json({
        success: true,
        data: {
          users,
          role,
          pagination: {
            currentPage: pageNum,
            totalPages: Math.ceil(totalCount / limitNum),
            totalCount,
            limit: limitNum
          }
        }
      });
    } catch (error) {
      logger.error('Get users by role error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve users by role'
      });
    }
  }

  // Get user by phone
  static async getUserByPhone(req, res) {
    try {
      const { phone } = req.params;

      if (!phone) {
        return res.status(400).json({
          success: false,
          message: 'Phone number is required'
        });
      }

      const user = await User.findOne({ phone }).select('-password').lean();

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.status(200).json({
        success: true,
        data: { user }
      });
    } catch (error) {
      logger.error('Get user by phone error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve user'
      });
    }
  }

  // Update last login
  static async updateLastLogin(req, res) {
    try {
      const { id } = req.params;

      UserController.validateObjectId(id);

      const user = await User.findByIdAndUpdate(
        id,
        { lastLogin: new Date() },
        { new: true }
      ).select('-password');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Last login updated successfully',
        data: { user }
      });
    } catch (error) {
      logger.error('Update last login error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update last login'
      });
    }
  }
}

module.exports = UserController;