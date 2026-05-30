"use client"

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signIn, signUp } from '../../lib/auth'
import TerminalIcon from '../../components/TerminalIcon'

export default function AuthPage() {
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [nextPath, setNextPath] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const requestedNext = new URLSearchParams(window.location.search).get('next')
    setNextPath(requestedNext && requestedNext.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : null)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    try {
      if (mode === 'signUp') {
        const res = await signUp(email, password)
        if (res.error) setMessage(res.error.message)
        else setMessage('Check your email for the confirmation link.')
      } else {
        const res = await signIn(email, password)
        if (res.error) setMessage(res.error.message)
        else {
          if (nextPath) {
            router.push(nextPath)
          } else {
            let onboardingSeen = false
            try {
              onboardingSeen = window.localStorage.getItem('banshi_extension_onboarding_seen') === '1'
            } catch {
              onboardingSeen = false
            }
            router.push(onboardingSeen ? '/dashboard' : '/onboarding/extension')
          }
        }
      }
    } catch (err) {
      setMessage('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="terminal-shell flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-5xl grid-cols-1 overflow-hidden rounded-lg border border-emerald-300/10 bg-black/20 lg:grid-cols-[1fr_430px]">
        <section className="terminal-panel hidden p-8 lg:block">
          <Link href="/" className="inline-flex items-center gap-3 text-zinc-100">
            <span className="flex h-10 w-10 items-center justify-center rounded border border-emerald-300/30 bg-emerald-300/10 text-emerald-200">
              <TerminalIcon name="shield" className="h-5 w-5" />
            </span>
            <span>
              <span className="block text-lg font-semibold">Banshi</span>
              <span className="block text-xs text-zinc-500">secure workspace access</span>
            </span>
          </Link>

          <div className="mt-16">
            <div className="terminal-chip inline-flex items-center gap-2 rounded px-3 py-1 text-xs font-medium">
              <TerminalIcon name="lock" className="h-3.5 w-3.5" />
              authenticated console
            </div>
            <h1 className="mt-5 max-w-xl text-3xl font-semibold leading-tight text-zinc-50">
              Enter the account integrity workspace.
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-zinc-400">
              Monitor public profile signals, review client health, and use the audit trail when your team needs proof instead of guesswork.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-3 gap-3">
            {[
              ['auth', 'private'],
              ['audit', 'ready'],
              ['risk', 'live'],
            ].map(([label, value]) => (
              <div key={label} className="rounded border border-zinc-800 bg-black/30 p-3">
                <div className="terminal-label text-xs">{label}</div>
                <div className="mt-1 text-sm font-medium text-emerald-200">{value}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-[#080a0d]/95 p-5 sm:p-8">
          <div className="mb-8 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100 lg:hidden">
              <TerminalIcon name="shield" className="h-4 w-4 text-emerald-200" />
              Banshi
            </Link>
            <div className="ml-auto rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-zinc-500">operator</div>
          </div>

          <div>
            <div className="terminal-label text-xs">{mode === 'signIn' ? 'session start' : 'operator setup'}</div>
            <h2 className="mt-2 text-2xl font-semibold text-zinc-50">{mode === 'signIn' ? 'Sign in' : 'Create account'}</h2>
            <p className="mt-2 text-sm text-zinc-500">Access the monitoring dashboard and client intelligence reports.</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <label className="block">
              <span className="mb-1 block text-sm text-zinc-300">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="terminal-input w-full rounded px-3 py-2.5 text-sm"
                placeholder="operator@agency.com"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm text-zinc-300">Password</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="terminal-input w-full rounded px-3 py-2.5 text-sm"
                placeholder="Your secure password"
              />
            </label>

            {message && (
              <div className="rounded border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">{message}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="terminal-button focus-ring inline-flex w-full items-center justify-center gap-2 rounded px-4 py-2.5 text-sm font-semibold"
            >
              {loading ? <TerminalIcon name="refresh" className="h-4 w-4" /> : <TerminalIcon name="lock" className="h-4 w-4" />}
              {loading ? 'Authenticating...' : mode === 'signIn' ? 'Enter console' : 'Create operator'}
            </button>
          </form>

          <div className="mt-5 rounded border border-zinc-800 bg-zinc-950/70 p-3 text-center text-sm text-zinc-400">
            {mode === 'signIn' ? (
              <>
                Need an account?{' '}
                <button className="font-medium text-emerald-200 hover:text-emerald-100" onClick={() => setMode('signUp')}>
                  Create one
                </button>
              </>
            ) : (
              <>
                Already registered?{' '}
                <button className="font-medium text-emerald-200 hover:text-emerald-100" onClick={() => setMode('signIn')}>
                  Sign in
                </button>
              </>
            )}
          </div>

          <div className="mt-4 flex justify-center gap-4 text-xs text-zinc-600">
            <Link href="/privacy" className="hover:text-zinc-300">Privacy</Link>
            <Link href="/terms" className="hover:text-zinc-300">Terms</Link>
            <Link href="/support" className="hover:text-zinc-300">Support</Link>
          </div>
        </section>
      </div>
    </main>
  )
}
