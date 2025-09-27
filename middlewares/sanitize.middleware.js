// sanitize-request.js
function sanitize(obj) {
  if (typeof obj !== 'object' || obj === null) return;

  for (const key in obj) {
    // Remove keys with MongoDB operators or prototype pollution
    if (key.includes('$') || key.includes('.') || key === '__proto__') {
      delete obj[key];
    } else {
      // Recursively sanitize nested objects
      sanitize(obj[key]);
    }
  }
}

function sanitizeRequest(req, res, next) {
  sanitize(req.body);
  sanitize(req.query);
  sanitize(req.params);
  next();
}

module.exports = sanitizeRequest;
