-- Fix the manual access helper after the paywall migration.
-- Run this in Supabase SQL Editor, then run:
-- SELECT * FROM public.grant_user_access_by_email('customer@email.com', 'agency');
BEGIN;

DROP FUNCTION IF EXISTS public.grant_user_access_by_email(text, text, integer, integer);

CREATE OR REPLACE FUNCTION public.grant_user_access_by_email(
  p_email text,
  p_plan text DEFAULT 'agency',
  p_client_limit integer DEFAULT NULL,
  p_days integer DEFAULT NULL
)
RETURNS TABLE (
  granted_user_id uuid,
  granted_email text,
  access_status text,
  access_plan text,
  access_client_limit integer,
  access_expires_at timestamptz
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

  UPDATE public.user_access ua
  SET status = 'active',
      plan = p_plan,
      client_limit = v_client_limit,
      granted_at = now(),
      expires_at = v_expires_at,
      updated_at = now()
  WHERE ua.user_id = v_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.user_access (user_id, status, plan, client_limit, granted_at, expires_at, updated_at)
    VALUES (v_user_id, 'active', p_plan, v_client_limit, now(), v_expires_at, now());
  END IF;

  RETURN QUERY
  SELECT ua.user_id, v_email, ua.status, ua.plan, ua.client_limit, ua.expires_at
  FROM public.user_access ua
  WHERE ua.user_id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_user_access_by_email(text, text, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.grant_user_access_by_email(text, text, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.grant_user_access_by_email(text, text, integer, integer) FROM authenticated;

DROP FUNCTION IF EXISTS public.suspend_user_access_by_email(text);

CREATE OR REPLACE FUNCTION public.suspend_user_access_by_email(p_email text)
RETURNS TABLE (
  suspended_user_id uuid,
  suspended_email text,
  access_status text,
  access_plan text,
  access_client_limit integer,
  access_expires_at timestamptz
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

COMMIT;

