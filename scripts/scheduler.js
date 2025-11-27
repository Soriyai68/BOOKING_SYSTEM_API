const cron = require('node-cron');
const mongoose = require('mongoose');
const Showtime = require('../models/showtime.model');
const Movie = require('../models/movie.model');
const Booking = require('../models/booking.model');
const SeatBooking = require('../models/seatBooking.model');
const logger = require('../utils/logger');

/**
 * Schedules a job to update showtime statuses from 'scheduled' to 'completed'.
 */
const startShowtimeScheduler = () => {
    logger.info('Scheduling showtime status update job to run every minute.');
    cron.schedule('* * * * *', async () => {
        logger.info('Running scheduled job to update showtime statuses...');
        try {
            const now = new Date();
            const candidateShowtimes = await Showtime.find({
                status: 'scheduled',
                show_date: {$lte: now}
            }).lean();

            const showtimesToCompleteIds = [];
            for (const showtime of candidateShowtimes) {
                const [hours, minutes] = showtime.end_time.split(':').map(Number);
                const showEndDateTime = new Date(showtime.show_date);
                showEndDateTime.setHours(hours, minutes, 0, 0);

                if (showEndDateTime < now) {
                    showtimesToCompleteIds.push(showtime._id);
                }
            }

            if (showtimesToCompleteIds.length > 0) {
                const {modifiedCount} = await Showtime.updateMany(
                    {_id: {$in: showtimesToCompleteIds}, status: 'scheduled'},
                    {$set: {status: 'completed', updatedAt: now}}
                );
                logger.info(`Updated ${modifiedCount} showtimes to 'completed' via scheduler.`);
                const {deletedCount} = await SeatBooking.deleteMany({
                    showtimeId: {$in: showtimesToCompleteIds}
                });

                if (deletedCount > 0) {
                    logger.info(`Scheduler cleaned up ${deletedCount} seat bookings for ${modifiedCount} completed showtimes.`);
                }

                const {modifiedCount: bookingModifiedCount} = await Booking.updateMany(
                    {showtimeId: {$in: showtimesToCompleteIds}, booking_status: 'Confirmed'},
                    {$set: {booking_status: 'Completed', updatedAt: now}}
                );
                if (bookingModifiedCount > 0) {
                    logger.info(`Updated ${bookingModifiedCount} bookings to 'Completed' for completed showtimes.`);
                }
            } else {
                logger.info('No scheduled showtimes found that need to be completed.');
            }
        } catch (error) {
            logger.error('Error in scheduled showtime update job:', error);
        }
    });
};

/**
 * Schedules a job to update movie statuses based on their release and end dates.
 */
const startMovieScheduler = () => {
    logger.info('Scheduling movie status update job to run every minute.');
    cron.schedule('* * * * *', async () => { // Runs at the top of every minutes
        logger.info('Running scheduled job to update movie statuses...');
        try {
            const now = new Date();

            // Update 'coming_soon' movies to 'now_showing'
            const toNowShowingResult = await Movie.updateMany(
                {status: 'coming_soon', release_date: {$lte: now}},
                {$set: {status: 'now_showing', updatedAt: now}}
            );
            if (toNowShowingResult.modifiedCount > 0) {
                logger.info(`Updated ${toNowShowingResult.modifiedCount} movies from 'coming_soon' to 'now_showing'.`);
            }

            // Update 'now_showing' movies to 'ended'
            const toEndedResult = await Movie.updateMany(
                {status: 'now_showing', end_date: {$lte: now}},
                {$set: {status: 'ended', updatedAt: now}}
            );
            if (toEndedResult.modifiedCount > 0) {
                logger.info(`Updated ${toEndedResult.modifiedCount} movies from 'now_showing' to 'ended'.`);
            }

            if (toNowShowingResult.modifiedCount === 0 && toEndedResult.modifiedCount === 0) {
                logger.info('No movie statuses required an update.');
            }
        } catch (error) {
            logger.error('Error in scheduled movie update job:', error);
        }
    });
};

/**
 * Schedules a job to automatically cancel expired bookings.
 */
const startBookingScheduler = () => {
    logger.info('Scheduling booking expiration job to run every minute.');
    cron.schedule('* * * * *', async () => {
        logger.info('Running scheduled job to cancel expired bookings...');
        try {
            const cancelledBookingIds = await Booking.autoCancelExpiredBookings();
            if (cancelledBookingIds.length > 0) {
                logger.info(`Auto-cancelled ${cancelledBookingIds.length} expired bookings.`);
            } else {
                logger.info('No expired bookings found to cancel.');
            }
        } catch (error) {
            logger.error('Error in scheduled booking cancellation job:', error);
        }
    });
};

/**
 * Schedules a job to sync seat statuses for completed bookings.
 * This acts as a janitor to ensure seats for paid bookings are marked as 'booked'.
 */
const startSeatBookingSyncScheduler = () => {
    logger.info('Scheduling seat booking sync job to run every minute.');
    cron.schedule('* * * * *', async () => {
        logger.info('Running scheduled job to sync seat bookings for completed bookings...');
        try {
            // Find bookings that are 'Completed' but may have seats still 'locked'
            const completedBookings = await Booking.find({
                booking_status: 'Completed',
            }).select('_id');

            if (completedBookings.length === 0) {
                logger.info('No completed bookings found to sync seat statuses.');
                return;
            }
            const completedBookingIds = completedBookings.map(b => b._id);

            // Find 'locked' SeatBooking records associated with these completed bookings and update them to 'booked'
            const result = await SeatBooking.updateMany(
                {
                    bookingId: {$in: completedBookingIds},
                    status: 'locked'
                },
                {
                    $set: {
                        status: 'booked',
                    },
                    $unset: { locked_until: "" }
                }
            );

            if (result.modifiedCount > 0) {
                logger.info(`Synced ${result.modifiedCount} seat bookings from 'locked' to 'booked' for completed bookings.`);
            } else {
                logger.info('No seat bookings required syncing for completed bookings.');
            }
        } catch (error) {
            logger.error('Error in scheduled seat booking sync job:', error);
        }
    });
};

/**
 * Initializes and starts all scheduled jobs for the application.
 */
const startAllSchedulers = () => {
    startShowtimeScheduler();
    startMovieScheduler();
    startBookingScheduler();
    startSeatBookingSyncScheduler();
};

module.exports = startAllSchedulers;
