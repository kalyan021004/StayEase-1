// Cache client. If Redis is down the API keeps working, just without cache.
const { createClient } = require("redis");
const env = require("./env");
const logger = require("../utils/logger");

const redisClient = createClient({
  url: env.redisUrl,
  socket: {
    // Back off up to 5s between reconnect attempts instead of hammering Redis.
    reconnectStrategy: (retries) => Math.min(retries * 200, 5000),
  },
});

redisClient.on("error", (err) => {
  logger.warn({ err: err.message }, "Redis client error");
});

async function connectRedis() {
  if (redisClient.isOpen) return;
  try {
    await redisClient.connect();
    logger.info("Redis connected");
  } catch (err) {
    logger.warn({ err: err.message }, "Redis connection failed, continuing without cache");
  }
}

async function disconnectRedis() {
  try {
    if (redisClient.isOpen) await redisClient.quit();
  } catch (err) {
    logger.warn({ err: err.message }, "Redis quit failed");
  }
}

module.exports = { redisClient, connectRedis, disconnectRedis };
