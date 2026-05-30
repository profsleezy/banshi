-- Enable owner-scoped Row Level Security for the MVP Supabase tables.
-- Server-side routes using SUPABASE_SERVICE_ROLE_KEY bypass these policies for ingestion/scoring.
BEGIN;

ALTER TABLE IF EXISTS events
  ADD COLUMN IF NOT EXISTS user_id uuid;

-- Keep old events compatible with owner-scoped policies.
UPDATE events e
SET user_id = c.user_id
FROM clients c
WHERE e.client_id = c.id
  AND e.user_id IS DISTINCT FROM c.user_id;

CREATE INDEX IF NOT EXISTS alerts_client_created_idx
  ON alerts (client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS risk_history_client_created_idx
  ON risk_history (client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS events_user_created_idx
  ON events (user_id, created_at DESC);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS clients_select_own ON clients;
DROP POLICY IF EXISTS clients_insert_own ON clients;
DROP POLICY IF EXISTS clients_update_own ON clients;
DROP POLICY IF EXISTS clients_delete_own ON clients;

CREATE POLICY clients_select_own
  ON clients
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY clients_insert_own
  ON clients
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY clients_update_own
  ON clients
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY clients_delete_own
  ON clients
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS events_select_own_client ON events;

CREATE POLICY events_select_own_client
  ON events
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM clients c
      WHERE c.id = events.client_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS alerts_select_own_client ON alerts;
DROP POLICY IF EXISTS alerts_insert_own_client ON alerts;
DROP POLICY IF EXISTS alerts_update_own_client ON alerts;
DROP POLICY IF EXISTS alerts_delete_own_client ON alerts;

CREATE POLICY alerts_select_own_client
  ON alerts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM clients c
      WHERE c.id = alerts.client_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY alerts_insert_own_client
  ON alerts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM clients c
      WHERE c.id = alerts.client_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY alerts_update_own_client
  ON alerts
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM clients c
      WHERE c.id = alerts.client_id
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM clients c
      WHERE c.id = alerts.client_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY alerts_delete_own_client
  ON alerts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM clients c
      WHERE c.id = alerts.client_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS risk_status_select_own_client ON risk_status;

CREATE POLICY risk_status_select_own_client
  ON risk_status
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM clients c
      WHERE c.id = risk_status.client_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS risk_history_select_own_client ON risk_history;

CREATE POLICY risk_history_select_own_client
  ON risk_history
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM clients c
      WHERE c.id = risk_history.client_id
        AND c.user_id = auth.uid()
    )
  );

COMMIT;
-- Note: run this in Supabase SQL editor or via psql as a DB admin.
