const cron = require("node-cron");
const mongoose = require("mongoose");
const Showtime = require("../models/showtime.model");
const Movie = require("../models/movie.model");
const Booking = require("../models/booking.model");
const SeatBooking = require("../models/seatBooking.model");
const Promotion = require("../models/promotion.model");
const Customer = require("../models/customer.model");
const ActivityLog = require("../models/activityLog.model");
const { logActivity } = require("../utils/activityLogger");

const logger = require("../utils/logger");

/**
 * Schedules a job to update showtime statuses from 'scheduled' to 'completed'.
 */
const startShowtimeScheduler = () => {
  logger.info("Scheduling showtime status update job to run every minute.");
  cron.schedule("* * * * *", async () => {
    logger.info("Running scheduled job to update showtime statuses...");
    try {
      const now = new Date();
      const candidateShowtimes = await Showtime.find({
        status: "scheduled",
        show_date: { $lte: now },
      }).lean();

      const showtimesToCompleteIds = [];
      for (const showtime of candidateShowtimes) {
        const [hours, minutes] = showtime.end_time.split(":").map(Number);
        const showEndDateTime = new Date(showtime.show_date);
        showEndDateTime.setHours(hours, minutes, 0, 0);

        if (showEndDateTime < now) {
          showtimesToCompleteIds.push(showtime._id);
        }
      }

      if (showtimesToCompleteIds.length > 0) {
        const { modifiedCount } = await Showtime.updateMany(
          { _id: { $in: showtimesToCompleteIds }, status: "scheduled" },
          { $set: { status: "completed", updatedAt: now } },
        );
        logger.info(
          `Updated ${modifiedCount} showtimes to 'completed' via scheduler.`,
        );
        const { deletedCount } = await SeatBooking.deleteMany({
          showtimeId: { $in: showtimesToCompleteIds },
        });

        if (deletedCount > 0) {
          logger.info(
            `Scheduler cleaned up ${deletedCount} seat bookings for ${modifiedCount} completed showtimes.`,
          );
        }

        const { modifiedCount: bookingModifiedCount } =
          await Booking.updateMany(
            {
              showtimeId: { $in: showtimesToCompleteIds },
              booking_status: "Confirmed",
            },
            { $set: { booking_status: "Completed", updatedAt: now } },
          );
        if (bookingModifiedCount > 0) {
          logger.info(
            `Updated ${bookingModifiedCount} bookings to 'Completed' for completed showtimes.`,
          );
        }
      } else {
        logger.info("No scheduled showtimes found that need to be completed.");
      }
    } catch (error) {
      logger.error("Error in scheduled showtime update job:", error);
    }
  });
};

/**
 * Schedules a job to update movie statuses based on their release and end dates.
 */
const startMovieScheduler = () => {
  logger.info("Scheduling movie status update job to run every minute.");
  cron.schedule("* * * * *", async () => {
    // Runs at the top of every minutes
    logger.info("Running scheduled job to update movie statuses...");
    try {
      const now = new Date();

      // Update 'coming_soon' movies to 'now_showing'
      const toNowShowingResult = await Movie.updateMany(
        { status: "coming_soon", release_date: { $lte: now } },
        { $set: { status: "now_showing", updatedAt: now } },
      );
      if (toNowShowingResult.modifiedCount > 0) {
        logger.info(
          `Updated ${toNowShowingResult.modifiedCount} movies from 'coming_soon' to 'now_showing'.`,
        );
      }

      // Update 'now_showing' movies to 'ended'
      const toEndedResult = await Movie.updateMany(
        { status: "now_showing", end_date: { $lte: now } },
        { $set: { status: "ended", updatedAt: now } },
      );
      if (toEndedResult.modifiedCount > 0) {
        logger.info(
          `Updated ${toEndedResult.modifiedCount} movies from 'now_showing' to 'ended'.`,
        );
      }

      if (
        toNowShowingResult.modifiedCount === 0 &&
        toEndedResult.modifiedCount === 0
      ) {
        logger.info("No movie statuses required an update.");
      }
    } catch (error) {
      logger.error("Error in scheduled movie update job:", error);
    }
  });
};

/**
 * Schedules a job to automatically cancel expired bookings.
 */
const startBookingScheduler = () => {
  logger.info("Scheduling booking expiration job to run every minute.");
  cron.schedule("* * * * *", async () => {
    logger.info("Running scheduled job to cancel expired bookings...");
    try {
      const cancelledBookingIds = await Booking.autoCancelExpiredBookings();
      if (cancelledBookingIds.length > 0) {
        logger.info(
          `Auto-cancelled ${cancelledBookingIds.length} expired bookings.`,
        );
      } else {
        logger.info("No expired bookings found to cancel.");
      }
    } catch (error) {
      logger.error("Error in scheduled booking cancellation job:", error);
    }
  });
};

