require("dotenv").config();
const mongoose = require("mongoose");
const Permission = require("../models/permission.model");
const RolePermission = require("../models/rolePermission.model");
const { Role } = require("../data");
const connectDB = require("../config/db");

// Define all permissions
const permissions = [
  // User Management
  {
    name: "users.view",
    displayName: "View Users",
    description: "Can view users list and details",
    module: "users",
  },
  {
    name: "users.create",
    displayName: "Create Users",
    description: "Can create new users",
    module: "users",
  },
  {
    name: "users.edit",
    displayName: "Edit Users",
    description: "Can edit user information",
    module: "users",
  },
  {
    name: "users.delete",
    displayName: "Delete Users",
    description: "Can delete users",
    module: "users",
  },
  {
    name: "users.manage",
    displayName: "Manage Users",
    description: "Full user management access",
    module: "users",
  },

  // Theater Management
  {
    name: "theaters.view",
    displayName: "View Theaters",
    description: "Can view theaters list and details",
    module: "theaters",
  },
  {
    name: "theaters.create",
    displayName: "Create Theaters",
    description: "Can create new theaters",
    module: "theaters",
  },
  {
    name: "theaters.edit",
    displayName: "Edit Theaters",
    description: "Can edit theater information",
    module: "theaters",
  },
  {
    name: "theaters.delete",
    displayName: "Delete Theaters",
    description: "Can delete theaters",
    module: "theaters",
  },
  {
    name: "theaters.manage",
    displayName: "Manage Theaters",
    description: "Full theater management access",
    module: "theaters",
  },

  // Hall Management
  {
    name: "halls.view",
    displayName: "View Halls",
    description: "Can view halls list and details",
    module: "halls",
  },
  {
    name: "halls.create",
    displayName: "Create Halls",
    description: "Can create new halls",
    module: "halls",
  },
  {
    name: "halls.edit",
    displayName: "Edit Halls",
    description: "Can edit hall information",
    module: "halls",
  },
  {
    name: "halls.delete",
    displayName: "Delete Halls",
    description: "Can delete halls",
    module: "halls",
  },
  {
    name: "halls.manage",
    displayName: "Manage Halls",
    description: "Full hall management access",
    module: "halls",
  },

  // Seat Management
  {
    name: "seats.view",
    displayName: "View Seats",
    description: "Can view seats list and details",
    module: "seats",
  },
  {
    name: "seats.create",
    displayName: "Create Seats",
    description: "Can create new seats",
    module: "seats",
  },
  {
    name: "seats.edit",
    displayName: "Edit Seats",
    description: "Can edit seat information",
    module: "seats",
  },
  {
    name: "seats.delete",
    displayName: "Delete Seats",
    description: "Can delete seats",
    module: "seats",
  },
  {
    name: "seats.manage",
    displayName: "Manage Seats",
    description: "Full seat management access",
    module: "seats",
  },

  // Movie Management
  {
    name: "movies.view",
    displayName: "View Movies",
    description: "Can view movies list and details",
    module: "movies",
  },
  {
    name: "movies.create",
    displayName: "Create Movies",
    description: "Can create new movies",
    module: "movies",
  },
  {
    name: "movies.edit",
    displayName: "Edit Movies",
    description: "Can edit movie information",
    module: "movies",
  },
  {
    name: "movies.delete",
    displayName: "Delete Movies",
    description: "Can delete movies",
    module: "movies",
  },
  {
    name: "movies.manage",
    displayName: "Manage Movies",
    description: "Full movie management access",
    module: "movies",
  },

  // Showtime Management
  {
    name: "showtimes.view",
    displayName: "View Showtimes",
    description: "Can view showtimes list and details",
    module: "showtimes",
  },
  {
    name: "showtimes.create",
    displayName: "Create Showtimes",
    description: "Can create new showtimes",
    module: "showtimes",
  },
  {
    name: "showtimes.edit",
    displayName: "Edit Showtimes",
    description: "Can edit showtime information",
    module: "showtimes",
  },
  {
    name: "showtimes.delete",
    displayName: "Delete Showtimes",
    description: "Can delete showtimes",
    module: "showtimes",
  },
  {
    name: "showtimes.manage",
    displayName: "Manage Showtimes",
    description: "Full showtime management access",
    module: "showtimes",
  },

  // Booking Management
  {
    name: "bookings.view",
    displayName: "View Bookings",
    description: "Can view bookings list and details",
    module: "bookings",
  },
  {
    name: "bookings.create",
    displayName: "Create Bookings",
    description: "Can create new bookings",
    module: "bookings",
  },
  {
    name: "bookings.edit",
    displayName: "Edit Bookings",
    description: "Can edit booking information",
    module: "bookings",
  },
  {
    name: "bookings.delete",
    displayName: "Delete Bookings",
    description: "Can delete bookings",
    module: "bookings",
  },
  {
    name: "bookings.manage",
    displayName: "Manage Bookings",
    description: "Full booking management access",
    module: "bookings",
  },

  // Booking Ticket Management
  {
    name: "booking-tickets.view",
    displayName: "View Booking Tickets",
    description: "Can view booking tickets list",
    module: "booking-tickets",
  },
  {
    name: "booking-tickets.create",
    displayName: "Create Booking Tickets",
    description: "Can create new booking tickets manually",
    module: "booking-tickets",
  },
  {
    name: "booking-tickets.edit",
    displayName: "Edit Booking Tickets",
    description: "Can edit booking ticket information",
    module: "booking-tickets",
  },
  {
    name: "booking-tickets.delete",
    displayName: "Delete Booking Tickets",
    description: "Can delete booking tickets",
    module: "booking-tickets",
  },
  {
    name: "booking-tickets.manage",
    displayName: "Manage Booking Tickets",
    description: "Full booking ticket management access",
    module: "booking-tickets",
  },

  // Booking Detail Management
  {
    name: "bookingdetails.view",
    displayName: "View Booking Details",
    description: "Can view booking details",
    module: "bookingdetails",
  },
  {
    name: "bookingdetails.create",
    displayName: "Create Booking Details",
    description: "Can create new booking details",
    module: "bookingdetails",
  },
  {
    name: "bookingdetails.edit",
    displayName: "Edit Booking Details",
    description: "Can edit booking detail information",
    module: "bookingdetails",
  },
  {
    name: "bookingdetails.delete",
    displayName: "Delete Booking Details",
    description: "Can delete booking details",
    module: "bookingdetails",
  },
  {
    name: "bookingdetails.manage",
    displayName: "Manage Booking Details",
    description: "Full booking detail management access",
    module: "bookingdetails",
  },

  // Invoice Management
  {
    name: "invoices.view",
    displayName: "View Invoices",
    description: "Can view invoices list and details",
    module: "invoices",
  },
  {
    name: "invoices.create",
    displayName: "Create Invoices",
    description: "Can create new invoices",
    module: "invoices",
  },
  {
    name: "invoices.edit",
    displayName: "Edit Invoices",
    description: "Can edit invoice information",
    module: "invoices",
  },
  {
    name: "invoices.delete",
    displayName: "Delete Invoices",
    description: "Can delete invoices",
    module: "invoices",
  },
  {
    name: "invoices.manage",
    displayName: "Manage Invoices",
    description: "Full invoice management access",
    module: "invoices",
  },

  // Payment Management
  {
    name: "payments.view",
    displayName: "View Payments",
    description: "Can view payments list and details",
    module: "payments",
  },
  {
    name: "payments.create",
    displayName: "Create Payments",
    description: "Can create new payments",
    module: "payments",
  },
  {
    name: "payments.edit",
    displayName: "Edit Payments",
    description: "Can edit payment information",
    module: "payments",
  },
  {
    name: "payments.delete",
    displayName: "Delete Payments",
    description: "Can delete payments",
    module: "payments",
  },
  {
    name: "payments.manage",
    displayName: "Manage Payments",
    description: "Full payment management access",
    module: "payments",
  },

  // Promotion Management
  {
    name: "promotions.view",
    displayName: "View Promotions",
    description: "Can view promotions list and details",
    module: "promotions",
  },
  {
    name: "promotions.create",
    displayName: "Create Promotions",
    description: "Can create new promotions",
    module: "promotions",
  },
  {
    name: "promotions.edit",
    displayName: "Edit Promotions",
    description: "Can edit promotions information",
    module: "promotions",
  },
  {
    name: "promotions.delete",
    displayName: "Delete Promotions",
    description: "Can delete promotions",
    module: "promotions",
  },
  {
    name: "promotions.manage",
    displayName: "Manage Promotions",
    description: "Full promotions management access",
    module: "promotions",
  },

  // Reports Management
  {
    name: "reports.view",
    displayName: "View Reports",
    description: "Can view system reports",
    module: "reports",
  },
  {
    name: "reports.total-customers.view",
    displayName: "View Total Customers Report",
    description: "Can view total customers report",
    module: "reports",
  },
  {
    name: "reports.total-bookings.view",
    displayName: "View Total Bookings Report",
    description: "Can view total bookings report",
    module: "reports",
  },
  {
    name: "reports.total-revenue.view",
    displayName: "View Total Revenue Report",
    description: "Can view total revenue report",
    module: "reports",
  },
  {
    name: "reports.total-movies.view",
    displayName: "View Total Movies Report",
    description: "Can view total movies report",
    module: "reports",
  },
  {
    name: "reports.customer-frequency.view",
    displayName: "View Customer Booking Frequency",
    description: "Can view customer booking frequency report",
    module: "reports",
  },
  {
    name: "reports.revenue-report.view",
    displayName: "View Revenue Report",
    description: "Can view detailed revenue report",
    module: "reports",
  },
  {
    name: "reports.booking-status-report.view",
    displayName: "View Booking Status Report",
    description: "Can view booking status report",
    module: "reports",
  },
  {
    name: "reports.popular-movies-report.view",
    displayName: "View Popular Movies Report",
    description: "Can view popular movies report",
    module: "reports",
  },
  {
    name: "reports.seat-type-revenue-report.view",
    displayName: "View Seat Type Revenue Report",
    description: "Can view seat type revenue report",
    module: "reports",
  },
  {
    name: "reports.detailed-revenue.view",
    displayName: "View Detailed Revenue Report",
    description: "Can view detailed revenue report",
    module: "reports",
  },
  {
    name: "reports.detailed-bookings.view",
    displayName: "View Detailed Bookings Report",
    description: "Can view detailed bookings report",
    module: "reports",
  },
  {
    name: "reports.detailed-movies.view",
    displayName: "View Detailed Movies Report",
    description: "Can view detailed movies report",
    module: "reports",
  },
  {
    name: "reports.payment-method-analysis.view",
    displayName: "View Payment Method Analysis Report",
    description: "Can view payment method analysis report",
    module: "reports",
  },
  {
    name: "reports.showtime-utilization.view",
    displayName: "View Showtime Utilization Report",
    description: "Can view showtime utilization report",
    module: "reports",
  },
  {
    name: "reports.customer-demographic.view",
    displayName: "View Customer Demographic Report",
    description: "Can view customer demographic report",
    module: "reports",
  },
  {
    name: "reports.staff-performance.view",
    displayName: "View Staff Performance Report",
    description: "Can view staff performance report",
    module: "reports",
  },
  {
    name: "reports.inventory-seat-management.view",
    displayName: "View Inventory & Seat Management Report",
    description: "Can view inventory and seat management report",
    module: "reports",
  },

  // Dashboard & Analytics
  {
    name: "dashboard.view",
    displayName: "View Dashboard",
    description: "Can access admin dashboard",
    module: "dashboard",
  },
  {
    name: "analytics.view",
    displayName: "View Analytics",
    description: "Can view system analytics and reports",
    module: "analytics",
  },

  // Settings Management
  {
    name: "settings.view",
    displayName: "View Settings",
    description: "Can view system settings",
    module: "settings",
  },
  {
    name: "settings.edit",
    displayName: "Edit Settings",
    description: "Can edit system settings",
    module: "settings",
  },
  {
    name: "settings.manage",
    displayName: "Manage Settings",
    description: "Full settings management access",
    module: "settings",
  },

  // Activity Logs Management
  {
    name: "activity-logs.view",
    displayName: "View Activity Logs",
    description: "Can view system activity logs",
    module: "activity-logs",
  },
  {
    name: "activity-logs.delete",
    displayName: "Delete Activity Logs",
    description: "Can delete activity logs",
    module: "activity-logs",
  },

  // Customer Management
  {
    name: "customers.view",
    displayName: "View Customers",
    description: "Can view customers list and details",
    module: "customers",
  },
  {
    name: "customers.create",
    displayName: "Create Customers",
    description: "Can create new customers",
    module: "customers",
  },
  {
    name: "customers.edit",
    displayName: "Edit Customers",
    description: "Can edit customer information",
    module: "customers",
  },
  {
    name: "customers.delete",
    displayName: "Delete Customers",
    description: "Can delete customers",
    module: "customers",
  },
  {
    name: "customers.manage",
    displayName: "Manage Customers",
    description: "Full customer management access",
    module: "customers",
  },

  // System Administration
  {
    name: "system.manage",
    displayName: "System Management",
    description: "Full system administration access",
    module: "system",
  },

  // Seat Booking Management
  {
    name: "seat-bookings.view",
    displayName: "View Seat Bookings",
    description: "Can view live seat booking status and maps",
    module: "seat-bookings",
  },
  {
    name: "seat-bookings.manage",
    displayName: "Manage Seat Bookings",
    description: "Full seat booking management (overriding locks)",
    module: "seat-bookings",
  },

  // Seat Booking History
  {
    name: "seat-booking-history.view",
    displayName: "View Seat Booking History",
    description: "Can view history of seat bookings and cancellations",
    module: "seat-booking-history",
  },

  // Backup Management
  {
    name: "backups.view",
    displayName: "View Backups",
    description: "Can view backup list and details",
    module: "backups",
  },
  {
    name: "backups.create",
    displayName: "Create Backups",
    description: "Can create manual database backups",
    module: "backups",
  },
  {
    name: "backups.restore",
    displayName: "Restore Backups",
    description: "Can restore database from backups",
    module: "backups",
  },
  {
    name: "backups.delete",
    displayName: "Delete Backups",
    description: "Can delete backup files",
    module: "backups",
  },
  {
    name: "backups.schedule",
    displayName: "Schedule Backups",
    description: "Can configure automated backup schedules",
    module: "backups",
  },
  {
    name: "backups.stats",
    displayName: "View Backup Statistics",
    description: "Can view backup statistics and storage usage",
    module: "backups",
  },
  {
    name: "backups.manage",
    displayName: "Manage Backups",
    description: "Full backup system management access",
    module: "backups",
  },
];

