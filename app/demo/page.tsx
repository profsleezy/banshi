import Link from 'next/link'
import DashboardShell from '../../components/DashboardShell'
import TerminalIcon, { type IconName } from '../../components/TerminalIcon'

type DemoClient = {
  name: string
  handle: string
  followers: string
  posts: string
  readiness: number
  risk: 'Healthy' | 'Watch' | 'Risk' | 'Critical'
  priority: 'Routine' | 'Review' | 'Prepare' | 'Escalate'
  action: string
  signals: string[]
  points: number[]
}

const clients: DemoClient[] = [
  {
    name: 'Northline Athletics',
    handle: 'northline.fc',
    followers: '218K',
    posts: '1,482',
    readiness: 86,
    risk: 'Healthy',
    priority: 'Routine',
    action: 'Keep normal monitoring. Baseline is mature and current.',
    signals: ['fresh snapshots', 'stable identity', 'mature baseline'],
    points: [201, 204, 207, 211, 216, 218],
  },
  {
    name: 'Luma Skin Studio',
    handle: 'lumaskin.co',
    followers: '72.4K',
    posts: '913',
    readiness: 62,
    risk: 'Watch',
    priority: 'Review',
    action: 'Confirm the new external link matches the client campaign calendar.',
    signals: ['external link', 'link review', 'low volatility'],
    points: [71, 71.2, 71.5, 72, 72.1, 72.4],
  },
  {
    name: 'Vanta Capital',
    handle: 'vanta.capital',
    followers: '161K',
    posts: '3,428',
    readiness: 48,
    risk: 'Risk',
    priority: 'Prepare',
    action: 'Ask account owner to verify recent bio and link edits before the next post.',
    signals: ['bio changed', 'verified', 'follow drift'],
    points: [139, 140, 141, 158, 161, 161],
  },
  {
    name: 'Hale Collective',
    handle: 'hale.collective',
    followers: '44.1K',
    posts: '227',
    readiness: 31,
    risk: 'Critical',
    priority: 'Escalate',
    action: 'Escalate to owner. Username changed, scraper went stale, and follower delta is abnormal.',
    signals: ['username change', 'scraper stale', 'audience spike'],
    points: [40, 40.1, 40.2, 43.7, 44.1, 44.1],
  },
]

function riskClass(risk: DemoClient['risk']) {
  if (risk === 'Critical') return 'border-red-500/40 bg-red-500/10 text-red-200'
  if (risk === 'Risk') return 'border-orange-500/40 bg-orange-500/10 text-orange-200'
  if (risk === 'Watch') return 'border-amber-500/40 bg-amber-500/10 text-amber-100'
  return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
}

function priorityIcon(priority: DemoClient['priority']): IconName {
  if (priority === 'Escalate') return 'alert'
  if (priority === 'Prepare') return 'shield'
  if (priority === 'Review') return 'eye'
  return 'check'
}

