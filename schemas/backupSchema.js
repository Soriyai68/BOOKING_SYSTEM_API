const Joi = require('joi');

// Schema for creating a backup
const createBackupSchema = Joi.object({
  description: Joi.string()
    .min(1)
    .max(255)
    .optional()
    .allow('')
    .default('Manual backup')
    .messages({
      'string.min': 'Description must be at least 1 character long',
      'string.max': 'Description cannot exceed 255 characters'
    })
});

// Schema for restoring a backup
const restoreBackupSchema = Joi.object({
  dropDatabase: Joi.boolean()
    .optional()
    .default(false)
    .messages({
      'boolean.base': 'dropDatabase must be a boolean value'
    })
});

// Schema for configuring backup schedule
const scheduleConfigSchema = Joi.object({
  enabled: Joi.boolean()
    .required()
    .messages({
      'boolean.base': 'enabled must be a boolean value',
      'any.required': 'enabled is required'
    }),
  
  cronExpression: Joi.string()
    .required()
    .pattern(/^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/)
    .messages({
      'string.base': 'cronExpression must be a string',
      'string.pattern.base': 'cronExpression must be a valid cron expression (e.g., "0 2 * * *")',
      'any.required': 'cronExpression is required'
    }),
  
  description: Joi.string()
    .min(1)
    .max(255)
    .optional()
    .default('Scheduled backup')
    .messages({
      'string.min': 'Description must be at least 1 character long',
      'string.max': 'Description cannot exceed 255 characters'
    }),
  
  retentionDays: Joi.number()
    .integer()
    .min(1)
    .max(365)
    .optional()
    .default(7)
    .messages({
      'number.base': 'retentionDays must be a number',
      'number.integer': 'retentionDays must be an integer',
      'number.min': 'retentionDays must be at least 1 day',
      'number.max': 'retentionDays cannot exceed 365 days'
    })
});

// Schema for backup name parameter
const backupNameSchema = Joi.object({
  backupName: Joi.string()
    .required()
    .pattern(/^[a-zA-Z0-9_-]+$/)
    .messages({
      'string.base': 'backupName must be a string',
      'string.pattern.base': 'backupName can only contain letters, numbers, underscores, and hyphens',
      'any.required': 'backupName is required'
    })
});

module.exports = {
  createBackupSchema,
  restoreBackupSchema,
  scheduleConfigSchema,
  backupNameSchema
};