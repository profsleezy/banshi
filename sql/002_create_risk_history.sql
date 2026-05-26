-- Create risk_status (if missing) and risk_history table for audit of computed risk scores
BEGIN;

-- risk_status: single-row per client (upserted by server)
CREATE TABLE IF NOT EXISTS risk_status (
  client_id uuid PRIMARY KEY,
  status text NOT NULL,
  score integer NOT NULL,
  notes text,
  updated_at timestamptz DEFAULT now()
);

-- risk_history: append-only log of computed risk scores (one row per computation)
CREATE TABLE IF NOT EXISTS risk_history (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL,
  event_id uuid,
  score integer NOT NULL,
  level text NOT NULL,
  notes text,
  payload jsonb,
  created_at timestamptz DEFAULT now()
);

COMMIT;
-- Note: run this in Supabase SQL editor or via psql as a DB admin.
