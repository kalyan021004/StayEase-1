const request = require("supertest");
const app = require("../src/app");
const { pool, resetDb, createUser, auth } = require("./helpers");

beforeAll(resetDb);
afterAll(() => pool.end());

describe("auth flow", () => {
  test("tenant signs up, logs in, and /me returns the profile", async () => {
    const signup = await request(app).post("/api/auth/signup").send({
      name: "Priya Sharma",
      email: "Priya@Example.in",
      password: "Strongpass1",
      phone: "9876543210",
      role: "tenant",
    });
    expect(signup.status).toBe(201);
    expect(signup.body.user).toMatchObject({ email: "priya@example.in", role: "tenant", status: "approved" });
    expect(signup.body.user).not.toHaveProperty("password_hash");

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "PRIYA@example.in", password: "Strongpass1" });
    expect(login.status).toBe(200);
    expect(login.body.token).toEqual(expect.any(String));

    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${login.body.token}`);
    expect(me.status).toBe(200);
    expect(me.body.user).toMatchObject({ name: "Priya Sharma", role: "tenant" });
  });

  test("duplicate email (any case) is rejected with 409", async () => {
    const res = await request(app).post("/api/auth/signup").send({
      name: "Someone",
      email: "PRIYA@EXAMPLE.IN",
      password: "Strongpass1",
      role: "tenant",
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already exists/i);
  });

  test("signup validation returns a readable 400", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ name: "A", email: "not-an-email", password: "123", role: "admin" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);
    expect(res.body.error).toMatch(/password/i);
  });

  test("users cannot sign themselves up as admin", async () => {
    const res = await request(app)
      .post("/api/auth/signup")
      .send({ name: "Mallory", email: "m@test.in", password: "Strongpass1", role: "admin" });
    expect(res.status).toBe(400);
  });

  test("wrong password and unknown email give the SAME message (no account enumeration)", async () => {
    const wrongPw = await request(app)
      .post("/api/auth/login")
      .send({ email: "priya@example.in", password: "nope-nope" });
    const unknown = await request(app)
      .post("/api/auth/login")
      .send({ email: "ghost@example.in", password: "nope-nope" });
    expect(wrongPw.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrongPw.body.error).toBe(unknown.body.error);
  });

  test("owner signup is pending and cannot log in until approved by admin", async () => {
    const signup = await request(app).post("/api/auth/signup").send({
      name: "Ravi Kumar",
      email: "ravi@pgowner.in",
      password: "Strongpass1",
      role: "owner",
    });
    expect(signup.status).toBe(201);
    expect(signup.body.user.status).toBe("pending");

    const blocked = await request(app).post("/api/auth/login").send({ email: "ravi@pgowner.in", password: "Strongpass1" });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error).toMatch(/approval/i);

    const admin = await createUser({ role: "admin" });
    const pending = await request(app).get("/api/auth/admin/pending-owners").set(auth(admin));
    expect(pending.status).toBe(200);
    const owner = pending.body.owners.find((o) => o.email === "ravi@pgowner.in");
    expect(owner).toBeDefined();

    const approve = await request(app).post(`/api/auth/admin/owners/${owner.id}/approve`).set(auth(admin));
    expect(approve.status).toBe(200);

    const ok = await request(app).post("/api/auth/login").send({ email: "ravi@pgowner.in", password: "Strongpass1" });
    expect(ok.status).toBe(200);
    expect(ok.body.user.role).toBe("owner");
  });

  test("missing, malformed and tampered tokens are rejected with 401", async () => {
    expect((await request(app).get("/api/auth/me")).status).toBe(401);
    expect((await request(app).get("/api/auth/me").set("Authorization", "Bearer garbage")).status).toBe(401);

    const user = await createUser();
    const [h, , s] = user.token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ id: user.id, role: "admin" })).toString("base64url");
    const forged = `${h}.${forgedPayload}.${s}`;
    const res = await request(app).get("/api/auth/admin/pending-owners").set("Authorization", `Bearer ${forged}`);
    expect(res.status).toBe(401);
  });

  test("role checks: a tenant cannot call admin or owner endpoints", async () => {
    const tenant = await createUser();
    expect((await request(app).get("/api/auth/admin/pending-owners").set(auth(tenant))).status).toBe(403);
    expect((await request(app).get("/api/pgs/mine/list").set(auth(tenant))).status).toBe(403);
    expect((await request(app).get("/api/bookings/owner/pending").set(auth(tenant))).status).toBe(403);
  });

  test("a suspended user's existing token stops working on /me", async () => {
    const user = await createUser();
    await pool.query("UPDATE users SET status = 'suspended' WHERE id = $1", [user.id]);
    const res = await request(app).get("/api/auth/me").set(auth(user));
    expect(res.status).toBe(401);
  });
});
