-- StayEase schema. Idempotent: safe to run on every deploy (`npm run migrate`).

CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  name            VARCHAR(120) NOT NULL,
  email           VARCHAR(160) UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  phone           VARCHAR(20),
  role            VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'owner', 'tenant')),
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Owners start as 'pending' and need admin approval.
-- Tenants and admins are 'approved' immediately (see auth.service.js).

CREATE TABLE IF NOT EXISTS pgs (
  id              SERIAL PRIMARY KEY,
  owner_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            VARCHAR(160) NOT NULL,
  city            VARCHAR(60) NOT NULL CHECK (city IN ('Chennai', 'Hyderabad', 'Bangalore')),
  address         TEXT NOT NULL,
  gender_type     VARCHAR(20) NOT NULL CHECK (gender_type IN ('male', 'female', 'unisex')),
  amenities       JSONB DEFAULT '[]',
  photos          JSONB DEFAULT '[]',
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rooms (
  id              SERIAL PRIMARY KEY,
  pg_id           INTEGER NOT NULL REFERENCES pgs(id) ON DELETE CASCADE,
  room_number     VARCHAR(20) NOT NULL,
  sharing_type    VARCHAR(20) NOT NULL, -- single / double / triple
  rent_amount     NUMERIC(10, 2) NOT NULL,
  capacity        INTEGER NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'vacant'
                    CHECK (status IN ('vacant', 'occupied', 'partial')),
  UNIQUE (pg_id, room_number)
);

CREATE TABLE IF NOT EXISTS bookings (
  id              SERIAL PRIMARY KEY,
  tenant_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id         INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled')),
  move_in_date    DATE,
  move_out_date   DATE,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bills (
  id              SERIAL PRIMARY KEY,
  tenant_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id         INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  month           VARCHAR(7) NOT NULL, -- 'YYYY-MM'
  amount          NUMERIC(10, 2) NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid')),
  due_date        DATE,
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, room_id, month)
);

CREATE TABLE IF NOT EXISTS payments (
  id              SERIAL PRIMARY KEY,
  bill_id         INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  amount          NUMERIC(10, 2) NOT NULL,
  provider        VARCHAR(30) NOT NULL DEFAULT 'razorpay',
  provider_ref    VARCHAR(160), -- payment gateway transaction id
  paid_at         TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS room_occupants (
  id              SERIAL PRIMARY KEY,
  room_id         INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  tenant_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  move_in_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  move_out_date   DATE,
  status          VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'vacated')),
  created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pgs_city ON pgs(city);
CREATE INDEX IF NOT EXISTS idx_rooms_pg_id ON rooms(pg_id);
CREATE INDEX IF NOT EXISTS idx_bookings_tenant ON bookings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bills_tenant ON bills(tenant_id);

CREATE INDEX IF NOT EXISTS idx_room_occupants_room ON room_occupants(room_id);
CREATE INDEX IF NOT EXISTS idx_room_occupants_tenant ON room_occupants(tenant_id);

-- A tenant can only be actively assigned to one room at a time
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_tenant
  ON room_occupants(tenant_id)
  WHERE status = 'active';

-- ---------------------------------------------------------------------------
-- Hardening (v1.1). All idempotent.
-- ---------------------------------------------------------------------------

-- Emails are unique regardless of case.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_users_email_lower ON users (LOWER(email));

-- A gateway payment id can only be recorded once (webhook idempotency under
-- concurrent deliveries; used by INSERT ... ON CONFLICT (provider_ref)).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_payments_provider_ref ON payments (provider_ref);
CREATE INDEX IF NOT EXISTS idx_payments_bill ON payments (bill_id);

-- One open request per tenant per room.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_pending_booking
  ON bookings (tenant_id, room_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_bookings_room ON bookings (room_id);
CREATE INDEX IF NOT EXISTS idx_bills_room_month ON bills (room_id, month);
CREATE INDEX IF NOT EXISTS idx_pgs_owner ON pgs (owner_id);
CREATE INDEX IF NOT EXISTS idx_pgs_status_city ON pgs (status, city);
