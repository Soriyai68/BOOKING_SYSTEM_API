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

//report customer booking frequency
exports.getCustomerBookingFrequency = async (req, res) => {
 try {
  const customerBookingFrequency = await reports.Booking.aggregate([
   {
    $match: {
     deletedAt: null,
     booking_status: { $in: ["Confirmed", "Completed"] }
    }
   },
   {
    $group: {
     _id: "$customerId",
     total_bookings: { $sum: 1 },
     total_spend: { $sum: "$total_price" }
    }
   },
   {
    $lookup: {
     from: "customers",
     localField: "_id",
     foreignField: "_id",
     as: "customer"
    }
   },
   {
    $unwind: {
     path: "$customer",
     preserveNullAndEmptyArrays: true
    }
   },
   {
    $project: {
     _id: 0,
     user_id: "$_id",
     customer_name: "$customer.name",
     customer_phone: "$customer.phone",
     customer_email: "$customer.email",
     total_bookings: 1,
     total_spend: 1
    }
   },
   {
    $sort: { total_bookings: -1 }
   }
  ]);

  res.status(200).json({
   success: true,
   data: customerBookingFrequency
  });
 } catch (error) {
  res.status(500).json({ message: error.message });
 }
}
