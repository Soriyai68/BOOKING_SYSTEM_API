const Joi = require('joi');

// Admin Login Schema (for admin and superadmin)
const adminLoginSchema = Joi.object({
  username: Joi.string()
    .required()
    .messages({
      'any.required': 'Username or Email is required'
    }),
  password: Joi.string()
    .min(6)
    .required()
    .messages({
      'string.min': 'Password must be at least 6 characters long',
      'any.required': 'Password is required'
    })
});

// Refresh token schema
const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    'string.empty': 'Refresh token is required',
    'any.required': 'Refresh token is required'
  })
});

// Logout schema
const logoutSchema = Joi.object({
  sessionId: Joi.string().optional().messages({
    'string.empty': 'Session ID cannot be empty'
  })
});

// Session ID parameter schema
const sessionIdParamSchema = Joi.object({
  sessionId: Joi.string().required().messages({
    'string.empty': 'Session ID is required',
    'any.required': 'Session ID is required'
  })
});

// Change password schema
const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().min(6).optional().messages({
    'string.min': 'Current password must be at least 6 characters',
    'string.empty': 'Current password cannot be empty'
  }),
  newPassword: Joi.string().min(6).required().messages({
    'string.min': 'New password must be at least 6 characters',
    'string.empty': 'New password is required',
    'any.required': 'New password is required'
  }),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
    'any.only': 'Passwords do not match',
    'any.required': 'Password confirmation is required'
  })
});

// Reset password schema (no OTP — admin/superadmin tool)
const resetPasswordSchema = Joi.object({
  username: Joi.string()
    .required()
    .messages({
      'any.required': 'Username or email is required'
    }),
  newPassword: Joi.string().min(6).required().messages({
    'string.min': 'New password must be at least 6 characters',
    'string.empty': 'New password is required',
    'any.required': 'New password is required'
  }),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
    'any.only': 'Passwords do not match',
    'any.required': 'Password confirmation is required'
  })
});

module.exports = {
  // Admin auth
  adminLoginSchema,

  // Token management schemas
  refreshTokenSchema,
  logoutSchema,

  // Parameter schemas
  sessionIdParamSchema,

  // Password management schemas
  changePasswordSchema,
  resetPasswordSchema
};
