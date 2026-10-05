const fs = require("fs");
const path = require("path");
const { pool, query } = require("../src/config/db");
const { hashPassword } = require("../src/utils/password");
const { signToken } = require("../src/utils/jwt");

const schemaSql = fs.readFileSync(path.join(__dirname, "../src/models/schema.sql"), "utf-8");

async function resetDb() {
  await pool.query(schemaSql);
  await pool.query(
    "TRUNCATE payments, bills, bookings, room_occupants, rooms, pgs, users RESTART IDENTITY CASCADE"
  );
}

let counter = 0;
async function createUser({ role = "tenant", status = "approved", password = "Password123", email } = {}) {
  counter += 1;
  const addr = email || `${role}${counter}-${Date.now()}@test.in`;
  const res = await query(
    `INSERT INTO users (name, email, password_hash, role, status)
     VALUES ($1, $2, $3, $4, $5) RETURNING id, name, email, role, status`,
    [`${role} ${counter}`, addr, await hashPassword(password), role, status]
  );
  const user = res.rows[0];
  return { ...user, password, token: signToken({ id: user.id, role: user.role }) };
}

async function createPg(ownerId, { status = "approved", city = "Bangalore" } = {}) {
  const res = await query(
    `INSERT INTO pgs (owner_id, name, city, address, gender_type, status)
     VALUES ($1, 'Test PG', $2, 'Koramangala 5th Block', 'unisex', $3) RETURNING *`,
    [ownerId, city, status]
  );
  return res.rows[0];
}

async function createRoom(pgId, { capacity = 1, rent = 8000, number } = {}) {
  counter += 1;
  const res = await query(
    `INSERT INTO rooms (pg_id, room_number, sharing_type, rent_amount, capacity, status)
     VALUES ($1, $2, 'single', $3, $4, 'vacant') RETURNING *`,
    [pgId, number || `R${counter}`, rent, capacity]
  );
  return res.rows[0];
}

async function createPendingBooking(tenantId, roomId) {
  const res = await query(
    "INSERT INTO bookings (tenant_id, room_id, status) VALUES ($1, $2, 'pending') RETURNING *",
    [tenantId, roomId]
  );
  return res.rows[0];
}

const auth = (user) => ({ Authorization: `Bearer ${user.token}` });

module.exports = { pool, query, resetDb, createUser, createPg, createRoom, createPendingBooking, auth };
