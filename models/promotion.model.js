const mongoose = require('mongoose');

const promotionSchema = new mongoose.Schema(
 {
  code: {
   type: String,
   required: true,
  },
  title: {
   type: String,
   required: false,
  },
  image_url: {
   type: String,
   trim: true,
   default: null,
  },
  start_date: {
   type: Date,
   required: true,
  },
  end_date: {
   type: Date,
   required: true,
  },
  status: {
   type: String,
   enum: ['Active', 'Inactive', 'Expired'],
   default: 'Inactive',
   required: true,
  },
 },
 {
  timestamps: true,
 }
);

const Promotion = mongoose.model('Promotions', promotionSchema);

module.exports = Promotion;
