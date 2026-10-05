const { Pool, types } = require("pg");
const env = require("./env");
const logger = require("../utils/logger");

// Return DATE columns as plain 'YYYY-MM-DD' strings. By default node-pg turns
// them into JS Dates at local midnight, which shifts the day when the server's
// timezone isn't UTC (a move-in on 1 Nov became "2026-10-31T18:30Z" in IST).
types.setTypeParser(1082, (value) => value);

const pool = new Pool({
  connectionString: env.dbUrl,
  max: env.dbPoolMax,
  idleTimeoutMillis: 30000,
});

pool.on("error", (err) => {
  logger.error({ err }, "Unexpected error on idle Postgres client");
});

async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  logger.debug({ sql: text, durationMs: Date.now() - start, rows: res.rowCount }, "db query");
  return res;
}

async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { pool, query, withTransaction };
