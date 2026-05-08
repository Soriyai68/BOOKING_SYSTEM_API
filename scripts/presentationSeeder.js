require("dotenv").config();
const mongoose = require("mongoose");

const Theater = require("../models/theater.model");
const Hall = require("../models/hall.model");
const Seat = require("../models/seat.model");
const Movie = require("../models/movie.model");
const Showtime = require("../models/showtime.model");
const SeatBooking = require("../models/seatBooking.model");
const SeatBookingHistory = require("../models/seatBookingHistory.model");
const BookingTicket = require("../models/bookingTicket.model");
const Booking = require("../models/booking.model");
const Payment = require("../models/payment.model");
const User = require("../models/user.model");
const { Role } = require("../data");
const connectDB = require("../config/db");

async function seedPresentationData() {
  try {
    await connectDB();
    console.log("Connected to database for presentation seeding...");

    // =========================
    // 1. GET ADMIN
    // =========================
    let admin = await User.findOne({ role: Role.SUPERADMIN });
    if (!admin) {
      admin = await User.findOne({ role: Role.ADMIN });
    }
    const adminId = admin ? admin._id : null;

    // =========================
    // 2. CLEAN OLD DATA (IMPORTANT)
    // =========================
    // =========================
    // 2. GLOBAL CLEANUP (TOTAL RESET)
    // =========================
    console.log("Performing global database cleanup...");

    // Collections to wipe completely for a fresh start
    await Promise.all([
      Booking.deleteMany({}),
      Payment.deleteMany({}),
      SeatBooking.deleteMany({}),
      Showtime.deleteMany({}),
      Seat.deleteMany({}),
      Hall.deleteMany({}),
      Theater.deleteMany({}),
    ]);

    await Movie.deleteMany({
      title: {
        $in: [
          "Midnight Strike",
          "Eternal Sunset",
          "Neon Frontier",
          "The Silent Forest",
          "Midnight Strike | វាយបកកណ្តាលអធ្រាត្រ",
          "Eternal Sunset | សូរ្យអស្តង្គតអមតៈ",
          "Neon Frontier | ដែនដីនីអុង",
          "The Silent Forest | ព្រៃស្ងប់ស្ងាត់",
        ],
      },
    });

    let theater = null;
    let hall = null;

    console.log("Database cleaned. Starting fresh seed...");

    // =========================
    // 3. CREATE THEATER
    // =========================
    console.log("Creating Theater...");
    theater = await Theater.create({
      name: "Grand Cinema Battambang",
      address: "Street 1, Battambang City",
      city: "Battambang",
      province: "Battambang",
      status: "active",
      contact_info: {
        phone: "+85512345678",
        email: "battambang@grandcinema.com",
      },
      features: ["parking", "air_conditioning", "wifi"],
      createdBy: adminId,
    });

    // =========================
    // 4. CREATE HALL
    // =========================
    console.log("Creating Hall...");
    hall = await Hall.create({
      hall_name: "Theater 01",
      theater_id: theater._id,
      screen_type: "vip",
      features: ["dolby_atmos", "premium_seating", "air_conditioning"],
      notes: "Main premium hall with Dolby Atmos support",
      createdBy: adminId,
    });

    // =========================
    // 5. CREATE SEATS
    // =========================
    // =========================
    // 5. CREATE SEATS
    // =========================
    console.log("Creating Seats...");
    const seatRows = [
      { row: "A", type: "regular", price: 0.05, count: 10 },
      { row: "B", type: "regular", price: 0.05, count: 10 },
      { row: "C", type: "regular", price: 0.05, count: 10 },
      { row: "D", type: "vip", price: 0.1, count: 8 },
      { row: "E", type: "vip", price: 0.1, count: 8 },
      { row: "F", type: "couple", price: 0.15, count: 5 },
      { row: "G", type: "queen", price: 0.2, count: 4 },
    ];

    const seats = [];

    for (const config of seatRows) {
      for (let i = 1; i <= config.count; i++) {
        seats.push({
          hall_id: hall._id,
          row: config.row,
          seat_number: i,
          seat_type: config.type,
          price: config.price,
          status: "active",
          createdBy: adminId,
        });
      }
    }

    await Seat.insertMany(seats);
    console.log(`Created ${seats.length} seats.`);

    await Hall.updateTotalSeatsForHall(hall._id);

    // =========================
    // 6. CREATE MOVIES
    // =========================
    console.log("Creating Movies...");
    const movieDocs = await Movie.insertMany([
      {
        title: "Midnight Strike | វាយបកកណ្តាលអធ្រាត្រ",
        description: "Elite forces stop a global catastrophe in this high-octane thriller.",
        duration_minutes: 125,
        genres: ["action", "thriller"],
        director: "James Cameron",
        producers: ["Jon Landau", "James Cameron"],
        release_date: new Date("2026-04-01"),
        end_date: new Date("2026-06-30"),
        languages: ["English", "Khmer"],
        poster_url: "https://images.unsplash.com/photo-1536440136628-849c177e76a1",
        trailer_url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        rating: 8.5,
        status: "now_showing",
        createdBy: adminId,
      },
      {
        title: "Eternal Sunset | សូរ្យអស្តង្គតអមតៈ",
        description: "A romantic journey across the scenic landscapes of Europe.",
        duration_minutes: 110,
        genres: ["romance", "drama"],
        director: "Sofia Coppola",
        producers: ["Roman Coppola"],
        release_date: new Date("2026-04-15"),
        end_date: new Date("2026-06-30"),
        languages: ["English", "Khmer"],
        poster_url: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23",
        trailer_url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        rating: 7.8,
        status: "now_showing",
        createdBy: adminId,
      },
      {
        title: "Neon Frontier | ដែនដីនីអុង",
        description: "A hard-boiled detective and an AI partner team up to save the last city on Earth.",
        duration_minutes: 140,
        genres: ["sci-fi", "adventure"],
        director: "Denis Villeneuve",
        producers: ["Ridley Scott"],
        release_date: new Date("2026-04-20"),
        end_date: new Date("2026-06-30"),
        languages: ["English", "Khmer"],
        poster_url: "https://images.unsplash.com/photo-1478720568477-152d9b164e26",
        trailer_url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        rating: 9.0,
        status: "now_showing",
        createdBy: adminId,
      },
      {
        title: "The Silent Forest | ព្រៃស្ងប់ស្ងាត់",
        description: "What starts as a quiet camping trip turns into a psychological nightmare.",
        duration_minutes: 95,
        genres: ["horror", "mystery"],
        director: "Ari Aster",
        producers: ["Lars Knudsen"],
        release_date: new Date("2026-04-25"),
        end_date: new Date("2026-06-30"),
        languages: ["English", "Khmer"],
        poster_url: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e",
        trailer_url: "https://www.youtube.com/embed/dQw4w9WgXcQ",
        rating: 6.5,
        status: "now_showing",
        createdBy: adminId,
      },
    ]);

    // =========================
    // 7. CREATE SHOWTIMES
    // =========================
    console.log("Creating Showtimes...");
    const times = ["09:00", "11:30", "14:00", "16:30", "19:00"];
    const showtimes = [];

    // Seed for Today only
    for (let dayOffset of [0]) {
      const d = new Date();
      d.setDate(d.getDate() + dayOffset);
      const showDate = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));

      for (let i = 0; i < times.length; i++) {
        const movie = movieDocs[i % movieDocs.length];
        const startTime = times[i];

        // Calculate end_time manually
        const [startHours, startMinutes] = startTime.split(":").map(Number);
        const duration = movie.duration_minutes || 120;
        const totalMinutes = startHours * 60 + startMinutes + duration;
        const endHours = Math.floor(totalMinutes / 60);
        const endMinutes = totalMinutes % 60;
        const endTime = `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;

        showtimes.push({
          hall_id: hall._id,
          movie_id: movie._id,
          show_date: showDate,
          start_time: startTime,
          end_time: endTime,
          status: "scheduled",
          createdBy: adminId,
        });
      }
    }

    await Showtime.insertMany(showtimes);
    console.log(`Created ${showtimes.length} showtimes.`);

    console.log("\n=========================================");
    console.log("Presentation Seeding Completed Successfully!");
    console.log("=========================================\n");
  } catch (error) {
    console.error("Error during seeding:", error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

seedPresentationData();
