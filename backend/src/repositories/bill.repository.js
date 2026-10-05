// Raw DB queries for bills.
const { query } = require("../config/db");

async function createBill({ tenantId, roomId, month, amount, dueDate }) {
  // ON CONFLICT: re-running generation for the same month is a no-op, not a
  // duplicate bill (UNIQUE (tenant_id, room_id, month) in the schema).
  const res = await query(
    `INSERT INTO bills (tenant_id, room_id, month, amount, due_date, status)
     VALUES ($1, $2, $3, $4, $5, 'unpaid')
     ON CONFLICT (tenant_id, room_id, month) DO NOTHING
     RETURNING *`,
    [tenantId, roomId, month, amount, dueDate]
  );
  return res.rows[0] || null; // null = already existed
}

// Every currently active occupant with their room's rent.
async function getActiveOccupantsWithRent() {
  const res = await query(
    `SELECT ro.tenant_id, ro.room_id, r.rent_amount
     FROM room_occupants ro
     JOIN rooms r ON r.id = ro.room_id
     WHERE ro.status = 'active'`
  );
  return res.rows;
}

async function findById(id) {
  const res = await query("SELECT * FROM bills WHERE id = $1", [id]);
  return res.rows[0] || null;
}

async function findByTenant(tenantId) {
  const res = await query(
    `SELECT b.id, b.tenant_id, b.room_id, b.month, b.amount::float AS amount, b.status,
            b.due_date, b.created_at,
            r.room_number, p.name AS pg_name, p.city,
            pay.paid_at, pay.provider_ref
     FROM bills b
     JOIN rooms r ON r.id = b.room_id
     JOIN pgs p ON p.id = r.pg_id
     LEFT JOIN LATERAL (
       SELECT paid_at, provider_ref FROM payments WHERE bill_id = b.id ORDER BY paid_at DESC LIMIT 1
     ) pay ON TRUE
     WHERE b.tenant_id = $1
     ORDER BY b.month DESC, b.id DESC`,
    [tenantId]
  );
  return res.rows;
}

// Every bill (any status) for rooms this owner manages - also feeds the Excel export.
async function findForOwner(ownerId, { pgId, month } = {}) {
  const conditions = ["p.owner_id = $1"];
  const values = [ownerId];
  let i = 2;

  if (pgId) {
    conditions.push(`p.id = $${i++}`);
    values.push(pgId);
  }
  if (month) {
    conditions.push(`b.month = $${i++}`);
    values.push(month);
  }

  const res = await query(
    `SELECT b.id, b.month, b.amount::float AS amount, b.status, b.due_date,
            r.room_number, p.id AS pg_id, p.name AS pg_name,
            u.name AS tenant_name, u.email AS tenant_email, u.phone AS tenant_phone,
            pay.paid_at, pay.provider_ref
     FROM bills b
     JOIN rooms r ON r.id = b.room_id
     JOIN pgs p ON p.id = r.pg_id
     JOIN users u ON u.id = b.tenant_id
     LEFT JOIN LATERAL (
       SELECT paid_at, provider_ref FROM payments WHERE bill_id = b.id ORDER BY paid_at DESC LIMIT 1
     ) pay ON TRUE
     WHERE ${conditions.join(" AND ")}
     ORDER BY p.name ASC, r.room_number ASC, b.month DESC`,
    values
  );
  return res.rows;
}

module.exports = {
  createBill,
  getActiveOccupantsWithRent,
  findById,
  findByTenant,
  findForOwner,
};
