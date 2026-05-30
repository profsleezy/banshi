"use client"

import Link from 'next/link'
import TerminalIcon from './TerminalIcon'

export type ClientRow = {
  id: string
  name: string
  platform: string
  accountId?: string | null
  monitoringEnabled?: boolean | null
  handle?: string | null
  profileName?: string | null
  riskStatus?: string | null
  riskScore?: number | null
  riskReason?: string | null
  lastChecked?: string | null
  latestAlert?: string | null
  latestAlertSeverity?: 'warning' | 'critical' | null
  followers?: number | null
  following?: number | null
  posts?: number | null
  followRatio?: number | null
  followRatioDriftPct?: number | null
  followerVelocity7d?: number | null
  followerPctChange30d?: number | null
  followingVelocity7d?: number | null
  postGrowthRate30d?: number | null
  profileStabilityScore?: number | null
  accountAgeConfidence?: number | null
  snapshotCount?: number | null
  staleData?: boolean | null
  staleHours?: number | null
  banRiskReadinessScore?: number | null
  banRiskReadinessLevel?: 'Ready' | 'Watch' | 'Exposed' | null
  usernameChangeDetected?: boolean | null
  externalLinkPresent?: boolean | null
  verifiedBadge?: boolean | null
  isPrivate?: boolean | null
  snapshotAt?: string | null
}

type Props = {
  clients: ClientRow[]
  loading?: boolean
  monitoringClientId?: string | null
  unmonitoringClientId?: string | null
  removingClientId?: string | null
  onMonitorClient?: (client: ClientRow) => void
  onUnmonitorClient?: (client: ClientRow) => void
  onRemoveClient?: (client: ClientRow) => void
}

function statusClass(status?: string | null) {
  if (status === 'Critical') return 'border-red-500/40 bg-red-500/10 text-red-200'
  if (status === 'Risk') return 'border-orange-500/40 bg-orange-500/10 text-orange-200'
  if (status === 'Watch') return 'border-amber-500/40 bg-amber-500/10 text-amber-100'
  if (status === 'Healthy') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200'
  return 'border-zinc-700 bg-zinc-950 text-zinc-400'
}

function signalClass(kind: 'good' | 'warn' | 'bad' | 'neutral') {
  if (kind === 'good') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
  if (kind === 'warn') return 'border-amber-500/30 bg-amber-500/10 text-amber-100'
  if (kind === 'bad') return 'border-red-500/30 bg-red-500/10 text-red-200'
  return 'border-zinc-700 bg-zinc-950 text-zinc-300'
}

function formatNumber(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-'
  return value.toLocaleString()
}

function formatCompact(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-'
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

function formatDate(value?: string | null) {
  if (!value) return 'No snapshot yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No snapshot yet'
  return date.toLocaleString()
}

function formatMetric(value?: number | null, digits = 1) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-'
  return value.toFixed(digits)
}

