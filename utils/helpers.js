const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');


const hashPassword = async (password) => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};


const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};


const generateUUID = () => {
  return uuidv4();
};


const generateOTP = (length = 6) => {
  const digits = '';
  let otp = '';
  for (let i = 0; i < length; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
};


const sanitizeUser = (user) => {
  const userObj = user.toObject ? user.toObject() : user;
  delete userObj.password;
  delete userObj.__v;
  return userObj;
};


const getPaginationMeta = (page, limit, total) => {
  const totalPages = Math.ceil(total / limit);
  return {
    currentPage: page,
    totalPages,
    totalItems: total,
    itemsPerPage: limit,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1
  };
};

module.exports = {
  hashPassword,
  comparePassword,
  generateUUID,
  generateOTP,
  sanitizeUser,
  getPaginationMeta
};