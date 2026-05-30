import Sidebar from './Sidebar'
import TerminalIcon from './TerminalIcon'
import type { PropsWithChildren } from 'react'

export default function DashboardShell({ children }: PropsWithChildren) {
  return (
    <div className="terminal-shell flex min-h-screen">
      <Sidebar />
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-20 border-b border-zinc-800/80 bg-[#050607]/92 backdrop-blur">
          <div className="flex min-h-14 flex-col gap-2 px-4 py-3 lg:flex-row lg:items-center lg:justify-between lg:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded border border-zinc-700 bg-zinc-900 text-emerald-200">
                <TerminalIcon name="shield" className="h-4 w-4" />
              </div>
              <div>
                <div className="text-sm font-medium text-zinc-100">Account Integrity</div>
                <div className="text-xs text-zinc-500">public profile risk intelligence</div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded border border-zinc-800 bg-zinc-950/60 px-2 py-1 text-zinc-300">snapshots</span>
              <span className="rounded border border-zinc-800 bg-zinc-950/60 px-2 py-1 text-zinc-500">derived metrics</span>
              <span className="rounded border border-zinc-800 bg-zinc-950/60 px-2 py-1 text-zinc-500">risk history</span>
            </div>
          </div>
          <nav className="flex gap-2 overflow-x-auto border-t border-zinc-800/80 px-4 py-2 md:hidden" aria-label="Mobile navigation">
            {[
              ['Dashboard', '/dashboard'],
              ['Clients', '/clients'],
              ['Alerts', '/alerts'],
              ['Settings', '/settings'],
              ['Setup', '/onboarding/extension'],
              ['Support', '/support'],
              ['Docs', '/docs'],
            ].map(([label, href]) => (
              <a key={href} href={href} className="shrink-0 rounded border border-zinc-800 bg-zinc-950/80 px-3 py-1.5 text-xs text-zinc-300">
                {label}
              </a>
            ))}
          </nav>
        </header>
        {children}
      </main>
    </div>
  )
}
