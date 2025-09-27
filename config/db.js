const mongoose = require('mongoose');
const { logger } = require('../utils');
require('dotenv').config();

const connectDB = async () => {
  try {
    console.log(' > Initializing MongoDB.');
    
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    logger.info(`MongoDB Connected: ${conn.connection.host} Soriya Ninja Team`);
    logger.info(`Database: ${conn.connection.name}`);
    console.log('Database (MongoDB) Connected.');
    
  } catch (error) {
    logger.error(`Failed to connect to MongoDB, ${error.message}`);
    logger.error('Exiting ...');
    process.exit(1);
  }
};

// Handle connection events
mongoose.connection.on('error', (err) => {
  logger.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
  console.log('MongoDB Disconnected');
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected');
});

// Gracefully closes MongoDB connection on app exit (CTRL+C)
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('MongoDB connection closed.');
  process.exit(0);
});

module.exports = connectDB;