const mongoose = require("mongoose");
require("dotenv").config();
const Payment = require("./models/payment.model");

async function checkRecentPayments() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("Connected to MongoDB");

    const payments = await Payment.find().sort({ createdAt: -1 }).limit(5);
    console.log("Last 5 payments:", JSON.stringify(payments, null, 2));

    await mongoose.connection.close();
  } catch (error) {
    console.error("Error:", error);
  }
}

checkRecentPayments();
