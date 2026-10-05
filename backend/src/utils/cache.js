const { redisClient } = require("../config/redis");
const env = require("../config/env");
const logger = require("./logger");

async function getOrSet(key, ttlSeconds, fetchFn) {
  try {
    if (redisClient.isReady) {
      const cached = await redisClient.get(key);
      if (cached) {
        return { data: JSON.parse(cached), fromCache: true };
      }
    }
  } catch (err) {
    logger.warn({ err: err.message, key }, "Cache read failed, falling back to DB");
  }

  const fresh = await fetchFn();

  try {
    if (redisClient.isReady) {
      await redisClient.set(key, JSON.stringify(fresh), {
        EX: ttlSeconds || env.cacheTtlSeconds,
      });
    }
  } catch (err) {
    logger.warn({ err: err.message, key }, "Cache write failed");
  }

  return { data: fresh, fromCache: false };
}

async function invalidateByPrefix(prefix) {
  try {
    if (!redisClient.isReady) return;
    const keys = [];
    // node-redis v5+ yields BATCHES (arrays) of keys; older versions yield single keys.
    for await (const batch of redisClient.scanIterator({ MATCH: `${prefix}*`, COUNT: 100 })) {
      if (Array.isArray(batch)) keys.push(...batch);
      else keys.push(batch);
    }
    if (keys.length > 0) await redisClient.del(keys);
  } catch (err) {
    logger.warn({ err: err.message, prefix }, "Cache invalidation failed");
  }
}

module.exports = { getOrSet, invalidateByPrefix };