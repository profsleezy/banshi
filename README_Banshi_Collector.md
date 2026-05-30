Banshi Collector - Edge/Chrome extension (Manifest V3)

Production package:

1. Run `powershell -ExecutionPolicy Bypass -File scripts/package-edge-extension.ps1`.
2. Upload `dist/banshi-edge-extension.zip` to the Microsoft Edge Add-ons dashboard.
3. After the listing URL exists, set `NEXT_PUBLIC_CHROME_EXTENSION_URL` in Vercel to that URL.

What it does:

- Runs only on Instagram profile pages.
- Collects visible public profile fields: handle, name, followers, following, posts, bio, privacy/verification signals, and external-link presence.
- Sends snapshots to `https://banshi.vercel.app/api/events`.
- Uses a per-client ingest token issued during the dashboard/linking flow.
- Stores local monitoring state, selected snapshot interval, client ids, and raw ingest tokens in extension local storage.

Snapshot interval:

- Supported intervals: 1, 5, 15, and 30 minutes.
- Default: 5 minutes.
- A profile tab must stay open in Edge/Chrome for live snapshots to continue.

Development install:

1. Open Edge or Chrome extensions.
2. Enable developer mode.
3. Load this repository folder as an unpacked extension.

For production uploads, use the packaged zip. Do not upload the full repository folder.
