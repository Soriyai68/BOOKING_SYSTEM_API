const mongoose = require("mongoose");
const { ActivityLog } = require("./models");
require("dotenv").config();

async function checkLogs() {
  try {
    const mongoUri =
      process.env.MONGODB_URI || "mongodb://localhost:27017/booking_system";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    const logs = await ActivityLog.find({ action: "SHOWTIME_CREATE" })
      .sort({ createdAt: -1 })
      .limit(5);

    console.log("Latest SHOWTIME_CREATE logs:", JSON.stringify(logs, null, 2));

    const allLogs = await ActivityLog.find({}).sort({ createdAt: -1 }).limit(5);
    console.log("Latest 5 activity logs:", JSON.stringify(allLogs, null, 2));

    await mongoose.disconnect();
  } catch (error) {
    console.error("Error:", error);
  }
}

checkLogs();
