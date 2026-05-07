const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('../models/index');
const Booking = require('../models/booking.model');

async function migrate() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected.');

    const res = await Booking.updateMany(
      { booking_status: 'Expired' },
      { $set: { booking_status: 'Failed' } }
    );
    console.log(`Migrated ${res.modifiedCount} bookings from Expired to Failed (booking_status).`);

    const res2 = await Booking.updateMany(
      { payment_status: 'Expired' },
      { $set: { payment_status: 'Failed' } }
    );
    console.log(`Migrated ${res2.modifiedCount} bookings from Expired to Failed (payment_status).`);

    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

migrate();
