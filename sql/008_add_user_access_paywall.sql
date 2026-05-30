-- Add manual paid-access control for the MVP.
-- You can grant access by inserting/updating user_access from the Supabase SQL editor.
BEGIN;

CREATE TABLE IF NOT EXISTS user_access (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'trial', 'active', 'comped', 'suspended', 'canceled')),
  plan text NOT NULL DEFAULT 'request' CHECK (plan IN ('request', 'starter', 'agency', 'command', 'founder')),
  client_limit integer NOT NULL DEFAULT 0 CHECK (client_limit >= 0),
  features jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  granted_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS access_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  email text,
  name text,
  agency text,
  plan text,
  telegram text,
  discord text,
  message text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'approved', 'rejected')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_access_status_idx
  ON user_access (status, plan);

CREATE INDEX IF NOT EXISTS access_requests_created_idx
  ON access_requests (created_at DESC);

CREATE OR REPLACE FUNCTION public.has_active_access(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_access ua
    WHERE ua.user_id = p_user_id
      AND ua.status IN ('trial', 'active', 'comped')
      AND (ua.expires_at IS NULL OR ua.expires_at > now())
  );
$$;

CREATE OR REPLACE FUNCTION public.can_add_client(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_access ua
    WHERE ua.user_id = p_user_id
      AND ua.status IN ('trial', 'active', 'comped')
      AND (ua.expires_at IS NULL OR ua.expires_at > now())
      AND (
        SELECT count(*)
        FROM clients c
        WHERE c.user_id = p_user_id
      ) < ua.client_limit
  );
$$;

-- Admin-only convenience helper.
-- After a customer signs up, run:
-- SELECT * FROM public.grant_user_access_by_email('customer@email.com', 'agency');
CREATE OR REPLACE FUNCTION public.grant_user_access_by_email(
  p_email text,
  p_plan text DEFAULT 'agency',
  p_client_limit integer DEFAULT NULL,
  p_days integer DEFAULT NULL
)
RETURNS TABLE (
  user_id uuid,
  email text,
  status text,
  plan text,
  client_limit integer,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_client_limit integer;
  v_expires_at timestamptz;
BEGIN
  SELECT u.id, u.email
  INTO v_user_id, v_email
  FROM auth.users u
  WHERE lower(u.email) = lower(trim(p_email))
  ORDER BY u.created_at DESC
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No signed-up user found for email: %', p_email;
  END IF;

  IF p_plan NOT IN ('starter', 'agency', 'command', 'founder') THEN
    RAISE EXCEPTION 'Invalid plan %. Use starter, agency, command, or founder.', p_plan;
  END IF;

  v_client_limit := COALESCE(
    p_client_limit,
    CASE p_plan
      WHEN 'starter' THEN 5
      WHEN 'agency' THEN 25
      WHEN 'command' THEN 75
      WHEN 'founder' THEN 150
      ELSE 0
    END
  );

  IF v_client_limit < 1 THEN
    RAISE EXCEPTION 'client_limit must be at least 1.';
  END IF;

  v_expires_at := CASE
    WHEN p_days IS NULL THEN NULL
    ELSE now() + make_interval(days => p_days)
  END;

  INSERT INTO public.user_access (user_id, status, plan, client_limit, granted_at, expires_at, updated_at)
  VALUES (v_user_id, 'active', p_plan, v_client_limit, now(), v_expires_at, now())
  ON CONFLICT (user_id) DO UPDATE
  SET status = 'active',
      plan = excluded.plan,
      client_limit = excluded.client_limit,
      granted_at = now(),
      expires_at = excluded.expires_at,
      updated_at = now();

  RETURN QUERY
  SELECT ua.user_id, v_email, ua.status, ua.plan, ua.client_limit, ua.expires_at
  FROM public.user_access ua
  WHERE ua.user_id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_user_access_by_email(text, text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grant_user_access_by_email(text, text, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.grant_user_access_by_email(text, text, integer, integer) FROM authenticated;

-- Admin-only helper to turn access off by email.
CREATE OR REPLACE FUNCTION public.suspend_user_access_by_email(p_email text)
RETURNS TABLE (
  user_id uuid,
  email text,
  status text,
  plan text,
  client_limit integer,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
BEGIN
  SELECT u.id, u.email
  INTO v_user_id, v_email
  FROM auth.users u
  WHERE lower(u.email) = lower(trim(p_email))
  ORDER BY u.created_at DESC
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No signed-up user found for email: %', p_email;
  END IF;

  UPDATE public.user_access ua
  SET status = 'suspended',
      updated_at = now()
  WHERE ua.user_id = v_user_id;

  RETURN QUERY
  SELECT ua.user_id, v_email, ua.status, ua.plan, ua.client_limit, ua.expires_at
  FROM public.user_access ua
  WHERE ua.user_id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.suspend_user_access_by_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.suspend_user_access_by_email(text) FROM anon;
REVOKE ALL ON FUNCTION public.suspend_user_access_by_email(text) FROM authenticated;

ALTER TABLE user_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_access_select_own ON user_access;
CREATE POLICY user_access_select_own
  ON user_access
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS access_requests_select_own ON access_requests;
CREATE POLICY access_requests_select_own
  ON access_requests
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Tighten existing app data policies so unpaid users cannot bypass the UI by calling Supabase directly.
DROP POLICY IF EXISTS clients_select_own ON clients;
DROP POLICY IF EXISTS clients_insert_own ON clients;
DROP POLICY IF EXISTS clients_update_own ON clients;
DROP POLICY IF EXISTS clients_delete_own ON clients;

CREATE POLICY clients_select_own
  ON clients
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() AND public.has_active_access(auth.uid()));

CREATE POLICY clients_insert_own
  ON clients
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_add_client(auth.uid()));

CREATE POLICY clients_update_own
  ON clients
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND public.has_active_access(auth.uid()))
  WITH CHECK (user_id = auth.uid() AND public.has_active_access(auth.uid()));

CREATE POLICY clients_delete_own
  ON clients
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() AND public.has_active_access(auth.uid()));

