// The riskiest logic in the app: two people must never end up in one bed.
// These tests fire REAL concurrent requests at a real Postgres.
const request = require("supertest");
const app = require("../src/app");
const {
  pool,
  query,
  resetDb,
  createUser,
  createPg,
  createRoom,
  createPendingBooking,
  auth,
} = require("./helpers");

beforeEach(resetDb);
afterAll(() => pool.end());

const activeOccupants = async (roomId) =>
  (await query("SELECT COUNT(*)::int AS n FROM room_occupants WHERE room_id = $1 AND status = 'active'", [roomId]))
    .rows[0].n;

const confirm = (owner, bookingId) =>
  request(app).post(`/api/bookings/${bookingId}/confirm`).set(auth(owner));

test("5 confirm clicks 5 different requests for the LAST bed: exactly one wins", async () => {
  const owner = await createUser({ role: "owner" });
  const pg = await createPg(owner.id);
  const room = await createRoom(pg.id, { capacity: 1 });

  const tenants = await Promise.all([1, 2, 3, 4, 5].map(() => createUser()));
  const bookings = [];
  for (const t of tenants) {
    const res = await request(app).post("/api/bookings").set(auth(t)).send({ roomId: room.id });
    expect(res.status).toBe(201);
    bookings.push(res.body.booking);
  }

  const results = await Promise.all(bookings.map((b) => confirm(owner, b.id)));
  const statuses = results.map((r) => r.status).sort();

  expect(statuses).toEqual([200, 409, 409, 409, 409]);
  results.filter((r) => r.status === 409).forEach((r) => expect(r.body.error).toMatch(/full/i));
  expect(await activeOccupants(room.id)).toBe(1);

  const roomRow = (await query("SELECT status FROM rooms WHERE id = $1", [room.id])).rows[0];
  expect(roomRow.status).toBe("occupied");

  // Losing bookings must be durably REJECTED (not silently rolled back to pending).
  const byStatus = (await query("SELECT status, COUNT(*)::int AS n FROM bookings GROUP BY status")).rows;
  expect(Object.fromEntries(byStatus.map((r) => [r.status, r.n]))).toEqual({ confirmed: 1, rejected: 4 });
});

test("double-click: the SAME booking confirmed 5 times at once creates exactly one occupant", async () => {
  const owner = await createUser({ role: "owner" });
  const pg = await createPg(owner.id);
  const room = await createRoom(pg.id, { capacity: 3 });
  const tenant = await createUser();
  const booking = await createPendingBooking(tenant.id, room.id);

  const results = await Promise.all([1, 2, 3, 4, 5].map(() => confirm(owner, booking.id)));
  const statuses = results.map((r) => r.status).sort();

  expect(statuses).toEqual([200, 409, 409, 409, 409]);
  expect(results.some((r) => r.status >= 500)).toBe(false);
  expect(await activeOccupants(room.id)).toBe(1);
});

test("a 2-bed room with 4 concurrent confirmations fills to exactly 2", async () => {
  const owner = await createUser({ role: "owner" });
  const pg = await createPg(owner.id);
  const room = await createRoom(pg.id, { capacity: 2 });
  const tenants = await Promise.all([1, 2, 3, 4].map(() => createUser()));
  const bookings = await Promise.all(tenants.map((t) => createPendingBooking(t.id, room.id)));

  const results = await Promise.all(bookings.map((b) => confirm(owner, b.id)));
  expect(results.filter((r) => r.status === 200)).toHaveLength(2);
  expect(results.filter((r) => r.status === 409)).toHaveLength(2);
  expect(await activeOccupants(room.id)).toBe(2);
});

test("one tenant with requests in two rooms confirmed at once ends up in exactly one room", async () => {
  const owner = await createUser({ role: "owner" });
  const pg = await createPg(owner.id);
  const roomA = await createRoom(pg.id, { capacity: 2 });
  const roomB = await createRoom(pg.id, { capacity: 2 });
  const tenant = await createUser();
  const bA = await createPendingBooking(tenant.id, roomA.id);
  const bB = await createPendingBooking(tenant.id, roomB.id);

  const results = await Promise.all([confirm(owner, bA.id), confirm(owner, bB.id)]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);

  const placed = (await query("SELECT COUNT(*)::int AS n FROM room_occupants WHERE tenant_id = $1 AND status = 'active'", [tenant.id])).rows[0].n;
  expect(placed).toBe(1);
  const open = (await query("SELECT COUNT(*)::int AS n FROM bookings WHERE tenant_id = $1 AND status = 'pending'", [tenant.id])).rows[0].n;
  expect(open).toBe(0);
});

test("booking confirmation racing a manual assignment never over-fills the room", async () => {
  const owner = await createUser({ role: "owner" });
  const pg = await createPg(owner.id);
  const room = await createRoom(pg.id, { capacity: 1 });
  const viaBooking = await createUser();
  const viaAssign = await createUser();
  const booking = await createPendingBooking(viaBooking.id, room.id);

  const [c, a] = await Promise.all([
    confirm(owner, booking.id),
    request(app).post(`/api/rooms/${room.id}/assign`).set(auth(owner)).send({ tenantEmail: viaAssign.email }),
  ]);

  const succeeded = [c.status === 200, a.status === 201].filter(Boolean).length;
  expect(succeeded).toBe(1);
  expect([c.status, a.status]).toContain(409);
  expect(await activeOccupants(room.id)).toBe(1);
});

test("an owner cannot confirm a booking for someone else's PG", async () => {
  const owner = await createUser({ role: "owner" });
  const intruder = await createUser({ role: "owner" });
  const pg = await createPg(owner.id);
  const room = await createRoom(pg.id);
  const tenant = await createUser();
  const booking = await createPendingBooking(tenant.id, room.id);

  const res = await confirm(intruder, booking.id);
  expect(res.status).toBe(404);
  expect(await activeOccupants(room.id)).toBe(0);
});

test("tenant cannot request a room in a listing that isn't approved yet", async () => {
  const owner = await createUser({ role: "owner" });
  const pg = await createPg(owner.id, { status: "pending" });
  const room = await createRoom(pg.id);
  const tenant = await createUser();
  const res = await request(app).post("/api/bookings").set(auth(tenant)).send({ roomId: room.id });
  expect(res.status).toBe(404);
});
