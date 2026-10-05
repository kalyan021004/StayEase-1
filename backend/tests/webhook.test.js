const crypto = require("crypto");
const request = require("supertest");
const app = require("../src/app");
const { pool, query, resetDb, createUser, createPg, createRoom } = require("./helpers");

const SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;
const sign = (body) => crypto.createHmac("sha256", SECRET).update(body).digest("hex");

let bill;

beforeEach(async () => {
  await resetDb();
  const owner = await createUser({ role: "owner" });
  const tenant = await createUser();
  const pg = await createPg(owner.id);
  const room = await createRoom(pg.id, { rent: 6500 });
  bill = (
    await query(
      `INSERT INTO bills (tenant_id, room_id, month, amount, due_date, status)
       VALUES ($1, $2, '2026-10', 6500, '2026-10-05', 'unpaid') RETURNING *`,
      [tenant.id, room.id]
    )
  ).rows[0];
});
afterAll(() => pool.end());

function capturedEvent({ paymentId = "pay_TEST123", amountPaise = 650000, billId } = {}) {
  return JSON.stringify({
    event: "payment.captured",
    payload: {
      payment: {
        entity: { id: paymentId, amount: amountPaise, currency: "INR", notes: { billId: String(billId ?? bill.id) } },
      },
    },
  });
}

const post = (body, signature) => {
  const req = request(app).post("/api/payments/webhook/razorpay").set("Content-Type", "application/json");
  if (signature !== undefined) req.set("X-Razorpay-Signature", signature);
  return req.send(body);
};

const billStatus = async () => (await query("SELECT status FROM bills WHERE id = $1", [bill.id])).rows[0].status;
const paymentCount = async () => (await query("SELECT COUNT(*)::int AS n FROM payments")).rows[0].n;

test("rejects a webhook with NO signature", async () => {
  const res = await post(capturedEvent());
  expect(res.status).toBe(400);
  expect(res.body.error).toBe("Invalid signature");
  expect(await billStatus()).toBe("unpaid");
});

test("rejects a webhook signed with the wrong secret", async () => {
  const body = capturedEvent();
  const bad = crypto.createHmac("sha256", "attacker-guess").update(body).digest("hex");
  const res = await post(body, bad);
  expect(res.status).toBe(400);
  expect(await billStatus()).toBe("unpaid");
  expect(await paymentCount()).toBe(0);
});

test("rejects a tampered body re-using a valid signature", async () => {
  const original = capturedEvent({ amountPaise: 100 });
  const signature = sign(original);
  const tampered = capturedEvent({ amountPaise: 650000 });
  const res = await post(tampered, signature);
  expect(res.status).toBe(400);
  expect(await billStatus()).toBe("unpaid");
});

test("rejects a garbage signature of a different length without crashing", async () => {
  const res = await post(capturedEvent(), "abc");
  expect(res.status).toBe(400);
});

test("accepts a correctly signed payment and marks the bill paid", async () => {
  const body = capturedEvent();
  const res = await post(body, sign(body));
  expect(res.status).toBe(200);
  expect(await billStatus()).toBe("paid");
  expect(await paymentCount()).toBe(1);
});

test("duplicate deliveries (sequential AND concurrent) record the payment once", async () => {
  const body = capturedEvent({ paymentId: "pay_DUP" });
  const sig = sign(body);
  const results = await Promise.all([post(body, sig), post(body, sig), post(body, sig)]);
  results.forEach((r) => expect(r.status).toBe(200));
  const again = await post(body, sig);
  expect(again.status).toBe(200);
  expect(await paymentCount()).toBe(1);
});

test("a signed event whose amount doesn't match the bill does NOT mark it paid", async () => {
  const body = capturedEvent({ amountPaise: 100 });
  const res = await post(body, sign(body));
  expect(res.status).toBe(200); // acknowledged so Razorpay stops retrying; logged for humans
  expect(await billStatus()).toBe("unpaid");
  expect(await paymentCount()).toBe(0);
});
