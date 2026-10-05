// Raw DB queries for rooms and room occupants.
const { query, withTransaction } = require("../config/db");

// Namespace for pg_advisory_xact_lock(ns, tenantId): serialises everything
// that places a tenant into a room.
const TENANT_LOCK_NS = 1;

const statusFor = (active, capacity) =>
  active >= capacity ? "occupied" : active > 0 ? "partial" : "vacant";

async function create({ pgId, roomNumber, sharingType, rentAmount, capacity }) {
  const res = await query(
    `INSERT INTO rooms (pg_id, room_number, sharing_type, rent_amount, capacity, status)
     VALUES ($1, $2, $3, $4, $5, 'vacant')
     RETURNING *`,
    [pgId, roomNumber, sharingType, rentAmount, capacity]
  );
  return res.rows[0];
}

async function findById(id) {
  const res = await query("SELECT * FROM rooms WHERE id = $1", [id]);
  return res.rows[0] || null;
}

// Room + its PG status, used when a tenant requests a booking.
async function findByIdWithPg(id) {
  const res = await query(
    `SELECT r.*, p.status AS pg_status, p.owner_id
     FROM rooms r JOIN pgs p ON p.id = r.pg_id
     WHERE r.id = $1`,
    [id]
  );
  return res.rows[0] || null;
}

// Confirms a room belongs to a PG owned by this owner - used for authorization.
async function findByIdForOwner(roomId, ownerId) {
  const res = await query(
    `SELECT r.* FROM rooms r
     JOIN pgs p ON p.id = r.pg_id
     WHERE r.id = $1 AND p.owner_id = $2`,
    [roomId, ownerId]
  );
  return res.rows[0] || null;
}

// Public view of a PG's rooms: no occupant identities, just beds free.
async function publicRoomsForPg(pgId) {
  const res = await query(
    `SELECT r.id, r.room_number, r.sharing_type, r.rent_amount::float AS rent_amount,
            r.capacity, r.status,
            (r.capacity - COUNT(ro.id))::int AS beds_free
     FROM rooms r
     LEFT JOIN room_occupants ro ON ro.room_id = r.id AND ro.status = 'active'
     WHERE r.pg_id = $1
     GROUP BY r.id
     ORDER BY r.rent_amount ASC, r.room_number ASC`,
    [pgId]
  );
  return res.rows;
}

// Owner's room-wise board: every room with its active occupants as JSON.
async function roomWiseView(pgId) {
  const res = await query(
    `SELECT
        r.id, r.room_number, r.sharing_type, r.rent_amount::float AS rent_amount, r.capacity, r.status,
        COALESCE(
          json_agg(
            json_build_object(
              'occupantId', ro.id,
              'tenantId', u.id,
              'tenantName', u.name,
              'tenantEmail', u.email,
              'tenantPhone', u.phone,
              'moveInDate', ro.move_in_date
            ) ORDER BY ro.move_in_date
          ) FILTER (WHERE ro.id IS NOT NULL),
          '[]'
        ) AS occupants
     FROM rooms r
     LEFT JOIN room_occupants ro ON ro.room_id = r.id AND ro.status = 'active'
     LEFT JOIN users u ON u.id = ro.tenant_id
     WHERE r.pg_id = $1
     GROUP BY r.id
     ORDER BY r.room_number ASC`,
    [pgId]
  );
  return res.rows;
}

// Update a room under a row lock, so capacity can't drop below the number of
// people currently living there (and status is recomputed atomically).
async function updateTransactional(roomId, fields) {
  return withTransaction(async (client) => {
    const roomRes = await client.query("SELECT * FROM rooms WHERE id = $1 FOR UPDATE", [roomId]);
    const room = roomRes.rows[0];
    if (!room) throw Object.assign(new Error("Room not found"), { statusCode: 404, isOperational: true });

    const countRes = await client.query(
      "SELECT COUNT(*)::int AS count FROM room_occupants WHERE room_id = $1 AND status = 'active'",
      [roomId]
    );
    const active = countRes.rows[0].count;

    if (fields.capacity !== undefined && fields.capacity < active) {
      throw Object.assign(
        new Error(`${active} tenant(s) live in this room, so capacity can't be lower than ${active}`),
        { statusCode: 409, isOperational: true }
      );
    }

    const allowed = ["room_number", "sharing_type", "rent_amount", "capacity"];
    const sets = [];
    const values = [];
    let i = 1;
    for (const key of Object.keys(fields)) {
      if (!allowed.includes(key) || fields[key] === undefined) continue;
      sets.push(`${key} = $${i++}`);
      values.push(fields[key]);
    }
    const capacity = fields.capacity !== undefined ? fields.capacity : room.capacity;
    sets.push(`status = $${i++}`);
    values.push(statusFor(active, capacity));
    values.push(roomId);

    const res = await client.query(
      `UPDATE rooms SET ${sets.join(", ")} WHERE id = $${i} RETURNING *`,
      values
    );
    return res.rows[0];
  });
}

