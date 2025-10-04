const Joi = require('joi');
const logger = require('../utils/logger');

const validator = (schema, source = 'body') => {
  return (req, res, next) => {
    // Determine which part of the request to validate
    let dataToValidate;
    switch (source) {
      case 'params':
        dataToValidate = req.params;
        break;
      case 'query':
        dataToValidate = req.query;
        break;
      case 'body':
      default:
        dataToValidate = req.body;
        break;
    }

    const { error } = schema.validate(dataToValidate, {
      abortEarly: false,
      stripUnknown: true
    });
    
    if (error) {
      const errorMessage = error.details.map(detail => detail.message).join(', ');
      logger.error(`Validation error in ${source}:`, errorMessage);
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
