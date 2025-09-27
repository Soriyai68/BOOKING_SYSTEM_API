const Joi = require('joi');
const logger = require('../utils/logger');

const validator = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });
    
    if (error) {
      const errorMessage = error.details.map(detail => detail.message).join(', ');
      logger.error('Validation error:', errorMessage);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }
    
    next();
  };
};

// Export the function directly
module.exports = validator;
