"use client"

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardShell from '../../components/DashboardShell'
import TerminalIcon, { type IconName } from '../../components/TerminalIcon'
import supabase from '../../lib/supabase'
import { getClients } from '../../lib/clients'
import { signOut } from '../../lib/auth'
import { PaywallPanel, useAccessStatus } from '../../components/AccessGate'
import {
  buildClientInsight,
  groupByClientId,
  trendSeries,
  type ClientInsight,
  type EventRow,
  type RiskHistoryRow,
  type RiskStatusRow,
} from '../../lib/clientInsights'
import type { Alert } from '../../types/alert'

type FilterMode = 'all' | 'monitoring' | 'paused' | 'attention'

function formatCompact(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-'
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function formatSigned(value?: number | null, suffix = '') {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}${suffix}`
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

function timeAgo(value?: string | null) {
  if (!value) return 'No snapshots'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No snapshots'
  const diffMs = Date.now() - date.getTime()
  if (diffMs < 60 * 1000) return 'Just now'
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function priorityClass(priority: ClientInsight['priority']) {
  if (priority === 'Escalate') return 'border-red-500/40 bg-red-500/10 text-red-200'
  if (priority === 'Prepare') return 'border-orange-500/40 bg-orange-500/10 text-orange-200'
  if (priority === 'Review') return 'border-amber-500/40 bg-amber-500/10 text-amber-100'
  return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
}

function statusClass(status?: string | null) {
  if (status === 'Critical') return 'border-red-500/40 bg-red-500/10 text-red-200'
  if (status === 'Risk') return 'border-orange-500/40 bg-orange-500/10 text-orange-200'
  if (status === 'Watch') return 'border-amber-500/40 bg-amber-500/10 text-amber-100'
  if (status === 'Healthy') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
  return 'border-zinc-700 bg-zinc-950 text-zinc-400'
}

function signalClass(tone: string) {
  if (tone === 'critical') return 'border-red-500/40 bg-red-500/10 text-red-200'
  if (tone === 'risk') return 'border-orange-500/40 bg-orange-500/10 text-orange-200'
  if (tone === 'watch') return 'border-amber-500/40 bg-amber-500/10 text-amber-100'
  if (tone === 'good') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
  return 'border-zinc-700 bg-zinc-950 text-zinc-300'
}

function StatCard({ label, value, caption, tone = 'neutral', icon }: { label: string; value: string | number; caption: string; tone?: 'neutral' | 'good' | 'watch' | 'risk'; icon: IconName }) {
  const toneClass = {
    neutral: 'text-zinc-100',
    good: 'text-emerald-200',
    watch: 'text-amber-100',
    risk: 'text-red-200',
  }[tone]

  return (
    <div className="terminal-card rounded p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="terminal-label text-xs">{label}</div>
          <div className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</div>
        </div>
        <div className="flex h-9 w-9 items-center justify-center rounded border border-emerald-300/20 bg-emerald-300/10 text-emerald-200">
          <TerminalIcon name={icon} className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-1 text-xs text-zinc-500">{caption}</div>
    </div>
  )
}

function MiniSparkline({ insight }: { insight: ClientInsight }) {
  const points = trendSeries(insight.snapshots, 'followers')
  if (points.length < 2) {
    return <div className="flex h-20 items-center justify-center rounded border border-zinc-800 bg-black/30 text-xs text-zinc-600">No trend yet</div>
  }

  const width = 360
  const height = 80
  const min = Math.min(...points.map((point) => point.value))
  const max = Math.max(...points.map((point) => point.value))
  const span = Math.max(1, max - min)
  const path = points.map((point, index) => {
    const x = points.length === 1 ? 0 : (index / (points.length - 1)) * width
    const y = height - ((point.value - min) / span) * (height - 12) - 6
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')

  return (
    <div className="rounded border border-zinc-800 bg-black/35 p-3">
      <div className="mb-2 flex items-center justify-between text-xs text-zinc-500">
        <span>Follower trend</span>
        <span>{formatCompact(min)} to {formatCompact(max)}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-20 w-full overflow-visible" role="img" aria-label="Follower trend sparkline">
        <path d={path} fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

function ClientCard({ insight }: { insight: ClientInsight }) {
  const topSignals = insight.signals.slice(0, 4)

  return (
    <article className={`terminal-card terminal-boot rounded p-5 ${insight.monitoringEnabled ? '' : 'border-amber-500/30'}`}>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-xl font-semibold text-zinc-50">{insight.displayName}</h2>
                <span className={`rounded border px-2.5 py-1 text-xs font-medium ${statusClass(insight.riskStatus)}`}>
                  {insight.riskStatus ?? 'No score'}{typeof insight.riskScore === 'number' ? ` ${insight.riskScore}` : ''}
                </span>
                <span className={`rounded border px-2.5 py-1 text-xs font-medium ${insight.monitoringEnabled ? signalClass('good') : signalClass('watch')}`}>
                  {insight.monitoringEnabled ? 'Monitoring' : 'Paused'}
                </span>
              </div>
              <div className="mt-1 text-sm text-zinc-500">@{insight.handle || insight.accountId || 'unknown'} - {insight.platform}</div>
              <div className="mt-2 text-xs text-zinc-600">Latest snapshot: {formatDate(insight.snapshotAt || insight.lastChecked)} ({timeAgo(insight.snapshotAt)})</div>
            </div>

            <Link href={`/clients/${insight.id}`} className="terminal-button-secondary focus-ring inline-flex shrink-0 items-center justify-center gap-2 rounded px-3 py-2 text-sm font-medium">
              <TerminalIcon name="chart" className="h-4 w-4" />
              Open report
            </Link>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="terminal-card-muted rounded p-3">
              <div className="text-xs text-zinc-500">Followers</div>
              <div className="mt-1 text-xl font-semibold text-zinc-50">{formatCompact(insight.followers)}</div>
              <div className="mt-1 text-xs text-zinc-500">{formatSigned(insight.followerPctChange30d, '%')} 30d</div>
            </div>
            <div className="terminal-card-muted rounded p-3">
              <div className="text-xs text-zinc-500">Velocity</div>
              <div className="mt-1 text-xl font-semibold text-zinc-50">{formatSigned(insight.followerVelocity7d, '/day')}</div>
              <div className="mt-1 text-xs text-zinc-500">7 day follower movement</div>
            </div>
            <div className="terminal-card-muted rounded p-3">
              <div className="text-xs text-zinc-500">Stability</div>
              <div className="mt-1 text-xl font-semibold text-zinc-50">{typeof insight.profileStabilityScore === 'number' ? `${insight.profileStabilityScore}/100` : '-'}</div>
              <div className="mt-1 text-xs text-zinc-500">{insight.snapshotCount ?? 0} snapshots</div>
            </div>
            <div className="terminal-card-muted rounded p-3">
              <div className="text-xs text-zinc-500">Ban readiness</div>
              <div className={`mt-1 text-xl font-semibold ${insight.banRiskReadinessLevel === 'Ready' ? 'text-emerald-200' : insight.banRiskReadinessLevel === 'Watch' ? 'text-amber-100' : 'text-red-200'}`}>{insight.banRiskReadinessScore}/100</div>
              <div className="mt-1 text-xs text-zinc-500">{insight.banRiskReadinessLevel}</div>
            </div>
          </div>

          <div className="mt-4">
            <MiniSparkline insight={insight} />
          </div>
        </div>

        <div className="rounded border border-zinc-800 bg-black/30 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-zinc-500">Agency queue</div>
              <div className="mt-1 text-sm font-medium text-zinc-100">Recommended next move</div>
            </div>
            <span className={`rounded border px-2.5 py-1 text-xs font-medium ${priorityClass(insight.priority)}`}>{insight.priority}</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-zinc-400">{insight.recommendedAction}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {topSignals.map((signal) => (
              <span key={signal.label} className={`rounded border px-2.5 py-1 text-xs font-medium ${signalClass(signal.tone)}`}>{signal.label}</span>
            ))}
          </div>
          {insight.riskNotes && <div className="mt-4 border-t border-zinc-800 pt-3 text-xs leading-5 text-zinc-500">{insight.riskNotes}</div>}
        </div>
      </div>
    </article>
  )
}

export default function ClientsPage() {
  const router = useRouter()
  const access = useAccessStatus()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [insights, setInsights] = useState<ClientInsight[]>([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterMode>('all')

  const loadClients = useCallback(async (initial = false) => {
    if (initial) setLoading(true)
    else setRefreshing(true)
    setError(null)

    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        router.push('/auth')
        return
      }

      const clientsRes = await getClients()
      if (clientsRes.error) {
        setError((clientsRes.error as any)?.message ?? 'Could not load clients')
        setInsights([])
        return
      }

      const clients = clientsRes.data ?? []
      const clientIds = clients.map((client) => client.id)
      if (clientIds.length === 0) {
        setInsights([])
        setLastUpdated(new Date().toISOString())
        return
      }

      const snapshotLimit = Math.min(5000, Math.max(250, clientIds.length * 80))
      const historyLimit = Math.min(1000, Math.max(100, clientIds.length * 20))
      const alertLimit = Math.min(500, Math.max(100, clientIds.length * 10))

      const [snapshotsRes, riskStatusRes, riskHistoryRes, alertsRes] = await Promise.all([
        supabase
          .from('events')
          .select('id, client_id, type, metadata, created_at')
          .in('client_id', clientIds)
          .eq('type', 'PROFILE_SNAPSHOT')
          .order('created_at', { ascending: false })
          .limit(snapshotLimit),
        supabase
          .from('risk_status')
          .select('client_id, status, score, notes, updated_at')
          .in('client_id', clientIds),
        supabase
          .from('risk_history')
          .select('id, client_id, event_id, score, level, notes, payload, created_at')
          .in('client_id', clientIds)
          .order('created_at', { ascending: false })
          .limit(historyLimit),
        supabase
          .from('alerts')
          .select('*')
          .in('client_id', clientIds)
          .order('created_at', { ascending: false })
          .limit(alertLimit),
      ])

      if (snapshotsRes.error) setError('Clients loaded, but snapshots could not be read.')
      if (riskStatusRes.error) setError('Clients loaded, but risk status could not be read.')
      if (riskHistoryRes.error) setError('Clients loaded, but risk history could not be read.')
      if (alertsRes.error) setError('Clients loaded, but alerts could not be read.')

      const snapshotsByClient = groupByClientId((snapshotsRes.data ?? []) as EventRow[])
      const historyByClient = groupByClientId((riskHistoryRes.data ?? []) as RiskHistoryRow[])
      const alertsByClient = groupByClientId((alertsRes.data ?? []) as Alert[])
      const riskByClient = new Map<string, RiskStatusRow>()
      ;((riskStatusRes.data ?? []) as RiskStatusRow[]).forEach((row) => riskByClient.set(row.client_id, row))

      const nextInsights = clients.map((client) => buildClientInsight({
        client,
        snapshots: snapshotsByClient.get(client.id) ?? [],
        riskStatus: riskByClient.get(client.id) ?? null,
        riskHistory: historyByClient.get(client.id) ?? [],
        alerts: alertsByClient.get(client.id) ?? [],
      }))

      setInsights(nextInsights)
      setLastUpdated(new Date().toISOString())
    } catch (loadError) {
      setError((loadError as any)?.message ?? 'Client intelligence refresh failed')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [router])

  useEffect(() => {
    loadClients(true)
  }, [loadClients])

  const stats = useMemo(() => {
    const total = insights.length
    const monitored = insights.filter((insight) => insight.monitoringEnabled).length
    const paused = total - monitored
    const attention = insights.filter((insight) => insight.priority === 'Escalate' || insight.priority === 'Prepare' || insight.priority === 'Review').length
    const live = insights.filter((insight) => {
      if (!insight.snapshotAt) return false
      const age = Date.now() - new Date(insight.snapshotAt).getTime()
      return age >= 0 && age <= 24 * 60 * 60 * 1000
    }).length

    return { total, monitored, paused, attention, live }
  }, [insights])

  const filteredInsights = useMemo(() => {
    const term = query.trim().toLowerCase()
    const priorityOrder: Record<ClientInsight['priority'], number> = { Escalate: 0, Prepare: 1, Review: 2, Routine: 3 }

    return insights
      .filter((insight) => {
        if (filter === 'monitoring' && !insight.monitoringEnabled) return false
        if (filter === 'paused' && insight.monitoringEnabled) return false
        if (filter === 'attention' && insight.priority === 'Routine') return false
        if (!term) return true
        return [insight.displayName, insight.handle, insight.accountId, insight.platform]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term))
      })
      .sort((a, b) => {
        const prioritySort = priorityOrder[a.priority] - priorityOrder[b.priority]
        if (prioritySort !== 0) return prioritySort
        const monitoringSort = (a.monitoringEnabled === false ? 1 : 0) - (b.monitoringEnabled === false ? 1 : 0)
        if (monitoringSort !== 0) return monitoringSort
        return (b.riskScore ?? 0) - (a.riskScore ?? 0)
      })
  }, [filter, insights, query])

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
          <div className="mb-6 h-8 w-56 animate-pulse rounded bg-zinc-900" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded border border-zinc-800 bg-zinc-900" />)}
          </div>
          <div className="mt-6 space-y-4">
            {[0, 1].map((item) => <div key={item} className="h-72 animate-pulse rounded border border-zinc-800 bg-zinc-900" />)}
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
      <div className="terminal-boot p-4 sm:p-6">
        <div className="terminal-panel mb-6 rounded p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="terminal-label text-xs">agency account protection</div>
            <h1 className="mt-2 text-2xl font-semibold text-zinc-50">Client Intelligence</h1>
            <div className="mt-2 text-sm text-zinc-500">
              Latest refresh: {lastUpdated ? formatDate(lastUpdated) : '-'}
              {refreshing && <span className="ml-2 text-emerald-200">Refreshing roster...</span>}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href="/dashboard" className="terminal-button-secondary focus-ring inline-flex items-center gap-2 rounded px-3 py-2 text-sm">
              <TerminalIcon name="radar" className="h-4 w-4" />
              Dashboard
            </Link>
            <button
              type="button"
              disabled={refreshing}
              onClick={() => loadClients(false)}
              className="terminal-button-secondary focus-ring inline-flex items-center gap-2 rounded px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              <TerminalIcon name="refresh" className="h-4 w-4" />
              {refreshing ? 'Refreshing...' : 'Refresh'}
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

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon="briefcase" label="Client roster" value={stats.total} caption={`${stats.monitored} monitored, ${stats.paused} paused`} />
          <StatCard icon="alert" label="Agency queue" value={stats.attention} caption="Accounts needing review or prep" tone={stats.attention > 0 ? 'watch' : 'neutral'} />
          <StatCard icon="database" label="Live coverage" value={stats.live} caption="Snapshot seen in the last 24h" tone={stats.live > 0 ? 'good' : 'neutral'} />
          <StatCard icon="eye" label="Paused accounts" value={stats.paused} caption="Visible but not collecting snapshots" tone={stats.paused > 0 ? 'watch' : 'neutral'} />
        </div>

        <section className="terminal-card mb-5 rounded p-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <label className="block">
              <span className="sr-only">Search clients</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by client, handle, or platform"
                className="terminal-input w-full rounded px-3 py-2 text-sm placeholder:text-zinc-600"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {([
                ['all', 'All'],
                ['monitoring', 'Monitoring'],
                ['paused', 'Paused'],
                ['attention', 'Attention'],
              ] as Array<[FilterMode, string]>).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                  className={`focus-ring rounded border px-3 py-2 text-sm transition ${filter === value ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {filteredInsights.length === 0 ? (
          <div className="terminal-card rounded border-dashed p-10 text-center">
            <div className="text-sm font-medium text-zinc-200">No clients match this view</div>
            <div className="mt-1 text-sm text-zinc-500">Clear the search or switch filters to see the full roster.</div>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredInsights.map((insight) => <ClientCard key={insight.id} insight={insight} />)}
          </div>
        )}
      </div>
    </DashboardShell>
  )
}