/**
 * Schedules a job to sync seat statuses for completed bookings.
 * This acts as a janitor to ensure seats for paid bookings are marked as 'booked'.
 */
const startSeatBookingSyncScheduler = () => {
  logger.info("Scheduling seat booking sync job to run every minute.");
  cron.schedule("* * * * *", async () => {
    logger.info(
      "Running scheduled job to sync seat bookings for completed bookings...",
    );
    try {
      // Find bookings that are 'Completed' but may have seats still 'locked'
      const completedBookings = await Booking.find({
        booking_status: "Completed",
      }).select("_id");

      if (completedBookings.length === 0) {
        logger.info("No completed bookings found to sync seat statuses.");
        return;
      }
      const completedBookingIds = completedBookings.map((b) => b._id);

      // Find 'locked' SeatBooking records associated with these completed bookings and update them to 'booked'
      const result = await SeatBooking.updateMany(
        {
          bookingId: { $in: completedBookingIds },
          status: "locked",
        },
        {
          $set: {
            status: "booked",
          },
          $unset: { locked_until: "" },
        },
      );

      if (result.modifiedCount > 0) {
        logger.info(
          `Synced ${result.modifiedCount} seat bookings from 'locked' to 'booked' for completed bookings.`,
        );
      } else {
        logger.info(
          "No seat bookings required syncing for completed bookings.",
        );
      }
    } catch (error) {
      logger.error("Error in scheduled seat booking sync job:", error);
    }
  });
};

/**
 * Schedules a job to release seats for bookings that have failed or been cancelled.
 * This acts as a janitor to clean up orphaned seat locks.
 */
const startSeatReleaseScheduler = () => {
  logger.info(
    "Scheduling seat release job for failed/cancelled bookings to run every minute.",
  );
  cron.schedule("* * * * *", async () => {
    logger.info(
      "Running scheduled job to release seats for failed/cancelled bookings...",
    );
    try {
      // Find bookings that are cancelled or have a failed payment
      const bookingsToClean = await Booking.find({
        $or: [{ payment_status: "Failed" }, { booking_status: "Cancelled" }],
      }).select("_id");

      if (bookingsToClean.length === 0) {
        logger.info(
          "No failed or cancelled bookings found that require seat release.",
        );
        return;
      }

      const bookingIdsToClean = bookingsToClean.map((b) => b._id);

      // Find and delete the associated SeatBooking records
      const seatBookingsToDelete = await SeatBooking.find({
        bookingId: { $in: bookingIdsToClean },
      }).lean();

      if (seatBookingsToDelete.length > 0) {
        const { deletedCount } = await SeatBooking.deleteMany({
          _id: { $in: seatBookingsToDelete.map((sb) => sb._id) },
        });

        // Update the corresponding history records to 'canceled'
        await mongoose
          .model("SeatBookingHistory")
          .updateMany(
            { bookingId: { $in: bookingIdsToClean }, action: "booked" },
            { $set: { action: "canceled" } },
          );

        logger.info(
          `Released ${deletedCount} seats from ${bookingIdsToClean.length} failed/cancelled bookings via scheduler.`,
        );
      }
    } catch (error) {
      logger.error("Error in scheduled seat release job:", error);
    }
  });
};

/**
 * Schedules a job to update promotion statuses based on their start and end dates.
 */
const startPromotionScheduler = () => {
  logger.info("Scheduling promotion status update job to run every minute.");
  cron.schedule("* * * * *", async () => {
    logger.info("Running scheduled job to update promotion statuses...");
    try {
      const now = new Date();

      // Update 'Inactive' promotions to 'Active' if they are within the valid date range.
      const toActiveResult = await Promotion.updateMany(
        {
          status: "Inactive",
          start_date: { $lte: now },
          end_date: { $gt: now },
        },
        { $set: { status: "Active", updatedAt: now } },
      );
      if (toActiveResult.modifiedCount > 0) {
        logger.info(
          `Updated ${toActiveResult.modifiedCount} promotions from 'Inactive' to 'Active'.`,
        );
      }

      // Update 'Active' or 'Inactive' promotions to 'Expired' if their end date has passed.
      const toExpiredResult = await Promotion.updateMany(
        {
          status: { $in: ["Active", "Inactive"] },
          end_date: { $lte: now },
        },
        { $set: { status: "Expired", updatedAt: now } },
      );
      if (toExpiredResult.modifiedCount > 0) {
        logger.info(
          `Updated ${toExpiredResult.modifiedCount} promotions to 'Expired'.`,
        );
      }

      if (
        toActiveResult.modifiedCount === 0 &&
        toExpiredResult.modifiedCount === 0
      ) {
        logger.info("No promotion statuses required an update.");
      }
    } catch (error) {
      logger.error("Error in scheduled promotion update job:", error);
    }
  });
};

