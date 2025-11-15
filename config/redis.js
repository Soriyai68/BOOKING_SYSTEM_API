const redis = require('redis');
const { envConfig } = require('./env');
const logger = require('../utils/logger');

let redisClient = null;

exports.connectRedis = async () => {
  try {
    console.log('🥷  Initializing Redis.');

    const options = {
      socket: {
        host: envConfig.redis.host,
        port: envConfig.redis.port,
        reconnectStrategy: (retries) => Math.min(retries * 50, 500)
      },
      database: envConfig.redis.database || 0
    };

    // Add password if provided
    if (envConfig.redis.password) {
      options.password = envConfig.redis.password;
    }

    redisClient = redis.createClient(options);

    // Handle connection events
    redisClient.on('connect', () => {
      console.log('🥷  Redis client connected.');
    });

    redisClient.on('ready', () => {
      console.log('Database (Redis) Connected.');
    });

    redisClient.on('error', (err) => {
      logger.error(`Failed to connect to Redis, ${err.message}`);
    });

    redisClient.on('end', () => {
      console.log('Redis Disconnected');
    });

    redisClient.on('reconnecting', () => {
      console.log('Redis reconnecting...');
    });

    // Connect to Redis
    await redisClient.connect();
    
  } catch (err) {
    logger.error(`Failed to connect to Redis, ${err.message}`);
    logger.error('Exiting ...');
    process.exit(0);
  }
};

exports.getRedisClient = () => {
  if (!redisClient) {
    throw new Error('Redis client not initialized. Call connectRedis() first.');
  }
  return redisClient;
};

process.on('SIGINT', async () => {
  if (redisClient) {
    await redisClient.quit();
  }
  process.exit(0);
});