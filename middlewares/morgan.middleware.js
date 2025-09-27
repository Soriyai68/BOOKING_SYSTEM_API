const morgan = require("morgan");
const logger = require("../utils/logger");
const { envConfig } = require("../config/env");

const stream = {
  write: (message) => logger.http(message),
};

const skip = () => {
  return envConfig.nodeEnv !== "development";
};

const morganMiddleware = morgan(
  ":remote-addr :method :url :status :res[content-length] - :response-time ms",
  { stream, skip }
);

module.exports = morganMiddleware;
