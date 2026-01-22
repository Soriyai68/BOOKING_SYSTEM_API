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






