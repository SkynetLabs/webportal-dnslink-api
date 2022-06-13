const winston = require("winston");

const ERROR_LOG_FILE = "logs/error.log";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.json(),
  defaultMeta: { service: "dnslink-api" },
  transports: [new winston.transports.File({ filename: ERROR_LOG_FILE, level: "error" })],
});

if (process.env.NODE_ENV !== "test") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(),
    })
  );
}

module.exports = logger;
