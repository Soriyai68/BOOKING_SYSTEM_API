// middlewares/errorHandler.js
function errorHandler(err, req, res, next) {
  // Handle MongoDB duplicate key error
  if (err.name === "MongoServerError" && err.code === 11000) {
    const field = Object.keys(err.keyValue)[0] || "field";
    const value = err.keyValue[field];

    return res.status(400).json({
      error: "Duplicate key error",
      message: `${field} with value "${value}" already exists`,
    });
  }

  if (err && err.isJoi) {
    const errors = {};
    err.details.forEach((detail) => {
      const field = detail.path.join(".");
      // only set the first error for each field
      if (!errors[field]) {
        errors[field] = detail.message.replace(/['"]/g, "");
      }
    });

    return res.status(400).json({
      error: "Validation error",
      details: errors,
    });
  }

  // Log the error for debugging
  console.error(`[Internal] ${err.stack || err}`);

  // Generic error response
  res.status(500).json({
    error: "Internal",
    message: "Something went wrong",
  });
}

module.exports = errorHandler;
