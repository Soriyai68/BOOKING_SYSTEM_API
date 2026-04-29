require('dotenv').config();
const mongoose = require('mongoose');
const Theater = require('../models/theater.model');
const Hall = require('../models/hall.model');
const Seat = require('../models/seat.model');
const Movie = require('../models/movie.model');
const Showtime = require('../models/showtime.model');
const User = require('../models/user.model');
const Customer = require('../models/customer.model');
const { Role } = require('../data');
const connectDB = require('../config/db');

async function seedPresentationData() {
  try {
    await connectDB();
    console.log('Connected to database for presentation seeding...');

    // 1. Get an admin user for audit fields
    let admin = await User.findOne({ role: Role.SUPERADMIN });
    if (!admin) {
      admin = await User.findOne({ role: Role.ADMIN });
    }
    const adminId = admin ? admin._id : null;

    console.log('Cleaning up existing presentation data...');
    // Clear specific presentation data to avoid duplicates on re-run
    await Theater.deleteMany({ name: 'Grand Cinema Battambang' });
    const halls = await Hall.find({ hall_name: 'Theater 01' });
    const hallIds = halls.map(h => h._id);
    await Hall.deleteMany({ hall_name: 'Theater 01' });
    await Seat.deleteMany({ hall_id: { $in: hallIds } });
    await Movie.deleteMany({ title: { $in: ['Midnight Strike', 'Eternal Sunset', 'Neon Frontier', 'The Silent Forest'] } });
    await Showtime.deleteMany({ hall_id: { $in: hallIds } });

    // 2. Create One Theater in Battambang
    console.log('Creating Theater in Battambang...');
    const theater = new Theater({
      name: 'Grand Cinema Battambang',
      address: 'Street 1, Battambang City',
      city: 'Battambang',
      province: 'Battambang',
      status: 'active',
      contact_info: {
        phone: '+85512345678',
        email: 'battambang@grandcinema.com'
      },
      features: ['parking', 'air_conditioning', 'wifi'],
      createdBy: adminId
    });
    await theater.save();

    // 3. Create One Hall
    console.log('Creating Hall...');
    const hall = new Hall({
      hall_name: 'Theater 01',
      theater_id: theater._id,
      screen_type: 'vip',
      features: ['dolby_atmos', 'premium_seating', 'air_conditioning'],
      createdBy: adminId
    });
    await hall.save();

    // 4. Create Seats with different types and prices (Starting from $0.01)
    console.log('Creating Seats...');
    const seatRows = [
      { row: 'A', type: 'regular', price: 0.01, count: 10 },
      { row: 'B', type: 'regular', price: 0.01, count: 10 },
      { row: 'C', type: 'regular', price: 0.01, count: 10 },
      { row: 'D', type: 'vip', price: 0.02, count: 8 },
      { row: 'E', type: 'vip', price: 0.02, count: 8 },
      { row: 'F', type: 'couple', price: 0.05, count: 5 }, 
      { row: 'G', type: 'queen', price: 0.10, count: 4 }
    ];

    const seatPromises = [];
    for (const rowConfig of seatRows) {
      for (let i = 1; i <= rowConfig.count; i++) {
        seatPromises.push(new Seat({
          hall_id: hall._id,
          row: rowConfig.row,
          seat_number: i,
          seat_type: rowConfig.type,
          price: rowConfig.price,
          status: 'active',
          createdBy: adminId
        }).save());
      }
    }
    await Promise.all(seatPromises);
    console.log(`Created ${seatPromises.length} seats.`);

    // Update hall total seats
    await Hall.updateTotalSeatsForHall(hall._id);

    // 5. Create 4 Movies with real image logos (Posters)
    // Genres must be lowercase: "action", "adventure", "animation", "comedy", "crime", "documentary", "drama", "family", "fantasy", "horror", "mystery", "romance", "sci-fi", "thriller", "war", "western"
    console.log('Creating Movies...');
    const movies = [
      {
        title: 'Midnight Strike',
        description: 'An elite special forces unit must prevent a global catastrophe when a secret weapon is stolen.',
        duration_minutes: 125,
        genres: ['action', 'thriller'],
        director: 'James Cameron',
        release_date: new Date('2026-04-01'),
        end_date: new Date('2026-05-30'),
        languages: ['English'],
        poster_url: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&q=80&w=800', 
        rating: 8.5,
        status: 'now_showing',
        createdBy: adminId
      },
      {
        title: 'Eternal Sunset',
        description: 'Two strangers meet on a train across Europe and discover a connection that defies time.',
        duration_minutes: 110,
        genres: ['romance', 'drama'],
        director: 'Sofia Coppola',
        release_date: new Date('2026-04-15'),
        end_date: new Date('2026-05-30'),
        languages: ['English'],
        poster_url: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&q=80&w=800',
        rating: 7.8,
        status: 'now_showing',
        createdBy: adminId
      },
      {
        title: 'Neon Frontier',
        description: 'In the year 2150, a rogue AI and a cynical detective must team up to save the last city on Earth.',
        duration_minutes: 140,
        genres: ['sci-fi', 'adventure'],
        director: 'Denis Villeneuve',
        release_date: new Date('2026-04-20'),
        end_date: new Date('2026-05-30'),
        languages: ['English'],
        poster_url: 'https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&q=80&w=800',
        rating: 9.0,
        status: 'now_showing',
        createdBy: adminId
      },
      {
        title: 'The Silent Forest',
        description: 'A group of friends goes camping in a remote forest, only to find they are not alone.',
        duration_minutes: 95,
        genres: ['horror', 'mystery'],
        director: 'Ari Aster',
        release_date: new Date('2026-04-25'),
        end_date: new Date('2026-05-30'),
        languages: ['English'],
        poster_url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&q=80&w=800',
        rating: 6.5,
        status: 'now_showing',
        createdBy: adminId
      }
    ];

    const movieDocs = await Movie.insertMany(movies);
    console.log(`Created ${movieDocs.length} movies.`);

    // 6. Create Showtimes from May 1 to May 15
    console.log('Creating Showtimes...');
    const startDate = new Date('2026-05-01');
    const endDate = new Date('2026-05-15');
    const times = ['10:00', '13:30', '16:00', '19:30', '22:00'];

    const showtimePromises = [];
    // Iterate through dates from May 1 to May 15
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const currentDate = new Date(d);
      
      // Assign movies per day
      times.forEach((time, index) => {
        const movieIndex = index % movieDocs.length;
        const movie = movieDocs[movieIndex];
        
        showtimePromises.push(new Showtime({
          hall_id: hall._id,
          movie_id: movie._id,
          show_date: currentDate,
          start_time: time,
          status: 'scheduled',
          createdBy: adminId
        }).save());
      });
    }
    await Promise.all(showtimePromises);
    console.log(`Created ${showtimePromises.length} showtimes.`);

    console.log('\n=========================================');
    console.log('Presentation Seeding Completed Successfully!');
    console.log('Location: Battambang City');
    console.log('Hall: Theater 01 (VIP)');
    console.log('Price Range: $0.01 - $0.10');
    console.log('Movies: 4');
    console.log('Dates: May 01 - May 15, 2026');
    console.log('=========================================\n');
    
  } catch (error) {
    console.error('Error during presentation seeding:', error);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
}

seedPresentationData();
