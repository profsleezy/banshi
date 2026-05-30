# Edge Production Checklist

Use this when the site is live and the extension is ready for Microsoft Edge Add-ons.

## Vercel Environment Variables

Set these in Vercel Project Settings > Environment Variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL=https://banshi.vercel.app`
- `APP_URL=https://banshi.vercel.app`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `PROFILE_SNAPSHOT_MAX_PER_MIN=120`
- `SNAPSHOTS_MAX_PER_MIN=60`
- `RATE_LIMIT_PREFIX=banshi:rate`
- `NEXT_PUBLIC_SUPPORT_TELEGRAM_PROFILE`
- `NEXT_PUBLIC_SUPPORT_TELEGRAM_CHANNEL`
- `NEXT_PUBLIC_SUPPORT_DISCORD_PROFILE`
- `NEXT_PUBLIC_CHROME_EXTENSION_URL`

After the Edge listing is approved, replace `NEXT_PUBLIC_CHROME_EXTENSION_URL` with the real Edge Add-ons URL.

## Supabase Settings

In Supabase Auth URL Configuration:

- Site URL: `https://banshi.vercel.app`
- Redirect URLs: `https://banshi.vercel.app/**`
- Optional local dev redirect: `http://localhost:3000/**`

Run all SQL files in order from `sql/001...` through the latest migration before letting users in.

## Extension Package

Run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/package-edge-extension.ps1
```

Upload:

```text
dist/banshi-edge-extension.zip
```

Do not upload the full repository folder.

## Store Review Notes

Recommended purpose text:

```text
Banshi Collector reads public Instagram profile pages selected by the user and sends public profile snapshots to the user's Banshi workspace for account integrity monitoring.
```

Permission notes:

- `storage`: stores monitored client ids, snapshot interval, and per-client ingest tokens locally.
- `alarms`: runs scheduled snapshot checks at the selected interval.
- `tabs`: finds open Instagram profile tabs and opens Banshi setup pages.
- `scripting`: reinjects the packaged profile collector when an Instagram tab was opened before the extension loaded.
- Host permissions: limited to Instagram profile pages and `https://banshi.vercel.app`.

Remote code:

```text
No remote code. All extension code is packaged inside the extension.
```
