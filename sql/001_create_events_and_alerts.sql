-- Create an events table for raw PROFILE_SNAPSHOT events and add payload/event_id to alerts
BEGIN;

CREATE TABLE IF NOT EXISTS events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL,
  user_id uuid,
  type text NOT NULL,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE IF EXISTS alerts ADD COLUMN IF NOT EXISTS payload jsonb;
ALTER TABLE IF EXISTS alerts ADD COLUMN IF NOT EXISTS event_id uuid;

ALTER TABLE IF EXISTS clients ADD COLUMN IF NOT EXISTS last_checked timestamptz;

-- Prevent duplicate clients for the same user/platform/account

-- Deduplicate existing client rows: keep the earliest created row for each user/platform/account
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY user_id, platform, account_id ORDER BY created_at ASC) AS rn
  FROM clients
)
DELETE FROM clients
WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Create unique index scoped to user/platform/account
CREATE UNIQUE INDEX IF NOT EXISTS clients_user_platform_account_id_idx ON clients (user_id, platform, account_id);

-- Index to speed up lookup of snapshots per client ordered by newest
CREATE INDEX IF NOT EXISTS events_client_created_idx ON events (client_id, created_at DESC);

COMMIT;
-- Note: run this in Supabase SQL editor or via psql as a DB admin.
