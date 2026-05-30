"use client"

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import DashboardShell from '../../../components/DashboardShell'
import TerminalIcon from '../../../components/TerminalIcon'
import supabase from '../../../lib/supabase'
import { createClient, issueClientIngestToken, setClientMonitoring, updateClient } from '../../../lib/clients'
import { PaywallPanel, useAccessStatus } from '../../../components/AccessGate'

const IG_PROFILE_PATH_BLACKLIST = ['p', 'explore', 'stories', 'direct', 'accounts', 'a', 'reel', 'reels', 'tag', 'tv', 'about', 'developer', 'graphql']

function normalizeHandle(value: string) {
  return value.trim().replace(/^@/, '').toLowerCase()
}

function isValidProfileHandle(value: string) {
  return /^[a-z0-9._]{1,30}$/i.test(value) && !IG_PROFILE_PATH_BLACKLIST.includes(value)
}

function formatFollowers(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '-'
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

export default function ExtensionLinkPage() {
  const params = useSearchParams()
  const access = useAccessStatus()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handle = useMemo(() => normalizeHandle(params.get('handle') ?? ''), [params])
  const validHandle = isValidProfileHandle(handle)
  const followers = Number(params.get('followers') ?? 0)
  const bio = params.get('bio') ?? ''

  useEffect(() => {
    let mounted = true

    async function init() {
      setLoading(true)
      const { data } = await supabase.auth.getUser()
      if (!mounted) return
      setUser(data?.user ?? null)
      setLoading(false)
    }

    init()
    return () => {
      mounted = false
    }
  }, [])

  async function startMonitoring() {
    if (!validHandle || submitting) return

    setSubmitting(true)
    setError(null)
    try {
      const res = await createClient({
        client_name: handle,
        platform: 'IG',
        account_id: handle,
        notes: bio || undefined,
      })

      if (res.error || !res.data) {
        setError((res.error as any)?.message ?? 'Could not create the client.')
        return
      }

      const client = res.data
      if (client.name !== handle || client.account_id !== handle) {
        const changes: any = { name: handle, account_id: handle }
        if (bio || client.notes) changes.notes = bio || client.notes
        await updateClient(client.id, changes)
      }

      const monitoringRes = await setClientMonitoring(client.id, true)
      if (monitoringRes.error) {
        setError((monitoringRes.error as any)?.message ?? 'Could not enable monitoring.')
        return
      }

      const tokenRes = await issueClientIngestToken(client.id)
      if (tokenRes.error || !tokenRes.data) {
        setError((tokenRes.error as any)?.message ?? 'Could not create the secure extension token.')
        return
      }

      const qp = new URLSearchParams()
      qp.set('client_id', client.id)
      qp.set('handle', handle)
      qp.set('name', handle)
      if (res.existed) qp.set('existed', '1')

      const hash = new URLSearchParams()
      hash.set('ingest_token', tokenRes.data.ingest_token)
      hash.set('token_created_at', tokenRes.data.created_at)

      // Force a real navigation so the Chrome extension reliably sees the tokenized URL.
      window.location.assign(`/extension/linked?${qp.toString()}#${hash.toString()}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || access.loading) {
    return (
      <DashboardShell>
        <div className="terminal-boot p-6">
          <div className="terminal-card max-w-xl rounded p-5 text-sm text-zinc-400">Checking your session...</div>
        </div>
      </DashboardShell>
    )
  }

  if (!user) {
    return (
      <DashboardShell>
        <div className="terminal-boot p-6">
          <div className="terminal-card max-w-xl rounded p-5">
            <h1 className="text-lg font-semibold text-zinc-100">Sign In Required</h1>
            <p className="mt-2 text-sm text-zinc-400">Sign in before linking this Instagram profile to your dashboard.</p>
            <a href="/auth" className="terminal-button mt-5 inline-flex rounded px-3 py-2 text-sm font-medium">
              Sign In
            </a>
          </div>
        </div>
      </DashboardShell>
    )
  }

  if (!access.active) {
    return (
      <DashboardShell>
        <PaywallPanel access={access.access} error={access.error} />
      </DashboardShell>
    )
  }

  return (
    <DashboardShell>
      <div className="terminal-boot p-6">
        <div className="terminal-panel max-w-xl rounded p-5">
          <div className="terminal-label text-xs">Extension Link</div>
          <h1 className="mt-2 flex items-center gap-2 text-xl font-semibold text-zinc-100">
            <TerminalIcon name="radar" className="h-5 w-5 text-emerald-200" />
            Start Monitoring
          </h1>

          <div className="mt-5 rounded border border-zinc-800 bg-black/30 p-4">
            <div className="text-xs text-zinc-500">Detected profile</div>
            <div className="mt-1 text-lg font-semibold text-zinc-100">{validHandle ? `@${handle}` : 'No profile detected'}</div>
            <div className="mt-1 text-sm text-zinc-500">{formatFollowers(followers)} followers</div>
          </div>

          <div className="mt-4 rounded border border-zinc-800 bg-zinc-950/70 p-3 text-sm leading-6 text-zinc-400">
            Live snapshots run from the Instagram profile tab opened in Chrome. Keep that profile tab open or in the background; this setup tab can be closed after monitoring starts.
          </div>

          {!validHandle && (
            <div className="mt-4 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
              Open an Instagram profile page, then use the extension again.
            </div>
          )}

          {error && (
            <div className="mt-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">{error}</div>
          )}

          <button
            type="button"
            disabled={!validHandle || submitting}
            onClick={startMonitoring}
            className="terminal-button focus-ring mt-5 inline-flex w-full items-center justify-center gap-2 rounded px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
          >
            <TerminalIcon name={submitting ? 'refresh' : 'check'} className="h-4 w-4" />
            {submitting ? 'Creating client...' : 'Create Client and Monitor'}
          </button>

          <a href="/dashboard" className="terminal-button-secondary focus-ring mt-3 inline-flex w-full justify-center rounded px-3 py-2 text-sm">
            Back to Dashboard
          </a>
        </div>
      </div>
    </DashboardShell>
  )
}
