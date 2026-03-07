const mongoose = require("mongoose");
const { logActivity } = require("./utils/activityLogger");
require("dotenv").config();

async function testLog() {
  try {
    const mongoUri =
      process.env.MONGODB_URI ||
      "mongodb://localhost:27017/movie_booking_system";
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    await logActivity({
      userId: new mongoose.Types.ObjectId(), // Fake user ID
      action: "SHOWTIME_CREATE",
      targetId: new mongoose.Types.ObjectId(), // Fake showtime ID
      metadata: {
        movie_id: new mongoose.Types.ObjectId(),
        hall_id: new mongoose.Types.ObjectId(),
        show_date: new Date(),
        start_time: "10:00",
      },
    });

    console.log(
      "Test log call completed. Check console for [ActivityLog] messages.",
    );

    await mongoose.disconnect();
  } catch (error) {
    console.error("Test Error:", error);
  }
}

testLog();
