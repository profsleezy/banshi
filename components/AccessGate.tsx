"use client"

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import TerminalIcon from './TerminalIcon'
import supabase from '../lib/supabase'
import type { UserAccessStatus } from '../lib/accessPlans'
import { getPublicSupportLinks } from '../lib/supportLinks'

type AccessState = {
  loading: boolean
  active: boolean
  access: UserAccessStatus | null
  error: string | null
  refresh: () => Promise<void>
}

const defaultAccess: UserAccessStatus = {
  active: false,
  status: 'pending',
  plan: 'request',
  planName: 'Request access',
  clientLimit: 0,
  clientCount: 0,
  remainingClients: 0,
  features: {},
  expiresAt: null,
  reason: 'Request access to unlock the workspace.',
}

export function useAccessStatus(): AccessState {
  const [loading, setLoading] = useState(true)
  const [access, setAccess] = useState<UserAccessStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) {
        setAccess(defaultAccess)
        return
      }

      const res = await fetch('/api/access/status', {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      })
      const body = await res.json().catch(() => null)
      if (!res.ok || !body?.success) throw new Error(body?.error || 'Could not check access')
      setAccess(body.access ?? defaultAccess)
    } catch (accessError) {
      setError((accessError as Error).message)
      setAccess(defaultAccess)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return {
    loading,
    active: !!access?.active,
    access,
    error,
    refresh,
  }
}

export function PaywallPanel({ access, error }: { access?: UserAccessStatus | null; error?: string | null }) {
  const current = access ?? defaultAccess
  const support = getPublicSupportLinks()

  return (
    <div className="terminal-boot mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <section className="terminal-panel rounded-lg p-6 sm:p-8">
        <div className="terminal-chip inline-flex items-center gap-2 rounded px-3 py-1 text-xs font-medium">
          <TerminalIcon name="lock" className="h-3.5 w-3.5" />
          workspace locked
        </div>
        <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_330px] lg:items-end">
          <div>
            <h1 className="max-w-3xl text-3xl font-semibold leading-tight text-zinc-50">
              Banshi is ready. Your workspace needs access enabled.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">
              Access is manually activated after plan confirmation. Once approved, the dashboard, client reports, snapshots, alerts, and extension sync unlock on the server side.
            </p>
          </div>
          <div className="rounded border border-zinc-800 bg-black/30 p-4">
            <div className="terminal-label text-xs">current status</div>
            <div className="mt-2 text-xl font-semibold text-zinc-100">{current.status}</div>
            <div className="mt-2 text-sm text-zinc-500">{error || current.reason || 'Waiting for access approval.'}</div>
          </div>
        </div>

        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          <div className="rounded border border-zinc-800 bg-black/25 p-4">
            <div className="text-sm font-medium text-zinc-100">No frontend bypass</div>
            <div className="mt-2 text-xs leading-5 text-zinc-500">Data APIs and Supabase policies check paid access before returning workspace records.</div>
          </div>
          <div className="rounded border border-zinc-800 bg-black/25 p-4">
            <div className="text-sm font-medium text-zinc-100">Manual approval</div>
            <div className="mt-2 text-xs leading-5 text-zinc-500">You get access when the workspace owner marks your user id active.</div>
          </div>
          <div className="rounded border border-zinc-800 bg-black/25 p-4">
            <div className="text-sm font-medium text-zinc-100">Setup included</div>
            <div className="mt-2 text-xs leading-5 text-zinc-500">The offer includes help linking the browser collector to your first monitored accounts.</div>
          </div>
        </div>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link href="/pricing" className="terminal-button focus-ring inline-flex items-center justify-center gap-2 rounded px-5 py-3 text-sm font-semibold">
            Request access
            <TerminalIcon name="arrowRight" className="h-4 w-4" />
          </Link>
          <a href={support.telegramProfile.href} target="_blank" rel="noreferrer" className="terminal-button-secondary focus-ring inline-flex items-center justify-center gap-2 rounded px-5 py-3 text-sm font-medium">
            <TerminalIcon name="telegram" className="h-4 w-4" />
            Message Telegram
          </a>
          <Link href="/demo" className="terminal-button-secondary focus-ring inline-flex items-center justify-center gap-2 rounded px-5 py-3 text-sm font-medium">
            View demo workspace
            <TerminalIcon name="eye" className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  )
}
