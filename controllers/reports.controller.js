const mongoose = require('mongoose');
const reports = require('../models')

//repost total customers
exports.getTotalCustomers = async (req, res) => {
 try {
  const totalCustomers = await reports.Customer.countDocuments();
  res.status(200).json({ totalCustomers });
 } catch (error) {

  res.status(500).json({ message: error.message });
 }
}

//report total bookings
exports.getTotalBookings = async (req, res) => {
 try {
  const totalBookings = await reports.Booking.countDocuments();
  res.status(200).json({ totalBookings });
 } catch (error) {
  res.status(500).json({ message: error.message });
 }
}

//report total revenue
exports.getTotalRevenue = async (req, res) => {
 try {
  const totalRevenue = await reports.Payment.aggregate([
   {
    $group: {
     _id: null,
      totalRevenue: { $sum: "$amount" }
    }
   }
  ]);
  res.status(200).json({ totalRevenue: totalRevenue[0].totalRevenue });
 } catch (error) {
  res.status(500).json({ message: error.message });
 }
}

//total movies
exports.getTotalMovies = async (req, res) => {
 try {
  const totalMovies = await reports.Movie.countDocuments();
  res.status(200).json({ totalMovies });
 } catch (error) {
  res.status(500).json({ message: error.message });
 }
}








