const express = require('express');
const router = express.Router();

// Import route modules
const userRoutes = require('./users.routes');
const seatRoutes = require('./seats.routes');
const hallRoutes = require('./halls.routes');
const theaterRoutes = require('./theaters.routes');
const movieRoutes = require('./movies.routes');
const showtimeRoutes = require('./showtime.routes');
const uploadRoutes = require('./upload.routes');

// Mount routes
router.use('/users', userRoutes);
router.use('/seats', seatRoutes);
router.use('/halls', hallRoutes);
router.use('/theaters', theaterRoutes);
router.use('/movies', movieRoutes);
router.use('/showtimes', showtimeRoutes);
router.use('/upload', uploadRoutes);


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
      seats: '/api/seats',
      halls: '/api/halls',
      theaters: '/api/theaters',
      movies: '/api/movies',
      upload: '/api/upload',
      health: '/api/health'
    }
  });
});

module.exports = router;