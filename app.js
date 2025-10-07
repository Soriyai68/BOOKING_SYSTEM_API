const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
//

// Import configurations
const { envConfig } = require("./config/env");
const { getRedisClient } = require("./config/redis");

// Import middlewares
const { error, sanitize, morgan } = require("./middlewares");
const { logger } = require("./utils");

// Import routes
const apiRoutes = require("./routes");
const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/users.routes");
const seatRoutes = require("./routes/seats.routes");
const hallRoutes = require("./routes/halls.routes");
const theaterRoutes = require("./routes/theaters.routes");

const app = express();

// Ensure logs directory exists
const logsDir = path.join(__dirname, "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
  logger.info("Logs directory created");
}

// Global Middlewares (Order is important!)
app.use(morgan); // HTTP request logging
app.use(cors(envConfig.cors)); // CORS configuration
app.use(cookieParser()); // Cookie parser
app.use(express.json({ limit: "10mb" })); // JSON parser
app.use(express.urlencoded({ extended: true, limit: "10mb" })); // URL encoded parser

// Session configuration
app.use(
  session({
    secret: envConfig.jwt?.secret || "your-secret-key-here",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: envConfig.mongo?.uri || process.env.MONGODB_URI,
      touchAfter: 24 * 3600, // lazy session update
    }),
    cookie: {
      secure: envConfig.env === "production", // true if HTTPS
      httpOnly: true,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      sameSite: envConfig.env === "production" ? "strict" : "lax",
    },
  })
);

app.use(sanitize); // Request sanitization

// Health check endpoint
app.get("/health", (req, res) => {
  let redisStatus = "disconnected";
  try {
    const redisClient = getRedisClient();
    redisStatus =
      redisClient && redisClient.isReady ? "connected" : "disconnected";
  } catch (error) {
    redisStatus = "disconnected";
  }

  const healthCheck = {
    status: "success",
    message: "Movie Booking System API is running",
    timestamp: new Date().toISOString(),
    environment: envConfig.env,
    uptime: process.uptime(),
    memory: {
      used:
        Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
      total:
        Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
    },
    database: {
      mongodb:
        mongoose.connection.readyState === 1 ? "connected" : "disconnected",
      redis: redisStatus,
    },
  };

  res.status(200).json(healthCheck);
});

// API Routes
app.use("/api/v1", apiRoutes);
// auth
app.use("/api/v1/auth", authRoutes);
// users
app.use("/api/v1/users", userRoutes);
// seats
app.use("/api/v1/seats", seatRoutes);
// theaters
app.use("/api/v1/theaters", theaterRoutes);
// halls
app.use("api/v1/halls", hallRoutes);

// 404 handler for undefined routes
app.use((req, res) => {
  logger.warn(`404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    status: "error",
    message: "Route not found",
    path: req.originalUrl,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
});

// Global error handling middleware (must be last)
app.use(error);

module.exports = app;
