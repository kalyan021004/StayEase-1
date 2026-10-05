// API process entrypoint. The billing worker and scheduler are SEPARATE
// processes (see src/jobs/) and are deployed as separate services.
const app = require("./app");
const env = require("./config/env");
const logger = require("./utils/logger");
const { pool } = require("./config/db");
const { connectRedis, disconnectRedis } = require("./config/redis");

async function start() {
  await connectRedis();

  const server = app.listen(env.port, () => {
    logger.info({ port: env.port, env: env.nodeEnv }, "StayEase API listening");
  });

  // Keep-alive must outlive the load balancer's idle timeout to avoid 502s.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  let shuttingDown = false;
  async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "Shutting down gracefully");

    // Hard stop if something hangs.
    setTimeout(() => {
      logger.error("Forced shutdown after 10s timeout");
      process.exit(1);
    }, 10_000).unref();

    server.close(async () => {
      logger.info("HTTP server closed (in-flight requests finished)");
      await disconnectRedis();
      await pool.end();
      logger.info("Database pool closed");
      process.exit(0);
    });
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

process.on("unhandledRejection", (reason) => {
  logger.error({ err: reason }, "Unhandled promise rejection");
});
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception - exiting");
  process.exit(1);
});

start().catch((err) => {
  logger.fatal({ err }, "Failed to start API");
  process.exit(1);
});
