const request = require("supertest");
const app = require("../src/app");
const { pool, resetDb } = require("./helpers");

beforeAll(resetDb);
afterAll(() => pool.end());

test("login is rate limited per IP (brute-force protection)", async () => {
  const max = Number(process.env.AUTH_RATE_LIMIT_MAX);
  for (let i = 0; i < max; i++) {
    const res = await request(app).post("/api/auth/login").send({ email: "x@test.in", password: "wrong-pass" });
    expect(res.status).toBe(401);
  }
  const blocked = await request(app).post("/api/auth/login").send({ email: "x@test.in", password: "wrong-pass" });
  expect(blocked.status).toBe(429);
  expect(blocked.body.error).toMatch(/too many attempts/i);
  expect(blocked.headers).toHaveProperty("retry-after");
});

test("signup has its own budget, separate from login", async () => {
  const res = await request(app)
    .post("/api/auth/signup")
    .send({ name: "New Person", email: "new@test.in", password: "Strongpass1", role: "tenant" });
  expect(res.status).toBe(201);
});
