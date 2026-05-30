-- Add MVP notification settings and delivery audit logs.
-- Server routes using SUPABASE_SERVICE_ROLE_KEY write delivery rows; users can read their own rows.
BEGIN;

CREATE TABLE IF NOT EXISTS notification_settings (
  user_id uuid PRIMARY KEY,
  email_enabled boolean NOT NULL DEFAULT false,
  email_recipients text[] NOT NULL DEFAULT '{}'::text[],
  webhook_enabled boolean NOT NULL DEFAULT false,
  webhook_url text,
  min_level text NOT NULL DEFAULT 'Risk' CHECK (min_level IN ('Watch', 'Risk', 'Critical')),
  dedupe_minutes integer NOT NULL DEFAULT 60 CHECK (dedupe_minutes BETWEEN 5 AND 1440),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  client_id uuid,
  risk_history_id uuid,
  channel text NOT NULL CHECK (channel IN ('email', 'webhook')),
  destination text,
  trigger_key text NOT NULL,
  status text NOT NULL CHECK (status IN ('sent', 'failed', 'skipped')),
  payload jsonb,
  response_status integer,
  response_body text,
  error text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_deliveries_user_created_idx
  ON notification_deliveries (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notification_deliveries_dedupe_idx
  ON notification_deliveries (user_id, client_id, channel, trigger_key, created_at DESC);

ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_settings_select_own ON notification_settings;
DROP POLICY IF EXISTS notification_settings_insert_own ON notification_settings;
DROP POLICY IF EXISTS notification_settings_update_own ON notification_settings;
DROP POLICY IF EXISTS notification_settings_delete_own ON notification_settings;

CREATE POLICY notification_settings_select_own
  ON notification_settings
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY notification_settings_insert_own
  ON notification_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY notification_settings_update_own
  ON notification_settings
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY notification_settings_delete_own
  ON notification_settings
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS notification_deliveries_select_own ON notification_deliveries;
DROP POLICY IF EXISTS notification_deliveries_delete_own ON notification_deliveries;

CREATE POLICY notification_deliveries_select_own
  ON notification_deliveries
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY notification_deliveries_delete_own
  ON notification_deliveries
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

COMMIT;
-- Note: run this in Supabase SQL editor or via psql as a DB admin.
