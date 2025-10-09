const Joi = require("joi");
const SHOWTIME_STATUSES = ["scheduled", "completed", "cancelled"];
// MongoDB ObjectId validator
const objectId = Joi.string().hex().length(24).messages({
  "string.base": "Must be a string",
  "string.hex": "Must be a valid hexadecimal",
  "string.length": "Must be 24 characters long",
});
// Pagination schema (reusable)
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
});

// Date Range schema (reusable)
const dateRangeSchema = Joi.object({
  dateFrom: Joi.date().iso().optional(),
  dateTo: Joi.date().iso().min(Joi.ref("dateFrom")).optional(),
}).messages({ "date.min": "dateTo must be on or after dateFrom" });

// Core CRUD Schemas
const createShowtimeSchema = Joi.object({
  movie_id: objectId
    .required()
    .messages({ "any.required": "Movie ID is required" }),
  hall_id: objectId
    .required()
    .messages({ "any.required": "Hall ID is required" }),
  theater_id: objectId
    .required()
    .messages({ "any.required": "Theater ID is required" }),
  start_time: Joi.date().iso().min("now").required().messages({
    "date.format": "Start time must be in ISO 8601 format",
    "any.required": "Start time is required",
    "date.min": "Start time cannot be in the past",
  }),
  end_time: Joi.date()
    .iso()
    .greater(Joi.ref("start_time"))
    .required()
    .messages({
      "date.format": "End time must be in ISO 8601 format",
      "date.greater": "End time must be after start time",
      "any.required": "End time is required",
    }),
  language: Joi.string()
    .trim()
    .optional()
    .messages({ "string.base": "Language must be a string" }),
  subtitle: Joi.string()
    .trim()
    .optional()
    .messages({ "string.base": "Subtitle must be a string" }),
  status: Joi.string()
    .valid(...SHOWTIME_STATUSES)
    .default("scheduled")
    .messages({
      "any.only": `Status must be one of: ${SHOWTIME_STATUSES.join(", ")}`,
    }),
});

const updateShowtimeSchema = Joi.object({
  movie_id: objectId,
  hall_id: objectId,
  theater_id: objectId,
  start_time: Joi.date().iso(),
  end_time: Joi.date()
    .iso()
    .when("start_time", {
      is: Joi.exist(),
      then: Joi.date().greater(Joi.ref("start_time")),
    }),
  language: Joi.string().trim(),
  subtitle: Joi.string().trim(),
  status: Joi.string().valid(...SHOWTIME_STATUSES),
})
  .min(1)
  .messages({
    "object.min": "At least one field must be provided for update",
    "date.greater": "End time must be after start time (when updating both)",
  });

// Path Parameter
const showtimeIdParamSchema = Joi.object({
  id: objectId.required(),
});

// Query schemas
const getAllShowtimesQuerySchema = paginationSchema
  .keys({
    sortBy: Joi.string()
      .trim()
      .valid("start_time", "end_time", "status", "createdAt")
      .default("start_time"),
    sortOrder: Joi.string().trim().valid("asc", "desc").default("asc"),
    searchQuery: Joi.string().trim().max(100).optional(),
    movie_id: objectId.optional(),
    hall_id: objectId.optional(),
    theater_id: objectId.optional(),
    status: Joi.string()
      .trim()
      .valid(...SHOWTIME_STATUSES)
      .optional(),
    includeDeleted: Joi.boolean().default(false),
  })
  .concat(dateRangeSchema);

// Advanced search
const advancedShowtimeSearchSchema = Joi.object({
  query: Joi.string().trim().min(1).max(100).required().messages({
    "string.empty": "Search query is required",
    "any.required": "Search query is required",
  }),
  fields: Joi.array()
    .items(Joi.string().valid("language", "subtitle", "movie_name"))
    .optional()
    .default(["movie_name"]),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string()
    .trim()
    .valid("start_time", "status", "createdAt")
    .default("start_time"),
  sortOrder: Joi.string().trim().valid("asc", "desc").default("asc"),
  exactMatch: Joi.boolean().default(false),
  caseSensitive: Joi.boolean().default(false),
  movie_id: objectId.optional(),
  hall_id: objectId.optional(),
  theater_id: objectId.optional(),
  status: Joi.string()
    .trim()
    .valid(...SHOWTIME_STATUSES)
    .optional(),
}).concat(dateRangeSchema);

// Analytics
const analyticsQuerySchema = Joi.object({
  movie_id: objectId.optional(),
  hall_id: objectId.optional(),
  theater_id: objectId.optional(),
  groupBy: Joi.string()
    .trim()
    .valid("day", "week", "month", "movie_id", "hall_id", "theater_id") // Added 'theater_id' for grouping
    .default("day"),
}).concat(dateRangeSchema);

// Batach Operations
const updateShowtimeStatusSchema = Joi.object({
  status: Joi.string()
    .valid(...SHOWTIME_STATUSES)
    .required()
    .messages({
      "any.required": "Status is required",
      "any.only": `Status must be one of: ${SHOWTIME_STATUSES.join(", ")}`,
    }),
});

const batchDeleteSchema = Joi.object({
  showtimeIds: Joi.array().items(objectId).min(1).max(100).required().messages({
    "array.min": "At least one showtime ID is required",
    "array.max": "Cannot delete more than 100 showtimes at once",
    "any.required": "Showtime IDs array is required",
  }),
  permanent: Joi.boolean().default(false),
});

const batchUpdateStatusSchema = Joi.object({
  showtimeIds: Joi.array().items(objectId).min(1).max(100).required().messages({
    "array.min": "At least one showtime ID is required",
    "array.max": "Cannot update more than 100 showtimes at once",
    "any.required": "Showtime IDs array is required",
  }),
  status: Joi.string()
    .valid(...SHOWTIME_STATUSES)
    .required(),
});

module.exports = {
  objectId,
  SHOWTIME_STATUSES,

  createShowtimeSchema,
  updateShowtimeSchema,
  showtimeIdParamSchema,
  getAllShowtimesQuerySchema,

  advancedShowtimeSearchSchema,
  updateShowtimeStatusSchema,

  batchDeleteSchema,
  batchUpdateStatusSchema,

  analyticsQuerySchema,
  paginationSchema,
};
