const mongoose = require("mongoose");
const { ActivityLog } = require("./models/activityLog.model"); // Adjust path as needed
// Note: We need to mock the connection or just test the schema validation

const ActivityLogModel = require("./models/activityLog.model");

async function testValidation() {
  console.log("Testing ActivityLog model validation...");

  const testActions = [
    "MOVIE_CREATE",
    "USER_FORCE_DELETE",
    "REPORT_GENERATE",
    "INVALID_ACTION_NAME",
  ];

  for (const action of testActions) {
    const log = new ActivityLogModel({
      logType: "ADMIN",
      action: action,
      status: "SUCCESS",
    });

    try {
      await log.validate();
      console.log(`✅ Action '${action}' is valid.`);
    } catch (error) {
      console.log(`❌ Action '${action}' is INVALID: ${error.message}`);
    }
  }
}

// Invoke the test
testValidation().then(() => console.log("Test finished."));
