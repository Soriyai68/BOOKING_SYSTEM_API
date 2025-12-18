const mongoose = require('mongoose');
const Movie = require('../models/movie.model');
const Showtime = require('../models/showtime.model'); // Import Showtime model
const { Role } = require('../data');
const logger = require('../utils/logger');

/**
 * MovieController - Comprehensive CRUD operations for movie management
 * Handles: getById, getAll, create, update, delete (soft), restore, forceDelete, 
 * listDeleted, updateStatus, getNowShowing, getComingSoon, getByGenre
 */
class MovieController {
  // Helper method to validate ObjectId
  static validateObjectId(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid movie ID format');
    }
  }

  // Helper method to build search query
  static buildSearchQuery(search) {
    if (!search) return {};

    return {
      $or: [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { director: { $regex: search, $options: 'i' } }
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

    // Handle genre filter
    if (filters.genre) {
      query.genres = filters.genre;
    }

    // Handle language filter
    if (filters.language) {
      query.languages = filters.language;
    }

    // Handle rating range filters
    if (filters.minRating !== undefined || filters.maxRating !== undefined) {
      query.rating = {};
      if (filters.minRating !== undefined) {
        query.rating.$gte = parseFloat(filters.minRating);
      }
      if (filters.maxRating !== undefined) {
        query.rating.$lte = parseFloat(filters.maxRating);
      }
    }

    // Handle duration range filters
    if (filters.minDuration !== undefined || filters.maxDuration !== undefined) {
      query.duration_minutes = {};
      if (filters.minDuration !== undefined) {
        query.duration_minutes.$gte = parseInt(filters.minDuration);
      }
      if (filters.maxDuration !== undefined) {
        query.duration_minutes.$lte = parseInt(filters.maxDuration);
      }
    }

    // Handle date range filters
    if (filters.dateFrom || filters.dateTo) {
      query.release_date = {};
      if (filters.dateFrom) {
        query.release_date.$gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        query.release_date.$lte = new Date(filters.dateTo);
      }
    }

    return query;
  }

  // 1. GET ALL MOVIES - with pagination, filtering, and sorting
  static async getAll(req, res) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'release_date',
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
        query = { ...query, ...MovieController.buildSearchQuery(search) };
      }

      // Handle filters
      query = { ...query, ...MovieController.buildFilterQuery(filters) };

      // Handle soft deleted records
      if (!includeDeleted || includeDeleted === 'false') {
        query.deletedAt = null;
      }

      // Build sort object
      const sortObj = {};
      sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

      // Execute queries
      const [movies, totalCount] = await Promise.all([
        Movie.find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum),
        Movie.countDocuments(query)
      ]);

      // Calculate pagination info
      const totalPages = Math.ceil(totalCount / limitNum);
      const hasNextPage = pageNum < totalPages;
      const hasPrevPage = pageNum > 1;

      logger.info(`Retrieved ${movies.length} movies`);

      res.status(200).json({
        success: true,
        data: {
          movies,
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
      logger.error('Get all movies error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve movies'
      });
    }
  }

  // 2. GET MOVIE BY ID
  static async getById(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Movie ID is required'
        });
      }

      MovieController.validateObjectId(id);

      const movie = await Movie.findById(id);

      if (!movie) {
        return res.status(404).json({
          success: false,
          message: 'Movie not found'
        });
      }

      logger.info(`Retrieved movie by ID: ${id}`);

      res.status(200).json({
        success: true,
        data: { movie }
      });
    } catch (error) {
      if (error.message === 'Invalid movie ID format') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      logger.error('Get movie by ID error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve movie'
      });
    }
  }

  // 3. CREATE MOVIE
  static async create(req, res) {
    try {
      const movieData = req.body;

      // Validate required fields
      if (!movieData.title || !movieData.duration_minutes || !movieData.release_date || !movieData.end_date) {
        return res.status(400).json({
          success: false,
          message: 'Title, duration, release date and end date are required'
        });
      }

      const releaseDate = new Date(movieData.release_date);
      const endDate = new Date(movieData.end_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
  
      if (releaseDate < today || endDate < today) {
        return res.status(400).json({
          success: false,
          message: 'Release date and end date cannot be in the past.'
        });
      }
  
      if (endDate <= releaseDate) {
        return res.status(400).json({
          success: false,
          message: 'End date must be after the release date.'
        });
      }

      // Check if movie already exists
      const existingMovie = await Movie.findOne({ 
        title: movieData.title.trim(),
        release_date: new Date(movieData.release_date)
      });

      if (existingMovie) {
        return res.status(409).json({
          success: false,
          message: 'Movie with this title and release date already exists'
        });
      }

      // Add creator info if available
      if (req.user) {
        movieData.createdBy = req.user.userId;
      }

      const movie = new Movie(movieData);
      await movie.save();

      logger.info(`Created new movie: ${movie._id} (${movie.title})`);

      res.status(201).json({
        success: true,
        message: 'Movie created successfully',
        data: { movie }
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
          message: 'Movie with this title already exists'
        });
      }

      logger.error('Create movie error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create movie'
      });
    }
  }

  // 4. UPDATE MOVIE
  static async update(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Movie ID is required'
        });
      }

      MovieController.validateObjectId(id);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
  
      if (updateData.release_date) {
        const newReleaseDate = new Date(updateData.release_date);
        if (newReleaseDate < today) {
          return res.status(400).json({ success: false, message: 'Release date cannot be set to a past date.' });
        }
      }
  
      if (updateData.end_date) {
        const newEndDate = new Date(updateData.end_date);
        if (newEndDate < today) {
          return res.status(400).json({ success: false, message: 'End date cannot be set to a past date.' });
        }
      }
  
      if (updateData.release_date || updateData.end_date) {
        const movieToUpdate = await Movie.findById(id);
        if (!movieToUpdate) {
          return res.status(404).json({ success: false, message: 'Movie not found' });
        }
        const releaseDate = updateData.release_date ? new Date(updateData.release_date) : movieToUpdate.release_date;
        const endDate = updateData.end_date ? new Date(updateData.end_date) : movieToUpdate.end_date;
  
        if (endDate <= releaseDate) {
          return res.status(400).json({ success: false, message: 'End date must be after the release date.' });
        }
      }

      // Remove sensitive fields
      delete updateData._id;
      delete updateData.createdAt;
      delete updateData.updatedAt;
      delete updateData.deletedAt;
      delete updateData.deletedBy;

      // Add updater info if available
      if (req.user) {
        updateData.updatedBy = req.user.userId;
      }

      const movie = await Movie.findByIdAndUpdate(
        id,
        updateData,
        {
          new: true,
          runValidators: true,
          context: 'query'
        }
      );

      if (!movie) {
        return res.status(404).json({
          success: false,
          message: 'Movie not found'
        });
      }

      logger.info(`Updated movie: ${id} (${movie.title})`);

      res.status(200).json({
        success: true,
        message: 'Movie updated successfully',
        data: { movie }
      });
    } catch (error) {
      if (error.message === 'Invalid movie ID format') {
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

      logger.error('Update movie error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update movie'
      });
    }
  }

  // 5. SOFT DELETE MOVIE
  static async delete(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Movie ID is required'
        });
      }

      MovieController.validateObjectId(id);

      const movie = await Movie.findById(id);

      if (!movie) {
        return res.status(404).json({
          success: false,
          message: 'Movie not found'
        });
      }

      if (movie.isDeleted()) {
        return res.status(409).json({
          success: false,
          message: 'Movie is already deleted'
        });
      }

      // Check if movie has associated showtimes
      const associatedShowtimes = await Showtime.countDocuments({
        movie_id: id,
        deletedAt: null, // Only count active showtimes
      });

      if (associatedShowtimes > 0) {
        return res.status(409).json({
          success: false,
          message: `Cannot delete movie. It has ${associatedShowtimes} associated active showtime(s). Please delete or reassign the showtimes first.`,
          data: {
            associatedShowtimesCount: associatedShowtimes,
          },
        });
      }

      const deletedMovie = await movie.softDelete(req.user?.userId);

      logger.info(`Soft deleted movie: ${id} (${deletedMovie.title})`);

      res.status(200).json({
        success: true,
        message: 'Movie deleted successfully',
        data: { movie: deletedMovie }
      });
    } catch (error) {
      if (error.message === 'Invalid movie ID format') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      logger.error('Delete movie error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to delete movie'
      });
    }
  }

  // 6. RESTORE MOVIE
  static async restore(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Movie ID is required'
        });
      }

      MovieController.validateObjectId(id);

      const movie = await Movie.findById(id);

      if (!movie) {
        return res.status(404).json({
          success: false,
          message: 'Movie not found'
        });
      }

      if (!movie.isDeleted()) {
        return res.status(409).json({
          success: false,
          message: 'Movie is not deleted'
        });
      }

      const restoredMovie = await movie.restore(req.user?.userId);

      logger.info(`Restored movie: ${id} (${restoredMovie.title})`);

      res.status(200).json({
        success: true,
        message: 'Movie restored successfully',
        data: { movie: restoredMovie }
      });
    } catch (error) {
      if (error.message === 'Invalid movie ID format') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      logger.error('Restore movie error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to restore movie'
      });
    }
  }

  // 7. FORCE DELETE MOVIE (Permanent deletion - Admin/SuperAdmin only)
  static async forceDelete(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Movie ID is required'
        });
      }

      // Enforce Admin/SuperAdmin access
      if (req.user?.role !== Role.ADMIN && req.user?.role !== Role.SUPERADMIN) {
        return res.status(403).json({
          success: false,
          message: 'Only Admin or SuperAdmin can permanently delete movies'
        });
      }

      MovieController.validateObjectId(id);

      const movie = await Movie.findById(id);

      if (!movie) {
        return res.status(404).json({
          success: false,
          message: 'Movie not found'
        });
      }

      // Check if movie has associated showtimes (even soft deleted ones)
      const associatedShowtimes = await Showtime.find({
        movie_id: id,
      });

      if (associatedShowtimes.length > 0) {
        const activeShowtimes = associatedShowtimes.filter((showtime) => !showtime.deletedAt);
        const deletedShowtimes = associatedShowtimes.filter((showtime) => showtime.deletedAt);

        return res.status(409).json({
          success: false,
          message: `Cannot permanently delete movie. It has ${associatedShowtimes.length} associated showtime(s) (${activeShowtimes.length} active, ${deletedShowtimes.length} deleted). Please permanently delete all showtimes first.`,
          data: {
            totalShowtimes: associatedShowtimes.length,
            activeShowtimes: activeShowtimes.length,
            deletedShowtimes: deletedShowtimes.length,
            showtimeIds: associatedShowtimes.map((showtime) => ({
              id: showtime._id,
              status: showtime.deletedAt ? "deleted" : "active",
            })),
          },
        });
      }

      const movieInfo = {
        id: movie._id,
        title: movie.title,
        director: movie.director,
        release_date: movie.release_date
      };

      await Movie.findByIdAndDelete(id);

      logger.warn(`PERMANENT DELETION: Movie permanently deleted by ${req.user.role} ${req.user.userId}`, {
        deletedMovie: movieInfo,
        deletedBy: req.user.userId,
        deletedAt: new Date().toISOString(),
        action: 'FORCE_DELETE_MOVIE'
      });

      res.status(200).json({
        success: true,
        message: 'Movie permanently deleted',
        data: {
          deletedMovie: movieInfo,
          warning: 'This action is irreversible'
        }
      });
    } catch (error) {
      if (error.message === 'Invalid movie ID format') {
        return res.status(400).json({
          success: false,
          message: error.message
        });
      }

      logger.error('Force delete movie error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to permanently delete movie'
      });
    }
  }

  // 8. LIST DELETED MOVIES
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

      const sortObj = {};
      sortObj[sortBy] = sortOrder === 'desc' ? -1 : 1;

      const [movies, totalCount] = await Promise.all([
        Movie.find({ deletedAt: { $ne: null } })
          .sort(sortObj)
          .skip(skip)
          .limit(limitNum),
        Movie.countDocuments({ deletedAt: { $ne: null } })
      ]);

      const totalPages = Math.ceil(totalCount / limitNum);

      logger.info(`Retrieved ${movies.length} deleted movies`);

      res.status(200).json({
        success: true,
        data: {
          movies,
          pagination: {
            currentPage: pageNum,
            totalPages,
            totalCount,
            limit: limitNum
          }
        }
      });
    } catch (error) {
      logger.error('List deleted movies error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve deleted movies'
      });
    }
  }

  // 9. UPDATE STATUS
  static async updateStatus(req, res) {
    try {
      const { id } = req.params;
      const { status } = req.body;

      if (!id) {
        return res.status(400).json({
          success: false,
          message: 'Movie ID is required'
        });
      }

      if (!status) {
        return res.status(400).json({
          success: false,
          message: 'Status is required'
        });
      }

      MovieController.validateObjectId(id);

      const movie = await Movie.findById(id);

      if (!movie) {
        return res.status(404).json({
          success: false,
          message: 'Movie not found'
        });
      }

      await movie.updateStatus(status, req.user?.userId);

      logger.info(`Updated movie status: ${id} to ${status}`);

      res.status(200).json({
        success: true,
        message: 'Movie status updated successfully',
        data: { movie }
      });
    } catch (error) {
      logger.error('Update movie status error:', error);
      res.status(400).json({
        success: false,
        message: error.message || 'Failed to update movie status'
      });
    }
  }

  // 10. GET NOW SHOWING MOVIES
  static async getNowShowing(req, res) {
    try {
      const { page = 1, limit = 10 } = req.query;

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      const movies = await Movie.findNowShowing()
        .skip(skip)
        .limit(limitNum);

      const totalCount = await Movie.findNowShowing().countDocuments();

      logger.info(`Retrieved ${movies.length} now showing movies`);

      res.status(200).json({
        success: true,
        data: {
          movies,
          pagination: {
            currentPage: pageNum,
            totalPages: Math.ceil(totalCount / limitNum),
            totalCount,
            limit: limitNum
          }
        }
      });
    } catch (error) {
      logger.error('Get now showing movies error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve now showing movies'
      });
    }
  }

  // 11. GET COMING SOON MOVIES
  static async getComingSoon(req, res) {
    try {
      const { page = 1, limit = 10 } = req.query;

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      const movies = await Movie.findComingSoon()
        .skip(skip)
        .limit(limitNum);

      const totalCount = await Movie.findComingSoon().countDocuments();

      logger.info(`Retrieved ${movies.length} coming soon movies`);

      res.status(200).json({
        success: true,
        data: {
          movies,
          pagination: {
            currentPage: pageNum,
            totalPages: Math.ceil(totalCount / limitNum),
            totalCount,
            limit: limitNum
          }
        }
      });
    } catch (error) {
      logger.error('Get coming soon movies error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve coming soon movies'
      });
    }
  }

  // 12. GET MOVIES BY GENRE
  static async getByGenre(req, res) {
    try {
      const { genre } = req.params;
      const { page = 1, limit = 10 } = req.query;

      if (!genre) {
        return res.status(400).json({
          success: false,
          message: 'Genre is required'
        });
      }

      const pageNum = Math.max(1, parseInt(page));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
      const skip = (pageNum - 1) * limitNum;

      const movies = await Movie.findByGenre(genre)
        .skip(skip)
        .limit(limitNum);

      const totalCount = await Movie.countDocuments({
        genres: genre,
        deletedAt: null
      });

      logger.info(`Retrieved ${movies.length} movies for genre: ${genre}`);

      res.status(200).json({
        success: true,
        data: {
          movies,
          pagination: {
            currentPage: pageNum,
            totalPages: Math.ceil(totalCount / limitNum),
            totalCount,
            limit: limitNum
          }
        }
      });
    } catch (error) {
      logger.error('Get movies by genre error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve movies by genre'
      });
    }
  }
}

module.exports = MovieController;