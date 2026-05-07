require("dotenv").config();
const mongoose = require("mongoose");

const Theater = require("../models/theater.model");
const Hall = require("../models/hall.model");
const Seat = require("../models/seat.model");
const Movie = require("../models/movie.model");
const Showtime = require("../models/showtime.model");
const SeatBooking = require("../models/seatBooking.model");
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
    console.log("Cleaning up existing presentation data...");

    const existingTheater = await Theater.findOne({
      name: "Grand Cinema Battambang",
    });

    if (existingTheater) {
      const halls = await Hall.find({
        theater_id: existingTheater._id,
      });

      const hallIds = halls.map((h) => h._id);

      // Delete child → parent
      await SeatBooking.deleteMany({});
      await Showtime.deleteMany({ hall_id: { $in: hallIds } });
      await Seat.deleteMany({ hall_id: { $in: hallIds } });
      await Hall.deleteMany({ theater_id: existingTheater._id });
      await Theater.deleteMany({ _id: existingTheater._id });
    }

    await Movie.deleteMany({
      title: {
        $in: [
          "Midnight Strike",
          "Eternal Sunset",
          "Neon Frontier",
          "The Silent Forest",
        ],
      },
    });

    console.log("Old data cleaned.");

    // =========================
    // 3. CREATE THEATER
    // =========================
    console.log("Creating Theater...");
    const theater = await Theater.create({
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
    const hall = await Hall.create({
      hall_name: "Theater 01",
      theater_id: theater._id,
      screen_type: "vip",
      features: ["dolby_atmos", "premium_seating", "air_conditioning"],
      createdBy: adminId,
    });

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
        title: "Midnight Strike",
        description: "Elite forces stop a global catastrophe.",
        duration_minutes: 125,
        genres: ["action", "thriller"],
        director: "James Cameron",
        release_date: new Date("2026-04-01"),
        end_date: new Date("2026-05-30"),
        languages: ["English"],
        poster_url:
          "https://images.unsplash.com/photo-1536440136628-849c177e76a1",
        rating: 8.5,
        status: "now_showing",
        createdBy: adminId,
      },
      {
        title: "Eternal Sunset",
        description: "Romantic journey across Europe.",
        duration_minutes: 110,
        genres: ["romance", "drama"],
        director: "Sofia Coppola",
        release_date: new Date("2026-04-15"),
        end_date: new Date("2026-05-30"),
        languages: ["English"],
        poster_url:
          "https://images.unsplash.com/photo-1518709268805-4e9042af9f23",
        rating: 7.8,
        status: "now_showing",
        createdBy: adminId,
      },
      {
        title: "Neon Frontier",
        description: "AI + detective save last city.",
        duration_minutes: 140,
        genres: ["sci-fi", "adventure"],
        director: "Denis Villeneuve",
        release_date: new Date("2026-04-20"),
        end_date: new Date("2026-05-30"),
        languages: ["English"],
        poster_url:
          "https://images.unsplash.com/photo-1478720568477-152d9b164e26",
        rating: 9.0,
        status: "now_showing",
        createdBy: adminId,
      },
      {
        title: "The Silent Forest",
        description: "Horror camping story.",
        duration_minutes: 95,
        genres: ["horror", "mystery"],
        director: "Ari Aster",
        release_date: new Date("2026-04-25"),
        end_date: new Date("2026-05-30"),
        languages: ["English"],
        poster_url:
          "https://images.unsplash.com/photo-1441974231531-c6227db76b6e",
        rating: 6.5,
        status: "now_showing",
        createdBy: adminId,
      },
    ]);

    // =========================
    // 7. CREATE SHOWTIMES
    // =========================
    console.log("Creating Showtimes...");
    const startDate = new Date("2026-05-08");
    const endDate = new Date("2026-05-10");
    const times = ["09:00", "11:30", "14:00", "16:30", "19:00"];

    const showtimes = [];

    for (
      let d = new Date(startDate);
      d <= endDate;
      d.setDate(d.getDate() + 1)
    ) {
      for (let i = 0; i < times.length; i++) {
        const movie = movieDocs[i % movieDocs.length];

        showtimes.push({
          hall_id: hall._id,
          movie_id: movie._id,
          show_date: new Date(d),
          start_time: times[i],
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