// Define role-permission mappings
const rolePermissions = {
  [Role.USER]: [
    // Users typically have no admin permissions
  ],
  [Role.ADMIN]: [
    // Dashboard
    "dashboard.view",
    "analytics.view",

    // User Management
    "users.view",
    "users.create",
    "users.edit",
    "users.manage",

    // Theater Management
    "theaters.view",
    "theaters.create",
    "theaters.edit",
    "theaters.delete",
    "theaters.manage",

    // Hall Management
    "halls.view",
    "halls.create",
    "halls.edit",
    "halls.delete",
    "halls.manage",

    // Seat Management
    "seats.view",
    "seats.create",
    "seats.edit",
    "seats.delete",
    "seats.manage",

    // Movie Management
    "movies.view",
    "movies.create",
    "movies.edit",
    "movies.delete",
    "movies.manage",

    // Showtime Management
    "showtimes.view",
    "showtimes.create",
    "showtimes.edit",
    "showtimes.delete",
    "showtimes.manage",

    // Booking Management
    "bookings.view",
    "bookings.create",
    "bookings.edit",
    "bookings.delete",
    "bookings.manage",

    // Seat Bookings
    "seat-bookings.view",
    "seat-bookings.manage",

    // Seat Booking History
    "seat-booking-history.view",

    // Booking Ticket Management
    "booking-tickets.view",
    "booking-tickets.create",
    "booking-tickets.edit",
    "booking-tickets.delete",
    "booking-tickets.manage",

    // Booking Detail Management
    "bookingdetails.view",
    "bookingdetails.create",
    "bookingdetails.edit",
    "bookingdetails.delete",
    "bookingdetails.manage",

    // Invoice Management
    "invoices.view",
    "invoices.create",
    "invoices.edit",
    "invoices.delete",
    "invoices.manage",

    // Payment Management
    "payments.view",
    "payments.create",
    "payments.edit",
    "payments.delete",
    "payments.manage",

    // Promotions Management
    "promotions.view",
    "promotions.create",
    "promotions.edit",
    "promotions.delete",
    "promotions.manage",

    // Reports
    "reports.view",
    "reports.total-customers.view",
    "reports.total-bookings.view",
    "reports.total-revenue.view",
    "reports.total-movies.view",
    "reports.customer-frequency.view",
    "reports.revenue-report.view",
    "reports.booking-status-report.view",
    "reports.popular-movies-report.view",
    "reports.seat-type-revenue-report.view",
    "reports.detailed-revenue.view",
    "reports.detailed-bookings.view",
    "reports.detailed-movies.view",
    "reports.payment-method-analysis.view",
    "reports.showtime-utilization.view",
    "reports.customer-demographic.view",
    "reports.staff-performance.view",
    "reports.inventory-seat-management.view",

    // Activity Logs
    "activity-logs.view",
    "activity-logs.delete",

    // Customers
    "customers.view",
    "customers.create",
    "customers.edit",
    "customers.delete",
    "customers.manage",

    // Settings (view only)
    "settings.view",

    // Backup Management (Admin gets all backup permissions)
    "backups.view",
    "backups.create",
    "backups.restore",
    "backups.delete",
    "backups.schedule",
    "backups.stats",
    "backups.manage",
  ],
  [Role.CASHIER]: [
    // Dashboard
    "dashboard.view",
    "analytics.view",

    // User Management
    "users.view",
    "users.create",
    "users.edit",
    "users.manage",

    // Theater Management (no delete)
    "theaters.view",
    "theaters.create",
    "theaters.edit",
    "theaters.manage",

    // Hall Management (no delete)

    "halls.view",
    "halls.create",
    "halls.edit",
    "halls.manage",

    // Seat Management (no delete)
    "seats.view",
    "seats.create",
    "seats.edit",
    "seats.manage",

    // Movie Management (no delete)
    "movies.view",
    "movies.create",
    "movies.edit",
    "movies.manage",

    // Showtime Management (no delete)
    "showtimes.view",
    "showtimes.create",
    "showtimes.edit",
    "showtimes.manage",

    // Booking Management (no delete)
    "bookings.view",
    "bookings.create",
    "bookings.edit",
    "bookings.manage",

    // Seat Bookings
    "seat-bookings.view",
    "seat-bookings.manage",

    // Seat Booking History
    "seat-booking-history.view",

    // Booking Ticket Management
    "booking-tickets.view",
    "booking-tickets.create",
    "booking-tickets.edit",

    // Booking Detail Management (no delete)
    "bookingdetails.view",
    "bookingdetails.create",
    "bookingdetails.edit",
    "bookingdetails.manage",

    // Invoice Management (no delete)
    "invoices.view",
    "invoices.create",
    "invoices.edit",
    "invoices.manage",

    // Payment Management (no delete)
    "payments.view",
    "payments.create",
    "payments.edit",
    "payments.manage",

    // Promotions Management (no delete)
    "promotions.view",
    "promotions.create",
    "promotions.edit",
    "promotions.manage",

    // Reports
    "reports.view",
    "reports.total-customers.view",
    "reports.total-bookings.view",
    "reports.total-revenue.view",
    "reports.total-movies.view",
    "reports.customer-frequency.view",
    "reports.revenue-report.view",
    "reports.booking-status-report.view",
    "reports.popular-movies-report.view",
    "reports.seat-type-revenue-report.view",
    "reports.detailed-revenue.view",
    "reports.detailed-bookings.view",
    "reports.detailed-movies.view",
    "reports.payment-method-analysis.view",
    "reports.showtime-utilization.view",
    "reports.customer-demographic.view",
    "reports.staff-performance.view",
    "reports.inventory-seat-management.view",

    // Activity Logs
    "activity-logs.view",

    // Customers (no delete)
    "customers.view",
    "customers.create",
    "customers.edit",

    // Settings (view only)
    "settings.view",

    // Backup Management (Cashier gets view-only access)
    "backups.view",
    "backups.stats",
  ],
  [Role.SUPERADMIN]: [
    // SuperAdmin gets ALL permissions
    ...permissions.map((p) => p.name),
  ],
};

