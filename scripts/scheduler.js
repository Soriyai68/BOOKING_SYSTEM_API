const cron = require('node-cron');
const mongoose = require('mongoose');
const Showtime = require('../models/showtime.model');
const Movie = require('../models/movie.model');
const Booking = require('../models/booking.model');
const Seat = require('../models/seat.model');
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

                for (const showtimeId of showtimesToCompleteIds) {
                    try {
                        const bookings = await Booking.find({
                            showtimeId: showtimeId,
                            booking_status: {$ne: 'Cancelled'}
                        }).select('seats');

                        if (bookings.length > 0) {
                            const seatIdsToRelease = bookings.flatMap(b => b.seats.map(id => id.toString()));
                            const uniqueSeatIds = [...new Set(seatIdsToRelease)];

                            if (uniqueSeatIds.length > 0) {
                                const {modifiedCount: seatsModifiedCount} = await Seat.updateMany(
                                    {_id: {$in: uniqueSeatIds}, status: 'reserved'},
                                    {$set: {status: 'active'}}
                                );
                                logger.info(`Scheduler released ${seatsModifiedCount} seats for showtime ${showtimeId}.`);
                            }
                        }
                    } catch (seatReleaseError) {
                        logger.error(`Error releasing seats for showtime ${showtimeId} via scheduler: ${seatReleaseError.message}`);
                    }
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
 * Initializes and starts all scheduled jobs for the application.
 */
const startAllSchedulers = () => {
    startShowtimeScheduler();
    startMovieScheduler();
    startBookingScheduler();
};

module.exports = startAllSchedulers;
