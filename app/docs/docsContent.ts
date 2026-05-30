import type { IconName } from '../../components/TerminalIcon'

export type DocsSlug =
  | 'extension-install'
  | 'how-monitoring-works'
  | 'alerts-and-risk'
  | 'webhooks'
  | 'privacy-and-data'
  | 'troubleshooting'

export type DocsSection = {
  title: string
  body: string[]
  steps?: string[]
}

export type DocsPage = {
  slug: DocsSlug
  title: string
  kicker: string
  summary: string
  icon: IconName
  readTime: string
  sections: DocsSection[]
}

export const docsPages: DocsPage[] = [
  {
    slug: 'extension-install',
    title: 'Extension Install',
    kicker: 'browser setup',
    summary: 'Install the browser collector, link real Instagram profile pages, and choose a snapshot interval.',
    icon: 'shield',
    readTime: '4 min',
    sections: [
      {
        title: 'What the extension does',
        body: [
          'The extension reads visible public Instagram profile fields from tabs you already have open, then sends snapshots to your Banshi workspace using a per-client ingest token.',
          'It does not ask for Instagram passwords, account cookies, direct messages, or private dashboard data. The monitoring workflow depends on public profile pages staying open in the browser.',
        ],
      },
      {
        title: 'Install and pin',
        body: [
          'For production, use the store link configured in NEXT_PUBLIC_CHROME_EXTENSION_URL. During private testing, load the unpacked extension only with trusted testers.',
        ],
        steps: [
          'Install Banshi from the provided extension link.',
          'Pin it in the browser toolbar so operators can see the workflow.',
          'Open a public Instagram profile page, not the feed, reels, settings, search, or explore pages.',
          'Open Banshi and click Link current profile.',
          'Leave the Instagram profile tab open or in the background for future snapshots.',
        ],
      },
      {
        title: 'Snapshot interval',
        body: [
          'The extension supports 1 minute, 5 minutes, 15 minutes, and 30 minutes. The default is 5 minutes so the product still feels live without spamming the backend.',
          'Use 1 minute for short troubleshooting sessions only. For normal client monitoring, 5 or 15 minutes is the best MVP balance. Use 30 minutes for low-priority accounts or weak machines.',
        ],
      },
    ],
  },
  {
    slug: 'how-monitoring-works',
    title: 'How Monitoring Works',
    kicker: 'pipeline',
    summary: 'Understand clients, snapshots, derived metadata, risk history, stale data, and why tabs must stay open.',
    icon: 'radar',
    readTime: '5 min',
    sections: [
      {
        title: 'The pipeline',
        body: [
          'A client is the account being watched. The extension collects public profile metadata and posts a PROFILE_SNAPSHOT event to the backend.',
          'The backend stores raw snapshot metadata in events, calculates derived fields, updates current risk status, writes risk history, and creates alerts when thresholds are crossed.',
        ],
        steps: [
          'Profile page is linked from the extension.',
          'Extension stores the client id and secure ingest token locally.',
          'Background alarm checks open Instagram tabs on the selected interval.',
          'Matching monitored handles produce snapshot events.',
          'Dashboard and reports read the latest metadata, risk history, alerts, and investigation notes.',
        ],
      },
      {
        title: 'What is collected',
        body: [
          'Snapshots are based on public profile fields such as handle, display name, follower count, following count, post count, bio, verified badge, private flag, and whether an external link is visible.',
          'Derived fields include follow ratio, follower velocity, percent change, profile stability, posting inactivity, username-change signals, snapshot count, and account-age confidence when available.',
        ],
      },
      {
        title: 'Freshness rules',
        body: [
          'A profile is fresh when a recent snapshot was accepted. If the extension stops collecting because the tab closed, the browser slept, or the account was unmonitored, Banshi marks the scraper as stale.',
          'Stale data is treated as its own risk because agencies need to know when the monitoring pipeline itself has gone quiet.',
        ],
      },
    ],
  },
  {
    slug: 'alerts-and-risk',
    title: 'Alerts And Risk',
    kicker: 'signal model',
    summary: 'Read risk scores, ban-readiness, incident severity, and alert history without turning the dashboard into noise.',
    icon: 'alert',
    readTime: '5 min',
    sections: [
      {
        title: 'Risk versus readiness',
        body: [
          'Generic risk is the current suspicious-change score. Ban-risk readiness is separate: it answers whether the account has enough monitoring coverage, history, stability, and freshness to support a confident agency response.',
          'A low current risk with stale data is not the same as a safe account. It means Banshi does not have enough fresh evidence.',
        ],
      },
      {
        title: 'Incident severity',
        body: [
          'Banshi separates incident categories so a user can see what kind of problem they are preparing for, not just a single number.',
        ],
        steps: [
          'Account takeover: unusual identity changes, username shifts, profile instability, suspicious link changes.',
          'Manipulation: unusual audience movement, follower spikes/drops, follow-ratio drift.',
          'Inactivity: posting cadence disruption and long silence on accounts that should be active.',
          'External-link risk: visible link presence or changes that deserve human review.',
          'Scraper stale: extension or tab stopped sending fresh snapshots.',
        ],
      },
      {
        title: 'Alert trust',
        body: [
          'Alerts are meant to be rare and explainable. A good alert includes severity, the client, why it fired, and enough recent history for the operator to decide whether to investigate, pause, escalate, or ignore.',
          'Use investigation logs to record what the agency decided. That turns the system from a noisy dashboard into an audit trail.',
        ],
      },
    ],
  },
  {
    slug: 'webhooks',
    title: 'Webhooks',
    kicker: 'notifications',
    summary: 'Send alerts to webhook.site, Discord, Slack, Zapier, Make, or a custom internal endpoint.',
    icon: 'zap',
    readTime: '4 min',
    sections: [
      {
        title: 'How delivery works',
        body: [
          'Webhook alerts are configured in Settings. When a client moves into the configured minimum level, Banshi sends a JSON payload to the webhook URL and records the delivery attempt.',
          'The cooldown prevents repeat noise. The MVP default is Risk and above with a 60 minute cooldown.',
        ],
      },
      {
        title: 'Test safely',
        body: [
          'Use webhook.site first. Paste the generated URL into Settings, enable webhook alerts, click Save & send test, then confirm the request appears in webhook.site and in Banshi delivery logs.',
        ],
        steps: [
          'Open Settings.',
          'Enable Webhook alerts.',
          'Paste the webhook URL.',
          'Click Save & send test.',
          'Check delivery status and response code.',
        ],
      },
      {
        title: 'Common destinations',
        body: [
          'Discord and Slack webhooks are useful for team notifications. Zapier, Make, and n8n are useful when agencies want to create tickets, send client emails, or update a CRM.',
          'If a destination returns a non-2xx status, Banshi records the failure so the user can fix the URL or destination permissions.',
        ],
      },
    ],
  },
  {
    slug: 'privacy-and-data',
    title: 'Privacy And Data',
    kicker: 'data handling',
    summary: 'Know exactly what is stored, what is not stored, and how users can export or delete their workspace.',
    icon: 'lock',
    readTime: '4 min',
    sections: [
      {
        title: 'Data scope',
        body: [
          'Banshi is designed around public profile monitoring. It stores the fields needed to show account health, trend movement, alerts, risk history, and investigation notes.',
          'The extension should not collect private messages, login credentials, Instagram session tokens, payment data, or private account management screens.',
        ],
      },
      {
        title: 'Security model',
        body: [
          'Snapshots require a per-client ingest token. Dashboard reads require Supabase authentication. Row Level Security policies keep client, event, alert, risk, notification, and investigation records scoped to the owner.',
          'Unmonitoring pauses new snapshots. Removing a client deletes that client and related workspace records that are linked by client id.',
        ],
      },
      {
        title: 'User control',
        body: [
          'Settings includes account export and account deletion. Export gives users a workspace archive. Delete removes workspace data and attempts to delete the authenticated user.',
          'Privacy policy and terms pages should stay aligned with the real data flow as the product changes.',
        ],
      },
    ],
  },
  {
    slug: 'troubleshooting',
    title: 'Troubleshooting',
    kicker: 'operator playbook',
    summary: 'Fix missing snapshots, invalid tokens, stale data, webhook delivery failures, and setup confusion.',
    icon: 'terminal',
    readTime: '6 min',
    sections: [
      {
        title: 'No new snapshots',
        body: [
          'Most snapshot issues are caused by the Instagram profile tab not being open, the extension not having a matching monitored handle, or the client needing a fresh ingest token.',
        ],
        steps: [
          'Open the exact Instagram profile page for the client.',
          'Confirm the extension popup lists the handle as monitored.',
          'Check whether the popup says reconnect clients or secure sync required.',
          'Click Link current profile again from the correct profile page.',
          'Use 1 minute interval briefly, then switch back to 5 or 15 minutes.',
        ],
      },
      {
        title: 'Invalid ingest token',
        body: [
          'A 401 invalid_ingest_token means the backend rejected the extension token. Re-linking the profile issues a new token and stores it in the extension.',
          'This can happen after token migrations, client deletion/recreation, or local extension storage getting out of sync.',
        ],
      },
      {
        title: 'Link button disabled',
        body: [
          'The extension only enables linking on real Instagram profile pages. It should stay disabled on the home feed, reels, explore, direct messages, account settings, and unrelated websites.',
          'Navigate to instagram.com/{handle}/, wait for the profile to load, then open the extension again.',
        ],
      },
      {
        title: 'Webhook test fails',
        body: [
          'A 400 usually means webhook alerts were not enabled or the URL was missing/invalid before testing. Save the webhook setting first, or use Save & send test so Banshi persists the current form before sending.',
          'For the first test, use webhook.site because it accepts simple POST requests and shows the raw payload immediately.',
        ],
      },
    ],
  },
]

export function getDocsPage(slug: DocsSlug) {
  return docsPages.find((page) => page.slug === slug)
}
