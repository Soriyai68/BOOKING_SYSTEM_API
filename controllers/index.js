const { ThisMonthInstance } = require('twilio/lib/rest/api/v2010/account/usage/record/thisMonth');

// Export all controllers
module.exports = {
  UserController: require('./user.controller'),
  AuthController: require('./auth.controller'),
  SeatController: require('./seat.controller'),
  ScreenController: require('./screen.controller'),
  TheaterController: require('./theater.controller'),
};

