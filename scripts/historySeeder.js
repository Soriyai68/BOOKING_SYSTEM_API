require("dotenv").config();
const mongoose = require("mongoose");
const dayjs = require("dayjs");

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
const Customer = require("../models/customer.model");
const User = require("../models/user.model");
const { Role } = require("../data");
const connectDB = require("../config/db");

async function seedHistoryData() {
  try {
    await connectDB();
    console.log("Connected to database for history seeding...");

    // 1. Get Admin/User
    let admin = await User.findOne({ role: Role.SUPERADMIN });
    if (!admin) admin = await User.findOne({ role: Role.ADMIN });
    const adminId = admin ? admin._id : null;

    // 2. Get/Create Customer
    let customer = await Customer.findOne({ 
      $or: [
        { email: "history_tester@example.com" },
        { phone: "+85599000111" }
      ]
    });
    if (!customer) {
      customer = await Customer.create({
        name: "History Tester",
        email: "history_tester@example.com",
        phone: "+85599000111",
        customerType: "member",
        status: "active"
      });
    }

    // 3. Find Theater and Hall (assuming presentationSeeder or similar ran)
    let theater = await Theater.findOne({ name: "Grand Cinema Battambang" });
    if (!theater) {
        console.log("Theater not found, please run presentationSeeder first.");
        process.exit(1);
    }
    let hall = await Hall.findOne({ theater_id: theater._id });
    let seats = await Seat.find({ hall_id: hall._id });

    if (seats.length === 0) {
        console.log("No seats found for this hall.");
        process.exit(1);
    }

    // 4. Create Past Showtimes
    console.log("Cleaning up and Creating Past Showtimes...");
    const movies = await Movie.find({
      title: {
        $in: [
          "Midnight Strike",
          "Eternal Sunset",
          "Neon Frontier",
          "The Silent Forest",
        ],
      },
    });

    if (movies.length === 0) {
      console.log("No movies from presentationSeeder found. Please run presentationSeeder first.");
      process.exit(1);
    }
    const pastDays = [1, 2, 3]; // Last 3 days
    const times = ["09:00", "11:30", "14:00", "16:30", "19:00"];

    // Cleanup and Seed
    for (const dayAgo of pastDays) {
      // Create a date at LOCAL midnight, then extract its parts to create a UTC midnight date
      const localDate = dayjs().subtract(dayAgo, "day").startOf('day').toDate();
      const showDate = new Date(Date.UTC(localDate.getFullYear(), localDate.getMonth(), localDate.getDate()));
      
      console.log(`Processing ${dayjs(showDate).format("YYYY-MM-DD")}...`);

      // Cleanup existing showtimes for this hall/date first
      await Showtime.deleteMany({
        hall_id: hall._id,
        show_date: showDate,
      });

      for (const time of times) {
        const movie = movies[Math.floor(Math.random() * movies.length)];
        
        // Calculate end_time manually
        const [startHours, startMinutes] = time.split(":").map(Number);
        const duration = movie.duration_minutes || 120;
        const totalMinutes = startHours * 60 + startMinutes + duration;
        const endHours = Math.floor(totalMinutes / 60);
        const endMinutes = totalMinutes % 60;
        const endTime = `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;

        // Create Showtime using insertMany to bypass pre-save validation
        const [showtime] = await Showtime.insertMany([{
          hall_id: hall._id,
          movie_id: movie._id,
          show_date: showDate,
          start_time: time,
          end_time: endTime,
          status: "completed",
          createdBy: adminId,
        }]);

        // 5. Create Bookings for this showtime
        // We'll book roughly 30-70% of seats for history
        const occupancyRate = 0.3 + Math.random() * 0.4;
        const numSeatsToBook = Math.floor(seats.length * occupancyRate);
        const shuffledSeats = [...seats].sort(() => 0.5 - Math.random());
        const selectedSeats = shuffledSeats.slice(0, numSeatsToBook);

        // Group seats into small bookings (1-4 seats each)
        let currentSeatIndex = 0;
        while (currentSeatIndex < selectedSeats.length) {
            const groupSize = Math.floor(Math.random() * 4) + 1;
            const bookingSeats = selectedSeats.slice(currentSeatIndex, currentSeatIndex + groupSize);
            currentSeatIndex += groupSize;

            if (bookingSeats.length === 0) break;

            const isFailed = Math.random() < 0.1; // 10% chance of failed booking
            const status = isFailed ? "Failed" : "Completed";

            const totalPrice = bookingSeats.reduce((sum, s) => sum + s.price, 0);
            const refCode = await Booking.generateReferenceCode();

            const booking = await Booking.create({
                customerId: customer._id,
                showtimeId: showtime._id,
                total_price: totalPrice,
                payment_status: status,
                payment_method: "Bakong",
                seats: bookingSeats.map(s => s._id),
                seat_count: bookingSeats.length,
                booking_status: status,
                reference_code: refCode,
                booking_date: showDate
            });

            // Create SeatBookings (only for Completed)
            if (status === "Completed") {
                for (const seat of bookingSeats) {
                    await SeatBooking.create({
                        showtimeId: showtime._id,
                        seatId: seat._id,
                        bookingId: booking._id,
                        status: "booked"
                    });
                }
            }

            // Create Payment
            await Payment.create({
                bookingId: booking._id,
                customerId: customer._id,
                amount: totalPrice,
                payment_method: "Bakong",
                payment_date: showDate,
                status: status,
                paid: status === "Completed",
                paidAt: status === "Completed" ? showDate : null,
                transaction_id: `HIST-${booking._id.toString().slice(-6).toUpperCase()}`
            });
        }
        console.log(`  Seeded showtime ${time} with ${numSeatsToBook} seats booked.`);
      }
    }

    console.log("\n=========================================");
    console.log("History Seeding Completed Successfully!");
    console.log("=========================================\n");
  } catch (error) {
    console.error("Error during history seeding:", error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

seedHistoryData();
