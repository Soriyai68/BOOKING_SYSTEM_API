const cloudinary = require('../config/cloudinary');

class UploadController {
  /**
   * Upload image to Cloudinary
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async uploadImage(req, res) {
    try {
      // Check if file exists
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(req.file.mimetype)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed'
        });
      }

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (req.file.size > maxSize) {
        return res.status(400).json({
          success: false,
          message: 'File size too large. Maximum size is 10MB'
        });
      }

      // Upload to Cloudinary using upload_stream
      const uploadResult = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'booking_system/movies', // Organize uploads in folders
            resource_type: 'image',
            transformation: [
              { width: 1000, height: 1500, crop: 'limit' }, // Limit max dimensions
              { quality: 'auto', fetch_format: 'auto' } // Optimize
            ]
          },
          (error, result) => {
            if (error) {
              reject(error);
            } else {
              resolve(result);
            }
          }
        );

        // Convert buffer to stream and pipe to Cloudinary
        const bufferStream = require('stream').Readable.from(req.file.buffer);
        bufferStream.pipe(uploadStream);
      });

      // Return success response
      return res.status(200).json({
        success: true,
        message: 'Image uploaded successfully',
        data: {
          url: uploadResult.secure_url,
          public_id: uploadResult.public_id,
          width: uploadResult.width,
          height: uploadResult.height,
          format: uploadResult.format,
          resource_type: uploadResult.resource_type,
          created_at: uploadResult.created_at
        }
      });
    } catch (error) {
      console.error('Upload error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to upload image',
        error: error.message
      });
    }
  }

  /**
   * Delete image from Cloudinary
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static async deleteImage(req, res) {
    try {
      const { public_id } = req.body;

      if (!public_id) {
        return res.status(400).json({
          success: false,
          message: 'Public ID is required'
        });
      }

      // Delete from Cloudinary
      const result = await cloudinary.uploader.destroy(public_id);

      if (result.result === 'ok') {
        return res.status(200).json({
          success: true,
          message: 'Image deleted successfully'
        });
      } else {
        return res.status(404).json({
          success: false,
          message: 'Image not found or already deleted'
        });
      }
    } catch (error) {
      console.error('Delete error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete image',
        error: error.message
      });
    }
  }

  /**
   * Get optimized image URL
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  static getOptimizedUrl(req, res) {
    try {
      const { public_id, width, height, crop = 'limit' } = req.query;

      if (!public_id) {
        return res.status(400).json({
          success: false,
          message: 'Public ID is required'
        });
      }

      const transformations = {
        fetch_format: 'auto',
        quality: 'auto'
      };

      if (width) transformations.width = parseInt(width);
      if (height) transformations.height = parseInt(height);
      if (crop) transformations.crop = crop;

      const optimizedUrl = cloudinary.url(public_id, transformations);

      return res.status(200).json({
        success: true,
        data: { url: optimizedUrl }
      });
    } catch (error) {
      console.error('Optimization error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate optimized URL',
        error: error.message
      });
    }
  }
}

module.exports = UploadController;
