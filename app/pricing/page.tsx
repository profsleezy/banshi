"use client"

import Link from 'next/link'
import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import Navbar from '../../components/Navbar'
import TerminalIcon from '../../components/TerminalIcon'
import { accessPlans, type AccessPlanKey } from '../../lib/accessPlans'
import { compactUrl, getPublicSupportLinks } from '../../lib/supportLinks'
import supabase from '../../lib/supabase'

type RequestState = 'idle' | 'sending' | 'sent' | 'error'

export default function PricingPage() {
  const links = useMemo(() => getPublicSupportLinks(), [])
  const [selectedPlan, setSelectedPlan] = useState<AccessPlanKey>('agency')
  const [requestState, setRequestState] = useState<RequestState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [checkingSession, setCheckingSession] = useState(true)
  const [authEmail, setAuthEmail] = useState<string | null>(null)
  const [form, setForm] = useState({
    contact: '',
    clientRange: '6-25 clients',
  })

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setAuthEmail(data.session?.user.email ?? null)
      setCheckingSession(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthEmail(session?.user.email ?? null)
      setCheckingSession(false)
    })

    return () => {
      active = false
      listener.subscription.unsubscribe()
    }
  }, [])

  async function submitRequest(event: FormEvent) {
    event.preventDefault()
    if (requestState === 'sending') return
    if (!authEmail) {
      setRequestState('error')
      setError('Sign in first so access can be attached to the right account.')
      return
    }
    if (!form.contact.trim()) {
      setRequestState('error')
      setError('Add Telegram so setup can continue.')
      return
    }
    setRequestState('sending')
    setError(null)

    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Sign in first so access can be attached to the right account.')
      const res = await fetch('/api/access/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          email: authEmail,
          telegram: form.contact,
          discord: '',
          plan: selectedPlan,
          message: `Client range: ${form.clientRange}`,
        }),
      })
      const body = await res.json().catch(() => null)
      if (!res.ok || !body?.success) throw new Error(body?.error || 'Request failed')
      setRequestState('sent')
    } catch (requestError) {
      setRequestState('error')
      setError((requestError as Error).message)
    }
  }

  return (
    <main className="min-h-screen">
      <Navbar />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <section className="terminal-panel rounded-lg p-6 sm:p-8">
          <div className="terminal-chip inline-flex items-center gap-2 rounded px-3 py-1 text-xs font-medium">
            <TerminalIcon name="lock" className="h-3.5 w-3.5" />
            manual activation
          </div>
          <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_390px] xl:items-end">
            <div>
              <h1 className="max-w-4xl text-4xl font-semibold leading-tight text-zinc-50">
                Pick a plan. Sign in. Get unlocked.
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-zinc-400">
                Access is manual for now: create an account, choose the roster size, then send a request or DM. Once approved, the same signed-in account opens the dashboard.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <a href={links.telegramProfile.href} target="_blank" rel="noreferrer" className="terminal-button focus-ring inline-flex items-center justify-center gap-2 rounded px-5 py-3 text-sm font-semibold">
                  <TerminalIcon name="telegram" className="h-4 w-4" />
                  Message on Telegram
                </a>
              </div>
            </div>
            <div className="rounded border border-zinc-800 bg-black/30 p-4">
              <div className="terminal-label text-xs">access flow</div>
              <div className="mt-3 space-y-3 text-sm text-zinc-400">
                <div><span className="text-zinc-100">1.</span> Sign in or create an account.</div>
                <div><span className="text-zinc-100">2.</span> Request the plan for that account.</div>
                <div><span className="text-zinc-100">3.</span> Refresh after approval and start setup.</div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-4">
          {accessPlans.map((plan) => (
            <button
              key={plan.key}
              type="button"
              onClick={() => setSelectedPlan(plan.key)}
              className={`focus-ring terminal-card rounded p-5 text-left transition ${
                selectedPlan === plan.key ? 'border-emerald-300/45 bg-emerald-300/5' : ''
              } ${plan.highlighted ? 'ring-1 ring-emerald-300/15' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="terminal-label text-xs">{plan.clientLimit} clients</div>
                  <h2 className="mt-2 text-lg font-semibold text-zinc-50">{plan.name}</h2>
                </div>
                {plan.highlighted && <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 text-xs text-emerald-200">recommended</span>}
              </div>
              <div className="mt-4 text-3xl font-semibold text-zinc-50">{plan.price}</div>
              <p className="mt-3 min-h-16 text-sm leading-6 text-zinc-500">{plan.description}</p>
              <div className="mt-4 space-y-2">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-2 text-xs leading-5 text-zinc-400">
                    <TerminalIcon name="check" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-200" />
                    {feature}
                  </div>
                ))}
              </div>
            </button>
          ))}
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="terminal-panel rounded p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="terminal-label text-xs">request access</div>
                <h2 className="mt-2 text-2xl font-semibold text-zinc-50">
                  {authEmail ? 'Send the unlock request' : 'Sign in before requesting'}
                </h2>
                <p className="mt-2 text-sm leading-6 text-zinc-500">
                  {authEmail
                    ? `Signed in as ${authEmail}. Selected: ${accessPlans.find((plan) => plan.key === selectedPlan)?.name}.`
                    : 'This keeps the request tied to the exact account that will be unlocked.'}
                </p>
              </div>
              <Link href="/demo" className="terminal-button-secondary focus-ring inline-flex items-center justify-center gap-2 rounded px-3 py-2 text-sm">
                Demo
                <TerminalIcon name="eye" className="h-4 w-4" />
              </Link>
            </div>

            {checkingSession ? (
              <div className="mt-5 rounded border border-zinc-800 bg-black/25 p-4 text-sm text-zinc-400">Checking sign-in...</div>
            ) : authEmail ? (
              <form onSubmit={submitRequest}>
                <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                  <input
                    className="terminal-input rounded px-3 py-3 text-sm"
                    placeholder="Telegram username"
                    value={form.contact}
                    onChange={(event) => setForm((current) => ({ ...current, contact: event.target.value }))}
                  />
                  <select
                    className="terminal-input rounded px-3 py-3 text-sm"
                    value={form.clientRange}
                    onChange={(event) => setForm((current) => ({ ...current, clientRange: event.target.value }))}
                  >
                    <option>1-5 clients</option>
                    <option>6-25 clients</option>
                    <option>26-75 clients</option>
                    <option>75+ clients</option>
                  </select>
                </div>

                {error && <div className="mt-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">{error}</div>}
                {requestState === 'sent' && <div className="mt-4 rounded border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">Request saved. After approval, refresh the dashboard with this same account.</div>}

                <button
                  type="submit"
                  disabled={requestState === 'sending'}
                  className="terminal-button focus-ring mt-5 inline-flex w-full items-center justify-center gap-2 rounded px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <TerminalIcon name={requestState === 'sending' ? 'refresh' : 'arrowRight'} className="h-4 w-4" />
                  {requestState === 'sending' ? 'Sending request...' : 'Request unlock'}
                </button>
              </form>
            ) : (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Link href="/auth?next=/pricing" className="terminal-button focus-ring inline-flex items-center justify-center gap-2 rounded px-4 py-3 text-sm font-semibold">
                  <TerminalIcon name="lock" className="h-4 w-4" />
                  Sign in / create account
                </Link>
                <a href={links.telegramProfile.href} target="_blank" rel="noreferrer" className="terminal-button-secondary focus-ring inline-flex items-center justify-center gap-2 rounded px-4 py-3 text-sm font-medium">
                  <TerminalIcon name="telegram" className="h-4 w-4" />
                  DM instead
                </a>
              </div>
            )}
          </div>

          <aside className="terminal-card h-max rounded p-5">
            <div className="terminal-label text-xs">direct contact</div>
            <h2 className="mt-2 text-xl font-semibold text-zinc-50">Fast setup path</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-500">Skip the form. DM the plan name, account count, and the email you used to sign in.</p>
            <div className="mt-5 space-y-3">
              {Object.values(links).map((link) => (
                <a key={link.href} href={link.href} target="_blank" rel="noreferrer" className="terminal-button-secondary focus-ring flex items-center justify-between gap-3 rounded px-3 py-3 text-sm">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded border border-zinc-800 bg-black/35 text-emerald-200">
                      <TerminalIcon name={link.platform} className="h-5 w-5" />
                      {link.mode === 'community' && (
                        <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-zinc-800 bg-zinc-950 text-cyan-200">
                          <TerminalIcon name="users" className="h-2.5 w-2.5" />
                        </span>
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-zinc-100">{link.label}</span>
                    <span className="mt-1 block text-xs text-zinc-500">{compactUrl(link.href)}</span>
                  </span>
                </span>
                  <TerminalIcon name="arrowRight" className="h-4 w-4 text-zinc-500" />
                </a>
              ))}
            </div>
          </aside>
        </section>
      </div>
    </main>
  )
}
