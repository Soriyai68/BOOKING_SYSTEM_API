require('dotenv').config();
const app = require('./app');
const { envConfig } = require('./config/env');
const connectDB = require('./config/db');
const { connectRedis } = require('./config/redis'); // Fixed: Use destructuring for named export
const { logger } = require('./utils');

const PORT = process.env.PORT || envConfig.server.port || 3000; // Fixed: Define PORT variable

const bootstrap = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Connect to Redis
    await connectRedis();
    
    // Start server
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

bootstrap();