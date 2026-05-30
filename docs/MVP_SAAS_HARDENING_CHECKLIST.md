# MVP SaaS Hardening Checklist

This is the phased checklist for turning the current monitoring MVP into a safer, sellable SaaS.

## Phase 1: Secure Snapshot Ingestion

- Add per-client ingest token columns.
- Issue a token when a profile is linked or monitoring is re-enabled.
- Store only the token hash in Supabase.
- Store the raw token only in the Chrome extension local storage.
- Send the token with every `POST /api/events` snapshot.
- Reject snapshots with missing or invalid tokens.

User actions:

- Run `sql/004_add_ingest_tokens.sql` in Supabase.
- Reload the unpacked Chrome extension.
- Re-link existing monitored profiles once so the extension receives tokens.
- When deployed, add the production app/API domain to `manifest.json` host permissions.

## Phase 2: Lock Snapshot Reads

Status: implemented in `app/api/clients/[client_id]/snapshots/route.ts`.

- Require a Supabase session token for `/api/clients/[client_id]/snapshots`.
- Verify the requested client belongs to the logged-in user.
- Return proper `401`, `403`, and `404` responses.

User actions:

- Test dashboard and client report pages after the patch.

## Phase 3: Supabase RLS Policies

Status: migration added in `sql/005_enable_rls_policies.sql`.

- Enable RLS on `clients`, `events`, `alerts`, `risk_status`, and `risk_history`.
- Add owner-scoped read/write policies.
- Keep server-side service-role ingestion/scoring working.

User actions:

- Run the RLS SQL migration in Supabase.
- Confirm `SUPABASE_SERVICE_ROLE_KEY` exists only server-side, never as `NEXT_PUBLIC_*`.

## Phase 4: Production Rate Limiting

Status: implemented in `lib/rateLimiter.ts`.

- Replace in-memory rate limiting with Redis/Upstash.
- Keep a local development fallback.
- Rate limit ingestion and read-heavy endpoints.
- Current protected endpoints:
  - `POST /api/events`
  - `GET /api/clients/[client_id]/snapshots`

User actions:

- Create an Upstash Redis database.
- Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to `.env.local` and production env.
- Optional tuning env vars:
  - `PROFILE_SNAPSHOT_MAX_PER_MIN=120`
  - `SNAPSHOTS_MAX_PER_MIN=60`
  - `RATE_LIMIT_PREFIX=banshi:rate`
- Restart the Next.js dev server after changing env vars.
- Test by lowering `PROFILE_SNAPSHOT_MAX_PER_MIN=2`, sending a few snapshots, and confirming the backend eventually returns `429 rate limit exceeded`.

## Phase 5: Notifications

Status: implemented with `sql/006_add_notification_settings.sql`, notification APIs, and Settings integration checks. Current MVP UI is webhook-only to avoid email/domain costs.

- Add notification settings.
- Add delivery logs.
- Send webhook alerts when risk state changes.
- Prevent duplicate notification spam.
- Add Settings controls for webhook routing, test sends, integration health, and delivery history.

User actions:

- Run `sql/006_add_notification_settings.sql` in Supabase.
- Use a free Discord/Slack/webhook.site webhook URL.
- Add `NEXT_PUBLIC_APP_URL` when deployed so alert payloads include the correct report link.
- Open `/settings`, save notification routing, then click `Send test`.
- Use `Run check` on `/settings` to verify Supabase auth, service role, Upstash, notification tables, webhook config, app URL, and delivery logs.
- Email can be restored later by setting `ENABLE_EMAIL_NOTIFICATIONS=true`, adding Resend env vars, and re-exposing the email UI.