function formatSigned(value?: number | null, suffix = '') {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}${suffix}`
}

function Avatar({ client }: { client: ClientRow }) {
  return (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded border border-emerald-300/20 bg-emerald-300/10 text-lg font-semibold text-emerald-100">
      {(client.profileName || client.name || '?').slice(0, 1).toUpperCase()}
    </div>
  )
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="terminal-card-muted rounded px-4 py-3">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-xl font-semibold text-zinc-50">{value}</div>
      {detail && <div className="mt-1 text-xs text-zinc-500">{detail}</div>}
    </div>
  )
}

function SmallMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-zinc-200">{value}</div>
    </div>
  )
}

function Signals({ client }: { client: ClientRow }) {
  const signals: Array<{ label: string; kind: 'good' | 'warn' | 'bad' | 'neutral' }> = []

  if (client.monitoringEnabled === false) signals.push({ label: 'Monitoring paused', kind: 'warn' })
  else if (client.staleData) signals.push({ label: 'Scraper stale', kind: (client.staleHours ?? 0) > 24 ? 'bad' : 'warn' })
  if (client.externalLinkPresent) signals.push({ label: 'External link', kind: 'warn' })
  if (client.usernameChangeDetected) signals.push({ label: 'Username changed', kind: 'bad' })
  if (client.verifiedBadge) signals.push({ label: 'Verified', kind: 'good' })
  if (client.isPrivate) signals.push({ label: 'Private', kind: 'neutral' })
  if (client.latestAlert) signals.push({ label: 'Alert present', kind: client.latestAlertSeverity === 'critical' ? 'bad' : 'warn' })
  if (signals.length === 0) signals.push({ label: 'No flagged changes', kind: 'good' })

  return (
    <div className="flex flex-wrap gap-2">
      {signals.map((signal) => (
        <span key={signal.label} className={`rounded border px-2.5 py-1 text-xs font-medium ${signalClass(signal.kind)}`}>
          {signal.label}
        </span>
      ))}
    </div>
  )
}

export default function ClientTable({
  clients,
  loading = false,
  monitoringClientId,
  unmonitoringClientId,
  removingClientId,
  onMonitorClient,
  onUnmonitorClient,
  onRemoveClient,
}: Props) {
  if (loading) {
    return (
      <div className="terminal-card rounded p-5">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-1/4 rounded bg-zinc-800" />
          <div className="h-32 rounded bg-zinc-800" />
        </div>
      </div>
    )
  }

  if (clients.length === 0) {
    return (
      <div className="terminal-card rounded border-dashed p-10 text-center">
        <div className="text-sm font-medium text-zinc-200">No clients yet</div>
        <div className="mt-1 text-sm text-zinc-500">Add a client or link one from the extension to start collecting snapshots.</div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {clients.map((client) => {
        const monitoring = monitoringClientId === client.id
        const unmonitoring = unmonitoringClientId === client.id
        const removing = removingClientId === client.id
        const paused = client.monitoringEnabled === false
        const riskStatus = client.riskStatus ?? 'No score'

        return (
          <article key={client.id} className={`terminal-card terminal-boot rounded p-5 shadow-sm ${paused ? 'border-amber-500/30' : ''}`}>
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-start gap-4">
                  <Avatar client={client} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/clients/${client.id}`} className="truncate text-xl font-semibold text-zinc-50 hover:text-emerald-200">
                        {client.profileName || client.name}
                      </Link>
                      <span className={`rounded border px-2.5 py-1 text-xs font-medium ${statusClass(client.riskStatus)}`}>
                        {riskStatus}{typeof client.riskScore === 'number' ? ` ${client.riskScore}` : ''}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded border px-2.5 py-1 text-xs font-medium ${paused ? signalClass('warn') : signalClass('good')}`}>
                        <TerminalIcon name={paused ? 'alert' : 'eye'} className="h-3 w-3" />
                        {paused ? 'Paused' : 'Monitoring'}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-sm text-zinc-500">
                      @{client.handle || client.accountId || 'unknown'} - {client.platform}
                    </div>
                    <div className="mt-2 text-xs text-zinc-600">Latest snapshot: {formatDate(client.snapshotAt || client.lastChecked)}</div>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Stat label="Followers" value={formatCompact(client.followers)} detail={`${formatNumber(client.following)} following`} />
                  <Stat label="Posts" value={formatNumber(client.posts)} detail={`Ratio ${formatMetric(client.followRatio, 2)}`} />
                  <Stat label="Stability" value={typeof client.profileStabilityScore === 'number' ? `${client.profileStabilityScore}/100` : '-'} detail={`${formatNumber(client.snapshotCount)} snapshots`} />
                </div>

                <div className="mt-5 grid grid-cols-2 gap-4 border-t border-zinc-800 pt-4 md:grid-cols-4">
                  <SmallMetric label="7d follower velocity" value={formatSigned(client.followerVelocity7d, '/day')} />
                  <SmallMetric label="30d follower change" value={formatSigned(client.followerPctChange30d, '%')} />
                  <SmallMetric label="Follow drift" value={formatSigned(client.followRatioDriftPct, '%')} />
                  <SmallMetric label="Ban readiness" value={typeof client.banRiskReadinessScore === 'number' ? `${client.banRiskReadinessScore}/100` : '-'} />
                </div>
              </div>

              <div className="w-full shrink-0 xl:w-72">
                <div className="rounded border border-zinc-800 bg-black/30 p-4">
                  <div className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">Signals</div>
                  <Signals client={client} />
                  {client.riskReason && <div className="mt-4 text-xs leading-5 text-zinc-500">{client.riskReason}</div>}
                  {client.latestAlert && <div className="mt-4 text-xs leading-5 text-zinc-500">{client.latestAlert}</div>}
                </div>

                <Link
                  href={`/clients/${client.id}`}
                  className="terminal-button-secondary focus-ring mt-3 inline-flex w-full items-center justify-center gap-2 rounded px-3 py-2 text-sm font-medium"
                >
                  <TerminalIcon name="chart" className="h-4 w-4" />
                  View Report
                </Link>

                {paused && onMonitorClient && (
                  <button
                    type="button"
                    disabled={monitoring || unmonitoring || removing}
                    onClick={() => onMonitorClient(client)}
                    className="terminal-button focus-ring mt-3 w-full rounded px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {monitoring ? 'Monitoring...' : 'Monitor'}
                  </button>
                )}

                {!paused && onUnmonitorClient && (
                  <button
                    type="button"
                    disabled={monitoring || unmonitoring || removing}
                    onClick={() => onUnmonitorClient(client)}
                    className="focus-ring mt-3 w-full rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-100 transition hover:border-amber-400/50 hover:bg-amber-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {unmonitoring ? 'Unmonitoring...' : 'Unmonitor'}
                  </button>
                )}

                {onRemoveClient && (
                  <button
                    type="button"
                    disabled={removing || unmonitoring || monitoring}
                    onClick={() => onRemoveClient(client)}
                    className="focus-ring mt-3 w-full rounded border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-200 transition hover:border-red-400/50 hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {removing ? 'Removing...' : 'Remove Client'}
                  </button>
                )}
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}
