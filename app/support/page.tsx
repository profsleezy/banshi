import Link from 'next/link'
import TerminalIcon from '../../components/TerminalIcon'
import { compactUrl, getPublicSupportLinks } from '../../lib/supportLinks'

export default function SupportPage() {
  const links = Object.values(getPublicSupportLinks())

  return (
    <main className="terminal-shell">
      <header className="border-b border-zinc-800/80 bg-black/25">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3 text-zinc-50">
            <span className="flex h-10 w-10 items-center justify-center rounded border border-zinc-700 bg-zinc-900 text-emerald-200">
              <TerminalIcon name="shield" className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-lg font-semibold">Banshi</span>
              <span className="block text-xs text-zinc-500">support desk</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/privacy" className="hidden text-sm text-zinc-500 hover:text-zinc-200 sm:inline">
              Privacy
            </Link>
            <Link href="/pricing" className="hidden text-sm text-zinc-500 hover:text-zinc-200 sm:inline">
              Pricing
            </Link>
            <Link href="/auth" className="terminal-button-secondary focus-ring rounded px-3 py-2 text-sm">
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="terminal-panel rounded-lg p-6 sm:p-8">
          <div className="terminal-chip inline-flex items-center gap-2 rounded px-3 py-1 text-xs font-medium">
            <TerminalIcon name="users" className="h-3.5 w-3.5" />
            direct operator support
          </div>
          <h1 className="mt-5 max-w-3xl text-3xl font-semibold leading-tight text-zinc-50 sm:text-4xl">
            Get help without digging through a ticket maze.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">
            Support is intentionally simple: Telegram DM for setup and urgent questions, plus a Telegram community for updates and operating notes.
          </p>

          <div className="mt-8 grid gap-3 md:grid-cols-2">
            {links.map((item) => (
              <a key={item.label} href={item.href} target="_blank" rel="noreferrer" className="terminal-card group rounded p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="relative flex h-9 w-9 items-center justify-center rounded border border-zinc-800 bg-black/40 text-emerald-200">
                    <TerminalIcon name={item.platform} className="h-5 w-5" />
                    {item.mode === 'community' && (
                      <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 text-cyan-200">
                        <TerminalIcon name="users" className="h-2.5 w-2.5" />
                      </span>
                    )}
                  </span>
                  <TerminalIcon name="arrowRight" className="h-4 w-4 text-zinc-600 transition group-hover:text-emerald-200" />
                </div>
                <h2 className="mt-4 text-base font-semibold text-zinc-50">{item.label}</h2>
                <p className="mt-2 min-h-16 text-sm leading-6 text-zinc-400">{item.description}</p>
                <div className="mt-4 truncate rounded border border-zinc-800 bg-black/30 px-2 py-1.5 text-xs text-zinc-500">
                  {compactUrl(item.href)}
                </div>
              </a>
            ))}
          </div>
        </div>

        <aside className="terminal-card rounded p-5">
          <div className="terminal-label text-xs">before contacting</div>
          <h2 className="mt-2 text-xl font-semibold text-zinc-50">Send useful context</h2>
          <div className="mt-5 space-y-3 text-sm leading-6 text-zinc-400">
            <p>For extension issues, include the Instagram handle, whether the profile tab is still open, and the latest error shown in the extension.</p>
            <p>For webhook issues, include the destination type, the time you clicked test, and whether the delivery log shows sent, skipped, or failed.</p>
            <p>For account reports, include the client handle and the chart or signal that looks wrong.</p>
          </div>
          <div className="terminal-divider my-5" />
          <Link href="/onboarding/extension" className="terminal-button focus-ring inline-flex w-full items-center justify-center gap-2 rounded px-4 py-2.5 text-sm font-semibold">
            Extension setup guide
            <TerminalIcon name="arrowRight" className="h-4 w-4" />
          </Link>
        </aside>
      </section>
    </main>
  )
}
