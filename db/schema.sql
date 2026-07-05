-- Park Management Database Schema
-- Apply to staging: CI runs this before every E2E test run.
-- When you change production schema, update this file in the same commit.

-- ── spots ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS spots (
  id            TEXT PRIMARY KEY,
  label         TEXT NOT NULL,
  state         TEXT NOT NULL DEFAULT 'free',
  reserved      BOOLEAN NOT NULL DEFAULT false,
  owned         BOOLEAN NOT NULL DEFAULT false,
  "monthlyRent" INTEGER NOT NULL DEFAULT 80,
  "rentHistory" JSONB,
  "assignedUserId" TEXT
);

ALTER TABLE spots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read spots" ON spots;
CREATE POLICY "Authenticated users can read spots" ON spots
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins and masters can modify spots" ON spots;
CREATE POLICY "Admins and masters can modify spots" ON spots
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users."authId" = auth.uid()
      AND users.role IN ('admin', 'master')
    )
  );

-- ── users ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  username        TEXT UNIQUE NOT NULL,
  "authId"        UUID,
  name            TEXT,
  "lastName"      TEXT,
  "licensePlate"  TEXT,
  phone           TEXT,
  "carModel"      TEXT,
  "carColor"      TEXT,
  address         TEXT,
  role            TEXT NOT NULL,
  active          BOOLEAN NOT NULL DEFAULT true,
  "registeredAt"  DATE,
  "terminationDate" DATE,
  "assignedSpots" JSONB,
  "pendingEdits"  JSONB,
  "passwordHash"  TEXT,
  "lastPassword"  TEXT
);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own row" ON users;
CREATE POLICY "Users can read own row" ON users
  FOR SELECT TO authenticated
  USING (
    "authId" = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u."authId" = auth.uid()
      AND u.role IN ('admin', 'master')
    )
  );

DROP POLICY IF EXISTS "Admins and masters can modify users" ON users;
CREATE POLICY "Admins and masters can modify users" ON users
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u."authId" = auth.uid()
      AND u.role IN ('admin', 'master')
    )
  );

DROP POLICY IF EXISTS "Renters can update own pendingEdits" ON users;
CREATE POLICY "Renters can update own pendingEdits" ON users
  FOR UPDATE TO authenticated
  USING ("authId" = auth.uid());

-- ── payments ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payments (
  id              TEXT PRIMARY KEY,
  "spotId"        TEXT NOT NULL,
  "userId"        TEXT NOT NULL,
  month           INTEGER NOT NULL,
  year            INTEGER NOT NULL,
  type            TEXT NOT NULL,
  "paidDate"      DATE NOT NULL,
  "markedByAdminId" TEXT NOT NULL
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read payments" ON payments;
CREATE POLICY "Authenticated users can read payments" ON payments
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins and masters can modify payments" ON payments;
CREATE POLICY "Admins and masters can modify payments" ON payments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users."authId" = auth.uid()
      AND users.role IN ('admin', 'master')
    )
  );

-- ── invites ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invites (
  id              TEXT PRIMARY KEY,
  token           TEXT UNIQUE NOT NULL,
  "spotId"        TEXT NOT NULL,
  "expiresAt"     TIMESTAMPTZ NOT NULL,
  "usedBy"        TEXT,
  name            TEXT,
  "lastName"      TEXT,
  phone           TEXT,
  address         TEXT,
  "licensePlate"  TEXT,
  "carModel"      TEXT,
  "carColor"      TEXT
);

ALTER TABLE invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read invites" ON invites;
CREATE POLICY "Authenticated users can read invites" ON invites
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins and masters can modify invites" ON invites;
CREATE POLICY "Admins and masters can modify invites" ON invites
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users."authId" = auth.uid()
      AND users.role IN ('admin', 'master')
    )
  );

-- ── pending_registrations ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pending_registrations (
  id              TEXT PRIMARY KEY,
  token           TEXT UNIQUE NOT NULL,
  "spotId"        TEXT NOT NULL,
  name            TEXT,
  "lastName"      TEXT,
  "licensePlate"  TEXT,
  phone           TEXT,
  address         TEXT,
  "carModel"      TEXT,
  "carColor"      TEXT,
  "passwordHash"  TEXT,
  "submittedAt"   TIMESTAMPTZ NOT NULL
);

-- No RLS — service role only via worker

-- ── incidents ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS incidents (
  id                  TEXT PRIMARY KEY,
  "spotId"            TEXT NOT NULL,
  "reportedByUserId"  TEXT NOT NULL,
  "observedPlate"     TEXT,
  note                TEXT,
  "imageUrl"          TEXT,
  "filePath"          TEXT,
  "reportedAt"        TIMESTAMPTZ NOT NULL
);

ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read incidents" ON incidents;
CREATE POLICY "Authenticated users can read incidents" ON incidents
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins and masters can delete incidents" ON incidents;
CREATE POLICY "Admins and masters can delete incidents" ON incidents
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users."authId" = auth.uid()
      AND users.role IN ('admin', 'master')
    )
  );
