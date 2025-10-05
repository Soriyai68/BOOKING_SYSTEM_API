const { v2: cloudinary } = require('cloudinary');
const dotenv = require('dotenv');

dotenv.config();

// Configure Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dwjrl0q37',
  api_key: process.env.CLOUDINARY_API_KEY || '624538951863282',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'RQr6BdZG6tyb3E0_XEyGUG6UvMs',
  secure: true
});

module.exports = cloudinary;
