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
  show_date: Joi.date().iso().required().messages({
    "date.format": "Show date must be in ISO 8601 format",
    "any.required": "Show date is required",
  }),
  start_time: Joi.string()
    .pattern(/^([0-1]\d|2[0-3]):([0-5]\d)$/)
    .required()
    .messages({
      "string.pattern.base": "Start time must be in HH:MM format.",
      "any.required": "Start time is required.",
    }),

  end_time: Joi.string()
    .pattern(/^([0-1]\d|2[0-3]):([0-5]\d)$/)
    .optional()
    .messages({
      "string.pattern.base": "End time must be in HH:MM format.",
    }),
  status: Joi.string()
    .valid(...SHOWTIME_STATUSES)
    .default("scheduled")
    .messages({
      "any.only": `Status must be one of: ${SHOWTIME_STATUSES.join(", ")}`,
    }),
}).custom((value, helpers) => {
  if (
    value.start_time &&
    value.end_time &&
    value.end_time <= value.start_time
  ) {
    return helpers.message("End time must be after start time.");
  }
  return value;
});
// Bulk Create Showtime Schema
const createBulkShowtimeSchema = Joi.object({
  showtimes: Joi.array()
    .items(createShowtimeSchema)
    .min(1)
    .max(100)
    .required()
    .messages({
      "array.min": "At least one showtime must be provided",
      "array.max": "Cannot create more than 100 showtimes at once",
      "any.required": "Showtimes array is required",
    }),
});

const updateShowtimeSchema = Joi.object({
  movie_id: objectId,
  hall_id: objectId,
  show_date: Joi.date().iso(),
  start_time: Joi.string()
    .pattern(/^([0-1]\d|2[0-3]):([0-5]\d)$/)
    .required()
    .messages({
      "string.pattern.base": "Start time must be in HH:MM format.",
      "any.required": "Start time is required.",
    }),

  end_time: Joi.string()
    .pattern(/^([0-1]\d|2[0-3]):([0-5]\d)$/)
    .optional()
    .messages({
      "string.pattern.base": "End time must be in HH:MM format.",
    }),
  status: Joi.string().valid(...SHOWTIME_STATUSES),
})
  .min(1)
  .custom((value, helpers) => {
    if (
      value.start_time &&
      value.end_time &&
      value.end_time <= value.start_time
    ) {
      return helpers.message("End time must be after start time.");
    }
    return value;
  })
  .messages({
    "object.min": "At least one field must be provided for update",
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
    movie_id: Joi.string().trim().optional(),
    hall_id: Joi.string().trim().optional(),
    theater_id: Joi.string().trim().optional(),
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
  movie_id: Joi.string().trim().optional(),
  hall_id: Joi.string().trim().optional(),
  theater_id: Joi.string().trim().optional(),
  status: Joi.string()
    .trim()
    .valid(...SHOWTIME_STATUSES)
    .optional(),
}).concat(dateRangeSchema);

// Analytics
const analyticsQuerySchema = Joi.object({
  movie_id: Joi.string().trim().optional(),
  hall_id: Joi.string().trim().optional(),
  theater_id: Joi.string().trim().optional(),
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

const duplicateBulkShowtimeSchema = Joi.object({
  sourceShowtimeIds: Joi.array().items(objectId).min(1).max(100).required().messages({
    "array.min": "At least one source showtime ID is required",
    "array.max": "Cannot duplicate more than 100 showtimes at once",
    "any.required": "sourceShowtimeIds array is required",
  }),
  newShowDate: Joi.date().iso().required().messages({
    "date.format": "newShowDate must be in ISO 8601 format",
    "any.required": "newShowDate is required",
  }),
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
  createBulkShowtimeSchema,
  updateShowtimeSchema,
  showtimeIdParamSchema,
  getAllShowtimesQuerySchema,

  advancedShowtimeSearchSchema,
  updateShowtimeStatusSchema,

  batchDeleteSchema,
  batchUpdateStatusSchema,

  analyticsQuerySchema,
  paginationSchema,
  duplicateBulkShowtimeSchema,
};
