const { query } = require("../config/db");

// Emails are matched case-insensitively (new signups are stored lowercase;
// LOWER() keeps older mixed-case rows working).
async function findByEmail(email) {
  const res = await query(
    `SELECT id, name, email, password_hash AS "passwordHash", phone, role, status, created_at
     FROM users WHERE LOWER(email) = LOWER($1)`,
    [email]
  );
  return res.rows[0] || null;
}

async function findById(id) {
  const res = await query(
    "SELECT id, name, email, phone, role, status, created_at FROM users WHERE id = $1",
    [id]
  );
  return res.rows[0] || null;
}

async function createUser({ name, email, passwordHash, phone, role, status }) {
  const res = await query(
    `INSERT INTO users (name, email, password_hash, phone, role, status)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, email, phone, role, status, created_at`,
    [name, email, passwordHash, phone || null, role, status]
  );
  return res.rows[0];
}

async function listPendingOwners() {
  const res = await query(
    `SELECT id, name, email, phone, created_at FROM users
     WHERE role = 'owner' AND status = 'pending'
     ORDER BY created_at ASC`
  );
  return res.rows;
}

async function updateStatus(id, status) {
  const res = await query(
    `UPDATE users SET status = $1 WHERE id = $2
     RETURNING id, name, email, role, status`,
    [status, id]
  );
  return res.rows[0] || null;
}

// Admin dashboard numbers - one round trip.
async function platformOverview() {
  const res = await query(`
    SELECT
      (SELECT COUNT(*) FROM users WHERE role = 'tenant')::int                          AS tenants,
      (SELECT COUNT(*) FROM users WHERE role = 'owner' AND status = 'approved')::int   AS owners,
      (SELECT COUNT(*) FROM users WHERE role = 'owner' AND status = 'pending')::int    AS pending_owners,
      (SELECT COUNT(*) FROM pgs WHERE status = 'approved')::int                        AS live_listings,
      (SELECT COUNT(*) FROM pgs WHERE status = 'pending')::int                         AS pending_listings,
      (SELECT COUNT(*) FROM rooms)::int                                                AS rooms,
      (SELECT COUNT(*) FROM room_occupants WHERE status = 'active')::int               AS active_tenants,
      (SELECT COUNT(*) FROM bookings WHERE status = 'pending')::int                    AS pending_bookings,
      (SELECT COALESCE(SUM(capacity), 0) FROM rooms)::int                              AS total_beds,
      (SELECT COALESCE(SUM(amount), 0) FROM bills
         WHERE status = 'paid' AND month = to_char(CURRENT_DATE, 'YYYY-MM'))::float    AS collected_this_month,
      (SELECT COALESCE(SUM(amount), 0) FROM bills
         WHERE status = 'unpaid' AND month = to_char(CURRENT_DATE, 'YYYY-MM'))::float  AS due_this_month
  `);
  const cityRes = await query(`
    SELECT city, COUNT(*)::int AS listings
    FROM pgs WHERE status = 'approved'
    GROUP BY city ORDER BY city
  `);
  return { ...res.rows[0], by_city: cityRes.rows };
}

module.exports = {
  findByEmail,
  findById,
  createUser,
  listPendingOwners,
  updateStatus,
  platformOverview,
};
