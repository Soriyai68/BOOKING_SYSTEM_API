const mongoose = require('mongoose');
require('dotenv').config();

// Register all models to avoid MissingSchemaError
require('../models/showtime.model');
require('../models/movie.model');
require('../models/seat.model');
require('../models/seatBooking.model');
require('../models/bookingTicket.model');
require('../models/customer.model');
require('../models/activityLog.model');
require('../models/seatBookingHistory.model');
const Booking = require('../models/booking.model');

async function migrateBookingStatus() {
  try {
    // Connect to MongoDB
    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is not defined in .env');
    }
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // 1. Migrate "Confirmed" to "Completed"
    const confirmedResult = await Booking.updateMany(
      { booking_status: 'Confirmed' },
      { $set: { booking_status: 'Completed' } }
    );
    console.log(`Migrated ${confirmedResult.modifiedCount} bookings from 'Confirmed' to 'Completed'`);

    // 2. Migrate "Cancelled" to "Expired"
    const cancelledResult = await Booking.updateMany(
      { booking_status: 'Cancelled' },
      { $set: { booking_status: 'Expired' } }
    );
    console.log(`Migrated ${cancelledResult.modifiedCount} bookings from 'Cancelled' to 'Expired'`);

    // 3. Migrate SeatBookingHistory actions
    const SeatBookingHistory = mongoose.model('SeatBookingHistory');
    const historyResult = await SeatBookingHistory.updateMany(
      { action: 'canceled' },
      { $set: { action: 'expired' } }
    );
    console.log(`Migrated ${historyResult.modifiedCount} seat booking history records from 'canceled' to 'expired'`);

    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  migrateBookingStatus();
}

module.exports = migrateBookingStatus;