async function remove(roomId) {
  const res = await query("DELETE FROM rooms WHERE id = $1 RETURNING id", [roomId]);
  return res.rowCount > 0;
}

async function countActiveOccupants(roomId) {
  const res = await query(
    "SELECT COUNT(*)::int AS count FROM room_occupants WHERE room_id = $1 AND status = 'active'",
    [roomId]
  );
  return res.rows[0].count;
}

// Manual assignment by the owner. Uses the SAME room-row lock as booking
// confirmation, so the two paths can never over-fill a room between them.
async function assignTenantTransactional(roomId, tenantId, moveInDate) {
  return withTransaction(async (client) => {
    // Per-tenant lock first (same order as booking confirmation) - see booking.repository.js.
    await client.query("SELECT pg_advisory_xact_lock($1, $2)", [TENANT_LOCK_NS, tenantId]);

    const placedRes = await client.query(
      "SELECT 1 FROM room_occupants WHERE tenant_id = $1 AND status = 'active'",
      [tenantId]
    );
    if (placedRes.rowCount > 0) {
      throw Object.assign(new Error("This tenant is already assigned to a room"), {
        statusCode: 409,
        isOperational: true,
      });
    }

    const roomRes = await client.query("SELECT * FROM rooms WHERE id = $1 FOR UPDATE", [roomId]);
    const room = roomRes.rows[0];
    if (!room) throw Object.assign(new Error("Room not found"), { statusCode: 404, isOperational: true });

    const countRes = await client.query(
      "SELECT COUNT(*)::int AS count FROM room_occupants WHERE room_id = $1 AND status = 'active'",
      [roomId]
    );
    const active = countRes.rows[0].count;
    if (active >= room.capacity) {
      throw Object.assign(new Error("Room is already at full capacity"), {
        statusCode: 409,
        isOperational: true,
      });
    }

    const occRes = await client.query(
      `INSERT INTO room_occupants (room_id, tenant_id, move_in_date, status)
       VALUES ($1, $2, COALESCE($3::date, CURRENT_DATE), 'active')
       RETURNING *`,
      [roomId, tenantId, moveInDate || null]
    );

    // The tenant now has a room - their other pending requests are moot.
    await client.query(
      "UPDATE bookings SET status = 'cancelled' WHERE tenant_id = $1 AND status = 'pending'",
      [tenantId]
    );

    const newStatus = statusFor(active + 1, room.capacity);
    await client.query("UPDATE rooms SET status = $1 WHERE id = $2", [newStatus, roomId]);
    return { occupant: occRes.rows[0], roomStatus: newStatus };
  });
}

async function findActiveOccupancyForTenant(tenantId) {
  const res = await query(
    "SELECT * FROM room_occupants WHERE tenant_id = $1 AND status = 'active'",
    [tenantId]
  );
  return res.rows[0] || null;
}

// Vacate an occupant - scoped to the room, so an owner can only vacate people
// from rooms they own (the caller has already checked room ownership).
async function vacateOccupantTransactional(roomId, occupantId) {
  return withTransaction(async (client) => {
    const roomRes = await client.query("SELECT * FROM rooms WHERE id = $1 FOR UPDATE", [roomId]);
    const room = roomRes.rows[0];
    if (!room) return null;

    const vacRes = await client.query(
      `UPDATE room_occupants
       SET status = 'vacated', move_out_date = CURRENT_DATE
       WHERE id = $1 AND room_id = $2 AND status = 'active'
       RETURNING *`,
      [occupantId, roomId]
    );
    const vacated = vacRes.rows[0];
    if (!vacated) return null;

    const countRes = await client.query(
      "SELECT COUNT(*)::int AS count FROM room_occupants WHERE room_id = $1 AND status = 'active'",
      [roomId]
    );
    const newStatus = statusFor(countRes.rows[0].count, room.capacity);
    await client.query("UPDATE rooms SET status = $1 WHERE id = $2", [newStatus, roomId]);
    return { vacated, roomStatus: newStatus };
  });
}

module.exports = {
  TENANT_LOCK_NS,
  statusFor,
  create,
  findById,
  findByIdWithPg,
  findByIdForOwner,
  publicRoomsForPg,
  roomWiseView,
  updateTransactional,
  remove,
  countActiveOccupants,
  assignTenantTransactional,
  findActiveOccupancyForTenant,
  vacateOccupantTransactional,
};