async function seedPermissions() {
  try {
    await connectDB();
    console.log("Starting permission seeding...");

    // Clear existing permissions and role permissions
    console.log("Clearing existing permissions...");
    await RolePermission.deleteMany({});
    await Permission.deleteMany({});

    // Create permissions
    console.log("Creating permissions...");
    const createdPermissions = await Permission.insertMany(permissions);
    console.log(`Created ${createdPermissions.length} permissions`);

    // Create role-permission mappings
    console.log("Creating role-permission mappings...");

    for (const [role, permissionNames] of Object.entries(rolePermissions)) {
      const rolePermissionDocs = [];

      for (const permissionName of permissionNames) {
        const permission = createdPermissions.find(
          (p) => p.name === permissionName,
        );
        if (permission) {
          rolePermissionDocs.push({
            role,
            permission: permission._id,
            isActive: true,
          });
        } else {
          console.warn(
            `Permission '${permissionName}' not found for role '${role}'`,
          );
        }
      }

      if (rolePermissionDocs.length > 0) {
        await RolePermission.insertMany(rolePermissionDocs);
        console.log(
          `Created ${rolePermissionDocs.length} permissions for role: ${role}`,
        );
      }
    }

    console.log("Permission seeding completed successfully!");

    // Print summary
    const totalPermissions = await Permission.countDocuments();
    const totalRolePermissions = await RolePermission.countDocuments();

    console.log("\nSummary:");
    console.log(`Total Permissions: ${totalPermissions}`);
    console.log(`Total Role-Permission Mappings: ${totalRolePermissions}`);

    for (const role of Object.values(Role)) {
      const count = await RolePermission.countDocuments({ role });
      console.log(`  - ${role}: ${count} permissions`);
    }
  } catch (error) {
    console.error("Error seeding permissions:", error);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
}

seedPermissions();
