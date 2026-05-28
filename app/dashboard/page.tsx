"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import DashboardShell from '../../components/DashboardShell'
import supabase from '../../lib/supabase'
import { signOut } from '../../lib/auth'
import { deleteClientAndRelated, getClients, setClientMonitoring } from '../../lib/clients'
import ClientTable, { ClientRow } from '../../components/ClientTable'
import { getRecentAlerts } from '../../lib/alerts'
import AlertFeed from '../../components/AlertFeed'

type AlertItem = {
  id: string
  client_id?: string
  title: string
  message: string
  severity: 'warning' | 'critical'
  created_at?: string
  payload?: any
}

type RiskHistoryItem = {
  id: string
  client_id: string
  clientName: string
  score: number
  level: string
  notes?: string | null
  created_at?: string
}

type RiskStatusRow = {
  client_id: string
  status: string
  score: number
  notes?: string | null
  updated_at?: string | null
}

type EventRow = {
  id: string
  client_id: string
  type: string
  metadata?: any
  created_at?: string
}

type RiskHistoryRow = {
  id: string
  client_id: string
  score: number
  level: string
  notes?: string | null
  payload?: any
  created_at?: string
}

const REFRESH_MS = 30000

async function fetchLatestSnapshots(clientIds: string[]): Promise<{ data: EventRow[]; error: unknown }> {
  if (clientIds.length === 0) return { data: [], error: null }

  try {
    const session = await supabase.auth.getSession()
    const token = session.data.session?.access_token
    if (!token) return { data: [], error: 'Not authenticated' }

    const res = await fetch('/api/clients/latest-snapshots', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store',
      body: JSON.stringify({ client_ids: clientIds }),
    })
    const body = await res.json().catch(() => null)

    if (!res.ok || !body?.success) {
      return { data: [], error: body?.error || `Snapshot request failed (${res.status})` }
    }

    return { data: (body.events ?? []) as EventRow[], error: null }
  } catch (error) {
    return { data: [], error }
  }
}

function safeNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string') return null

  const match = value.trim().replace(/,/g, '').match(/^([0-9]*\.?[0-9]+)\s*([kmb])?$/i)
  if (!match) return null

  let parsed = Number(match[1])
  if (!Number.isFinite(parsed)) return null
  const suffix = match[2]?.toLowerCase()
  if (suffix === 'k') parsed *= 1000
  if (suffix === 'm') parsed *= 1000000
  if (suffix === 'b') parsed *= 1000000000
  return Math.round(parsed)
}

function normalizeIdentity(value: unknown) {
  return String(value ?? '').trim().replace(/^@/, '').toLowerCase()
}

function cleanProfileName(value: unknown, handle: unknown, fallback: string) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim()
  if (!text) return fallback

  const nameKey = normalizeIdentity(text)
  const handleKey = normalizeIdentity(handle)
  if (!nameKey || nameKey === handleKey) return fallback

  const compactName = nameKey.replace(/[^a-z0-9]/g, '')
  const compactHandle = handleKey.replace(/[^a-z0-9]/g, '')
  const nameParts = nameKey.split(/[^a-z0-9]+/).filter((part) => part.length >= 3)
  const handleParts = handleKey.split(/[^a-z0-9]+/).filter((part) => part.length >= 3)
  const related =
    compactHandle.includes(compactName) ||
    compactName.includes(compactHandle) ||
    nameParts.some((part) => compactHandle.includes(part)) ||
    handleParts.some((part) => compactName.includes(part))

  return related ? text : fallback
}

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value

  try {
    return JSON.parse(trimmed)
  } catch (e) {
    return value
  }
}

function candidatePayloads(source: any): Record<string, any>[] {
  const parsed = parseMaybeJson(source)
  if (!isRecord(parsed)) return []

  const candidates = [
    parsed,
    parsed.metadata,
    parsed.snapshot,
    parsed.profile,
    parsed.payload,
    parsed.event,
    parsed.event?.metadata,
    parsed.current,
    parsed.currentEvent,
    parsed.currentEvent?.metadata,
  ].map(parseMaybeJson).filter(isRecord)

  const unique: Record<string, any>[] = []
  candidates.forEach((candidate) => {
    if (!unique.includes(candidate)) unique.push(candidate)
  })

  return unique
}

