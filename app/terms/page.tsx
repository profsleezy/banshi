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

export default function TermsPage() {
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
              <span className="block text-xs text-zinc-500">terms and conditions</span>
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
          <h1 className="mt-3 text-3xl font-semibold text-zinc-50">Terms And Conditions</h1>
          <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400">
            These terms govern access to Banshi, an MVP account integrity monitoring workspace for public Instagram profile signals. By creating an account, using the dashboard, or installing the extension, you agree to these terms.
          </p>
        </div>

        <div className="mt-6 grid gap-4">
          <Section title="1. The Service">
            <p>
              Banshi helps users monitor public social profile changes, review calculated risk signals, keep an audit trail, and route alerts to destinations they configure. The product is intended for agencies, operators, creators, brands, and analysts who need early warning signals for public account integrity.
            </p>
            <p>
              The service is an MVP. Features may change, be limited, or be temporarily unavailable while the product is improved.
            </p>
          </Section>

          <Section title="2. Account Responsibilities">
            <p>
              You are responsible for maintaining control of your login credentials, extension installation, webhook destinations, and any devices used to run the extension. You must provide accurate account information and promptly remove access for anyone who should no longer use your workspace.
            </p>
            <p>
              You are responsible for activity under your account, including clients linked through the extension and webhooks configured by your team.
            </p>
          </Section>

          <Section title="3. Authorized Monitoring">
            <p>
              You may use Banshi only to monitor public profile information that you are legally and contractually permitted to monitor. You should have a legitimate business, operational, security, fraud-prevention, brand-protection, or client-service reason for adding a profile.
            </p>
            <p>
              You may not use Banshi to collect private content, bypass access controls, harvest credentials, impersonate others, stalk or harass people, violate platform rules, or make unlawful decisions about a person.
            </p>
          </Section>

          <Section title="4. Browser Extension">
            <p>
              The extension links public profile pages to your workspace and may send profile snapshots while an Instagram profile tab remains open or available in the browser. You understand that browser behavior, network conditions, Instagram page changes, and extension permissions may affect snapshot collection.
            </p>
            <p>
              You may pause monitoring for a client without deleting historical records. Removing a client is a deletion workflow and should be used only when you no longer need that client in the workspace.
            </p>
          </Section>

          <Section title="5. Alerts And Reports Are Decision Support">
            <p>
              Risk scores, alerts, trend charts, recommended actions, and reports are informational tools. They do not guarantee that an account will be banned, compromised, manipulated, safe, or unsafe.
            </p>
            <p>
              You are responsible for reviewing context before taking action. Do not rely on Banshi as the sole basis for legal, employment, financial, platform enforcement, or other high-impact decisions.
            </p>
          </Section>

          <Section title="6. Acceptable Use">
            <p>
              You may not attack the service, probe private systems, spam API routes, spoof snapshots, resell access without permission, upload malicious payloads, interfere with other users, or use Banshi in a way that creates legal or safety risk for the service or other people.
            </p>
            <p>
              We may limit, suspend, or terminate access if we believe an account is abusing the service, creating security risk, or violating these terms.
            </p>
          </Section>

          <Section title="7. Third-Party Services">
            <p>
              Banshi depends on third-party services for authentication, database storage, hosting, rate limiting, and user-configured webhook delivery. Third-party outages, policy changes, browser changes, or platform layout changes may affect the service.
            </p>
            <p>
              Webhook destinations are controlled by you. Do not send alert payloads to endpoints you do not own, trust, or have permission to use.
            </p>
          </Section>

          <Section title="8. Data And Privacy">
            <p>
              The Banshi Privacy Policy explains how data is collected and used. By using the service, you also agree to the data practices described there.
            </p>
            <p>
              You retain responsibility for the client data and public profile data you choose to monitor, including any obligations you have to your clients or team members.
            </p>
          </Section>

          <Section title="9. Payments And Beta Access">
            <p>
              If Banshi is offered for free during an MVP or beta period, access does not guarantee future free access. Paid plans, usage limits, feature limits, or commercial terms may be introduced later.
            </p>
            <p>
              Any future paid plan terms should be presented before payment is collected.
            </p>
          </Section>

          <Section title="10. Disclaimers">
            <p>
              Banshi is provided on an "as is" and "as available" basis. We do not promise uninterrupted service, perfect accuracy, complete detection of every suspicious event, or compatibility with every browser, platform page, webhook provider, or workflow.
            </p>
            <p>
              Banshi is not affiliated with, endorsed by, or sponsored by Instagram, Meta, or any monitored social platform.
            </p>
          </Section>

          <Section title="11. Limitation Of Liability">
            <p>
              To the maximum extent permitted by law, Banshi and its operator will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, including loss of profits, clients, reputation, data, or business opportunities.
            </p>
            <p>
              If liability cannot be excluded, the total liability for claims related to the service will be limited to the amount you paid for the service in the three months before the claim, or USD $100 if you have not paid for the service.
            </p>
          </Section>

          <Section title="12. Indemnity">
            <p>
              You agree to defend and hold harmless Banshi and its operator from claims arising from your use of the service, monitored profiles you add, webhook destinations you configure, your violation of these terms, or your violation of law or third-party rights.
            </p>
          </Section>

          <Section title="13. Changes And Termination">
            <p>
              We may update these terms as the product changes. Updated terms will be posted with a new effective date. Continued use after changes means you accept the updated terms.
            </p>
            <p>
              You may stop using Banshi at any time. We may suspend or terminate access if needed to protect the service, other users, legal compliance, or platform integrity.
            </p>
          </Section>

          <Section title="14. Governing Law">
            <p>
              Unless a mandatory local law says otherwise, these terms are governed by the laws applicable to the service operator's principal place of business, without regard to conflict-of-law rules.
            </p>
          </Section>

          <Section title="15. Contact">
            <p>
              For support, account questions, or legal notices, use the support links below.
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              {Object.values(support).map((item) => (
                <a key={item.label} href={item.href} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded border border-zinc-800 bg-black/30 p-3 text-zinc-200 hover:border-emerald-300/30">
                  <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded border border-zinc-800 bg-black/40 text-emerald-200">
                    <TerminalIcon name={item.platform === 'discord' ? 'discord' : 'telegram'} className="h-5 w-5" />
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
        </div>
      </div>
    </main>
  )
}
