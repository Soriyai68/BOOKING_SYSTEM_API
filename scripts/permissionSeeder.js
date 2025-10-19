require('dotenv').config();
const mongoose = require('mongoose');
const Permission = require('../models/permission.model');
const RolePermission = require('../models/rolePermission.model');
const { Role } = require('../data');
const connectDB = require('../config/db');

// Define all permissions
const permissions = [
  // User Management
  { name: 'users.view', displayName: 'View Users', description: 'Can view users list and details', module: 'users' },
  { name: 'users.create', displayName: 'Create Users', description: 'Can create new users', module: 'users' },
  { name: 'users.edit', displayName: 'Edit Users', description: 'Can edit user information', module: 'users' },
  { name: 'users.delete', displayName: 'Delete Users', description: 'Can delete users', module: 'users' },
  { name: 'users.manage', displayName: 'Manage Users', description: 'Full user management access', module: 'users' },

  // Theater Management
  { name: 'theaters.view', displayName: 'View Theaters', description: 'Can view theaters list and details', module: 'theaters' },
  { name: 'theaters.create', displayName: 'Create Theaters', description: 'Can create new theaters', module: 'theaters' },
  { name: 'theaters.edit', displayName: 'Edit Theaters', description: 'Can edit theater information', module: 'theaters' },
  { name: 'theaters.delete', displayName: 'Delete Theaters', description: 'Can delete theaters', module: 'theaters' },
  { name: 'theaters.manage', displayName: 'Manage Theaters', description: 'Full theater management access', module: 'theaters' },

  // Hall Management
  { name: 'halls.view', displayName: 'View Halls', description: 'Can view halls list and details', module: 'halls' },
  { name: 'halls.create', displayName: 'Create Halls', description: 'Can create new halls', module: 'halls' },
  { name: 'halls.edit', displayName: 'Edit Halls', description: 'Can edit hall information', module: 'halls' },
  { name: 'halls.delete', displayName: 'Delete Halls', description: 'Can delete halls', module: 'halls' },
  { name: 'halls.manage', displayName: 'Manage Halls', description: 'Full hall management access', module: 'halls' },

  // Seat Management
  { name: 'seats.view', displayName: 'View Seats', description: 'Can view seats list and details', module: 'seats' },
  { name: 'seats.create', displayName: 'Create Seats', description: 'Can create new seats', module: 'seats' },
  { name: 'seats.edit', displayName: 'Edit Seats', description: 'Can edit seat information', module: 'seats' },
  { name: 'seats.delete', displayName: 'Delete Seats', description: 'Can delete seats', module: 'seats' },
  { name: 'seats.manage', displayName: 'Manage Seats', description: 'Full seat management access', module: 'seats' },

  // Movie Management
  { name: 'movies.view', displayName: 'View Movies', description: 'Can view movies list and details', module: 'movies' },
  { name: 'movies.create', displayName: 'Create Movies', description: 'Can create new movies', module: 'movies' },
  { name: 'movies.edit', displayName: 'Edit Movies', description: 'Can edit movie information', module: 'movies' },
  { name: 'movies.delete', displayName: 'Delete Movies', description: 'Can delete movies', module: 'movies' },
  { name: 'movies.manage', displayName: 'Manage Movies', description: 'Full movie management access', module: 'movies' },

  // Showtime Management
  { name: 'showtimes.view', displayName: 'View Showtimes', description: 'Can view showtimes list and details', module: 'showtimes' },
  { name: 'showtimes.create', displayName: 'Create Showtimes', description: 'Can create new showtimes', module: 'showtimes' },
  { name: 'showtimes.edit', displayName: 'Edit Showtimes', description: 'Can edit showtime information', module: 'showtimes' },
  { name: 'showtimes.delete', displayName: 'Delete Showtimes', description: 'Can delete showtimes', module: 'showtimes' },
  { name: 'showtimes.manage', displayName: 'Manage Showtimes', description: 'Full showtime management access', module: 'showtimes' },

  // Booking Management
  { name: 'bookings.view', displayName: 'View Bookings', description: 'Can view bookings list and details', module: 'bookings' },
  { name: 'bookings.create', displayName: 'Create Bookings', description: 'Can create new bookings', module: 'bookings' },
  { name: 'bookings.edit', displayName: 'Edit Bookings', description: 'Can edit booking information', module: 'bookings' },
  { name: 'bookings.delete', displayName: 'Delete Bookings', description: 'Can delete bookings', module: 'bookings' },
  { name: 'bookings.manage', displayName: 'Manage Bookings', description: 'Full booking management access', module: 'bookings' },

  // Dashboard & Analytics
  { name: 'dashboard.view', displayName: 'View Dashboard', description: 'Can access admin dashboard', module: 'dashboard' },
  { name: 'analytics.view', displayName: 'View Analytics', description: 'Can view system analytics and reports', module: 'analytics' },

  // Settings Management
  { name: 'settings.view', displayName: 'View Settings', description: 'Can view system settings', module: 'settings' },
  { name: 'settings.edit', displayName: 'Edit Settings', description: 'Can edit system settings', module: 'settings' },
  { name: 'settings.manage', displayName: 'Manage Settings', description: 'Full settings management access', module: 'settings' },

  // System Administration
  { name: 'system.manage', displayName: 'System Management', description: 'Full system administration access', module: 'system' },
];