function readFirst(sources: any[], key: string) {
  for (const source of sources) {
    for (const candidate of candidatePayloads(source)) {
      if (candidate[key] !== undefined && candidate[key] !== null) return candidate[key]
    }
  }
  return null
}

function readAny(sources: any[], keys: string[]) {
  for (const key of keys) {
    const value = readFirst(sources, key)
    if (value !== null) return value
  }
  return null
}

function readDerived(sources: any[]) {
  for (const source of sources) {
    for (const candidate of candidatePayloads(source)) {
      if (isRecord(candidate.derived)) return candidate.derived
    }
  }
  return {}
}

function formatDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleString()
}

function timeAgo(value?: string | null) {
  if (!value) return 'No snapshots yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No snapshots yet'
  const diffMs = Date.now() - date.getTime()
  if (diffMs < 60 * 1000) return 'Just now'
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function statusClass(status?: string | null) {
  if (status === 'Critical') return 'border-red-500/40 bg-red-500/10 text-red-200'
  if (status === 'Risk') return 'border-orange-500/40 bg-orange-500/10 text-orange-200'
  if (status === 'Watch') return 'border-amber-500/40 bg-amber-500/10 text-amber-100'
  if (status === 'Healthy') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
  return 'border-zinc-700 bg-zinc-900 text-zinc-400'
}

function SnapshotCard({ title, value, caption, tone = 'neutral' }: { title: string; value: string | number; caption: string; tone?: 'neutral' | 'good' | 'warn' | 'bad' }) {
  const toneClass = {
    neutral: 'text-zinc-100',
    good: 'text-emerald-200',
    warn: 'text-amber-100',
    bad: 'text-red-200',
  }[tone]

  return (
    <div className="rounded border border-zinc-800 bg-zinc-900 p-4">
      <div className="text-xs uppercase text-zinc-500">{title}</div>
      <div className={`mt-2 text-2xl font-semibold ${toneClass}`}>{value}</div>
      <div className="mt-1 text-xs text-zinc-500">{caption}</div>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [dashboardError, setDashboardError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [recentAlerts, setRecentAlerts] = useState<AlertItem[]>([])
  const [riskHistory, setRiskHistory] = useState<RiskHistoryItem[]>([])
  const [monitoringClientId, setMonitoringClientId] = useState<string | null>(null)
  const [unmonitoringClientId, setUnmonitoringClientId] = useState<string | null>(null)
  const [removingClientId, setRemovingClientId] = useState<string | null>(null)
  const [clientRows, setClientRows] = useState<ClientRow[]>([])

  const fetchDashboardData = useCallback(async (initial = false) => {
    if (initial) setLoading(true)
    else setRefreshing(true)

    setDashboardError(null)

    try {
      const { data } = await supabase.auth.getUser()
      if (!data.user) {
        router.push('/auth')
        return
      }

      const clientsRes = await getClients()
      if (clientsRes.error) {
        setDashboardError((clientsRes.error as any)?.message ?? 'Could not load clients')
        setClientRows([])
        return
      }

      const clients = clientsRes.data ?? []
      const clientIds = clients.map((client) => client.id)

      if (clientIds.length === 0) {
        setClientRows([])
        setRecentAlerts([])
        setRiskHistory([])
        setLastUpdated(new Date().toISOString())
        return
      }

      const latestEventsPromise = fetchLatestSnapshots(clientIds)

      const latestAlertsPromise = Promise.all(clientIds.map(async (clientId) => {
        const res = await supabase
          .from('alerts')
          .select('*')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        return { clientId, data: res.data as any | null, error: res.error }
      }))

      const latestHistoryPromise = Promise.all(clientIds.map(async (clientId) => {
        const res = await supabase
          .from('risk_history')
          .select('id, client_id, score, level, notes, payload, created_at')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        return { clientId, data: res.data as RiskHistoryRow | null, error: res.error }
      }))

      const [latestEventResults, latestAlertResults, latestHistoryResults, alertsRes, riskStatusRes, riskHistoryRes] = await Promise.all([
        latestEventsPromise,
        latestAlertsPromise,
        latestHistoryPromise,
        getRecentAlerts(25),
        supabase
          .from('risk_status')
          .select('client_id, status, score, notes, updated_at')
          .in('client_id', clientIds),
        supabase
          .from('risk_history')
          .select('id, client_id, score, level, notes, payload, created_at')
          .in('client_id', clientIds)
          .order('created_at', { ascending: false })
          .limit(Math.max(25, clientIds.length * 5)),
      ])

      if (latestEventResults.error) {
        setDashboardError('Loaded clients, but profile snapshots could not be read.')
      }

      if (riskStatusRes.error) {
        setDashboardError('Loaded clients, but risk status could not be read.')
      }

      if (riskHistoryRes.error) {
        setDashboardError('Loaded clients, but risk history could not be read.')
      }

      const alerts = alertsRes.data ?? []
      const alertsForUi = alerts.map((alert) => ({
        id: alert.id,
        client_id: alert.client_id,
        title: alert.message.split('\n')[0] ?? alert.message,
        message: alert.message,
        severity: alert.severity,
        created_at: alert.created_at,
        payload: alert.payload,
      }))

      const riskByClient = new Map<string, RiskStatusRow>()
      const riskRows = (riskStatusRes.data ?? []) as RiskStatusRow[]
      riskRows.forEach((row) => {
        riskByClient.set(row.client_id, row)
      })

      const latestAlertByClient = new Map<string, AlertItem>()
      latestAlertResults.forEach((result) => {
        const alert = result.data
        if (alert) {
          latestAlertByClient.set(result.clientId, {
            id: alert.id,
            client_id: alert.client_id,
            title: alert.message?.split('\n')[0] ?? alert.message ?? 'Alert',
            message: alert.message ?? '',
            severity: alert.severity,
            created_at: alert.created_at,
            payload: alert.payload,
          })
        }
      })

      const latestEventByClient = new Map<string, EventRow>()
      latestEventResults.data.forEach((event) => {
        if (event?.client_id) latestEventByClient.set(event.client_id, event)
      })

      const historyRowsRaw = (riskHistoryRes.data ?? []) as RiskHistoryRow[]
      const latestHistoryByClient = new Map<string, RiskHistoryRow>()
      latestHistoryResults.forEach((result) => {
        if (result.data) latestHistoryByClient.set(result.clientId, result.data)
      })

      const rows: ClientRow[] = clients.map((client) => {
        const latestSnapshotMetadata = (client as any).latest_snapshot_metadata
        const cachedLatest = isRecord(latestSnapshotMetadata)
          ? {
              id: `client-cache-${client.id}`,
              client_id: client.id,
              type: 'PROFILE_SNAPSHOT',
              metadata: latestSnapshotMetadata,
              created_at: client.last_checked ?? undefined,
            } as EventRow
          : null
        const latest = latestEventByClient.get(client.id) ?? cachedLatest
        const latestAlert = latestAlertByClient.get(client.id)
        const latestHistory = latestHistoryByClient.get(client.id)
        const sources = [latest?.metadata, latestAlert?.payload, latestHistory?.payload]
        const derived = readDerived(sources)
        const risk = riskByClient.get(client.id)
        const handle = readAny(sources, ['handle', 'username', 'account_id'])
        const name = readAny(sources, ['name', 'full_name', 'profile_name'])
        const metadataHandle = typeof handle === 'string' ? handle : null
        const displayHandle = client.account_id || metadataHandle
        const fallbackName = displayHandle || client.name || 'Unknown profile'
        const profileStabilityScore = safeNumber(derived.profile_stability_score)
        const fallbackScore = profileStabilityScore !== null ? Math.max(0, 100 - profileStabilityScore) : null
        const fallbackStatus = latest ? 'Healthy' : null

        return {
          id: client.id,
          name: client.name,
          platform: client.platform ?? 'IG',
          accountId: client.account_id,
          monitoringEnabled: (client as any).monitoring_enabled !== false,
          handle: displayHandle,
          profileName: cleanProfileName(name, displayHandle, fallbackName),
          riskStatus: risk?.status ?? latestHistory?.level ?? fallbackStatus,
          riskScore: safeNumber(risk?.score) ?? safeNumber(latestHistory?.score) ?? fallbackScore,
          riskReason: risk?.notes ?? latestHistory?.notes ?? (latest ? 'No suspicious metadata signals' : null),
          lastChecked: client.last_checked ?? client.updated_at ?? client.created_at,
          latestAlert: latestAlert?.message ?? null,
          latestAlertSeverity: latestAlert?.severity ?? null,
          followers: safeNumber(readAny(sources, ['followers', 'followers_count', 'follower_count'])),
          following: safeNumber(readAny(sources, ['following', 'following_count'])),
          posts: safeNumber(readAny(sources, ['posts', 'posts_count', 'post_count', 'media_count'])),
          followRatio: safeNumber(derived.follow_ratio),
          followRatioDriftPct: safeNumber(derived.follow_ratio_drift_pct),
          followerVelocity7d: safeNumber(derived.follower_velocity_7d),
          followerPctChange30d: safeNumber(derived.follower_pct_change_30d),
          followingVelocity7d: safeNumber(derived.following_velocity_7d),
          postGrowthRate30d: safeNumber(derived.post_growth_rate_30d),
          profileStabilityScore,
          accountAgeConfidence: safeNumber(derived.account_age_confidence),
          snapshotCount: safeNumber(derived.snapshot_count),
          usernameChangeDetected: typeof derived.username_change_detected === 'boolean' ? derived.username_change_detected : null,
          externalLinkPresent: typeof readAny(sources, ['external_link_present']) === 'boolean' ? readAny(sources, ['external_link_present']) : null,
          verifiedBadge: typeof readAny(sources, ['verified_badge']) === 'boolean' ? readAny(sources, ['verified_badge']) : null,
          isPrivate: typeof readAny(sources, ['is_private']) === 'boolean' ? readAny(sources, ['is_private']) : null,
          snapshotAt: latest?.created_at ?? null,
        }
      })

      const clientNameById = new Map(rows.map((row) => [row.id, row.profileName || row.handle || row.name]))
      const historyRows = historyRowsRaw.slice(0, 12).map((row) => ({
        id: row.id,
        client_id: row.client_id,
        clientName: clientNameById.get(row.client_id) ?? 'Unknown client',
        score: row.score,
        level: row.level,
        notes: row.notes,
        created_at: row.created_at,
      }))

      setClientRows(rows)
      setRecentAlerts(alertsForUi)
      setRiskHistory(historyRows)
      setLastUpdated(new Date().toISOString())
    } catch (error) {
      setDashboardError((error as any)?.message ?? 'Dashboard refresh failed')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [router])

  useEffect(() => {
    fetchDashboardData(true)
    const refreshId = window.setInterval(() => fetchDashboardData(false), REFRESH_MS)

    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchDashboardData(false)
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.clearInterval(refreshId)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [fetchDashboardData])

  useEffect(() => {
    const channel = supabase
      .channel('dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' }, () => fetchDashboardData(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'risk_status' }, () => fetchDashboardData(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'risk_history' }, () => fetchDashboardData(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, () => fetchDashboardData(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => fetchDashboardData(false))
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchDashboardData])

  const stats = useMemo(() => {
    const total = clientRows.length
    const monitoredRows = clientRows.filter((row) => row.monitoringEnabled !== false)
    const monitored = monitoredRows.length
    const paused = total - monitored
    const critical = monitoredRows.filter((row) => row.riskStatus === 'Critical').length
    const watchOrRisk = monitoredRows.filter((row) => row.riskStatus === 'Watch' || row.riskStatus === 'Risk').length
    const liveSnapshots = monitoredRows.filter((row) => {
      if (!row.snapshotAt) return false
      const age = Date.now() - new Date(row.snapshotAt).getTime()
      return age >= 0 && age <= 2 * 60 * 60 * 1000
    }).length
    const highestScore = clientRows.reduce((max, row) => Math.max(max, row.riskScore ?? 0), 0)

    return { total, monitored, paused, critical, watchOrRisk, liveSnapshots, highestScore }
  }, [clientRows])

  const sortedRows = useMemo(() => {
    const order: Record<string, number> = { Critical: 0, Risk: 1, Watch: 2, Healthy: 3 }
    return [...clientRows].sort((a, b) => {
      const monitoringSort = (a.monitoringEnabled === false ? 1 : 0) - (b.monitoringEnabled === false ? 1 : 0)
      if (monitoringSort !== 0) return monitoringSort
      const riskSort = (order[a.riskStatus ?? ''] ?? 4) - (order[b.riskStatus ?? ''] ?? 4)
      if (riskSort !== 0) return riskSort
      return (b.riskScore ?? 0) - (a.riskScore ?? 0)
    })
  }, [clientRows])

  const openExtensionUnlinkedUrl = useCallback((client: ClientRow, options?: { syncOnly?: boolean }) => {
    const params = new URLSearchParams()
    params.set('client_id', client.id)
    const handle = client.handle || client.accountId || ''
    if (handle) params.set('handle', handle)
    params.set('name', client.profileName || client.name)
    if (options?.syncOnly) params.set('sync_only', '1')

    window.open(`/extension/unlinked?${params.toString()}`, '_blank', 'noopener,noreferrer')
  }, [])

  const openExtensionLinkedUrl = useCallback((client: ClientRow) => {
    const params = new URLSearchParams()
    params.set('client_id', client.id)
    const handle = client.handle || client.accountId || ''
    if (handle) params.set('handle', handle)
    params.set('name', client.profileName || client.name)

    window.open(`/extension/linked?${params.toString()}`, '_blank', 'noopener,noreferrer')
  }, [])

  const handleMonitorClient = useCallback(async (client: ClientRow) => {
    const label = client.profileName || client.name
    const confirmed = window.confirm(`Monitor ${label}? The extension will resume taking snapshots when this profile is linked again.`)
    if (!confirmed) return

    setDashboardError(null)
    setMonitoringClientId(client.id)
    try {
      const res = await setClientMonitoring(client.id, true)
      if (res.error) {
        setDashboardError((res.error as any)?.message ?? 'Failed to enable monitoring')
        return
      }

      setClientRows((rows) => rows.map((row) => (row.id === client.id ? { ...row, monitoringEnabled: true } : row)))
      openExtensionLinkedUrl(client)
      await fetchDashboardData(false)
    } finally {
      setMonitoringClientId(null)
    }
  }, [fetchDashboardData, openExtensionLinkedUrl])

  const handleUnmonitorClient = useCallback(async (client: ClientRow) => {
    const label = client.profileName || client.name
    const confirmed = window.confirm(`Unmonitor ${label}? The extension will stop taking new snapshots until you link this profile again.`)
    if (!confirmed) return

    setDashboardError(null)
    setUnmonitoringClientId(client.id)
    try {
      openExtensionUnlinkedUrl(client)
      const res = await setClientMonitoring(client.id, false)
      if (res.error) {
        setDashboardError((res.error as any)?.message ?? 'Failed to disable monitoring')
        return
      }

      setClientRows((rows) => rows.map((row) => (row.id === client.id ? { ...row, monitoringEnabled: false } : row)))
      await fetchDashboardData(false)
    } finally {
      setUnmonitoringClientId(null)
    }
  }, [fetchDashboardData, openExtensionUnlinkedUrl])

  const handleRemoveClient = useCallback(async (client: ClientRow) => {
    const label = client.profileName || client.name
    const confirmed = window.confirm(`Remove ${label}? This deletes the client and its snapshots, alerts, current risk status, and risk history.`)
    if (!confirmed) return

    setDashboardError(null)
    setRemovingClientId(client.id)
    try {
      openExtensionUnlinkedUrl(client, { syncOnly: true })
      const res = await deleteClientAndRelated(client.id)
      if (res.error) {
        setDashboardError((res.error as any)?.message ?? 'Failed to remove client')
        return
      }

      setClientRows((rows) => rows.filter((row) => row.id !== client.id))
      setRecentAlerts((alerts) => alerts.filter((alert) => alert.client_id !== client.id))
      setRiskHistory((items) => items.filter((item) => item.client_id !== client.id))
      await fetchDashboardData(false)
    } finally {
      setRemovingClientId(null)
    }
  }, [fetchDashboardData, openExtensionUnlinkedUrl])

  if (loading) {
    return (
      <DashboardShell>
        <div className="p-4 sm:p-6">
          <div className="mb-6 h-8 w-48 animate-pulse rounded bg-zinc-900" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded border border-zinc-800 bg-zinc-900" />)}
          </div>
          <div className="mt-6 h-96 animate-pulse rounded border border-zinc-800 bg-zinc-900" />
        </div>
      </DashboardShell>
    )
  }

  return (
    <DashboardShell>
      <div className="p-4 sm:p-6">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-sm text-zinc-500">Public profile monitoring</div>
            <h1 className="mt-1 text-2xl font-semibold text-zinc-50">Account Integrity Dashboard</h1>
            <div className="mt-2 text-sm text-zinc-500">
              Latest refresh: {lastUpdated ? formatDate(lastUpdated) : '-'}
              {refreshing && <span className="ml-2 text-zinc-300">Refreshing...</span>}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => fetchDashboardData(false)}
              disabled={refreshing}
              className="rounded border border-zinc-800 px-3 py-2 text-sm text-zinc-200 hover:border-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Refresh
            </button>
            <button
              onClick={async () => {
                await signOut()
                router.push('/auth')
              }}
              className="rounded border border-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:border-zinc-700"
            >
              Sign Out
            </button>
          </div>
        </div>

        {dashboardError && (
          <div className="mb-4 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">{dashboardError}</div>
        )}

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <SnapshotCard title="Monitored" value={stats.monitored} caption={`${stats.total} total clients, ${stats.paused} paused`} />
          <SnapshotCard title="Watch / Risk" value={stats.watchOrRisk} caption="Needs attention soon" tone={stats.watchOrRisk > 0 ? 'warn' : 'neutral'} />
          <SnapshotCard title="Critical" value={stats.critical} caption="Highest priority accounts" tone={stats.critical > 0 ? 'bad' : 'neutral'} />
          <SnapshotCard title="Live Snapshots" value={stats.liveSnapshots} caption="Updated in the last 2 hours" tone={stats.liveSnapshots > 0 ? 'good' : 'neutral'} />
        </div>

        <section>
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-lg font-medium text-zinc-100">Client Profiles</h2>
              <div className="text-sm text-zinc-500">Profile health, audience movement, and snapshot-derived signals.</div>
            </div>
            <div className="rounded border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-400">
              Peak score {stats.highestScore}
            </div>
          </div>
          <ClientTable
            clients={sortedRows}
            monitoringClientId={monitoringClientId}
            unmonitoringClientId={unmonitoringClientId}
            removingClientId={removingClientId}
            onMonitorClient={handleMonitorClient}
            onUnmonitorClient={handleUnmonitorClient}
            onRemoveClient={handleRemoveClient}
          />
        </section>

        <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
          <section className="rounded border border-zinc-800 bg-zinc-900">
            <div className="border-b border-zinc-800 px-4 py-3">
              <h3 className="text-sm font-medium text-zinc-100">Risk Timeline</h3>
            </div>

            {riskHistory.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-zinc-500">No risk history yet</div>
            ) : (
              <div className="max-h-[360px] overflow-y-auto">
                {riskHistory.map((item) => (
                  <div key={item.id} className="border-b border-zinc-800/70 px-4 py-3 last:border-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-zinc-100">{item.clientName}</div>
                        <div className="mt-1 text-xs text-zinc-500">{timeAgo(item.created_at)} - score {item.score}</div>
                      </div>
                      <span className={`shrink-0 rounded border px-2 py-1 text-xs font-medium ${statusClass(item.level)}`}>{item.level}</span>
                    </div>
                    {item.notes && <div className="mt-2 max-h-10 overflow-hidden text-xs leading-5 text-zinc-500">{item.notes}</div>}
                  </div>
                ))}
              </div>
            )}
          </section>

          <AlertFeed alerts={recentAlerts} />
        </div>
      </div>

    </DashboardShell>
  )
}
