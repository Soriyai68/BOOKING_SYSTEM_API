const Joi = require("joi");

// Send OTP Schema
const sendOTPSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required()
    .messages({
      "string.pattern.base": "Please enter a valid phone number",
      "any.required": "Phone number is required",
    }),
});

// Verify OTP Schema (for registration/login)
const verifyOTPSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required()
    .messages({
      "string.pattern.base": "Please enter a valid phone number",
      "any.required": "Phone number is required",
    }),
  otp: Joi.string()
    .length(6)
    .pattern(/^[0-9]+$/)
    .required()
    .messages({
      "string.length": "OTP must be 6 digits",
      "string.pattern.base": "OTP must contain only numbers",
      "any.required": "OTP is required",
    }),
  name: Joi.string().min(2).max(50).optional().messages({
    "string.min": "Name must be at least 2 characters",
    "string.max": "Name cannot exceed 50 characters",
  }),
});

// Customer Login Schema (phone + password)
const loginSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required()
    .messages({
      "string.pattern.base": "Please enter a valid phone number",
      "any.required": "Phone number is required",
    }),
  password: Joi.string().min(6).required().messages({
    "string.min": "Password must be at least 6 characters long",
    "any.required": "Password is required",
  }),
});

// Telegram Login Schema (Standard Widget - Flat Body)
const telegramLoginSchema = Joi.object({
  id: Joi.number().required().messages({
    "any.required": "Telegram ID is required",
    "number.base": "Telegram ID must be a number",
  }),
  first_name: Joi.string().optional().allow("").messages({
    "string.empty": "First name cannot be empty",
  }),
  last_name: Joi.string().optional().allow("").messages({
    "string.empty": "Last name cannot be empty",
  }),
  username: Joi.string().optional().allow("").messages({
    "string.empty": "Username cannot be empty",
  }),
  photo_url: Joi.string().uri().optional().allow("").messages({
    "string.uri": "Photo URL must be a valid URI",
    "string.empty": "Photo URL cannot be empty",
  }),
  auth_date: Joi.number().required().messages({
    "any.required": "Auth date is required",
    "number.base": "Auth date must be a number",
  }),
  hash: Joi.string().required().messages({
    "any.required": "Hash is required",
    "string.empty": "Hash cannot be empty",
  }),
});

// Telegram Mini App Login Schema
const telegramWebAppLoginSchema = Joi.object({
  initData: Joi.string().required().messages({
    "any.required": "initData is required",
    "string.empty": "initData cannot be empty",
  }),
  phone_number: Joi.string().optional().allow("").messages({
    "string.empty": "Phone number cannot be empty",
  }),
});

// Refresh token schema
const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    "string.empty": "Refresh token is required",
    "any.required": "Refresh token is required",
  }),
});

// Logout schema
const logoutSchema = Joi.object({
  sessionId: Joi.string().optional().messages({
    "string.empty": "Session ID cannot be empty",
  }),
});

// Session ID parameter schema
const sessionIdParamSchema = Joi.object({
  sessionId: Joi.string().required().messages({
    "string.empty": "Session ID is required",
    "any.required": "Session ID is required",
  }),
});

// Change password schema
const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().min(6).optional().messages({
    "string.min": "Current password must be at least 6 characters",
    "string.empty": "Current password cannot be empty",
  }),
  newPassword: Joi.string().min(6).required().messages({
    "string.min": "New password must be at least 6 characters",
    "string.empty": "New password is required",
    "any.required": "New password is required",
  }),
  confirmPassword: Joi.string()
    .valid(Joi.ref("newPassword"))
    .required()
    .messages({
      "any.only": "Passwords do not match",
      "any.required": "Password confirmation is required",
    }),
});

// Send reset OTP schema
const sendResetOTPSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required()
    .messages({
      "string.pattern.base": "Please enter a valid phone number",
      "any.required": "Phone number is required",
    }),
});

// Reset password schema
const resetPasswordSchema = Joi.object({
  phone: Joi.string()
    .pattern(/^\+?[1-9]\d{1,14}$/)
    .required()
    .messages({
      "string.pattern.base": "Please enter a valid phone number",
      "any.required": "Phone number is required",
    }),
  otp: Joi.string()
    .length(6)
    .pattern(/^[0-9]+$/)
    .required()
    .messages({
      "string.length": "OTP must be 6 digits",
      "string.pattern.base": "OTP must contain only numbers",
      "any.required": "OTP is required",
    }),
  newPassword: Joi.string().min(6).required().messages({
    "string.min": "New password must be at least 6 characters",
    "string.empty": "New password is required",
    "any.required": "New password is required",
  }),
  confirmPassword: Joi.string()
    .valid(Joi.ref("newPassword"))
    .required()
    .messages({
      "any.only": "Passwords do not match",
      "any.required": "Password confirmation is required",
    }),
});

module.exports = {
  sendOTPSchema,
  verifyOTPSchema,
  loginSchema,
  telegramLoginSchema,
  telegramWebAppLoginSchema,
  refreshTokenSchema,
  logoutSchema,
  sessionIdParamSchema,
  changePasswordSchema,
  sendResetOTPSchema,
  resetPasswordSchema,
};
