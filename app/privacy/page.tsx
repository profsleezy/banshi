import Link from 'next/link'
import type { ReactNode } from 'react'
import TerminalIcon from '../../components/TerminalIcon'
import { compactUrl, getPublicSupportLinks } from '../../lib/supportLinks'

const effectiveDate = 'May 29, 2026'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="terminal-card rounded p-5">
      <h2 className="text-lg font-semibold text-zinc-50">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-zinc-400">{children}</div>
    </section>
  )
}

export default function PrivacyPage() {
  const support = getPublicSupportLinks()

  return (
    <main className="terminal-shell">
      <header className="border-b border-zinc-800/80 bg-black/25">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3 text-zinc-50">
            <span className="flex h-10 w-10 items-center justify-center rounded border border-zinc-700 bg-zinc-900 text-emerald-200">
              <TerminalIcon name="shield" className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-lg font-semibold">Banshi</span>
              <span className="block text-xs text-zinc-500">privacy policy</span>
            </span>
          </Link>
          <Link href="/auth" className="terminal-button-secondary focus-ring rounded px-3 py-2 text-sm">
            Sign in
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <div className="terminal-panel rounded-lg p-6 sm:p-8">
          <div className="terminal-label text-xs">effective {effectiveDate}</div>
          <h1 className="mt-3 text-3xl font-semibold text-zinc-50">Privacy Policy</h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400">
            Banshi is a monitoring workspace for agencies and operators that track public Instagram profile signals. This policy explains what we collect, why we collect it, how it is used, and the choices available to you.
          </p>
        </div>

        <div className="mt-6 grid gap-4">
          <Section title="1. What Banshi Monitors">
            <p>
              Banshi is designed to monitor public profile information that is visible from Instagram profile pages. The service is not designed to collect private messages, passwords, non-public posts, private account content, payment card data, or hidden platform data.
            </p>
            <p>
              The browser extension may collect public profile fields from pages you link, including profile handle, display name, biography, follower count, following count, post count, public/private indicator, verified badge indicator, external link presence, profile image URL if available, and timestamped snapshots.
            </p>
          </Section>

          <Section title="2. Account And Workspace Data">
            <p>
              When you create an account, Banshi uses authentication data such as your email address, login session, and user identifier. Supabase provides authentication and database infrastructure for the MVP.
            </p>
            <p>
              We store client records you create or link through the extension, monitoring status, snapshot metadata, calculated risk scores, incident classifications, investigation notes, alerts, risk history, notification settings, webhook URLs, and delivery logs needed to operate the service.
            </p>
          </Section>

          <Section title="3. How Data Is Used">
            <p>
              We use collected data to provide account monitoring, calculate profile risk, show trend reports, generate alerts, keep an audit trail, secure ingestion, prevent abuse, troubleshoot errors, and support users.
            </p>
            <p>
              Risk calculations are decision-support signals. They are intended to help an agency decide when to review or escalate a profile, not to make final moderation, employment, financial, or legal decisions automatically.
            </p>
          </Section>

          <Section title="4. Extension Tokens And Local Storage">
            <p>
              Linked clients use an ingest token so snapshots are accepted only from an authorized extension workflow. The extension may store client identifiers, monitoring state, and ingest tokens locally in the browser so background snapshot sync can continue while an Instagram profile tab remains open.
            </p>
            <p>
              If you remove a client from the dashboard, related client data is removed from the application database and the extension is instructed to unlink that client locally when it receives the update.
            </p>
          </Section>

          <Section title="5. Notifications And Webhooks">
            <p>
              If you enable webhook alerts, Banshi sends alert payloads to the destination URL you provide. That destination may be a third-party service such as Discord, Slack, webhook.site, Zapier, Make, or an internal endpoint. You are responsible for choosing a destination that your team is authorized to use.
            </p>
            <p>
              Notification delivery logs may include destination metadata, status codes, response snippets, and the alert payload so you can confirm whether delivery worked.
            </p>
          </Section>

          <Section title="6. Service Providers">
            <p>
              Banshi may use infrastructure providers for authentication, database storage, hosting, rate limiting, and notifications. Current MVP integrations may include Supabase for auth/database, Upstash Redis for rate limiting, the hosting provider used to run the app, and webhook destinations configured by you.
            </p>
            <p>
              We do not sell monitored profile data or user account data. We share data only as needed to operate the service, comply with law, protect the service, or send data to destinations you configure.
            </p>
          </Section>

          <Section title="7. Retention And Deletion">
            <p>
              Client snapshots, calculated metrics, investigation notes, alerts, and risk history are retained so the product can provide an audit trail. Removing a client is intended to remove the client and related monitoring records from the application database. Account deletion is intended to remove workspace records associated with your user account.
            </p>
            <p>
              You may disable monitoring without deleting a client. Disabling monitoring stops new snapshots from being accepted for that client unless monitoring is turned on again.
            </p>
          </Section>

          <Section title="8. Security">
            <p>
              Banshi uses authentication, owner-scoped database access policies, service-side ingestion checks, rate limiting, and per-client ingest tokens to reduce unauthorized access and spoofed snapshots.
            </p>
            <p>
              No internet service is perfectly secure. You should protect your login, avoid sharing extension tokens, and remove webhook URLs you no longer control.
            </p>
          </Section>

          <Section title="9. Your Choices">
            <p>
              You can remove clients, pause monitoring, change webhook settings, sign out, or contact support for help with account data questions. Browser extension data may also be cleared from Chrome extension storage by removing or resetting the extension.
            </p>
            <p>
              Depending on your location, you may have rights to access, correct, delete, restrict, or export personal data. Contact support to make a request.
            </p>
          </Section>

          <Section title="10. Platform Relationship">
            <p>
              Banshi is not affiliated with, endorsed by, or sponsored by Instagram, Meta, or any monitored social platform. You are responsible for using Banshi in a way that respects applicable laws, platform rules, and your client agreements.
            </p>
          </Section>

          <Section title="11. International Processing">
            <p>
              The service may be hosted and processed in countries different from where you or your clients are located. By using Banshi and configuring third-party destinations, you understand that data may be transferred to infrastructure providers and webhook services needed to operate the product.
            </p>
          </Section>

          <Section title="12. Children">
            <p>
              Banshi is not intended for children and should not be used to knowingly monitor or profile children. If you believe child-related personal data has been added improperly, contact support so it can be reviewed and removed.
            </p>
          </Section>

          <Section title="13. Contact">
            <p>
              For privacy questions or support, contact us through Telegram. The public support links are controlled by environment variables so the operator can update them without rewriting this policy.
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {Object.values(support).map((item) => (
                <a key={item.label} href={item.href} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded border border-zinc-800 bg-black/30 p-3 text-zinc-200 hover:border-emerald-300/30">
                  <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded border border-zinc-800 bg-black/40 text-emerald-200">
                    <TerminalIcon name={item.platform} className="h-5 w-5" />
                    {item.mode === 'community' && (
                      <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 text-cyan-200">
                        <TerminalIcon name="users" className="h-2.5 w-2.5" />
                      </span>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{item.label}</span>
                    <span className="mt-1 block truncate text-xs text-zinc-500">{compactUrl(item.href)}</span>
                  </span>
                </a>
              ))}
            </div>
          </Section>

          <Section title="14. Changes">
            <p>
              We may update this policy as the product changes. If a change materially affects how data is collected or used, the updated policy will be posted with a new effective date.
            </p>
          </Section>
        </div>
      </div>
    </main>
  )
}
