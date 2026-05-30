"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardShell from '../../components/DashboardShell'
import TerminalIcon from '../../components/TerminalIcon'
import AlertFeed, { type AlertRow } from '../../components/AlertFeed'
import supabase from '../../lib/supabase'
import { getRecentAlerts } from '../../lib/alerts'
import { signOut } from '../../lib/auth'
import { PaywallPanel, useAccessStatus } from '../../components/AccessGate'

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

export default function AlertsPage() {
  const router = useRouter()
  const access = useAccessStatus()
  const [alerts, setAlerts] = useState<AlertRow[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  const loadAlerts = useCallback(async (initial = false) => {
    if (initial) setLoading(true)
    else setRefreshing(true)
    setError(null)

    try {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        router.push('/auth')
        return
      }

      const res = await getRecentAlerts(100)
      if (res.error) {
        setError((res.error as any)?.message ?? 'Could not load alerts')
        return
      }

      setAlerts((res.data ?? []).map((alert) => ({
        id: alert.id,
        title: alert.message.split('\n')[0] || 'Alert',
        message: alert.message,
        severity: alert.severity,
        created_at: alert.created_at,
      })))
      setLastUpdated(new Date().toISOString())
    } catch (loadError) {
      setError((loadError as any)?.message ?? 'Alert refresh failed')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [router])

  useEffect(() => {
    loadAlerts(true)
  }, [loadAlerts])

  const stats = useMemo(() => {
    const critical = alerts.filter((alert) => alert.severity === 'critical').length
    const warning = alerts.filter((alert) => alert.severity === 'warning').length
    const latest = alerts[0]?.created_at ?? null
    return { total: alerts.length, critical, warning, latest }
  }, [alerts])

  if (access.loading) {
    return (
      <DashboardShell>
        <div className="p-4 sm:p-6">
          <div className="terminal-panel rounded p-5 text-sm text-zinc-400">Checking workspace access...</div>
        </div>
      </DashboardShell>
    )
  }

  if (loading) {
    return (
      <DashboardShell>
        <div className="p-4 sm:p-6">
          <div className="mb-6 h-8 w-48 animate-pulse rounded bg-zinc-900" />
          <div className="h-96 animate-pulse rounded border border-zinc-800 bg-zinc-900" />
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
      <div className="terminal-boot p-4 sm:p-6">
        <div className="terminal-panel mb-6 rounded p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="terminal-label text-xs">incident queue</div>
              <h1 className="mt-2 text-2xl font-semibold text-zinc-50">Alert Console</h1>
              <div className="mt-2 text-sm text-zinc-500">
                Latest refresh: {lastUpdated ? formatDate(lastUpdated) : '-'}
                {refreshing && <span className="ml-2 text-emerald-200">Refreshing alerts...</span>}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={refreshing}
                onClick={() => loadAlerts(false)}
                className="terminal-button-secondary focus-ring inline-flex items-center gap-2 rounded px-3 py-2 text-sm disabled:opacity-60"
              >
                <TerminalIcon name="refresh" className="h-4 w-4" />
                Refresh
              </button>
              <button
                type="button"
                onClick={async () => {
                  await signOut()
                  router.push('/auth')
                }}
                className="terminal-button-secondary focus-ring rounded px-3 py-2 text-sm"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {error && <div className="mb-4 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">{error}</div>}

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="terminal-card rounded p-4">
            <div className="terminal-label text-xs">total</div>
            <div className="mt-2 text-2xl font-semibold text-zinc-50">{stats.total}</div>
          </div>
          <div className="terminal-card rounded p-4">
            <div className="terminal-label text-xs">critical</div>
            <div className="mt-2 text-2xl font-semibold text-red-200">{stats.critical}</div>
          </div>
          <div className="terminal-card rounded p-4">
            <div className="terminal-label text-xs">warning</div>
            <div className="mt-2 text-2xl font-semibold text-amber-100">{stats.warning}</div>
          </div>
          <div className="terminal-card rounded p-4">
            <div className="terminal-label text-xs">latest</div>
            <div className="mt-2 text-sm font-medium text-zinc-100">{formatDate(stats.latest)}</div>
          </div>
        </div>

        <AlertFeed alerts={alerts} />
      </div>
    </DashboardShell>
  )
}
