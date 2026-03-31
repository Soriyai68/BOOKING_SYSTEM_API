require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user.model');
const Customer = require('../models/customer.model');
const { Role } = require('../data');
const connectDB = require('../config/db');

const adminUsers = [
  {
    username: 'admin',
    email: 'admin@booking.com',
    name: 'Admin User',
    password: 'admin123',
    role: Role.ADMIN,
    isVerified: true,
    isActive: true
  },
  {
    username: 'superadmin',
    email: 'superadmin@booking.com',
    name: 'Super Admin',
    password: 'superadmin123',
    role: Role.SUPERADMIN,
    isVerified: true,
    isActive: true
  },
  {
    username: 'cashier',
    email: 'cashier@booking.com',
    name: 'Cashier User',
    password: '123456',
    role: Role.CASHIER,
    isVerified: true,
    isActive: true
  }
];

const defaultCustomers = [
  {
    name: 'Walk-in',
    phone: '+85500000000',
    customerType: 'walkin',
    isVerified: true,
    isActive: true
  }
];

async function dropStaleIndexes() {
  try {
    const collection = mongoose.connection.collection('users');
    const indexes = await collection.indexes();
    const phoneIndex = indexes.find(idx => idx.name === 'phone_1');
    if (phoneIndex) {
      await collection.dropIndex('phone_1');
      console.log('Dropped stale index: phone_1');
    }
  } catch (err) {
    console.warn('Could not drop stale indexes (may not exist):', err.message);
  }
}

async function createDefaultCustomers() {
  try {
    console.log('Creating default customers...');

    for (const customerData of defaultCustomers) {
      // Check if customer already exists by phone
      const existingCustomer = await Customer.findOne({
        phone: customerData.phone
      });

      if (existingCustomer) {
        console.log(`Customer ${customerData.name} (${customerData.phone}) already exists, skipping...`);
        continue;
      }

      const customer = new Customer(customerData);
      await customer.save();
      console.log(`Created customer: ${customerData.name} (${customerData.phone})`);
    }
  } catch (error) {
    console.error('Error creating default customers:', error);
  }
}

async function createAdminUsers() {
  try {
    await connectDB();

    // Drop legacy phone index if it still exists
    await dropStaleIndexes();

    console.log('Creating admin users...');

    for (const userData of adminUsers) {
      // Check if user already exists (by username or email)
      const existingUser = await User.findOne({
        $or: [
          { username: userData.username },
          { email: userData.email }
        ]
      });

      if (existingUser) {
        console.log(`User ${userData.username} (${userData.email}) already exists, skipping...`);
        continue;
      }

      const user = new User(userData);
      await user.save();
      console.log(`Created ${userData.role}: ${userData.username} / ${userData.email} (password: ${userData.password})`);
    }

    // Create default customers
    await createDefaultCustomers();

    console.log('Seeder completed successfully.');
  } catch (error) {
    console.error('Error creating admin users:', error);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
}

createAdminUsers();