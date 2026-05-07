const { Showtime, Movie, Hall } = require("../models");

/**
 * Utility functions for showtime validation
 */
class ShowtimeValidation {
  /**
   * Validate if a time slot is available for booking
   * @param {string} hallId - Hall ID
   * @param {string} showDate - Show date (YYYY-MM-DD)
   * @param {string} startTime - Start time (HH:MM)
   * @param {string} endTime - End time (HH:MM) - optional, will be calculated if not provided
   * @param {string} movieId - Movie ID for duration calculation
   * @param {string} excludeShowtimeId - Showtime ID to exclude from conflict check (for updates)
   * @returns {Object} Validation result
   */
  static async validateTimeSlot(hallId, showDate, startTime, endTime = null, movieId = null, excludeShowtimeId = null) {
    try {
      // Validate input format
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(startTime)) {
        return {
          isValid: false,
          error: 'INVALID_TIME_FORMAT',
          message: 'Invalid start_time format. Please use HH:MM format (e.g., 14:30).'
        };
      }

      // Check if time is in the past
      const pastValidation = Showtime.validateNotInPast(showDate, startTime);
      if (!pastValidation.isValid) {
        return {
          isValid: false,
          error: 'PAST_TIME',
          message: pastValidation.message
        };
      }

      // Get hall information
      const hall = await Hall.findOne({ _id: hallId, deletedAt: null });
      if (!hall) {
        return {
          isValid: false,
          error: 'HALL_NOT_FOUND',
          message: 'Hall not found or has been deleted.'
        };
      }

      if (hall.status !== 'active') {
        return {
          isValid: false,
          error: 'HALL_INACTIVE',
          message: `Hall "${hall.hall_name}" is not active. Only active halls can have showtimes.`
        };
      }

      // Calculate end_time if not provided
      if (!endTime && movieId) {
        const movie = await Movie.findOne({ _id: movieId, deletedAt: null });
        if (!movie) {
          return {
            isValid: false,
            error: 'MOVIE_NOT_FOUND',
            message: 'Movie not found or has been deleted.'
          };
        }

        if (movie.status === 'ended') {
          return {
            isValid: false,
            error: 'MOVIE_ENDED',
            message: 'Cannot create showtime for a movie that has ended.'
          };
        }

        if (movie.duration_minutes) {
          const normalizedDate = Showtime.safeNormalizeDate(showDate);
          const [hours, minutes] = startTime.split(':').map(Number);
          const startDateTime = new Date(Date.UTC(
            normalizedDate.getUTCFullYear(),
            normalizedDate.getUTCMonth(),
            normalizedDate.getUTCDate(),
            hours,
            minutes
          ));
          const endDateTime = new Date(startDateTime.getTime() + movie.duration_minutes * 60000);
          endTime = `${String(endDateTime.getUTCHours()).padStart(2, "0")}:${String(endDateTime.getUTCMinutes()).padStart(2, "0")}`;
        }
      }

      if (!endTime) {
        return {
          isValid: false,
          error: 'MISSING_END_TIME',
          message: 'End time is required but could not be calculated.'
        };
      }

      // Check for time slot conflicts
      const validation = await Showtime.canCreateShowtimeAt(
        hallId,
        showDate,
        startTime,
        endTime,
        excludeShowtimeId
      );

      if (!validation.canCreate) {
        return {
          isValid: false,
          error: 'TIME_CONFLICT',
          message: `Time slot conflict in hall "${hall.hall_name}"`,
          details: `Cannot schedule showtime from ${startTime} to ${endTime} because it overlaps with an existing showtime (${validation.conflictingShowtime.start_time} - ${validation.conflictingShowtime.end_time}).`,
          conflictingShowtime: validation.conflictingShowtime,
          suggestions: {
            message: "Try scheduling after the conflicting showtime ends",
            earliestAvailableTime: validation.conflictingShowtime.end_time
          }
        };
      }

      return {
        isValid: true,
        message: 'Time slot is available',
        calculatedEndTime: endTime,
        hallName: hall.hall_name
      };

    } catch (error) {
      return {
        isValid: false,
        error: 'VALIDATION_ERROR',
        message: 'An error occurred during validation',
        details: error.message
      };
    }
  }

  /**
   * Get available time slots for a hall on a specific date
   * @param {string} hallId - Hall ID
   * @param {string} showDate - Show date (YYYY-MM-DD)
   * @param {number} durationMinutes - Duration in minutes for the new showtime
   * @returns {Object} Available time slots
   */
  static async getAvailableTimeSlots(hallId, showDate, durationMinutes = 120) {
    try {
      // Get existing showtimes for the hall on the date
      const existingShowtimes = await Showtime.findByHallAndDate(hallId, showDate);
      
      // Define operating hours (can be made configurable)
      const operatingStart = "09:00";
      const operatingEnd = "23:00";
      
      const slots = [];
      const [startHour, startMin] = operatingStart.split(':').map(Number);
      const [endHour, endMin] = operatingEnd.split(':').map(Number);
      
      let currentTime = startHour * 60 + startMin; // Convert to minutes
      const endTime = endHour * 60 + endMin;
      const slotDuration = durationMinutes;
      
      while (currentTime + slotDuration <= endTime) {
        const slotStart = `${String(Math.floor(currentTime / 60)).padStart(2, '0')}:${String(currentTime % 60).padStart(2, '0')}`;
        const slotEnd = `${String(Math.floor((currentTime + slotDuration) / 60)).padStart(2, '0')}:${String((currentTime + slotDuration) % 60).padStart(2, '0')}`;
        
        // Check if this slot conflicts with existing showtimes
        const hasConflict = existingShowtimes.some(showtime => {
          return slotStart < showtime.end_time && slotEnd > showtime.start_time;
        });
        
        if (!hasConflict) {
          // Check if it's not in the past
          const pastValidation = Showtime.validateNotInPast(showDate, slotStart);
          if (pastValidation.isValid) {
            slots.push({
              startTime: slotStart,
              endTime: slotEnd,
              available: true
            });
          }
        }
        
        // Move to next 30-minute slot
        currentTime += 30;
      }
      
      return {
        success: true,
        availableSlots: slots,
        existingShowtimes: existingShowtimes.map(st => ({
          id: st._id,
          startTime: st.start_time,
          endTime: st.end_time,
          movieId: st.movie_id
        }))
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Validate multiple showtimes for bulk operations
   * @param {Array} showtimes - Array of showtime objects
   * @returns {Object} Validation results
   */
  static async validateBulkShowtimes(showtimes) {
    const results = {
      valid: [],
      invalid: [],
      conflicts: []
    };

    const batchKeys = new Set(); // Track duplicates within the batch

    for (let i = 0; i < showtimes.length; i++) {
      const showtime = showtimes[i];
      const { movie_id, hall_id, show_date, start_time } = showtime;

      // Check required fields
      if (!movie_id || !hall_id || !show_date || !start_time) {
        results.invalid.push({
          index: i,
          showtime,
          error: 'MISSING_FIELDS',
          message: 'Missing required fields (movie_id, hall_id, show_date, or start_time)'
        });
        continue;
      }

      // Check for duplicates within the batch
      const normalizedDate = Showtime.safeNormalizeDate(show_date);
      const isoDate = normalizedDate.toISOString().split('T')[0];
      const batchKey = `${hall_id}_${isoDate}_${start_time}`;
      
      if (batchKeys.has(batchKey)) {
        results.invalid.push({
          index: i,
          showtime,
          error: 'BATCH_DUPLICATE',
          message: 'Duplicate entry for the same hall/date/time found within this batch'
        });
        continue;
      }
      batchKeys.add(batchKey);

      // Validate individual showtime
      const validation = await this.validateTimeSlot(
        hall_id,
        show_date,
        start_time,
        showtime.end_time,
        movie_id
      );

      if (validation.isValid) {
        results.valid.push({
          index: i,
          showtime: {
            ...showtime,
            end_time: validation.calculatedEndTime
          }
        });
      } else {
        results.invalid.push({
          index: i,
          showtime,
          error: validation.error,
          message: validation.message,
          details: validation.details
        });
      }
    }

    return results;
  }
}

module.exports = ShowtimeValidation;