const express = require('express');
const router = express.Router();

// Import route modules
const userRoutes = require('./users.routes');
// const seatRoutes = require('./seats.routes');
// const locationRoutes = require('./locations.routes');
// const theaterRoutes = require('./theaters.routes');
// Import Route module

// Mount routes
router.use('/users', userRoutes);
// router.use('/seats', seatRoutes);


// Health check endpoint
router.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'API is running successfully',
    timestamp: new Date().toISOString()
  });
});

// API info endpoint
router.get('/', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Movie Booking System API',
    version: '1.0.0',
    endpoints: {
      users: '/api/users',
      // seats: '/api/seats',
      // locations: '/api/locations',
      // theaters: '/api/theaters',
      health: '/api/health'
    }
  });
});

module.exports = router;