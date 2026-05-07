const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config();

const { Booking, Showtime, Movie } = require("../models");

async function debug() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/movie_booking_systemv2");
    console.log("Connected to MongoDB");

    const bookings = await Booking.find().limit(1);
    if (bookings.length === 0) {
      console.log("No bookings found");
      process.exit(0);
    }

    const booking = bookings[0];
    console.log("\n--- Booking Sample ---");
    console.log("ID:", booking._id);
    console.log("showtimeId:", booking.showtimeId);

    const showtime = await Showtime.findById(booking.showtimeId);
    if (!showtime) {
      console.log("Showtime not found for this booking!");
    } else {
      console.log("\n--- Showtime Details ---");
      console.log("ID:", showtime._id);
      console.log("movie_id:", showtime.movie_id, typeof showtime.movie_id);

      const movie = await Movie.findById(showtime.movie_id);
      if (!movie) {
        console.log("Movie not found for this showtime!");
      } else {
        console.log("\n--- Movie Details ---");
        console.log("ID:", movie._id);
        console.log("Title:", movie.title);
      }
    }

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

debug();
