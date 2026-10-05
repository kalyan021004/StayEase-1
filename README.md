# StayEase

A PG (paying guest) booking platform for **Bangalore, Hyderabad and Chennai**, with three kinds of user:

| Role | What they do |
|---|---|
| **Tenant** | Search PGs, request a room, track requests, pay monthly rent (Razorpay) |
| **PG owner** | List PGs, manage rooms and tenants on a room board, accept or decline requests, see and export rent |
| **Admin** | Approve owners and listings, see platform numbers, re-run billing if needed |

```
backend/    Node + Express API, billing worker, scheduler (Postgres, Redis, S3)
frontend/   React + Vite app
docs/       API reference and deployment guide
```

---

## Run it locally (about 10 minutes)

You need **one** of these:

- **Option A, Docker (easiest):** Docker Desktop (or Docker Engine + Compose v2)
- **Option B, no Docker:** Node 20+ (22 recommended), Postgres 14+, Redis 6+

### Option A: Docker

```bash
git clone <repo-url> stayease && cd stayease
docker compose up --build
```

First build takes a few minutes. When the logs settle, open **http://localhost:5173**.

That one command starts Postgres, Redis, MinIO (local S3), runs the database migration, loads demo data, and starts the API, the billing worker, the scheduler and the website.

**Demo logins** (created by the seed):

| Role | Email | Password |
|---|---|---|
| Admin | admin@stayease.in | Admin12345 |
| Owner | owner@stayease.in | Owner12345 |
| Tenant | tenant@stayease.in | Tenant12345 |

Useful local URLs: API http://localhost:5000/health, MinIO console http://localhost:9001 (stayease / stayease-secret).

**Payments:** everything works without Razorpay keys except the "Pay" button. To test payments, create free **test-mode** keys in the Razorpay dashboard and put them in a `.env` file next to `docker-compose.yml`:

```bash
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...
RAZORPAY_WEBHOOK_SECRET=...   # whatever you set when creating the webhook
```

Razorpay must be able to reach your webhook to mark bills paid. Locally, expose the API with a tunnel (for example `ngrok http 5000`) and set the webhook URL in Razorpay to `https://<tunnel>/api/payments/webhook/razorpay`, event `payment.captured`.

Reset everything: `docker compose down -v`.

### Option B: without Docker

```bash
# 1. Database and Redis must be running. Create the DB:
createdb stayease            # or: psql -c "CREATE DATABASE stayease"

# 2. Backend
cd backend
cp .env.example .env         # edit DATABASE_URL / REDIS_URL if yours differ
npm install
npm run migrate
npm run seed:admin -- admin@stayease.in Admin12345
npm run seed:listings
npm run dev                  # API on http://localhost:5000

# 3. In a second terminal: the billing worker (optional for browsing)
cd backend && npm run worker

# 4. In a third terminal: the website
cd frontend
npm install
npm run dev                  # http://localhost:5173 (proxies /api to :5000)
```

Excel export needs S3-compatible storage. The `.env.example` values point at a local MinIO on port 9000; run one with `docker run -p 9000:9000 -e MINIO_ROOT_USER=stayease -e MINIO_ROOT_PASSWORD=stayease-secret minio/minio server /data` and create a bucket named `stayease-exports`, or point the `S3_*` variables at a real R2/S3 bucket.

---

## Tests

The tests use a **real Postgres** (the booking race tests depend on real row locks).

```bash
createdb stayease_test
cd backend
TEST_DATABASE_URL=postgres://<user>:<pass>@localhost:5432/stayease_test npm test
```

What's covered (33 tests):

- **Auth:** signup, login, `/me`, owner approval flow, same error for wrong password and unknown email, forged tokens, role checks, suspended users, **rate limiting** (429)
- **Booking race conditions:** 5 confirmations for the last bed at the same time (exactly one wins, the rest are durably declined), double-click on the same booking, 2-bed room with 4 confirmations, one tenant confirmed into two rooms at once, booking confirm racing a manual assignment
- **Webhook security:** missing signature, wrong secret, tampered body, bad length, valid payment, duplicate and concurrent deliveries, wrong amount
- **API surface:** room and bill URLs, input validation (400 not 500), private data not leaked on public pages, ownership checks

Lint: `npm run lint` in `backend/` and `frontend/`.

---

## How the pieces fit

```
Browser ──► web (nginx: static React app, proxies /api) ──► api (Express)
                                                             │   │   │
                                              Postgres ◄─────┘   │   └────► S3 / R2 (Excel exports, private)
                                                                 ▼
                                                               Redis  (search cache + job queue)
                                                                 ▲
                         scheduler (one-shot per deploy) ────────┤  registers "1st of month, 2 AM IST"
                         worker (always on) ◄────────────────────┘  generates the month's bills
Razorpay ──► POST /api/payments/webhook/razorpay  (signature checked, marks bill paid)
```

- The **API**, **worker** and **scheduler** are separate processes from the same Docker image. The API never runs background jobs.
- The **webhook** is the source of truth for payments, not the browser.
- Room capacity is protected by **row locks** inside a transaction. See `backend/src/repositories/booking.repository.js`.

More detail: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) (production setup and secrets) and [docs/API.md](docs/API.md) (every endpoint).

---

## Configuration

Every variable is listed with comments in [`backend/.env.example`](backend/.env.example). The API, worker and scheduler **refuse to start** if a required variable is missing and print exactly which ones.

The frontend has one optional variable, `VITE_API_URL` (default `/api`); see `frontend/.env.example`.
