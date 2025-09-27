const { envConfig } = require('../config/env');

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) {
      return callback(null, true); // allow requests like Postman or same-origin
    }

    try {
      const hostname = new URL(origin).hostname;

      const isAllowed = envConfig.cors.origin.some(domain =>
        hostname === domain || hostname.endsWith(`.${domain}`)
      );

      if (isAllowed) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    } catch (err) {
      callback(new Error('Invalid origin'));
    }
  },
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'cache-control'],
  exposedHeaders: ['Set-Cookie', 'Authorization']
};

module.exports = corsOptions;
