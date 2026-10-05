// BullMQ needs its own Redis connection (separate from the cache client).
// Only the worker and scheduler processes import this file - the API never does.
const { Queue } = require("bullmq");
const IORedis = require("ioredis");
const env = require("./env");

const connection = new IORedis(env.queueRedisUrl, {
  maxRetriesPerRequest: null, // required by BullMQ
});

const BILLING_QUEUE = "billing";
const billingQueue = new Queue(BILLING_QUEUE, { connection });

module.exports = { connection, billingQueue, BILLING_QUEUE };
