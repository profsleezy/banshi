Banshi Collector — Architecture & User Value Guide

Overview

Banshi Collector is a lightweight monitoring engine that captures periodic snapshots of Instagram profiles and computes deterministic risk signals. It is designed to run as a Chrome extension (client) that scrapes public profile data and a Next.js backend (server) that ingests, enriches, scores, and stores snapshots.

High-level components

- Chrome extension (MV3)
  - content_scripts/profile_collector.js: extracts visible profile fields (followers, following, posts, handle, bio, name, profile_picture_url, verified, is_private, external_link_present) using robust selectors and embedded JSON parsing.
  - background/service_worker.js: orchestrates periodic snapshots (1, 5, 15, or 30 minutes; 5 minutes by default), messages tabs safely, and POSTs PROFILE_SNAPSHOT events to the server.
  - popup UI: shows connection status and monitored clients.

- Server (Next.js, App Router)
  - app/api/events/route.ts: accepts PROFILE_SNAPSHOT events from collectors, validates and inserts them into `events`, computes derived metrics, computes a risk score, upserts a `risk_status`, and appends a row to `risk_history` for audit.
  - app/api/clients/[client_id]/snapshots/route.ts: paginated endpoint to list `PROFILE_SNAPSHOT` events for a client (used by the UI).
  - lib/riskEngine.ts: deterministic scoring + derived metrics functions. It computes both historical signals (7d/30d velocities, stability) and short-term live signals (live deltas, recent pct change, profile changes).
  - lib/updateRiskStatus.ts: helper to recompute risk based on alerts and upsert `risk_status` (now also writes `risk_history`).
  - lib/supabase.ts: ephemeral `anon` supabase client for user-facing server code.
  - lib/apiUtils.ts, lib/logger.ts, lib/rateLimiter.ts, lib/notifications.ts: helpers added for CORS, admin client creation, logging, validation, Redis-backed rate limiting, and email/webhook alert delivery.
  - SQL migrations (sql/*.sql): create `events`, index on `(client_id, created_at DESC)`, `risk_status`, and `risk_history`.

Data flow (simple human turns)

1. Browser: The extension watches open monitored Instagram profile tabs. On the configured interval (1, 5, 15, or 30 minutes; 5 minutes by default), it collects a PROFILE_SNAPSHOT: a small JSON with `client_id`, `type: PROFILE_SNAPSHOT`, and `metadata` containing `followers`, `following`, `posts`, `bio`, `handle`, plus optional fields like `profile_picture_url`, `verified_badge`, `is_private`, and `external_link_present`.

2. Network: The background worker sends the snapshot to the server: POST /api/events. The request is validated by the server (sanity checks for expected fields), and a per-client rate limiter prevents accidental floods (best-effort, in-memory).

3. Server ingest: On receipt, the server inserts the row into the `events` table (storing raw metadata). It updates `clients.last_checked` so the UI knows how fresh the data is.

4. Derived metrics: The server fetches recent PROFILE_SNAPSHOT events for the client and runs `computeDerivedMetricsFromHistory` to produce both historical and short-term metrics. These are merged back into the event row under `metadata.derived` so they travel with the snapshot.

5. Scoring & history: `computeRiskScoreFromSnapshot` produces a deterministic numeric score (0..100) and a categorical level (`Healthy`, `Watch`, `Risk`, `Critical`). Short-term live signals (e.g., large follower delta in the last hour, handle or profile image change, external link added) are prioritized so we can surface immediate concerns. After scoring, the server upserts a summary into `risk_status` (single-row per client) and appends a full audit into `risk_history` (time series).

6. UI & retrieval: Dashboard pages query `risk_status` for quick counts and use `/api/clients/:client_id/snapshots` to retrieve historical snapshots (each snapshot contains `metadata.derived`), allowing the frontend to render velocity charts, flags, and the recent risk timeline.

Value to the user (plain benefits)

- Fast alerts for sudden changes: The system detects and prioritizes short-term spikes and abrupt changes (e.g., extreme follower jumps, handle changes) so the user can act quickly if an account is being manipulated or compromised.

- Deterministic, auditable scores: The score is deterministic and recorded to `risk_history`, enabling audit trails, explanations, and consistent behavior across restarts.

- Progressive confidence: Historical metrics (7d/30d velocities) and `account_age_confidence` let the UI indicate reliability of trends: newly-monitored accounts produce low-confidence derived metrics until enough snapshots are collected.

- Minimal local state: The extension stores only `client_id` locally and streams snapshots to the backend; nothing sensitive is stored on-device.

- Developer-friendly: The backend performs validation, merges derived signals into events for easy UI consumption, and keeps a lightweight, append-only `risk_history` for investigations.

Operational considerations & security baseline included

- Input validation: Server-side checks for required fields before accepting events.
- Rate limiting: In-memory per-client rate limiting to reduce accidental overload; for production, replace with a distributed limiter (Redis, Cloudflare, etc.).
- Least privilege DB access: The app uses the anonymous client for general queries and only instantiates a service-role admin client when the `SUPABASE_SERVICE_ROLE_KEY` env var is present. The admin client is used sparingly and only server-side.
- Graceful failures: Best-effort flows (e.g., merging derived metrics, writing to `risk_history`) are wrapped in try/catch so transient DB issues don't drop the primary snapshot insert.
- Observability: A small `lib/logger` centralizes logs and respects `LOG_LEVEL`. Add metrics (Prometheus/StatsD) as a next step.
- Migration hygiene: SQL migrations create required tables and indexes. Run them as a DB admin.

Next improvements (suggested roadmap)

- Distributed rate limiting using Redis or a managed service for correctness across multiple server instances.
- Background job queue for heavier derived calculations (e.g., reprocessing 30d windows) so ingest stays fast and bound.
- Metrics + alerting: instrument key paths (ingest latency, failed inserts, rate-limited clients) and send alerts if anomalies are detected.
- RBAC / API auth: if extension needs private endpoints or user-specific data, add signed tokens or OAuth flows; keep the ingestion endpoint open only to trusted clients if needed.
- Tests: Add unit tests for `lib/riskEngine.ts` and integration tests for `app/api/events/route.ts` (using a local test DB or test doubles).

If you want, I can:
- Run a quick typecheck/build and surface any remaining issues.
- Add a small `/api/clients/:client_id/risk_history` endpoint for the UI.
- Implement a background queue for heavier derived work.

*** End of document ***