/**
 * Schedules a job to deactivate customer accounts based on inactivity.
 * Runs daily at midnight.
 */
const startAccountCleanupScheduler = () => {
  logger.info(
    "Scheduling customer account cleanup job to run daily at midnight.",
  );
  cron.schedule("0 0 * * *", async () => {
    logger.info(
      "Running scheduled job to deactivate inactive customer accounts...",
    );
    try {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const inactiveCustomers = await Customer.find({
        lastLogin: { $lt: sixMonthsAgo },
        isActive: true,
        deletedAt: null,
      });

      if (inactiveCustomers.length > 0) {
        const customerIds = inactiveCustomers.map((c) => c._id);
        await Customer.updateMany(
          { _id: { $in: customerIds } },
          { $set: { isActive: false, updatedAt: new Date() } },
        );

        for (const customer of inactiveCustomers) {
          await logActivity({
            customerId: customer._id,
            logType: "CUSTOMER",
            action: "ACCOUNT_DEACTIVATED",
            status: "SUCCESS",
            metadata: {
              reason: "Inactivity for more than 6 months",
              lastLogin: customer.lastLogin,
            },
          });
        }
        logger.info(
          `Deactivated ${inactiveCustomers.length} inactive customer accounts.`,
        );
      }
    } catch (error) {
      logger.error("Error in scheduled account cleanup job:", error);
    }
  });
};

/**
 * Schedules a job to check customer reputation and deactivate accounts with high cancellation rates.
 * Runs daily at 1 AM.
 */
const startReputationCheckScheduler = () => {
  logger.info("Scheduling customer reputation check job to run daily at 1 AM.");
  cron.schedule("0 1 * * *", async () => {
    logger.info("Running scheduled job to check customer reputation...");
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      // Find customers with more than 10 cancellations in the last 30 days
      const suspiciousActivities = await ActivityLog.aggregate([
        {
          $match: {
            action: "BOOK_CANCEL",
            status: "SUCCESS",
            timestamp: { $gt: thirtyDaysAgo },
          },
        },
        {
          $group: {
            _id: "$customerId",
            cancelCount: { $sum: 1 },
          },
        },
        {
          $match: {
            cancelCount: { $gt: 10 },
          },
        },
      ]);

      if (suspiciousActivities.length > 0) {
        const customerIds = suspiciousActivities.map((a) => a._id);

        // Get customer details for logging
        const customersToDeactivate = await Customer.find({
          _id: { $in: customerIds },
          isActive: true,
        });

        if (customersToDeactivate.length > 0) {
          const deactivationIds = customersToDeactivate.map((c) => c._id);
          await Customer.updateMany(
            { _id: { $in: deactivationIds } },
            { $set: { isActive: false, updatedAt: new Date() } },
          );

          for (const customer of customersToDeactivate) {
            const cancelCount = suspiciousActivities.find(
              (a) => a._id.toString() === customer._id.toString(),
            ).cancelCount;
            await logActivity({
              customerId: customer._id,
              logType: "CUSTOMER",
              action: "ACCOUNT_DEACTIVATED",
              status: "SUCCESS",
              metadata: {
                reason: "High cancellation rate",
                cancelCount: cancelCount,
                period: "Last 30 days",
              },
            });
          }
          logger.info(
            `Deactivated ${customersToDeactivate.length} accounts due to high cancellation rates.`,
          );
        }
      }
    } catch (error) {
      logger.error("Error in scheduled reputation check job:", error);
    }
  });
};

/**
 * Initializes and starts all scheduled jobs for the application.
 */

const startAllSchedulers = () => {
  startShowtimeScheduler();
  startMovieScheduler ? startMovieScheduler() : startMovieStatusScheduler();
  startBookingScheduler();
  startSeatBookingSyncScheduler
    ? startSeatBookingSyncScheduler()
    : startSeatReleaseScheduler();
  startPromotionScheduler();
  startAccountCleanupScheduler();
  startReputationCheckScheduler();
};

module.exports = startAllSchedulers;
