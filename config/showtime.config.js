/**
 * Showtime Configuration
 */

module.exports = {
  // Buffer time between showtimes in minutes
  // This adds extra time before and after each showtime to prevent conflicts
  // Example: If set to 15, there must be at least 15 minutes between showtimes
  BUFFER_TIME_MINUTES: 15, // Set to 0 to disable buffer time
  
  // Operating hours for the cinema
  OPERATING_HOURS: {
    START: "09:00",
    END: "23:00"
  },
  
  // Time slot intervals for available slot calculation (in minutes)
  TIME_SLOT_INTERVAL: 30,
  
  // Validation settings
  VALIDATION: {
    // Require buffer time for all showtimes
    ENFORCE_BUFFER: true,
    
    // Allow past showtimes (for admin/bulk operations)
    ALLOW_PAST_SHOWTIMES: false,
    
    // Maximum advance booking days
    MAX_ADVANCE_DAYS: 90
  },

  // Protection settings for completed showtimes
  COMPLETED_SHOWTIME_PROTECTION: {
    // Prevent deletion of completed showtimes
    PREVENT_DELETE: true,
    
    // Prevent modification of completed showtimes (except status)
    PREVENT_MODIFY: true,
    
    // Fields that can be modified on completed showtimes
    ALLOWED_UPDATE_FIELDS: ["status"],
    
    // Allow force delete of completed showtimes (admin only)
    ALLOW_FORCE_DELETE: true,
    
    // Log warnings when force deleting completed showtimes
    LOG_FORCE_DELETE_WARNINGS: true
  }
};