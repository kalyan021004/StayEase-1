// Raw DB queries for PG listings. No business rules here.
const { query } = require("../config/db");

async function create({ ownerId, name, city, address, genderType, amenities, photos }) {
  const res = await query(
    `INSERT INTO pgs (owner_id, name, city, address, gender_type, amenities, photos, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
     RETURNING *`,
    [ownerId, name, city, address, genderType, JSON.stringify(amenities || []), JSON.stringify(photos || [])]
  );
  return res.rows[0];
}

async function findById(id) {
  const res = await query("SELECT * FROM pgs WHERE id = $1", [id]);
  return res.rows[0] || null;
}

// Owner's listings with room/bed stats for the dashboard.
async function findByOwner(ownerId) {
  const res = await query(
    `SELECT p.*,
            COALESCE(rs.total_rooms, 0)::int  AS total_rooms,
            COALESCE(rs.total_beds, 0)::int   AS total_beds,
            COALESCE(occ.active, 0)::int      AS occupied_beds,
            rs.min_rent::float                AS min_rent
     FROM pgs p
     LEFT JOIN (
       SELECT pg_id, COUNT(*) AS total_rooms, SUM(capacity) AS total_beds, MIN(rent_amount) AS min_rent
       FROM rooms GROUP BY pg_id
     ) rs ON rs.pg_id = p.id
     LEFT JOIN (
       SELECT r.pg_id, COUNT(*) AS active
       FROM room_occupants ro JOIN rooms r ON r.id = ro.room_id
       WHERE ro.status = 'active' GROUP BY r.pg_id
     ) occ ON occ.pg_id = p.id
     WHERE p.owner_id = $1
     ORDER BY p.created_at DESC`,
    [ownerId]
  );
  return res.rows;
}

async function update(id, ownerId, fields) {
  // Whitelisted columns only; values are always parameterised.
  const allowed = ["name", "address", "gender_type", "amenities", "photos"];
  const sets = [];
  const values = [];
  let i = 1;

  for (const key of Object.keys(fields)) {
    if (!allowed.includes(key) || fields[key] === undefined) continue;
    sets.push(`${key} = $${i}`);
    values.push(key === "amenities" || key === "photos" ? JSON.stringify(fields[key]) : fields[key]);
    i++;
  }
  if (sets.length === 0) return findById(id);

  values.push(id, ownerId);
  const res = await query(
    `UPDATE pgs SET ${sets.join(", ")}
     WHERE id = $${i} AND owner_id = $${i + 1}
     RETURNING *`,
    values
  );
  return res.rows[0] || null;
}

async function remove(id, ownerId) {
  const res = await query("DELETE FROM pgs WHERE id = $1 AND owner_id = $2 RETURNING id", [id, ownerId]);
  return res.rowCount > 0;
}

async function countActiveOccupants(pgId) {
  const res = await query(
    `SELECT COUNT(*)::int AS count
     FROM room_occupants ro JOIN rooms r ON r.id = ro.room_id
     WHERE r.pg_id = $1 AND ro.status = 'active'`,
    [pgId]
  );
  return res.rows[0].count;
}

// Tenant-facing search. `limit` may be page size + 1 (to detect a next page);
// `offsetLimit` is the real page size used for the offset.
async function search({ city, genderType, maxRent, minRent, page = 1, limit = 12, offsetLimit }) {
  const conditions = ["p.status = 'approved'"];
  const values = [];
  let i = 1;

  if (city) {
    conditions.push(`p.city = $${i++}`);
    values.push(city);
  }
  if (genderType) {
    conditions.push(`p.gender_type = $${i++}`);
    values.push(genderType);
  }

  let having = "";
  if (minRent) {
    having += ` AND MIN(r.rent_amount) >= $${i++}`;
    values.push(minRent);
  }
  if (maxRent) {
    having += ` AND MIN(r.rent_amount) <= $${i++}`;
    values.push(maxRent);
  }

  const offset = (page - 1) * (offsetLimit || limit);
  values.push(limit, offset);

  const sql = `
    SELECT p.id, p.name, p.city, p.address, p.gender_type, p.amenities, p.photos,
           COUNT(r.id)::int                                        AS total_rooms,
           COUNT(r.id) FILTER (WHERE r.status = 'vacant')::int     AS vacant_rooms,
           COUNT(r.id) FILTER (WHERE r.status <> 'occupied')::int  AS rooms_with_space,
           MIN(r.rent_amount)::float                               AS min_rent
    FROM pgs p
    LEFT JOIN rooms r ON r.pg_id = p.id
    WHERE ${conditions.join(" AND ")}
    GROUP BY p.id
    ${having ? "HAVING TRUE" + having : ""}
    ORDER BY p.created_at DESC, p.id DESC
    LIMIT $${i} OFFSET $${i + 1}
  `;

  const res = await query(sql, values);
  return res.rows;
}

async function updateStatus(id, status) {
  const res = await query("UPDATE pgs SET status = $1 WHERE id = $2 RETURNING *", [status, id]);
  return res.rows[0] || null;
}

async function listPending() {
  const res = await query(
    `SELECT p.*, u.name AS owner_name, u.email AS owner_email, u.phone AS owner_phone,
            (SELECT COUNT(*) FROM rooms r WHERE r.pg_id = p.id)::int AS total_rooms
     FROM pgs p JOIN users u ON u.id = p.owner_id
     WHERE p.status = 'pending'
     ORDER BY p.created_at ASC`
  );
  return res.rows;
}

module.exports = {
  create,
  findById,
  findByOwner,
  update,
  remove,
  countActiveOccupants,
  search,
  updateStatus,
  listPending,
};
