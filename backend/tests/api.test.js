// Route surface checks: paths match the documented API, inputs are validated,
// and private data stays private.
const request = require("supertest");
const app = require("../src/app");
const { pool, resetDb, createUser, createPg, createRoom, auth } = require("./helpers");

beforeAll(resetDb);
afterAll(() => pool.end());

test("room endpoints live at /api/pgs/:pgId/rooms and /api/rooms/:roomId", async () => {
  const owner = await createUser({ role: "owner" });
  const pg = await createPg(owner.id);

  const created = await request(app)
    .post(`/api/pgs/${pg.id}/rooms`)
    .set(auth(owner))
    .send({ roomNumber: "101", sharingType: "double", rentAmount: 7000, capacity: 2 });
  expect(created.status).toBe(201);

  const board = await request(app).get(`/api/pgs/${pg.id}/rooms`).set(auth(owner));
  expect(board.status).toBe(200);
  expect(board.body.rooms).toHaveLength(1);

  const roomId = created.body.room.id;
  const patched = await request(app).patch(`/api/rooms/${roomId}`).set(auth(owner)).send({ rentAmount: 7500 });
  expect(patched.status).toBe(200);
  expect(Number(patched.body.room.rent_amount)).toBe(7500);

  const dup = await request(app)
    .post(`/api/pgs/${pg.id}/rooms`)
    .set(auth(owner))
    .send({ roomNumber: "101", sharingType: "single", rentAmount: 9000, capacity: 1 });
  expect(dup.status).toBe(409);
});

test("capacity can't be reduced below current occupants", async () => {
  const owner = await createUser({ role: "owner" });
  const pg = await createPg(owner.id);
  const room = await createRoom(pg.id, { capacity: 2 });
  const t1 = await createUser();
  const t2 = await createUser();
  await request(app).post(`/api/rooms/${room.id}/assign`).set(auth(owner)).send({ tenantEmail: t1.email });
  await request(app).post(`/api/rooms/${room.id}/assign`).set(auth(owner)).send({ tenantEmail: t2.email });
  const res = await request(app).patch(`/api/rooms/${room.id}`).set(auth(owner)).send({ capacity: 1 });
  expect(res.status).toBe(409);
});

test("an owner cannot vacate a tenant from another owner's room", async () => {
  const ownerA = await createUser({ role: "owner" });
  const ownerB = await createUser({ role: "owner" });
  const roomA = await createRoom((await createPg(ownerA.id)).id, { capacity: 1 });
  const roomB = await createRoom((await createPg(ownerB.id)).id, { capacity: 1 });
  const tenant = await createUser();
  const assigned = await request(app)
    .post(`/api/rooms/${roomA.id}/assign`)
    .set(auth(ownerA))
    .send({ tenantEmail: tenant.email });
  const occupantId = assigned.body.occupant.id;

  // B uses their OWN room id with A's occupant id.
  const res = await request(app)
    .post(`/api/rooms/${roomB.id}/occupants/${occupantId}/remove`)
    .set(auth(ownerB));
  expect(res.status).toBe(404);
});

test("bills are served at /api/bills (and the old /api/billing alias)", async () => {
  const tenant = await createUser();
  expect((await request(app).get("/api/bills/mine").set(auth(tenant))).status).toBe(200);
  expect((await request(app).get("/api/billing/mine").set(auth(tenant))).status).toBe(200);
});

test("non-numeric ids return 400, not a 500", async () => {
  const tenant = await createUser();
  const res = await request(app).post("/api/bookings/abc/cancel").set(auth(tenant));
  expect(res.status).toBe(400);
  expect((await request(app).get("/api/pgs/not-a-number")).status).toBe(400);
});

test("public PG detail hides pending listings and never exposes occupants", async () => {
  const owner = await createUser({ role: "owner" });
  const pending = await createPg(owner.id, { status: "pending" });
  expect((await request(app).get(`/api/pgs/${pending.id}`)).status).toBe(404);
  expect((await request(app).get(`/api/pgs/${pending.id}`).set(auth(owner))).status).toBe(200);

  const live = await createPg(owner.id);
  const room = await createRoom(live.id, { capacity: 2 });
  const tenant = await createUser();
  await request(app).post(`/api/rooms/${room.id}/assign`).set(auth(owner)).send({ tenantEmail: tenant.email });

  const res = await request(app).get(`/api/pgs/${live.id}`);
  expect(res.status).toBe(200);
  expect(res.body.pg.rooms[0]).toMatchObject({ id: room.id, beds_free: 1 });
  expect(JSON.stringify(res.body)).not.toContain(tenant.email);
});

test("search returns approved listings with pagination info and validates filters", async () => {
  const owner = await createUser({ role: "owner" });
  const pg = await createPg(owner.id, { city: "Chennai" });
  await createRoom(pg.id, { rent: 5000 });
  const res = await request(app).get("/api/pgs/search?city=Chennai&maxRent=6000");
  expect(res.status).toBe(200);
  expect(res.body.pgs.map((p) => p.id)).toContain(pg.id);
  expect(res.body).toHaveProperty("hasMore", false);

  expect((await request(app).get("/api/pgs/search?city=Mumbai")).status).toBe(400);
  expect((await request(app).get("/api/pgs/search?minRent=9000&maxRent=1000")).status).toBe(400);
});

test("every error response carries the { error } shape and a request id", async () => {
  const res = await request(app).get("/api/does-not-exist");
  expect(res.status).toBe(404);
  expect(res.body).toHaveProperty("error");
  expect(res.headers["x-request-id"]).toEqual(expect.any(String));
});
