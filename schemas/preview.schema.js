const Joi = require('joi');

const createPreviewSchema = Joi.object({
  customer_id: Joi.string().required(),
  showtime_id: Joi.string().required(),
  seat_id: Joi.string().required(),
  status: Joi.string().valid('pending', 'confirmed', 'cancelled').default('pending'),
});

const updatePreviewSchema = Joi.object({
  customer_id: Joi.string(),
  showtime_id: Joi.string(),
  seat_id: Joi.string(),
  status: Joi.string().valid('pending', 'confirmed', 'cancelled'),
});

module.exports = {
  createPreviewSchema,
  updatePreviewSchema,
};


