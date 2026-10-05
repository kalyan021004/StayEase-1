// Raw DB queries for bookings. The locking logic lives here because it is a
// database-level concern.
const { query, withTransaction } = require("../config/db");
const { TENANT_LOCK_NS, statusFor } = require("./room.repository");

async function create({ tenantId, roomId, moveInDate }) {
  const res = await query(
    `INSERT INTO bookings (tenant_id, room_id, status, move_in_date)
     VALUES ($1, $2, 'pending', $3)
     RETURNING *`,
    [tenantId, roomId, moveInDate || null]
  );
  return res.rows[0];
}

async function findById(id) {
  const res = await query("SELECT * FROM bookings WHERE id = $1", [id]);
  return res.rows[0] || null;
}

async function findByTenant(tenantId) {
  const res = await query(
    `SELECT b.*, r.room_number, r.sharing_type, r.rent_amount::float AS rent_amount,
            p.id AS pg_id, p.name AS pg_name, p.city, p.address
     FROM bookings b
     JOIN rooms r ON r.id = b.room_id
     JOIN pgs p ON p.id = r.pg_id
     WHERE b.tenant_id = $1
     ORDER BY b.created_at DESC`,
    [tenantId]
  );
  return res.rows;
}

async function findPendingForTenantRoom(tenantId, roomId) {
  const res = await query(
    "SELECT * FROM bookings WHERE tenant_id = $1 AND room_id = $2 AND status = 'pending'",
    [tenantId, roomId]
  );
  return res.rows[0] || null;
}

// All pending booking requests for rooms this owner manages.
async function findPendingForOwner(ownerId) {
  const res = await query(
    `SELECT b.*, r.room_number, r.capacity, r.sharing_type, r.rent_amount::float AS rent_amount,
            p.id AS pg_id, p.name AS pg_name,
            u.name AS tenant_name, u.email AS tenant_email, u.phone AS tenant_phone,
            (r.capacity - (SELECT COUNT(*) FROM room_occupants ro
                           WHERE ro.room_id = r.id AND ro.status = 'active'))::int AS beds_free
     FROM bookings b
     JOIN rooms r ON r.id = b.room_id
     JOIN pgs p ON p.id = r.pg_id
     JOIN users u ON u.id = b.tenant_id
     WHERE p.owner_id = $1 AND b.status = 'pending'
     ORDER BY b.created_at ASC`,
    [ownerId]
  );
  return res.rows;
}

// Confirms the booking belongs to a room owned by this owner - for authorization.
async function findByIdForOwner(bookingId, ownerId) {
  const res = await query(
    `SELECT b.* FROM bookings b
     JOIN rooms r ON r.id = b.room_id
     JOIN pgs p ON p.id = r.pg_id
     WHERE b.id = $1 AND p.owner_id = $2`,
    [bookingId, ownerId]
  );
  return res.rows[0] || null;
}

/**
 * THE CRITICAL PATH. Confirming must be atomic and safe under concurrency.
 *
 * Lock order (always the same, so no deadlocks):
 *   1. per-tenant advisory lock  -> one placement per tenant at a time
 *   2. the booking row           -> the same booking can't be confirmed twice
 *   3. the room row              -> beds are counted while nobody else can add one
 *
 * Returns { outcome: "confirmed", ... } or { outcome: "room_full" | "tenant_placed" | "not_pending" }.
 * Non-confirmed outcomes are RETURNED (not thrown) so the transaction COMMITS
 * the booking's new status. Throwing would roll it back and leave it pending.
 */
async function confirmBookingTransactional(bookingId, tenantId, roomId) {
  return withTransaction(async (client) => {
    await client.query("SELECT pg_advisory_xact_lock($1, $2)", [TENANT_LOCK_NS, tenantId]);

    const bookingRes = await client.query("SELECT * FROM bookings WHERE id = $1 FOR UPDATE", [bookingId]);
    const current = bookingRes.rows[0];
    if (!current || current.status !== "pending") {
      return { outcome: "not_pending", status: current ? current.status : null };
    }

    const roomRes = await client.query("SELECT * FROM rooms WHERE id = $1 FOR UPDATE", [roomId]);
    const room = roomRes.rows[0];
    if (!room) {
      throw Object.assign(new Error("Room not found"), { statusCode: 404, isOperational: true });
    }

    // Tenant may have been placed elsewhere (another confirmation or a manual assign).
    const placedRes = await client.query(
      "SELECT 1 FROM room_occupants WHERE tenant_id = $1 AND status = 'active'",
      [tenantId]
    );
    if (placedRes.rowCount > 0) {
      await client.query("UPDATE bookings SET status = 'cancelled' WHERE id = $1", [bookingId]);
      return { outcome: "tenant_placed" };
    }

    const countRes = await client.query(
      "SELECT COUNT(*)::int AS count FROM room_occupants WHERE room_id = $1 AND status = 'active'",
      [roomId]
    );
    const activeCount = countRes.rows[0].count;

    if (activeCount >= room.capacity) {
      await client.query("UPDATE bookings SET status = 'rejected' WHERE id = $1", [bookingId]);
      return { outcome: "room_full" };
    }

    const confirmedRes = await client.query(
      "UPDATE bookings SET status = 'confirmed' WHERE id = $1 RETURNING *",
      [bookingId]
    );
    const booking = confirmedRes.rows[0];

    const occupantRes = await client.query(
      `INSERT INTO room_occupants (room_id, tenant_id, move_in_date, status)
       VALUES ($1, $2, COALESCE($3::date, CURRENT_DATE), 'active')
       RETURNING *`,
      [roomId, tenantId, booking.move_in_date]
    );

    // This tenant now has a room: their other pending requests are cancelled.
    await client.query(
      "UPDATE bookings SET status = 'cancelled' WHERE tenant_id = $1 AND status = 'pending' AND id <> $2",
      [tenantId, bookingId]
    );

    const roomStatus = statusFor(activeCount + 1, room.capacity);
    await client.query("UPDATE rooms SET status = $1 WHERE id = $2", [roomStatus, roomId]);

    return { outcome: "confirmed", booking, occupant: occupantRes.rows[0], roomStatus };
  });
}

async function rejectBooking(bookingId) {
  const res = await query(
    "UPDATE bookings SET status = 'rejected' WHERE id = $1 AND status = 'pending' RETURNING *",
    [bookingId]
  );
  return res.rows[0] || null;
}

async function cancelBooking(bookingId, tenantId) {
  const res = await query(
    `UPDATE bookings SET status = 'cancelled'
     WHERE id = $1 AND tenant_id = $2 AND status = 'pending'
     RETURNING *`,
    [bookingId, tenantId]
  );
  return res.rows[0] || null;
}

module.exports = {
  create,
  findById,
  findByTenant,
  findPendingForTenantRoom,
  findPendingForOwner,
  findByIdForOwner,
  confirmBookingTransactional,
  rejectBooking,
  cancelBooking,
};
