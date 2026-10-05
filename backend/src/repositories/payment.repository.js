const { withTransaction } = require("../config/db");

/**
 * Record a captured payment and mark its bill paid - atomically and idempotently.
 * The UNIQUE index on payments.provider_ref means two concurrent deliveries of
 * the same webhook can't both insert: the loser gets 0 rows back and we report
 * "already processed".
 */
async function recordCapturedPayment({ billId, amount, provider, providerRef }) {
  return withTransaction(async (client) => {
    const ins = await client.query(
      `INSERT INTO payments (bill_id, amount, provider, provider_ref)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (provider_ref) DO NOTHING
       RETURNING *`,
      [billId, amount, provider, providerRef]
    );
    if (ins.rowCount === 0) return { alreadyProcessed: true };

    const upd = await client.query(
      "UPDATE bills SET status = 'paid' WHERE id = $1 RETURNING *",
      [billId]
    );
    return { alreadyProcessed: false, payment: ins.rows[0], bill: upd.rows[0] };
  });
}

module.exports = { recordCapturedPayment };
