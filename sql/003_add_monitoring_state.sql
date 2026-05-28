-- Add explicit monitoring state and a fast latest-snapshot lookup.
BEGIN;

ALTER TABLE IF EXISTS clients
  ADD COLUMN IF NOT EXISTS monitoring_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE IF EXISTS clients
  ADD COLUMN IF NOT EXISTS monitoring_updated_at timestamptz DEFAULT now();

ALTER TABLE IF EXISTS clients
  ADD COLUMN IF NOT EXISTS latest_snapshot_metadata jsonb;

CREATE INDEX IF NOT EXISTS clients_user_monitoring_idx
  ON clients (user_id, monitoring_enabled);

CREATE OR REPLACE FUNCTION latest_profile_snapshots(p_client_ids uuid[])
RETURNS TABLE (
  id uuid,
  client_id uuid,
  type text,
  metadata jsonb,
  created_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT ON (e.client_id)
    e.id,
    e.client_id,
    e.type,
    e.metadata,
    e.created_at
  FROM events e
  WHERE e.client_id = ANY(p_client_ids)
    AND e.type = 'PROFILE_SNAPSHOT'
  ORDER BY e.client_id, e.created_at DESC;
$$;

COMMIT;
-- Note: run this in Supabase SQL editor or via psql as a DB admin.
