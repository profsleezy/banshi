import Link from 'next/link'
import TerminalIcon from '../components/TerminalIcon'
import { compactUrl, getPublicSupportLinks } from '../lib/supportLinks'

function SupportCard({
  label,
  href,
  description,
  platform,
  mode,
}: {
  label: string
  href: string
  description: string
  platform: 'telegram'
  mode: 'direct' | 'community'
}) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="terminal-card group rounded p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex h-10 w-10 items-center justify-center rounded border border-zinc-800 bg-black/35 text-emerald-200">
          <TerminalIcon name={platform} className="h-5 w-5" />
          {mode === 'community' && (
            <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 text-cyan-200">
              <TerminalIcon name="users" className="h-2.5 w-2.5" />
            </span>
          )}
        </div>
        <TerminalIcon name="arrowRight" className="h-4 w-4 text-zinc-600 transition group-hover:text-emerald-200" />
      </div>
      <h3 className="mt-5 text-base font-semibold text-zinc-50">{label}</h3>
      <p className="mt-2 min-h-16 text-sm leading-6 text-zinc-400">{description}</p>
      <div className="mt-4 truncate text-xs text-zinc-500">{compactUrl(href)}</div>
    </a>
  )
}

function TerminalPreview() {
  const rows = [
    ['@creator.alpha', 'Healthy', '12', '+0.4%', 'stable'],
    ['@brand.ops', 'Watch', '38', '+18.2%', 'link added'],
    ['@creator.ops', 'Risk', '67', '-24.0%', 'rapid loss'],
    ['@launch.team', 'Healthy', '7', '+2.1%', 'verified'],
  ]

  return (
    <div className="terminal-panel rounded-lg p-4">
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-100">
          <TerminalIcon name="radar" className="h-4 w-4 text-emerald-200" />
          live watchlist
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-zinc-500">128 watched</span>
          <span className="h-1 w-1 rounded-full bg-zinc-700" />
          <span className="text-amber-200">9 review</span>
          <span className="h-1 w-1 rounded-full bg-zinc-700" />
          <span className="text-red-200">2 urgent</span>
        </div>
      </div>
      <div className="mt-4 overflow-hidden rounded border border-zinc-800 bg-black/40">
        <div className="grid grid-cols-[1.2fr_.7fr_.5fr_.7fr_1fr] gap-3 border-b border-zinc-800 px-3 py-2 text-xs uppercase tracking-wide text-zinc-500">
          <span>account</span>
          <span>state</span>
          <span>score</span>
          <span>30d</span>
          <span>signal</span>
        </div>
        {rows.map((row) => (
          <div key={row[0]} className="grid grid-cols-[1.2fr_.7fr_.5fr_.7fr_1fr] gap-3 border-b border-zinc-800/70 px-3 py-3 text-sm last:border-0">
            <span className="truncate text-zinc-100">{row[0]}</span>
            <span className={row[1] === 'Risk' ? 'text-orange-200' : row[1] === 'Watch' ? 'text-amber-100' : 'text-emerald-200'}>{row[1]}</span>
            <span className="text-zinc-300">{row[2]}</span>
            <span className={row[3].startsWith('-') ? 'text-red-200' : 'text-emerald-200'}>{row[3]}</span>
            <span className="truncate text-zinc-500">{row[4]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Home() {
  const support = getPublicSupportLinks()
  const supportLinks = Object.values(support)

  return (
    <main className="terminal-shell">
      <header className="border-b border-zinc-800/80 bg-black/25">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded border border-zinc-700 bg-zinc-900 text-emerald-200">
              <TerminalIcon name="shield" className="h-5 w-5" />
            </div>
            <div>
              <div className="text-lg font-semibold text-zinc-50">Banshi</div>
              <div className="text-xs text-zinc-500">account integrity monitoring</div>
            </div>
          </div>
          <nav className="flex items-center gap-3 text-sm sm:gap-4">
            <Link href="/demo" className="hidden text-zinc-500 hover:text-zinc-100 md:inline">Demo</Link>
            <Link href="/pricing" className="hidden text-zinc-500 hover:text-zinc-100 md:inline">Pricing</Link>
            <Link href="/support" className="hidden text-zinc-500 hover:text-zinc-100 sm:inline">Support</Link>
            <Link href="/auth" className="text-zinc-500 hover:text-zinc-100">Sign in</Link>
            <Link href="/pricing" className="terminal-button focus-ring rounded px-3.5 py-2 text-sm font-medium">Get access</Link>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_560px] lg:items-center lg:py-16">
        <div className="terminal-boot">
          <div className="terminal-chip inline-flex items-center gap-2 rounded px-3 py-1 text-xs font-medium">
            <TerminalIcon name="activity" className="h-3.5 w-3.5" />
            Instagram account watchlist
          </div>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight text-zinc-50 sm:text-5xl">
            Catch risky profile changes early.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-zinc-400">
            Banshi watches public Instagram profiles for follower swings, profile edits, new links, stale collection, and takeover-looking changes. Your team gets a clear warning and a report clients can understand.
          </p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <Link href="/demo" className="terminal-button focus-ring inline-flex items-center justify-center gap-2 rounded px-5 py-3 text-sm font-semibold">
              See the demo
              <TerminalIcon name="arrowRight" className="h-4 w-4" />
            </Link>
            <Link href="/pricing" className="terminal-button-secondary focus-ring inline-flex items-center justify-center gap-2 rounded px-5 py-3 text-sm font-medium">
              Get access
              <TerminalIcon name="lock" className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 border-l border-emerald-300/20 pl-4 text-sm text-zinc-400">
            <span className="text-zinc-100">Watches the account</span>
            <span>spots unusual changes</span>
            <span>tells you what to check next</span>
          </div>
        </div>

        <TerminalPreview />
      </section>

      <div className="terminal-divider mx-auto max-w-7xl" />

      <section id="how" className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-center">
          <div>
            <div className="terminal-label text-xs">how it helps</div>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-50">From "something feels off" to a clean next step.</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-500">
              Less digging around. The page should answer: is the account fresh, what changed, and what should I check?
            </p>
          </div>

          <div className="relative">
            <div className="absolute left-3 top-3 hidden h-[calc(100%-1.5rem)] w-px bg-gradient-to-b from-emerald-300/40 via-zinc-700 to-transparent md:block" />
            <div className="space-y-5 md:pl-12">
              {[
                ['Watch', 'Open Instagram profile tabs collect public snapshots in the background.'],
                ['Warn', 'Banshi flags sudden audience movement, profile edits, new links, and stale data.'],
                ['Act', 'The report gives a plain-language reason and a next move: ignore, review, prepare, or escalate.'],
              ].map(([title, copy], index) => (
                <div key={title} className="relative grid gap-2 border-b border-zinc-800/80 pb-5 last:border-0 last:pb-0 sm:grid-cols-[120px_minmax(0,1fr)]">
                  <div className="flex items-center gap-3">
                    <span className="hidden h-6 w-6 items-center justify-center rounded-full border border-emerald-300/25 bg-[#080a0d] text-xs text-emerald-200 md:flex">{index + 1}</span>
                    <span className="text-base font-semibold text-zinc-50">{title}</span>
                  </div>
                  <p className="text-sm leading-6 text-zinc-400">{copy}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="terminal-divider mx-auto max-w-7xl" />

      <section id="support" className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start">
          <div>
            <div className="terminal-label text-xs">support loop</div>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-50">Talk to a human before setup friction turns into churn.</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-500">
              Monitoring teams need fast answers: extension setup, webhook routing, profile sync, and report questions. Pick the channel you already use and move.
            </p>
            <Link href="/onboarding/extension" className="terminal-button-secondary focus-ring mt-5 inline-flex items-center gap-2 rounded px-4 py-2.5 text-sm font-medium">
              Extension setup guide
              <TerminalIcon name="arrowRight" className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {supportLinks.map((item) => (
              <SupportCard key={item.label} {...item} />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6">
        <div className="grid gap-5 border-t border-zinc-800/80 pt-8 lg:grid-cols-[minmax(0,1fr)_560px] lg:items-center">
          <div>
            <div className="terminal-label text-xs">next action</div>
            <h2 className="mt-2 max-w-2xl text-3xl font-semibold leading-tight text-zinc-50">
              Shortest path: demo, plan, setup.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-500">
              Look at the sample incident first. If it matches the problem you sell against, pick a plan and DM the account count.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Link href="/demo" className="group rounded border border-zinc-800/80 px-4 py-3 hover:border-cyan-300/30">
              <TerminalIcon name="eye" className="h-5 w-5 text-cyan-200" />
              <div className="mt-3 text-sm font-semibold text-zinc-50">Demo</div>
            </Link>
            <Link href="/pricing" className="group rounded border border-zinc-800/80 px-4 py-3 hover:border-emerald-300/30">
              <TerminalIcon name="lock" className="h-5 w-5 text-emerald-200" />
              <div className="mt-3 text-sm font-semibold text-zinc-50">Get access</div>
            </Link>
            <a href={support.telegramProfile.href} target="_blank" rel="noreferrer" className="group rounded border border-zinc-800/80 px-4 py-3 hover:border-emerald-300/30">
              <TerminalIcon name="telegram" className="h-5 w-5 text-emerald-200" />
              <div className="mt-3 text-sm font-semibold text-zinc-50">DM setup</div>
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-800/80 px-4 py-8 text-sm text-zinc-500 sm:px-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>Banshi. Built for account integrity teams and agencies.</div>
          <div className="flex flex-wrap gap-4">
            <Link href="/privacy" className="hover:text-zinc-200">Privacy</Link>
            <Link href="/terms" className="hover:text-zinc-200">Terms</Link>
            <Link href="/demo" className="hover:text-zinc-200">Demo</Link>
            <Link href="/pricing" className="hover:text-zinc-200">Pricing</Link>
            <Link href="/support" className="hover:text-zinc-200">Support</Link>
            <Link href="/dashboard" className="hover:text-zinc-200">Dashboard</Link>
          </div>
        </div>
      </footer>
    </main>
  )
}