// Define role-permission mappings
const rolePermissions = {
  [Role.USER]: [
    // Users typically have no admin permissions
  ],
  [Role.ADMIN]: [
    // Dashboard
    'dashboard.view',
    'analytics.view',

    // User Management
    'users.view',
    'users.create',
    'users.edit',
    'users.manage',

    // Theater Management
    'theaters.view',
    'theaters.create',
    'theaters.edit',
    'theaters.delete',
    'theaters.manage',

    // Hall Management
    'halls.view',
    'halls.create',
    'halls.edit',
    'halls.delete',
    'halls.manage',

    // Seat Management
    'seats.view',
    'seats.create',
    'seats.edit',
    'seats.delete',
    'seats.manage',

    // Movie Management
    'movies.view',
    'movies.create',
    'movies.edit',
    'movies.delete',
    'movies.manage',

    // Showtime Management
    'showtimes.view',
    'showtimes.create',
    'showtimes.edit',
    'showtimes.delete',
    'showtimes.manage',

    // Booking Management
    'bookings.view',
    'bookings.create',
    'bookings.edit',
    'bookings.delete',
    'bookings.manage',

    // Settings (view only)
    'settings.view',
  ],
  [Role.CASHIER]: [
    // Dashboard
    'dashboard.view',
    'analytics.view',

    // User Management
    'users.view',
    'users.create',
    'users.edit',
    'users.manage',

    // Theater Management (no delete)
    'theaters.view',
    'theaters.create',
    'theaters.edit',
    'theaters.manage',

    // Hall Management (no delete)
    'halls.view',
    'halls.create',
    'halls.edit',
    'halls.manage',

    // Seat Management (no delete)
    'seats.view',
    'seats.create',
    'seats.edit',
    'seats.manage',

    // Movie Management (no delete)
    'movies.view',
    'movies.create',
    'movies.edit',
    'movies.manage',

    // Showtime Management (no delete)
    'showtimes.view',
    'showtimes.create',
    'showtimes.edit',
    'showtimes.manage',

    // Booking Management (no delete)
    'bookings.view',
    'bookings.create',
    'bookings.edit',
    'bookings.manage',

    // Settings (view only)
    'settings.view',
  ],
  [Role.SUPERADMIN]: [
    // SuperAdmin gets ALL permissions
    ...permissions.map(p => p.name)
  ]
};

async function seedPermissions() {
  try {
    await connectDB();
    console.log('Starting permission seeding...');

    // Clear existing permissions and role permissions
    console.log('Clearing existing permissions...');
    await RolePermission.deleteMany({});
    await Permission.deleteMany({});

    // Create permissions
    console.log('Creating permissions...');
    const createdPermissions = await Permission.insertMany(permissions);
    console.log(`Created ${createdPermissions.length} permissions`);

    // Create role-permission mappings
    console.log('Creating role-permission mappings...');

    for (const [role, permissionNames] of Object.entries(rolePermissions)) {
      const rolePermissionDocs = [];

      for (const permissionName of permissionNames) {
        const permission = createdPermissions.find(p => p.name === permissionName);
        if (permission) {
          rolePermissionDocs.push({
            role,
            permission: permission._id,
            isActive: true
          });
        } else {
          console.warn(`Permission '${permissionName}' not found for role '${role}'`);
        }
      }

      if (rolePermissionDocs.length > 0) {
        await RolePermission.insertMany(rolePermissionDocs);
        console.log(`Created ${rolePermissionDocs.length} permissions for role: ${role}`);
      }
    }

    console.log('Permission seeding completed successfully!');

    // Print summary
    const totalPermissions = await Permission.countDocuments();
    const totalRolePermissions = await RolePermission.countDocuments();

    console.log('\nSummary:');
    console.log(`Total Permissions: ${totalPermissions}`);
    console.log(`Total Role-Permission Mappings: ${totalRolePermissions}`);

    for (const role of Object.values(Role)) {
      const count = await RolePermission.countDocuments({ role });
      console.log(`  - ${role}: ${count} permissions`);
    }

  } catch (error) {
    console.error('Error seeding permissions:', error);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
}

seedPermissions();