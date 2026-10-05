// Applies schema.sql (idempotent). Run on every deploy, before the new API
// version starts taking traffic: `npm run migrate`.
const fs = require("fs");
const path = require("path");
const { pool } = require("../config/db");
const logger = require("../utils/logger");

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
  const client = await pool.connect();
  try {
    // Advisory lock so two deploys starting at once don't migrate concurrently.
    await client.query("SELECT pg_advisory_lock(424242)");
    await client.query(sql);
    logger.info("Migration complete: tables and indexes created/verified");
  } catch (err) {
    logger.error({ err }, "Migration failed");
    process.exitCode = 1;
  } finally {
    await client.query("SELECT pg_advisory_unlock(424242)").catch(() => {});
    client.release();
    await pool.end();
  }
}

if (require.main === module) migrate();

module.exports = { migrate };
