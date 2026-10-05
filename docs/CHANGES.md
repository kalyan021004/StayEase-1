# What changed in this update

## Backend fixes (real bugs found while reading the code)

1. **Room URLs didn't match the documented API.** Room routes were mounted under `/api/rooms`, so the real paths were `/api/rooms/pgs/:pgId/rooms` and `/api/rooms/rooms/:roomId`. They now match the docs: `/api/pgs/:pgId/rooms` and `/api/rooms/:roomId`.
2. **Bills were at `/api/billing`, not `/api/bills`.** Now `/api/bills`; `/api/billing` kept as an alias.
3. **Tenants couldn't pick a room to book.** `GET /api/pgs/:id` didn't return rooms and the room list was owner-only. It now includes rooms with free beds (no tenant details).
4. **"Room full" rejection was being undone.** On confirm, the code marked the booking rejected and then threw an error, which rolled back the transaction, so the booking stayed pending forever. It now commits the rejection and then returns 409.
5. **Double-clicking Confirm could create a duplicate tenant and a 500.** The booking row is now locked and re-checked inside the transaction.
6. **One tenant confirmed into two rooms at once** ended in a database error. A per-tenant lock now serialises it; the second request gets a clear 409.
7. **Manual "assign tenant" didn't use the room lock**, so it could race with a booking confirmation and over-fill a room. It now uses the same lock.
8. **An owner could vacate tenants from another owner's room** by sending their own room id with someone else's occupant id. Vacating now checks the occupant belongs to that room.
9. **Duplicate webhook deliveries could record a payment twice** (check-then-insert race). Now a unique index plus `INSERT ... ON CONFLICT` inside a transaction. A payment whose amount doesn't match the bill no longer marks it paid.
10. **Login told attackers which emails exist** ("User Not Found" vs "Invalid password"). Both now say "Incorrect email or password".
11. **Cache invalidation silently did nothing** with the installed Redis client (v5+ returns keys in batches), so search could show stale vacancies. Fixed, and room changes now clear the search cache too.
12. **Dates shifted by a day** when the server wasn't on UTC (a 1 Nov move-in came back as 31 Oct). DATE columns are now returned as plain `YYYY-MM-DD`.
13. **Several dependencies (bullmq, razorpay, S3 SDK, exceljs, ioredis) were only in the root `package.json`**, so `npm install` inside `backend/` produced an API that crashed on startup. Moved into `backend/package.json`.
14. Non-numeric ids (e.g. `/bookings/abc/cancel`) returned 500; now 400. Database constraint errors (duplicate room number etc.) now return a readable 409 instead of 500.

## Backend hardening

- Every route has validation (body, query **and** URL params), auth and role checks.
- Env vars validated at startup with a clear list of what's missing (`backend/.env.example` lists them all).
- Rate limiting on `/auth/login` and `/auth/signup`.
- Structured JSON logs (pino) with a request id on every line, returned as `X-Request-Id` and in error bodies; secrets redacted.
- Graceful shutdown for API (closes HTTP, Redis, DB) and worker (finishes current job).
- Scheduler uses BullMQ's upsert, so running it on every deploy never duplicates the schedule; month is computed in IST.
- `GET /ready` readiness check; `GET /api/auth/admin/overview` for the admin dashboard.
- Signup requires 8+ character passwords and a valid Indian mobile number if given; emails are case-insensitive.
- 33 automated tests against real Postgres.

## Frontend

The old `frontend/` folder was removed and rebuilt from scratch (React 19 + Vite + React Router): all public, tenant, owner and admin screens, one API client file per resource, role-protected routes, loading/empty/error states everywhere, and mobile-first layouts with a bottom tab bar for logged-in users.

## Deployment

Dockerfiles for backend (one image for api/worker/scheduler/migrate) and frontend (nginx), `docker-compose.yml` for the full local stack (Postgres, Redis, MinIO, API, worker, scheduler, web), GitHub Actions CI (lint, test, build, Docker build on every PR), and `docs/DEPLOYMENT.md`.

## Removed

- `backend/notes`: old curl logs that included real JWTs.
- `backend/rutes`: an API guide describing the old, wrong URLs. Replaced by `docs/API.md`.
- Root `package.json` / lockfile: they only held the misplaced dependencies.
