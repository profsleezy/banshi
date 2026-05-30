-- Add client investigation logs for agency audit notes.
-- Account export/delete is handled by authenticated server routes.
BEGIN;

CREATE TABLE IF NOT EXISTS client_investigation_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  note text NOT NULL CHECK (length(trim(note)) > 0),
  severity text NOT NULL DEFAULT 'note' CHECK (severity IN ('note', 'watch', 'risk', 'critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS client_investigation_logs_client_created_idx
  ON client_investigation_logs (client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS client_investigation_logs_user_created_idx
  ON client_investigation_logs (user_id, created_at DESC);

ALTER TABLE client_investigation_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_investigation_logs_select_own ON client_investigation_logs;
DROP POLICY IF EXISTS client_investigation_logs_insert_own ON client_investigation_logs;
DROP POLICY IF EXISTS client_investigation_logs_update_own ON client_investigation_logs;
DROP POLICY IF EXISTS client_investigation_logs_delete_own ON client_investigation_logs;

CREATE POLICY client_investigation_logs_select_own
  ON client_investigation_logs
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM clients c
      WHERE c.id = client_investigation_logs.client_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY client_investigation_logs_insert_own
  ON client_investigation_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM clients c
      WHERE c.id = client_investigation_logs.client_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY client_investigation_logs_update_own
  ON client_investigation_logs
  FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM clients c
      WHERE c.id = client_investigation_logs.client_id
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM clients c
      WHERE c.id = client_investigation_logs.client_id
        AND c.user_id = auth.uid()
    )
  );

CREATE POLICY client_investigation_logs_delete_own
  ON client_investigation_logs
  FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM clients c
      WHERE c.id = client_investigation_logs.client_id
        AND c.user_id = auth.uid()
    )
  );

COMMIT;
-- Note: run this in Supabase SQL editor or via psql as a DB admin.