DROP POLICY IF EXISTS events_select_own_client ON events;
CREATE POLICY events_select_own_client
  ON events
  FOR SELECT
  TO authenticated
  USING (
    public.has_active_access(auth.uid())
    AND (
      user_id = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM clients c
        WHERE c.id = events.client_id
          AND c.user_id = auth.uid()
      )
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
    public.has_active_access(auth.uid())
    AND EXISTS (
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
    public.has_active_access(auth.uid())
    AND EXISTS (
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
    public.has_active_access(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM clients c
      WHERE c.id = alerts.client_id
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.has_active_access(auth.uid())
    AND EXISTS (
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
    public.has_active_access(auth.uid())
    AND EXISTS (
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
    public.has_active_access(auth.uid())
    AND EXISTS (
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
    public.has_active_access(auth.uid())
    AND EXISTS (
      SELECT 1
      FROM clients c
      WHERE c.id = risk_history.client_id
        AND c.user_id = auth.uid()
    )
  );

DO $$
BEGIN
  IF to_regclass('public.client_investigation_logs') IS NOT NULL THEN
    DROP POLICY IF EXISTS client_investigation_logs_select_own ON client_investigation_logs;
    DROP POLICY IF EXISTS client_investigation_logs_insert_own ON client_investigation_logs;
    DROP POLICY IF EXISTS client_investigation_logs_update_own ON client_investigation_logs;
    DROP POLICY IF EXISTS client_investigation_logs_delete_own ON client_investigation_logs;

    CREATE POLICY client_investigation_logs_select_own
      ON client_investigation_logs
      FOR SELECT
      TO authenticated
      USING (
        public.has_active_access(auth.uid())
        AND user_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM clients c
          WHERE c.id = client_investigation_logs.client_id
            AND c.user_id = auth.uid()
        )
      );

    CREATE POLICY client_investigation_logs_insert_own
      ON client_investigation_logs
      FOR INSERT
      TO authenticated
      WITH CHECK (
        public.has_active_access(auth.uid())
        AND user_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM clients c
          WHERE c.id = client_investigation_logs.client_id
            AND c.user_id = auth.uid()
        )
      );

    CREATE POLICY client_investigation_logs_update_own
      ON client_investigation_logs
      FOR UPDATE
      TO authenticated
      USING (
        public.has_active_access(auth.uid())
        AND user_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM clients c
          WHERE c.id = client_investigation_logs.client_id
            AND c.user_id = auth.uid()
        )
      )
      WITH CHECK (
        public.has_active_access(auth.uid())
        AND user_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM clients c
          WHERE c.id = client_investigation_logs.client_id
            AND c.user_id = auth.uid()
        )
      );

    CREATE POLICY client_investigation_logs_delete_own
      ON client_investigation_logs
      FOR DELETE
      TO authenticated
      USING (
        public.has_active_access(auth.uid())
        AND user_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM clients c
          WHERE c.id = client_investigation_logs.client_id
            AND c.user_id = auth.uid()
        )
      );
  END IF;
END $$;

COMMIT;

-- Manual grant examples:
-- Easiest grant:
-- SELECT * FROM public.grant_user_access_by_email('customer@email.com', 'agency');
--
-- Trial for 14 days:
-- SELECT * FROM public.grant_user_access_by_email('customer@email.com', 'agency', NULL, 14);
--
-- Custom limit:
-- SELECT * FROM public.grant_user_access_by_email('customer@email.com', 'founder', 150);
--
-- Turn access off:
-- SELECT * FROM public.suspend_user_access_by_email('customer@email.com');
