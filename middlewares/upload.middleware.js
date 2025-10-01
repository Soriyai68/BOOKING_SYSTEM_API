const multer = require("multer");
const cloudinary = require("../config/cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const path = require("path");

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "booking_system",
    allowedFormats: ["jpg", "jpeg", "png"],
    public_id: (req, file) => {
      const ext = path.extname(file.originalname);
      const name = path.parse(file.originalname).name;
      return `${name}-${Date.now()}${ext}`;
    },
  },
});
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png/;
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.test(ext.replace(".", ""))) {
    cb(null, true);
  } else {
    cb(new Error("Only .jpeg, .jpg, and .png files are allowed!"), false);
  }
};
const limits = { fileSize: 5 * 1024 * 1024 }; // 5MB file size limit
const upload = multer({ storage, limits, fileFilter });

module.exports = upload;
