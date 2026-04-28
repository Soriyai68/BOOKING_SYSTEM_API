const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Booking = require('../models/booking.model');

async function migrateBookingStatus() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find all "Confirmed" bookings with "Completed" payment status
    const confirmedBookings = await Booking.find({
      booking_status: 'Confirmed',
      payment_status: 'Completed',
      deletedAt: null
    });

    console.log(`Found ${confirmedBookings.length} bookings to migrate from Confirmed to Completed`);

    let migratedCount = 0;
    for (const booking of confirmedBookings) {
      await booking.transitionToCompleted();
      migratedCount++;
      console.log(`Migrated booking ${booking.reference_code} (${migratedCount}/${confirmedBookings.length})`);
    }

    console.log(`Migration completed. ${migratedCount} bookings updated.`);
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