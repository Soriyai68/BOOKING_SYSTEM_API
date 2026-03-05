require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../models/user.model");
const ActivityLog = require("../models/activityLog.model");
const Customer = require("../models/customer.model");
const connectDB = require("../config/db");

const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_3_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3.1 Mobile/15E148 Safari/604.1",
];

const ips = ["192.168.1.1", "10.0.0.42", "172.16.0.5", "127.0.0.1"];

async function seedActivityLogs() {
  try {
    await connectDB();
    console.log("Connected to database for activity log seeding...");

    // Fetch admin users
    const superadmin = await User.findOne({ role: "superadmin" });
    const admin = await User.findOne({ role: "admin" });
    const cashier = await User.findOne({ role: "cashier" });

    if (!superadmin || !admin || !cashier) {
      console.error(
        "Core admin users (superadmin, admin, cashier) not found. Please run seeder.js first.",
      );
      process.exit(1);
    }

    console.log("Clearing old logs...");
    await ActivityLog.deleteMany({ logType: "ADMIN" });

    const logs = [];

    // 1. SuperAdmin Logs
    logs.push({
      userId: superadmin._id,
      logType: "ADMIN",
      action: "USER_LOGIN",
      ipAddress: ips[0],
      userAgent: userAgents[0],
      metadata: { method: "password" },
      createdAt: new Date(Date.now() - 3600000 * 2), // 2 hours ago
    });

    logs.push({
      userId: superadmin._id,
      logType: "ADMIN",
      action: "PERMISSION_UPDATE",
      ipAddress: ips[0],
      userAgent: userAgents[0],
      metadata: { role: "cashier", changes: "Added activity-logs.view" },
      createdAt: new Date(Date.now() - 3600000 * 1.5),
    });

    // 2. Admin Logs
    logs.push({
      userId: admin._id,
      logType: "ADMIN",
      action: "USER_LOGIN",
      ipAddress: ips[1],
      userAgent: userAgents[1],
      createdAt: new Date(Date.now() - 3600000 * 5), // 5 hours ago
    });

    logs.push({
      userId: admin._id,
      logType: "ADMIN",
      action: "USER_CREATE",
      ipAddress: ips[1],
      userAgent: userAgents[1],
      metadata: { username: "new_temp_staff" },
      createdAt: new Date(Date.now() - 3600000 * 4),
    });

    // 3. Cashier Logs
    logs.push({
      userId: cashier._id,
      logType: "ADMIN",
      action: "USER_LOGIN",
      ipAddress: ips[2],
      userAgent: userAgents[3],
      createdAt: new Date(Date.now() - 3600000 * 24), // Yesterday
    });

    logs.push({
      userId: cashier._id,
      logType: "ADMIN",
      action: "BOOK_CREATE_CONFIRMED",
      ipAddress: ips[2],
      userAgent: userAgents[3],
      metadata: { bookingId: new mongoose.Types.ObjectId(), amount: 12.5 },
      createdAt: new Date(Date.now() - 3600000 * 23),
    });

    logs.push({
      userId: cashier._id,
      logType: "ADMIN",
      action: "USER_LOGOUT",
      ipAddress: ips[2],
      userAgent: userAgents[3],
      createdAt: new Date(Date.now() - 3600000 * 22),
    });

    console.log(`Inserting ${logs.length} activity logs...`);
    await ActivityLog.insertMany(logs);
    console.log("Activity log seeding completed successfully!");
  } catch (error) {
    console.error("Error seeding activity logs:", error);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
}

seedActivityLogs();
