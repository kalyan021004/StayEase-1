# StayEase API

Base URL: `/api`. Send `Authorization: Bearer <token>` on protected routes.
Errors always look like `{ "error": "Readable message", "requestId": "..." }` with a meaningful status:
`400` invalid input, `401` not logged in / session expired, `403` wrong role or not yours, `404` not found, `409` conflict (room full, duplicate, already processed), `429` too many attempts, `5xx` server problem.

Legend: 🔓 public, 👤 any logged-in user, 🧑 tenant, 🏠 owner, 🛡 admin

## Auth `/api/auth`

| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/signup` | 🔓 | `{name, email, password(min 8), phone?, role: tenant\|owner}`. Owners start as `pending`. Rate limited. |
| POST | `/login` | 🔓 | `{email, password}` returns `{token, user}`. Pending owner gets 403. Rate limited. |
| GET | `/me` | 👤 | Fresh profile from DB. 401 if the account was suspended/rejected. |
| GET | `/admin/pending-owners` | 🛡 | |
| GET | `/admin/overview` | 🛡 | **New.** Platform counts for the admin dashboard. |
| POST | `/admin/owners/:id/approve` | 🛡 | |
| POST | `/admin/owners/:id/reject` | 🛡 | |

## PG listings `/api/pgs`

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/search?city&genderType&minRent&maxRent&page&limit` | 🔓 | Cached in Redis. Returns `{pgs, page, limit, hasMore, cached}`. |
| GET | `/:id` | 🔓 | Approved listings only (owner/admin can also see their pending ones). **Now includes `rooms`** with `beds_free`; never occupant details. |
| POST | `/` | 🏠 | `{name, city, address, genderType, amenities?, photos?}` creates a pending listing. |
| GET | `/mine/list` | 🏠 | With `total_rooms`, `total_beds`, `occupied_beds`, `min_rent`. |
| PATCH | `/:id` | 🏠 own | `{name?, address?, genderType? (or gender_type), amenities?, photos?}` |
| DELETE | `/:id` | 🏠 own | 409 if tenants still live there. |
| GET | `/admin/pending` | 🛡 | Includes owner name/contact. |
| POST | `/admin/:id/approve` | 🛡 | |
| POST | `/admin/:id/reject` | 🛡 | |

## Rooms

| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/api/pgs/:pgId/rooms` | 🏠 own | `{roomNumber, sharingType: single\|double\|triple, rentAmount, capacity}` |
| GET | `/api/pgs/:pgId/rooms` | 🏠 own | Room board: every room with `occupants[]`. |
| PATCH | `/api/rooms/:roomId` | 🏠 own | camelCase or snake_case fields. 409 if capacity < current tenants. |
| DELETE | `/api/rooms/:roomId` | 🏠 own | 409 if occupied. |
| POST | `/api/rooms/:roomId/assign` | 🏠 own | `{tenantEmail, moveInDate?}`. Uses the same lock as booking confirmation. |
| POST | `/api/rooms/:roomId/occupants/:occupantId/remove` | 🏠 own | Occupant must belong to that room. |

## Bookings `/api/bookings`

| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/` | 🧑 | `{roomId, moveInDate?}`. 409 if already living somewhere, duplicate request, or room full. |
| GET | `/mine` | 🧑 | |
| POST | `/:id/cancel` | 🧑 | Pending only. |
| GET | `/owner/pending` | 🏠 | Includes tenant contact and `beds_free`. |
| POST | `/:id/confirm` | 🏠 own | Transactional. **409** "Room is already full..." (request is then marked declined), or "tenant already moved into another room" (request cancelled). Confirming cancels the tenant's other pending requests. |
| POST | `/:id/reject` | 🏠 own | |

## Bills `/api/bills` (old `/api/billing` still works)

| Method | Path | Who | Notes |
|---|---|---|---|
| GET | `/mine` | 🧑 | With `paid_at`, `provider_ref` when paid. |
| GET | `/owner?pgId&month` | 🏠 | `month` = `YYYY-MM`. |
| GET | `/owner/export?pgId&month` | 🏠 | `{url, rowCount, filename, expiresInSeconds: 300}`. 404 if nothing matches. |
| POST | `/admin/generate` | 🛡 | `{month?: "YYYY-MM"}`. Idempotent. |

## Payments `/api/payments`

| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/bills/:billId/order` | 🧑 own bill | `{order, keyId, billId, amount}` for Razorpay Checkout. |
| POST | `/webhook/razorpay` | Razorpay | Raw body, `X-Razorpay-Signature` HMAC checked. Handles `payment.captured`. Idempotent; amount must match the bill. |

## Ops

| GET | `/health` | liveness |
|---|---|---|
| GET | `/ready` | readiness (checks Postgres) |
