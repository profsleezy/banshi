import Link from 'next/link'
import TerminalIcon from './TerminalIcon'

export default function Navbar() {
  return (
    <nav className="w-full border-b border-emerald-300/10 bg-black/30">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-medium text-zinc-50">
          <TerminalIcon name="shield" className="h-5 w-5 text-emerald-200" />
          Banshi
        </Link>
        <div className="flex items-center gap-3 text-sm sm:gap-4">
          <Link href="/demo" className="hidden text-zinc-400 hover:text-zinc-100 sm:inline">Demo</Link>
          <Link href="/pricing" className="hidden text-zinc-400 hover:text-zinc-100 sm:inline">Pricing</Link>
          <Link href="/docs" className="hidden text-zinc-400 hover:text-zinc-100 lg:inline">Docs</Link>
          <Link href="/support" className="hidden text-zinc-400 hover:text-zinc-100 md:inline">Support</Link>
          <Link href="/dashboard" className="text-zinc-400 hover:text-zinc-100">Dashboard</Link>
          <Link href="/pricing" className="terminal-button rounded px-3.5 py-2 font-medium">Get access</Link>
        </div>
      </div>
    </nav>
  )
}
