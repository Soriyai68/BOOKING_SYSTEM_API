require("dotenv").config();
const app = require("./app");
const { envConfig } = require("./config/env");
const connectDB = require("./config/db");
const { connectRedis } = require("./config/redis"); // Fixed: Use destructuring for named export
const { logger } = require("./utils");
const { init: initSocket } = require("./utils/socket");
const startAllSchedulers = require("./scripts/scheduler");
const http = require("http");

const PORT = process.env.PORT || envConfig.port || 3000; // Fixed: Define PORT variable

const bootstrap = async () => {
  try {
    // Connect to MongoDB
    await connectDB();

    // Connect to Redis
    await connectRedis();

    // Start the scheduled tasks
    startAllSchedulers();

    // Create HTTP server
    const server = http.createServer(app);

    // Initialize Socket.io
    initSocket(server);

    // Start server
    server.listen(PORT, () => {
      logger.info(`Server running on port http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
};

bootstrap();
