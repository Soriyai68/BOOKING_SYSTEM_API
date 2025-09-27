require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user.model');
const { Role } = require('../data');
const Providers = require('../data/providers');
const connectDB = require('../config/db');

const adminUsers = [
  {
    phone: '+1234567891',
    name: 'Admin User',
    password: 'admin123',
    role: Role.ADMIN,
    provider: Providers.PHONE,
    isVerified: true,
    isActive: true
  },
  {
    phone: '+85581218840',
    name: 'Super Admin',
    password: 'superadmin123',
    role: Role.SUPERADMIN,
    provider: Providers.PHONE,
    isVerified: true,
    isActive: true
  }
];

async function createAdminUsers() {
  try {
    await connectDB();
    
    console.log('Creating admin users...');
    
    for (const userData of adminUsers) {
      // Check if user already exists
      const existingUser = await User.findOne({ phone: userData.phone });
      if (existingUser) {
        console.log(`User ${userData.phone} already exists, skipping...`);
        continue;
      }
      
      const user = new User(userData);
      await user.save();
      console.log(`Created ${userData.role}: ${userData.phone} (password: ${userData.password})`);
    }
    
    console.log('\nAdmin users created successfully!');
    console.log('\nAdmin Login Credentials:');
    console.log('Admin: +1234567891 / admin123');
    console.log('Super Admin: +1234567892 / superadmin123');
    
  } catch (error) {
    console.error('Error creating admin users:', error);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
}

createAdminUsers();