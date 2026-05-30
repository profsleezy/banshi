import Link from 'next/link'
import DashboardShell from '../../components/DashboardShell'
import TerminalIcon from '../../components/TerminalIcon'
import { docsPages } from './docsContent'

export default function DocsPage() {
  return (
    <DashboardShell>
      <div className="terminal-boot mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <section className="terminal-panel rounded-lg p-6 sm:p-8">
          <div className="terminal-chip inline-flex items-center gap-2 rounded px-3 py-1 text-xs font-medium">
            <TerminalIcon name="book" className="h-3.5 w-3.5" />
            docs center
          </div>
          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
            <div>
              <h1 className="max-w-3xl text-3xl font-semibold leading-tight text-zinc-50">
                Operator docs for running Banshi without guessing.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400">
                Setup, monitoring behavior, risk language, webhooks, privacy, and troubleshooting. Written for agency operators who need to know what the system is doing and what to do next.
              </p>
            </div>
            <div className="rounded border border-zinc-800 bg-black/30 p-4">
              <div className="terminal-label text-xs">quick default</div>
              <div className="mt-2 text-lg font-semibold text-zinc-100">5 minute snapshots</div>
              <p className="mt-2 text-xs leading-5 text-zinc-500">
                Use 1 minute only while debugging. Most client monitoring should stay on 5 or 15 minutes to keep the backend quiet.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {docsPages.map((page) => (
            <Link key={page.slug} href={`/docs/${page.slug}`} className="terminal-card focus-ring group rounded p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-zinc-700 bg-zinc-900 text-emerald-200">
                  <TerminalIcon name={page.icon} className="h-4 w-4" />
                </div>
                <span className="rounded border border-zinc-800 bg-black/30 px-2 py-1 text-xs text-zinc-500">{page.readTime}</span>
              </div>
              <div className="terminal-label mt-5 text-xs">{page.kicker}</div>
              <h2 className="mt-2 text-lg font-semibold text-zinc-50">{page.title}</h2>
              <p className="mt-3 min-h-16 text-sm leading-6 text-zinc-500">{page.summary}</p>
              <div className="mt-5 inline-flex items-center gap-2 text-sm text-zinc-400 transition group-hover:text-emerald-200">
                Open guide
                <TerminalIcon name="arrowRight" className="h-4 w-4" />
              </div>
            </Link>
          ))}
        </section>
      </div>
    </DashboardShell>
  )
}
