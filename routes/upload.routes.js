const express = require('express');
const router = express.Router();
const multer = require('multer');
const UploadController = require('../controllers/upload.controller');
const middlewares = require('../middlewares');
const { Role } = require('../data');

// Configure multer for memory storage (buffer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed'), false);
    }
  }
});

/**
 * @route   POST /api/upload/image
 * @desc    Upload single image to Cloudinary
 * @access  Private (Admin/SuperAdmin)
 */
router.post(
  '/image',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  upload.single('image'),
  UploadController.uploadImage
);

/**
 * @route   DELETE /api/upload/image
 * @desc    Delete image from Cloudinary
 * @access  Private (Admin/SuperAdmin)
 */
router.delete(
  '/image',
  middlewares.authenticate,
  middlewares.authorize(Role.ADMIN, Role.SUPERADMIN),
  UploadController.deleteImage
);

/**
 * @route   GET /api/upload/optimize
 * @desc    Get optimized image URL
 * @access  Public
 */
router.get('/optimize', UploadController.getOptimizedUrl);

module.exports = router;
