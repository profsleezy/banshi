-- Add per-client ingest token storage for authenticated extension snapshots.
-- The raw token is only shown to the extension once. Supabase stores only a SHA-256 hash.
BEGIN;

ALTER TABLE IF EXISTS clients
  ADD COLUMN IF NOT EXISTS ingest_token_hash text;

ALTER TABLE IF EXISTS clients
  ADD COLUMN IF NOT EXISTS ingest_token_created_at timestamptz;

ALTER TABLE IF EXISTS clients
  ADD COLUMN IF NOT EXISTS ingest_token_last_used_at timestamptz;

CREATE INDEX IF NOT EXISTS clients_ingest_token_created_idx
  ON clients (ingest_token_created_at DESC);

COMMIT;
-- Note: run this in Supabase SQL editor or via psql as a DB admin.
