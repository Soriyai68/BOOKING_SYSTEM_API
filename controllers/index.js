// Export all controllers
module.exports = {
    UserController: require('./user.controller'),
    AuthController: require('./auth.controller'),
    SeatController: require('./seat.controller'),
    SeatBookingController: require('./seatBooking.controller'),
    HallController: require('./hall.controller'),
    TheaterController: require('./theater.controller'),
    BookingController: require('./booking.controller'),

    BookingDetailController: require('./bookingDetail.controller'),
    PaymentController: require('./payment.controller'),
    InvoiceController: require('./invoice.controller'),
    MovieController: require('./movie.controller'),
    ShowtimeController: require('./showtime.controller'),
    UploadController: require('./upload.controller'),
    PromotionController: require('./promotion.controller'),
    SeatBookingController: require('./seatBooking.controller'),
    PermissionController: require("./permission.controller"),

};