function Sparkline({ points }: { points: number[] }) {
  const width = 240
  const height = 64
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = Math.max(0.1, max - min)
  const path = points.map((point, index) => {
    const x = (index / Math.max(1, points.length - 1)) * width
    const y = height - ((point - min) / span) * (height - 10) - 5
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-16 w-full" role="img" aria-label="Demo follower trend">
      <path d={path} fill="none" stroke="#9be7c4" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function DemoPage() {
  const incident = clients[3]

  return (
    <DashboardShell>
      <div className="terminal-boot p-4 sm:p-6">
        <section className="terminal-panel rounded-lg p-6 sm:p-8">
          <div className="terminal-chip inline-flex items-center gap-2 rounded px-3 py-1 text-xs font-medium">
            <TerminalIcon name="eye" className="h-3.5 w-3.5" />
            fake agency workspace
          </div>
          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px] xl:items-end">
            <div>
              <h1 className="max-w-4xl text-3xl font-semibold leading-tight text-zinc-50">
                See the value before installing the collector.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400">
                This demo uses sample clients and one simulated incident. It shows the agency loop: spot the account, understand why it matters, decide the next move, then keep an audit trail.
              </p>
            </div>
            <div className="rounded border border-zinc-800 bg-black/30 p-4">
              <div className="terminal-label text-xs">demo incident</div>
              <div className="mt-2 text-lg font-semibold text-red-100">{incident.name}</div>
              <p className="mt-2 text-sm leading-6 text-zinc-500">{incident.action}</p>
            </div>
          </div>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href="/pricing" className="terminal-button focus-ring inline-flex items-center justify-center gap-2 rounded px-5 py-3 text-sm font-semibold">
              Request access
              <TerminalIcon name="arrowRight" className="h-4 w-4" />
            </Link>
            <Link href="/docs/how-monitoring-works" className="terminal-button-secondary focus-ring inline-flex items-center justify-center gap-2 rounded px-5 py-3 text-sm font-medium">
              How monitoring works
              <TerminalIcon name="book" className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="terminal-card rounded p-4">
            <div className="terminal-label text-xs">client roster</div>
            <div className="mt-2 text-3xl font-semibold text-zinc-50">4</div>
            <div className="mt-1 text-xs text-zinc-500">sample monitored accounts</div>
          </div>
          <div className="terminal-card rounded p-4">
            <div className="terminal-label text-xs">agency queue</div>
            <div className="mt-2 text-3xl font-semibold text-amber-100">3</div>
            <div className="mt-1 text-xs text-zinc-500">accounts with useful next steps</div>
          </div>
          <div className="terminal-card rounded p-4">
            <div className="terminal-label text-xs">incident</div>
            <div className="mt-2 text-3xl font-semibold text-red-200">1</div>
            <div className="mt-1 text-xs text-zinc-500">simulated critical account</div>
          </div>
          <div className="terminal-card rounded p-4">
            <div className="terminal-label text-xs">readiness avg</div>
            <div className="mt-2 text-3xl font-semibold text-zinc-50">57</div>
            <div className="mt-1 text-xs text-zinc-500">coverage, baseline, and freshness</div>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-4">
            {clients.map((client) => (
              <article key={client.handle} className="terminal-card rounded p-5">
                <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-semibold text-zinc-50">{client.name}</h2>
                      <span className={`rounded border px-2.5 py-1 text-xs font-medium ${riskClass(client.risk)}`}>{client.risk}</span>
                      <span className="rounded border border-zinc-800 bg-black/30 px-2.5 py-1 text-xs text-zinc-400">{client.priority}</span>
                    </div>
                    <div className="mt-1 text-sm text-zinc-500">@{client.handle}</div>
                    <div className="mt-5 grid grid-cols-3 gap-3">
                      <div className="rounded border border-zinc-800 bg-black/25 p-3">
                        <div className="text-xs text-zinc-500">Followers</div>
                        <div className="mt-1 text-lg font-semibold text-zinc-50">{client.followers}</div>
                      </div>
                      <div className="rounded border border-zinc-800 bg-black/25 p-3">
                        <div className="text-xs text-zinc-500">Posts</div>
                        <div className="mt-1 text-lg font-semibold text-zinc-50">{client.posts}</div>
                      </div>
                      <div className="rounded border border-zinc-800 bg-black/25 p-3">
                        <div className="text-xs text-zinc-500">Readiness</div>
                        <div className="mt-1 text-lg font-semibold text-zinc-50">{client.readiness}/100</div>
                      </div>
                    </div>
                    <p className="mt-4 text-sm leading-6 text-zinc-400">{client.action}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {client.signals.map((signal) => (
                        <span key={signal} className="rounded border border-zinc-700 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-300">{signal}</span>
                      ))}
                    </div>
                  </div>
                  <div className="rounded border border-zinc-800 bg-black/30 p-4">
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <TerminalIcon name={priorityIcon(client.priority)} className="h-3.5 w-3.5 text-emerald-200" />
                      follower trend
                    </div>
                    <div className="mt-4">
                      <Sparkline points={client.points} />
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <aside className="terminal-panel h-max rounded p-5">
            <div className="terminal-label text-xs">incident report</div>
            <h2 className="mt-2 text-xl font-semibold text-zinc-50">Critical account change</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-400">
              Hale Collective changed username, audience jumped, and no fresh scraper event arrived after the change. Banshi separates that into incident types instead of hiding it inside one score.
            </p>
            <div className="terminal-divider my-5" />
            <div className="space-y-3">
              {[
                ['Account takeover', 'high', 'Identity changed and should be verified by owner.'],
                ['Manipulation', 'medium', 'Follower movement broke the normal baseline.'],
                ['Scraper stale', 'high', 'Open the profile tab again before relying on latest numbers.'],
                ['Next move', 'owner check', 'Confirm credentials, link, bio, and recent login activity.'],
              ].map(([label, value, detail]) => (
                <div key={label} className="rounded border border-zinc-800 bg-black/25 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-zinc-100">{label}</span>
                    <span className="text-xs text-amber-100">{value}</span>
                  </div>
                  <div className="mt-1 text-xs leading-5 text-zinc-500">{detail}</div>
                </div>
              ))}
            </div>
          </aside>
        </section>
      </div>
    </DashboardShell>
  )
}
