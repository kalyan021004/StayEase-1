// SCHEDULER - a one-shot process (`npm run schedule`). Run it once per deploy
// (e.g. a release/pre-deploy step or a one-off container). It registers the
// repeatable "generate monthly bills" schedule in Redis and exits; BullMQ then
// enqueues the job on time and the WORKER service executes it.
// Upsert = safe to run on every deploy; it never creates duplicate schedules.
process.env.SERVICE_NAME = process.env.SERVICE_NAME || "stayease-scheduler";

const { billingQueue, connection } = require("../config/queue");
const logger = require("../utils/logger");

const SCHEDULE_ID = "monthly-bill-generation";
const CRON = process.env.BILLING_CRON || "0 2 10 * *"; // 02:00 on the 1st
const TZ = process.env.BILLING_TZ || "Asia/Kolkata";

async function main() {
  await billingQueue.upsertJobScheduler(
    SCHEDULE_ID,
    { pattern: CRON, tz: TZ },
    { name: "generate-monthly-bills", data: {}, opts: { attempts: 3, backoff: { type: "exponential", delay: 60_000 } } }
  );
  logger.info({ scheduleId: SCHEDULE_ID, cron: CRON, tz: TZ }, "Monthly billing schedule registered");
}

main()
  .then(async () => {
    await billingQueue.close();
    await connection.quit();
    process.exit(0);
  })
  .catch((err) => {
    logger.fatal({ err }, "Failed to register schedule");
    process.exit(1);
  });
