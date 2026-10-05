// BILLING WORKER - runs as its own process/service (`npm run worker`), never
// inside the API. Consumes jobs from the "billing" queue.
process.env.SERVICE_NAME = process.env.SERVICE_NAME || "stayease-worker";

const { Worker } = require("bullmq");
const { connection, BILLING_QUEUE } = require("../config/queue");
const { pool } = require("../config/db");
const billingService = require("../services/billing.service");
const logger = require("../utils/logger");

// Month in India time - a job firing at 02:00 IST on the 1st must bill the
// NEW month, but in UTC that is still the previous day.
function currentMonthIST() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit" })
    .format(new Date())
    .slice(0, 7);
}

const worker = new Worker(
  BILLING_QUEUE,
  async (job) => {
    const month = job.data.month || currentMonthIST();
    logger.info({ jobId: job.id, month }, "Generating monthly bills");
    const result = await billingService.generateMonthlyBills(month);
    logger.info({ jobId: job.id, ...result }, "Monthly bills generated");
    return result;
  },
  { connection, concurrency: 1 }
);

worker.on("failed", (job, err) => {
  logger.error({ jobId: job && job.id, err }, "Billing job failed");
});

logger.info({ queue: BILLING_QUEUE }, "Billing worker started");

async function shutdown(signal) {
  logger.info({ signal }, "Worker shutting down - finishing the current job first");
  setTimeout(() => process.exit(1), 30_000).unref();
  await worker.close();
  await connection.quit();
  await pool.end();
  process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

module.exports = { worker, currentMonthIST };
