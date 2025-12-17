const bcrypt = require("bcryptjs");
const { v4: uuidv4 } = require("uuid");

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
  const digits = "0123456789";
  let otp = "";
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
    hasPrevPage: page > 1,
  };
};

/**
 * Creates a regex for phone number search that tolerates different formats.
 * It cleans the input and creates a pattern that allows optional non-digit characters
 * between digits, and handles optional leading plus signs.
 * @param {string} searchString The phone number search string.
 * @returns {RegExp|null} A regular expression object for searching phone numbers, or null if the search string is empty.
 */
const createPhoneRegex = (searchString) => {
  if (!searchString) return null;

  const digits = searchString.replace(/\D/g, "");

  // If no digits, fallback to normal text search
  if (!digits) {
    const escaped = searchString.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(escaped, "i");
  }

  const patterns = [];

  // Original digits
  patterns.push(digits.split("").join("\\D*"));

  // Local → international (0 → 855)
  if (digits.startsWith("0")) {
    patterns.push(("855" + digits.slice(1)).split("").join("\\D*"));
  }

  // International → local (855 → 0)
  if (digits.startsWith("855")) {
    patterns.push(("0" + digits.slice(3)).split("").join("\\D*"));
  }

  return new RegExp(`(${patterns.join("|")})`);
};

module.exports = {
  hashPassword,
  comparePassword,
  generateUUID,
  generateOTP,
  sanitizeUser,
  getPaginationMeta,
  createPhoneRegex,
};
