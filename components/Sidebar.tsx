"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import TerminalIcon from './TerminalIcon'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: 'radar' },
  { href: '/clients', label: 'Clients', icon: 'briefcase' },
  { href: '/alerts', label: 'Alerts', icon: 'alert' },
  { href: '/settings', label: 'Settings', icon: 'settings' },
  { href: '/onboarding/extension', label: 'Install guide', icon: 'terminal' },
  { href: '/support', label: 'Support', icon: 'users' },
  { href: '/docs', label: 'Docs', icon: 'book' },
] as const

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden w-72 shrink-0 border-r border-zinc-800/80 bg-black/30 p-4 backdrop-blur md:block">
      <div className="terminal-panel rounded p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded border border-zinc-700 bg-zinc-900 text-emerald-200">
            <TerminalIcon name="shield" className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-semibold text-zinc-50">Banshi</div>
            <div className="text-xs text-zinc-500">Agency monitoring</div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded border border-zinc-800 bg-black/30 p-2">
            <div className="terminal-label">status</div>
            <div className="mt-1 text-zinc-200">active</div>
          </div>
          <div className="rounded border border-zinc-800 bg-black/30 p-2">
            <div className="terminal-label">scope</div>
            <div className="mt-1 text-zinc-200">public IG</div>
          </div>
        </div>
      </div>

      <nav className="mt-5 flex flex-col gap-2" aria-label="Sidebar navigation">
        {navItems.map((item) => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname?.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex items-center justify-between rounded border px-3 py-2.5 text-sm transition ${
                active
                  ? 'border-zinc-700 bg-zinc-900 text-zinc-100'
                  : 'border-transparent text-zinc-400 hover:border-zinc-800 hover:bg-zinc-900/70 hover:text-zinc-100'
              }`}
            >
              <span className="flex items-center gap-3">
                <TerminalIcon name={item.icon} className="h-4 w-4" />
                {item.label}
              </span>
              <TerminalIcon name="chevron" className={`h-3.5 w-3.5 transition ${active ? 'text-zinc-400' : 'text-zinc-700 group-hover:text-zinc-400'}`} />
            </Link>
          )
        })}
      </nav>

      <div className="mt-5 rounded border border-zinc-800 bg-zinc-950/70 p-3">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <TerminalIcon name="database" className="h-3.5 w-3.5 text-cyan-200" />
          Snapshot ledger
        </div>
        <div className="mt-2 text-xs leading-5 text-zinc-400">
          Every account view is built from event metadata, derived risk fields, alerts, and risk history.
        </div>
      </div>
    </aside>
  )
}
