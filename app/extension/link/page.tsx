"use client"

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import DashboardShell from '../../../components/DashboardShell'
import supabase from '../../../lib/supabase'
import { createClient, setClientMonitoring, updateClient } from '../../../lib/clients'

function normalizeHandle(value: string) {
  return value.trim().replace(/^@/, '').toLowerCase()
}

function formatFollowers(value: number) {
  if (!Number.isFinite(value) || value <= 0) return '-'
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

export default function ExtensionLinkPage() {
  const params = useSearchParams()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handle = useMemo(() => normalizeHandle(params.get('handle') ?? ''), [params])
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
    if (!handle || submitting) return

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

      const qp = new URLSearchParams()
      qp.set('client_id', client.id)
      qp.set('handle', handle)
      qp.set('name', handle)
      if (res.existed) qp.set('existed', '1')
      router.push(`/extension/linked?${qp.toString()}`)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <DashboardShell>
        <div className="p-6">
          <div className="max-w-xl rounded border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-400">Checking your session...</div>
        </div>
      </DashboardShell>
    )
  }

  if (!user) {
    return (
      <DashboardShell>
        <div className="p-6">
          <div className="max-w-xl rounded border border-zinc-800 bg-zinc-900 p-5">
            <h1 className="text-lg font-semibold text-zinc-100">Sign In Required</h1>
            <p className="mt-2 text-sm text-zinc-400">Sign in before linking this Instagram profile to your dashboard.</p>
            <a href="/auth" className="mt-5 inline-flex rounded border border-emerald-500/30 px-3 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/10">
              Sign In
            </a>
          </div>
        </div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell>
      <div className="p-6">
        <div className="max-w-xl rounded border border-zinc-800 bg-zinc-900 p-5">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Extension Link</div>
          <h1 className="mt-2 text-xl font-semibold text-zinc-100">Start Monitoring</h1>

          <div className="mt-5 rounded border border-zinc-800 bg-zinc-950 p-4">
            <div className="text-xs text-zinc-500">Detected profile</div>
            <div className="mt-1 text-lg font-semibold text-zinc-100">{handle ? `@${handle}` : 'No profile detected'}</div>
            <div className="mt-1 text-sm text-zinc-500">{formatFollowers(followers)} followers</div>
          </div>

          {!handle && (
            <div className="mt-4 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
              Open an Instagram profile page, then use the extension again.
            </div>
          )}

          {error && (
            <div className="mt-4 rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100">{error}</div>
          )}

          <button
            type="button"
            disabled={!handle || submitting}
            onClick={startMonitoring}
            className="mt-5 w-full rounded border border-emerald-500/30 px-3 py-2 text-sm font-medium text-emerald-200 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Creating client...' : 'Create Client and Monitor'}
          </button>

          <a href="/dashboard" className="mt-3 inline-flex w-full justify-center rounded border border-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:border-zinc-700">
            Back to Dashboard
          </a>
        </div>
      </div>
    </DashboardShell>
  )
}
