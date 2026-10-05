// Structured JSON logging. Every line is one JSON object, so production logs
// can be searched by field (e.g. reqId, userId, statusCode) instead of grepping
// free-form strings. In development the output is pretty-printed instead.
const pino = require("pino");
const env = require("../config/env");

const logger = pino({
  level: env.isTest ? "silent" : env.logLevel,
  base: { service: process.env.SERVICE_NAME || "stayease-api" },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers['x-razorpay-signature']",
      "*.password",
      "*.passwordHash",
      "*.token",
    ],
    censor: "[redacted]",
  },
  ...(env.nodeEnv === "development"
    ? { transport: { target: "pino-pretty", options: { colorize: true, translateTime: "SYS:HH:MM:ss" } } }
    : {}),
});

module.exports = logger;
