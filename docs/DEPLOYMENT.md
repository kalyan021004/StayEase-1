# Deploying StayEase

## What runs in production

| Piece | Type | Count | Command (same backend image) |
|---|---|---|---|
| **web** | Static site (nginx image) or any CDN/static host | 1+ | built from `frontend/` |
| **api** | Long-running web service | 2+ behind a load balancer | `node src/server.js` |
| **worker** | Long-running background service, no public port | 1 (can be more) | `node src/jobs/billGeneration.job.js` |
| **migrate** | One-off job, run on every deploy **before** the new API starts | 1 | `node src/models/migrate.js` |
| **scheduler** | One-off job, run on every deploy (after migrate) | 1 | `node src/jobs/scheduler.js` |
| **Postgres** | Managed database (RDS, Cloud SQL, Neon, Supabase...) | 1 | |
| **Redis** | Managed Redis (ElastiCache, Upstash, Redis Cloud...) | 1 | |
| **Object storage** | Private S3-compatible bucket (Cloudflare R2 recommended: no egress fees) | 1 | |

### Why the scheduler is a one-off job and not cron

BullMQ stores the repeat schedule **in Redis**. `scheduler.js` upserts it ("2:00 AM on the 1st, Asia/Kolkata") and exits. From then on Redis triggers the job on time and the **worker** runs it. Re-running the scheduler on every deploy is safe: it updates the one schedule instead of adding a second one. You don't need a separate cron service.

If your platform prefers real cron instead, delete the schedule and call `POST /api/bills/admin/generate` (admin token) from a cron trigger at 02:00 IST on the 1st. Bill generation is idempotent either way: running it twice for a month never creates duplicate bills.

### Deploy order

1. Build both images (CI does this on every PR).
2. Run **migrate**. The schema file is idempotent and holds an advisory lock, so two deploys can't migrate at the same time.
3. Run **scheduler**.
4. Roll out **api** and **worker**. Both stop gracefully on `SIGTERM`: the API finishes in-flight requests (10s max), the worker finishes its current job (30s max).

### Health checks

- `GET /health`: the process is alive (use for **liveness**).
- `GET /ready`: Postgres is reachable (use for **readiness** / load-balancer checks). Redis being down returns `cache: "degraded"` but still 200, because the API works without cache.

## Secrets and environment variables

**Never commit secrets.** `.env` is git-ignored; `.env.example` holds placeholders only.

In production, inject variables from your platform's secret store:

- **AWS ECS / Fargate:** Secrets Manager or SSM Parameter Store, referenced in the task definition `secrets` block.
- **Google Cloud Run:** Secret Manager, mounted as env vars (`--set-secrets`).
- **Kubernetes:** a `Secret` referenced with `envFrom.secretRef`, ideally synced by External Secrets Operator.
- **Render / Railway / Fly.io:** the dashboard's environment/secrets settings (`fly secrets set ...`).

All three backend processes (api, worker, scheduler) need the **same** variables. Give each one only what it uses if your platform makes that easy; the full list is in `backend/.env.example`.

Production checklist:

- [ ] `NODE_ENV=production` (JSON logs, no stack traces in responses)
- [ ] `JWT_SECRET`: 48+ random bytes, different per environment. Rotating it logs everyone out.
- [ ] `CORS_ORIGIN` = your real site origin(s), comma-separated
- [ ] `TRUST_PROXY=1` (or the number of proxies in front of the API), so rate limiting sees real client IPs
- [ ] Razorpay **live** keys; webhook created in the Razorpay dashboard pointing to `https://<your-domain>/api/payments/webhook/razorpay` with event `payment.captured`, and its secret set as `RAZORPAY_WEBHOOK_SECRET`
- [ ] S3/R2 bucket is **private** (no public read). Exports are only reachable through 5-minute signed URLs. Add a lifecycle rule deleting `owner-exports/` objects after 1 day.
- [ ] `DATABASE_URL` uses TLS if your provider requires it (`?sslmode=require`)
- [ ] Create the first admin once: `node src/models/seedAdmin.js <email> <strong-password>` as a one-off job. **Never** run `seedListings.js` in production (it creates demo accounts).

## Logs

Every API log line is one JSON object with `reqId`, `method`, `url`, `statusCode`, `responseTime`, and `userId`/`role` when logged in. The same id is returned to clients in the `X-Request-Id` header and inside error bodies as `requestId`, so a user's error screen can be matched to the exact log line. Authorization headers, passwords and tokens are redacted.

Worker and scheduler logs carry `service: "stayease-worker"` / `"stayease-scheduler"`.

## Scaling notes

- **Rate limiting** on `/auth/login` and `/auth/signup` is per API instance (in memory). With N instances an attacker gets at most N times the limit. For many instances, switch the store in `backend/src/middlewares/rateLimit.middleware.js` to Redis.
- The **search cache** lives in Redis and is cleared whenever a listing, room or occupancy changes.
- The DB pool is 10 connections per API instance (`DB_POOL_MAX`). Keep `instances x DB_POOL_MAX` under your database's connection limit.
