"use client"

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import DashboardShell from '../../../components/DashboardShell'
import TerminalIcon from '../../../components/TerminalIcon'
import supabase from '../../../lib/supabase'
import { getClients } from '../../../lib/clients'
import { signOut } from '../../../lib/auth'
import { PaywallPanel, useAccessStatus } from '../../../components/AccessGate'
import {
  buildClientInsight,
  safeNumber,
  sortSnapshotsAscending,
  trendSeries,
  type ClientInsight,
  type EventRow,
  type RiskHistoryRow,
  type RiskStatusRow,
  type TrendPoint,
} from '../../../lib/clientInsights'
import type { Alert } from '../../../types/alert'

type InvestigationLog = {
  id: string
  user_id: string
  client_id: string
  note: string
  severity: 'note' | 'watch' | 'risk' | 'critical'
  status: 'open' | 'reviewing' | 'resolved'
  created_at?: string | null
  updated_at?: string | null
}

function formatCompact(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-'
  return new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

async function getAccessToken() {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw error
  const token = data.session?.access_token
  if (!token) throw new Error('Not authenticated')
  return token
}

async function apiFetch(path: string, token: string, options: RequestInit = {}) {
  const res = await fetch(path, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    cache: 'no-store',
  })
  const body = await res.json().catch(() => null)
  if (!res.ok || !body?.success) throw new Error(body?.error || `Request failed (${res.status})`)
  return body
}

function formatNumber(value?: number | null) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '-'
  return value.toLocaleString()
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

function statusClass(status?: string | null) {
  if (status === 'Critical') return 'border-red-500/40 bg-red-500/10 text-red-200'
  if (status === 'Risk') return 'border-orange-500/40 bg-orange-500/10 text-orange-200'
  if (status === 'Watch') return 'border-amber-500/40 bg-amber-500/10 text-amber-100'
  if (status === 'Healthy') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
  return 'border-zinc-700 bg-zinc-950 text-zinc-400'
}

function priorityClass(priority: ClientInsight['priority']) {
  if (priority === 'Escalate') return 'border-red-500/40 bg-red-500/10 text-red-200'
  if (priority === 'Prepare') return 'border-orange-500/40 bg-orange-500/10 text-orange-200'
  if (priority === 'Review') return 'border-amber-500/40 bg-amber-500/10 text-amber-100'
  return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
}

function signalClass(tone: string) {
  if (tone === 'critical') return 'border-red-500/40 bg-red-500/10 text-red-200'
  if (tone === 'risk') return 'border-orange-500/40 bg-orange-500/10 text-orange-200'
  if (tone === 'watch') return 'border-amber-500/40 bg-amber-500/10 text-amber-100'
  if (tone === 'good') return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
  return 'border-zinc-700 bg-zinc-950 text-zinc-300'
}

function derivedTrend(snapshots: EventRow[], key: string): TrendPoint[] {
  return sortSnapshotsAscending(snapshots)
    .map((snapshot) => {
      const value = safeNumber(snapshot.metadata?.derived?.[key])
      if (value === null || !snapshot.created_at) return null
      return { ts: snapshot.created_at, value }
    })
    .filter((point): point is TrendPoint => !!point)
}

function formatShortDate(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function deltaText(value: number, formatter: (value: number) => string) {
  if (value === 0) return formatter(0)
  return `${value > 0 ? '+' : ''}${formatter(value)}`
}

function chartStats(points: TrendPoint[]) {
  const first = points[0]
  const latest = points[points.length - 1]
  const previous = points.length > 1 ? points[points.length - 2] : null
  const values = points.map((point) => point.value)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const totalDelta = latest.value - first.value
  const latestDelta = previous ? latest.value - previous.value : 0
  const pctDelta = first.value !== 0 ? (totalDelta / Math.abs(first.value)) * 100 : null
  const flat = Math.abs(max - min) < 0.0001

  return { first, latest, previous, min, max, totalDelta, latestDelta, pctDelta, flat }
}

function chartObservation(title: string, points: TrendPoint[], formatter: (value: number) => string) {
  if (points.length < 2) return 'Collect more snapshots before treating this as a trend.'
  const stats = chartStats(points)
  if (stats.flat) return `${title} has held steady at ${formatter(stats.latest.value)} across this window.`
  const direction = stats.totalDelta > 0 ? 'up' : 'down'
  const pct = typeof stats.pctDelta === 'number' ? ` (${deltaText(stats.pctDelta, (value) => `${value.toFixed(1)}%`)})` : ''
  return `${title} is ${direction} ${deltaText(stats.totalDelta, formatter)}${pct} over the visible window.`
}

function csvCell(value: unknown) {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

function downloadTextFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

function buildReportCsv(insight: ClientInsight, logs: InvestigationLog[]) {
  const rows = [
    ['record_type', 'timestamp', 'client', 'handle', 'followers', 'following', 'posts', 'risk_level', 'risk_score', 'severity', 'status', 'note_or_signal'],
    ...insight.snapshots.map((snapshot) => {
      const meta = snapshot.metadata ?? {}
      const derived = meta.derived ?? {}
      const signals = [
        derived.username_change_detected ? 'username change' : null,
        derived.short_term_spike ? 'follower spike' : null,
        meta.external_link_present ? 'external link' : null,
        meta.verified_badge ? 'verified' : null,
        meta.is_private ? 'private' : null,
      ].filter(Boolean).join('; ')

      return [
        'snapshot',
        snapshot.created_at ?? '',
        insight.displayName,
        insight.handle || insight.accountId || '',
        meta.followers ?? '',
        meta.following ?? '',
        meta.posts ?? '',
        '',
        '',
        '',
        insight.freshnessStatus,
        signals || 'stable',
      ]
    }),
    ...insight.riskHistory.map((item) => [
      'risk_history',
      item.created_at ?? '',
      insight.displayName,
      insight.handle || insight.accountId || '',
      '',
      '',
      '',
      item.level,
      item.score,
      '',
      '',
      item.notes ?? '',
    ]),
    ...logs.map((log) => [
      'investigation_log',
      log.created_at ?? '',
      insight.displayName,
      insight.handle || insight.accountId || '',
      '',
      '',
      '',
      '',
      '',
      log.severity,
      log.status,
      log.note,
    ]),
  ]

  return rows.map((row) => row.map(csvCell).join(',')).join('\n')
}

function exportReportCsv(insight: ClientInsight, logs: InvestigationLog[]) {
  const handle = (insight.handle || insight.accountId || insight.id).replace(/[^a-z0-9_-]/gi, '_')
  const csv = buildReportCsv(insight, logs)
  downloadTextFile(`banshi-${handle}-client-report.csv`, csv, 'text/csv;charset=utf-8')
}

function LineChart({
  title,
  points,
  caption,
  tone = 'emerald',
  formatValue = formatCompact,
  emptyHint = 'Need at least two snapshots to draw a trend.',
}: {
  title: string
  points: TrendPoint[]
  caption?: string
  tone?: 'emerald' | 'amber' | 'red' | 'zinc'
  formatValue?: (value: number) => string
  emptyHint?: string
}) {
  if (points.length < 2) {
    return (
      <div className="terminal-card rounded p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-zinc-100">{title}</div>
            {caption && <div className="mt-1 text-xs text-zinc-500">{caption}</div>}
          </div>
          <span className="rounded border border-zinc-800 bg-zinc-950 px-2.5 py-1 text-xs text-zinc-500">collecting</span>
        </div>
        <div className="mt-5 flex h-44 items-center justify-center rounded border border-dashed border-zinc-800 bg-black/25 px-4 text-center text-sm leading-6 text-zinc-500">
          {emptyHint}
        </div>
      </div>
    )
  }

  const width = 620
  const height = 220
  const pad = { top: 20, right: 18, bottom: 34, left: 52 }
  const plotWidth = width - pad.left - pad.right
  const plotHeight = height - pad.top - pad.bottom
  const stats = chartStats(points)
  const minTs = new Date(points[0].ts).getTime()
  const maxTs = new Date(points[points.length - 1].ts).getTime()
  const timeSpan = Math.max(1, maxTs - minTs)
  const valueSpan = Math.max(1, stats.max - stats.min)
  const stroke = {
    emerald: '#34d399',
    amber: '#fbbf24',
    red: '#f87171',
    zinc: '#a1a1aa',
  }[tone]

  const xFor = (point: TrendPoint, index: number) => {
    if (points.length === 1) return pad.left
    const ts = new Date(point.ts).getTime()
    if (Number.isNaN(ts) || timeSpan <= 1) return pad.left + (index / (points.length - 1)) * plotWidth
    return pad.left + ((ts - minTs) / timeSpan) * plotWidth
  }

  const yFor = (value: number) => {
    if (stats.flat) return pad.top + plotHeight / 2
    return pad.top + plotHeight - ((value - stats.min) / valueSpan) * plotHeight
  }

  const path = points.map((point, index) => {
    const x = xFor(point, index)
    const y = yFor(point.value)
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')
  const areaPath = `${path} L ${xFor(points[points.length - 1], points.length - 1).toFixed(1)} ${(pad.top + plotHeight).toFixed(1)} L ${pad.left} ${(pad.top + plotHeight).toFixed(1)} Z`
  const latestX = xFor(stats.latest, points.length - 1)
  const latestY = yFor(stats.latest.value)

  return (
    <div className="terminal-card rounded p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-100">{title}</div>
          {caption && <div className="mt-1 text-xs text-zinc-500">{caption}</div>}
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold text-zinc-50">{formatValue(stats.latest.value)}</div>
          <div className={`text-xs ${stats.totalDelta > 0 ? 'text-emerald-200' : stats.totalDelta < 0 ? 'text-red-200' : 'text-zinc-500'}`}>
            {deltaText(stats.totalDelta, formatValue)} window
          </div>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="mt-4 h-56 w-full" role="img" aria-label={`${title} chart`}>
        {(stats.flat ? [0.5] : [0, 0.5, 1]).map((tick) => {
          const y = pad.top + tick * plotHeight
          const value = stats.max - tick * (stats.max - stats.min)
          return (
            <g key={tick}>
              <line x1={pad.left} y1={y} x2={width - pad.right} y2={y} stroke="#27272a" strokeWidth="1" />
              <text x="0" y={y + 4} fill="#71717a" fontSize="12">{formatValue(value)}</text>
            </g>
          )
        })}
        <text x={pad.left} y={height - 8} fill="#71717a" fontSize="12">{formatShortDate(stats.first.ts)}</text>
        <text x={width - pad.right - 54} y={height - 8} fill="#71717a" fontSize="12">{formatShortDate(stats.latest.ts)}</text>
        <path d={areaPath} fill={stroke} opacity="0.08" />
        <path d={path} fill="none" stroke={stroke} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={latestX} cy={latestY} r="4.5" fill={stroke} stroke="#09090b" strokeWidth="2" />
      </svg>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-zinc-800/70 pt-3 text-xs">
        <span className="text-zinc-500">Range <span className="font-medium text-zinc-300">{formatValue(stats.min)} to {formatValue(stats.max)}</span></span>
        <span className="text-zinc-500">Move <span className="font-medium text-zinc-300">{deltaText(stats.latestDelta, formatValue)}</span></span>
        <span className="text-zinc-500">Shape <span className="font-medium text-zinc-300">{stats.flat ? 'Flat' : stats.totalDelta > 0 ? 'Rising' : 'Falling'}</span></span>
        <span className="text-zinc-500">{points.length} snapshots</span>
      </div>
      <div className="mt-3 text-xs leading-5 text-zinc-500">
        {chartObservation(title, points, formatValue)}
      </div>
    </div>
  )
}

function reportGuidance(insight: ClientInsight) {
  const lowConfidence = typeof insight.accountAgeConfidence === 'number' && insight.accountAgeConfidence < 0.7
  const thinHistory = (insight.snapshotCount ?? insight.snapshots.length) < 10
  const staleMs = insight.snapshotAt ? Date.now() - new Date(insight.snapshotAt).getTime() : null
  const stale = staleMs !== null && (Number.isNaN(staleMs) || staleMs > 24 * 60 * 60 * 1000)

  const now = !insight.monitoringEnabled
    ? 'Turn monitoring back on to restart live snapshots.'
    : insight.priority === 'Escalate'
      ? 'Verify ownership, capture a fresh snapshot, and prepare escalation context.'
      : insight.priority === 'Prepare'
        ? 'Review profile edits, outbound link, and audience movement before client check-in.'
        : insight.priority === 'Review'
          ? 'Compare flags against planned campaigns or expected account activity.'
          : 'No urgent action. Let the baseline keep maturing.'

  const watch = stale
    ? 'Coverage is stale. Keep the Instagram profile tab open.'
    : thinHistory || lowConfidence
      ? 'Baseline is thin; read trends as directional.'
      : insight.externalLinkPresent
        ? 'External link is present. Confirm the destination is approved.'
        : 'Watch follower movement, handle/privacy changes, and new links.'

  const clientNote = insight.priority === 'Routine'
    ? 'Stable public signals from the available history.'
    : `Driven by: ${insight.riskNotes || insight.signals.map((signal) => signal.label).join(', ')}.`

  return { now, watch, clientNote }
}

function CommandBrief({ insight }: { insight: ClientInsight }) {
  const guidance = reportGuidance(insight)
  const headline = !insight.monitoringEnabled
    ? 'Resume coverage'
    : insight.priority === 'Escalate'
      ? 'Escalate now'
      : insight.priority === 'Prepare'
        ? 'Prepare review'
        : insight.priority === 'Review'
          ? 'Review today'
          : 'Stay the course'
  const tone = !insight.monitoringEnabled || insight.priority === 'Review'
    ? 'border-amber-500/30 bg-amber-500/5'
    : insight.priority === 'Escalate'
      ? 'border-red-500/30 bg-red-500/5'
      : insight.priority === 'Prepare'
        ? 'border-orange-500/30 bg-orange-500/5'
        : 'border-emerald-500/25 bg-emerald-500/5'
  const signalSummary = insight.signals.length
    ? insight.signals.map((signal) => signal.label).slice(0, 3).join(', ')
    : 'No suspicious metadata signals'

  return (
    <section className={`terminal-panel mb-6 rounded border p-5 ${tone}`}>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded border px-2.5 py-1 text-xs font-medium ${priorityClass(insight.priority)}`}>{insight.priority}</span>
            <span className={`rounded border px-2.5 py-1 text-xs font-medium ${statusClass(insight.riskStatus)}`}>
              {insight.riskStatus ?? 'No score'}{typeof insight.riskScore === 'number' ? ` ${insight.riskScore}` : ''}
            </span>
            <span className={`rounded border px-2.5 py-1 text-xs font-medium ${insight.monitoringEnabled ? signalClass('good') : signalClass('watch')}`}>
              {insight.monitoringEnabled ? 'Monitoring' : 'Paused'}
            </span>
          </div>

          <div className="mt-6 flex items-start gap-4">
            <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded border border-emerald-300/25 bg-black/35 text-emerald-200">
              <TerminalIcon name="shield" className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="terminal-label text-xs">next move</div>
              <h2 className="mt-1 text-2xl font-semibold text-zinc-50">{headline}</h2>
              <p className="mt-3 max-w-3xl text-base leading-7 text-zinc-300">{guidance.now}</p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded border border-zinc-800/80 bg-black/25 p-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-500">
                <TerminalIcon name="eye" className="h-3.5 w-3.5" />
                Watch
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-300">{guidance.watch}</p>
            </div>
            <div className="rounded border border-zinc-800/80 bg-black/25 p-3">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-zinc-500">
                <TerminalIcon name="activity" className="h-3.5 w-3.5" />
                Signal driver
              </div>
              <p className="mt-2 text-sm leading-6 text-zinc-300">{signalSummary}</p>
            </div>
          </div>
        </div>

        <div className="rounded border border-zinc-800 bg-black/30 p-4">
          <div className="terminal-label text-xs">readiness</div>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-zinc-500">Snapshots</div>
              <div className="mt-1 text-2xl font-semibold text-zinc-50">{formatNumber(insight.snapshotCount)}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Confidence</div>
              <div className="mt-1 text-2xl font-semibold text-zinc-50">{typeof insight.accountAgeConfidence === 'number' ? `${Math.round(insight.accountAgeConfidence * 100)}%` : '-'}</div>
            </div>
            <div className="col-span-2">
              <div className="text-xs text-zinc-500">Last checked</div>
              <div className="mt-1 text-sm font-medium text-zinc-100">{formatDate(insight.snapshotAt || insight.lastChecked)}</div>
            </div>
          </div>
          <div className="mt-4 border-t border-zinc-800 pt-4 text-sm leading-6 text-zinc-400">
            {guidance.clientNote}
          </div>
        </div>
      </div>
    </section>
  )
}

function readinessClass(level: ClientInsight['banRiskReadinessLevel']) {
  if (level === 'Ready') return signalClass('good')
  if (level === 'Watch') return signalClass('watch')
  return signalClass('risk')
}

function incidentClass(severity: string) {
  if (severity === 'critical') return signalClass('critical')
  if (severity === 'risk') return signalClass('risk')
  if (severity === 'watch') return signalClass('watch')
  return signalClass('good')
}

function BanReadinessPanel({ insight }: { insight: ClientInsight }) {
  const freshnessCopy = insight.freshnessStatus === 'live'
    ? 'Fresh snapshot coverage.'
    : insight.freshnessStatus === 'warming'
      ? 'Snapshot is aging; keep the tab available.'
      : insight.freshnessStatus === 'paused'
        ? 'Monitoring is paused.'
        : insight.freshnessStatus === 'missing'
          ? 'No snapshot collected yet.'
          : 'Extension has likely stopped collecting.'

  return (
    <section className="terminal-card rounded p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="terminal-label text-xs">ban-risk readiness</div>
          <h2 className="mt-2 text-xl font-semibold text-zinc-50">Operational readiness, separate from risk score</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">
            This score answers a different question: if this account starts moving toward a ban or incident, is the agency prepared enough to see it early and explain it?
          </p>
        </div>
        <div className="rounded border border-zinc-800 bg-black/30 p-4 text-right">
          <span className={`rounded border px-2.5 py-1 text-xs font-medium ${readinessClass(insight.banRiskReadinessLevel)}`}>{insight.banRiskReadinessLevel}</span>
          <div className="mt-3 text-4xl font-semibold text-zinc-50">{insight.banRiskReadinessScore}</div>
          <div className="mt-1 text-xs text-zinc-500">out of 100</div>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded border border-zinc-800 bg-black/25 p-3">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Freshness</div>
          <div className="mt-2 text-sm font-medium text-zinc-100">{freshnessCopy}</div>
          <div className="mt-1 text-xs text-zinc-500">{typeof insight.staleHours === 'number' ? `${insight.staleHours.toFixed(1)}h since snapshot` : 'No snapshot age'}</div>
        </div>
        <div className="rounded border border-zinc-800 bg-black/25 p-3">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Baseline</div>
          <div className="mt-2 text-sm font-medium text-zinc-100">{formatNumber(insight.snapshotCount)} snapshots</div>
          <div className="mt-1 text-xs text-zinc-500">{typeof insight.accountAgeConfidence === 'number' ? `${Math.round(insight.accountAgeConfidence * 100)}% confidence` : 'Confidence unavailable'}</div>
        </div>
        <div className="rounded border border-zinc-800 bg-black/25 p-3">
          <div className="text-xs uppercase tracking-wide text-zinc-500">Read</div>
          <div className="mt-2 text-sm font-medium text-zinc-100">{insight.banRiskReadinessSummary}</div>
          <div className="mt-1 text-xs text-zinc-500">Use with incident severities below.</div>
        </div>
      </div>
    </section>
  )
}

function IncidentSeverityPanel({ insight }: { insight: ClientInsight }) {
  return (
    <section className="terminal-card rounded p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="terminal-label text-xs">incident model</div>
          <h2 className="mt-2 text-xl font-semibold text-zinc-50">What kind of problem is this?</h2>
        </div>
        <div className="text-xs text-zinc-500">takeover / manipulation / inactivity / link / scraper</div>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-3 xl:grid-cols-5">
        {insight.incidentSeverities.map((incident) => (
          <div key={incident.category} className="rounded border border-zinc-800 bg-black/25 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm font-medium text-zinc-100">{incident.label}</div>
              <span className={`rounded border px-2 py-0.5 text-[11px] font-medium ${incidentClass(incident.severity)}`}>{incident.severity}</span>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded bg-zinc-900">
              <div className="h-full rounded bg-emerald-300" style={{ width: `${incident.score}%` }} />
            </div>
            <div className="mt-2 text-xs text-zinc-500">Score {incident.score}/100</div>
            <p className="mt-3 text-xs leading-5 text-zinc-400">{incident.reason}</p>
            <p className="mt-3 border-t border-zinc-800 pt-3 text-xs leading-5 text-zinc-500">{incident.action}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function InvestigationLogPanel({
  logs,
  note,
  severity,
  status,
  saving,
  error,
  onNoteChange,
  onSeverityChange,
  onStatusChange,
  onSubmit,
}: {
  logs: InvestigationLog[]
  note: string
  severity: InvestigationLog['severity']
  status: InvestigationLog['status']
  saving: boolean
  error?: string | null
  onNoteChange: (value: string) => void
  onSeverityChange: (value: InvestigationLog['severity']) => void
  onStatusChange: (value: InvestigationLog['status']) => void
  onSubmit: () => void
}) {
  return (
    <section className="terminal-card rounded">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-100">
          <TerminalIcon name="terminal" className="h-4 w-4 text-emerald-200" />
          Investigation Log
        </h3>
        <p className="mt-1 text-xs text-zinc-500">Client-specific notes for review, handoff, and dispute history.</p>
      </div>
      <div className="p-4">
        {error && <div className="mb-3 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">{error}</div>}
        <textarea
          value={note}
          onChange={(event) => onNoteChange(event.target.value)}
          placeholder="Add what was checked, what changed, and the next action..."
          className="terminal-input min-h-24 w-full rounded px-3 py-2 text-sm placeholder:text-zinc-700"
        />
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <select value={severity} onChange={(event) => onSeverityChange(event.target.value as InvestigationLog['severity'])} className="terminal-input rounded px-3 py-2 text-sm">
            <option value="note">Note</option>
            <option value="watch">Watch</option>
            <option value="risk">Risk</option>
            <option value="critical">Critical</option>
          </select>
          <select value={status} onChange={(event) => onStatusChange(event.target.value as InvestigationLog['status'])} className="terminal-input rounded px-3 py-2 text-sm">
            <option value="open">Open</option>
            <option value="reviewing">Reviewing</option>
            <option value="resolved">Resolved</option>
          </select>
          <button type="button" disabled={saving || !note.trim()} onClick={onSubmit} className="terminal-button focus-ring rounded px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? 'Saving...' : 'Add log'}
          </button>
        </div>
      </div>
      <div className="max-h-[420px] overflow-y-auto border-t border-zinc-800">
        {logs.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-zinc-500">No investigation notes yet</div>
        ) : (
          logs.map((log) => (
            <div key={log.id} className="border-b border-zinc-800/70 px-4 py-3 last:border-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-zinc-500">{formatDate(log.created_at)}</div>
                <div className="flex gap-2">
                  <span className={`rounded border px-2 py-0.5 text-[11px] font-medium ${incidentClass(log.severity === 'note' ? 'clear' : log.severity)}`}>{log.severity}</span>
                  <span className="rounded border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-[11px] text-zinc-400">{log.status}</span>
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-300">{log.note}</p>
            </div>
          ))
        )}
      </div>
    </section>
  )
}

function MetricTile({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="terminal-card rounded p-4">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-zinc-50">{value}</div>
      {detail && <div className="mt-1 text-xs text-zinc-500">{detail}</div>}
    </div>
  )
}

function SnapshotTimeline({ snapshots }: { snapshots: EventRow[] }) {
  const latest = snapshots.slice(0, 20)
  if (latest.length === 0) {
    return <div className="terminal-card rounded p-8 text-center text-sm text-zinc-500">No snapshots yet</div>
  }

  return (
    <div className="terminal-card overflow-hidden rounded">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h3 className="text-sm font-medium text-zinc-100">Snapshot Timeline</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3 font-medium">Time</th>
              <th className="px-4 py-3 font-medium">Followers</th>
              <th className="px-4 py-3 font-medium">Following</th>
              <th className="px-4 py-3 font-medium">Posts</th>
              <th className="px-4 py-3 font-medium">Signals</th>
            </tr>
          </thead>
          <tbody>
            {latest.map((snapshot) => {
              const meta = snapshot.metadata ?? {}
              const derived = meta.derived ?? {}
              const signals = [
                derived.short_term_spike ? 'Spike' : null,
                derived.handle_changed ? 'Handle' : null,
                derived.external_link_added ? 'Link added' : null,
                meta.external_link_present ? 'External link' : null,
                meta.verified_badge ? 'Verified' : null,
                meta.is_private ? 'Private' : null,
              ].filter(Boolean)

              return (
                <tr key={snapshot.id} className="border-b border-zinc-800/70 last:border-0">
                  <td className="px-4 py-3 text-zinc-400">{formatDate(snapshot.created_at)}</td>
                  <td className="px-4 py-3 text-zinc-100">{formatNumber(safeNumber(meta.followers))}</td>
                  <td className="px-4 py-3 text-zinc-100">{formatNumber(safeNumber(meta.following))}</td>
                  <td className="px-4 py-3 text-zinc-100">{formatNumber(safeNumber(meta.posts))}</td>
                  <td className="px-4 py-3 text-zinc-400">{signals.length ? signals.join(', ') : 'Stable'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function RiskHistoryPanel({ insight }: { insight: ClientInsight }) {
  if (insight.riskHistory.length === 0) {
    return (
      <div className="terminal-card rounded p-8 text-center text-sm text-zinc-500">
        No risk history yet
      </div>
    )
  }

  return (
    <div className="terminal-card rounded">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h3 className="text-sm font-medium text-zinc-100">Risk History</h3>
      </div>
      <div className="max-h-[460px] overflow-y-auto">
        {insight.riskHistory.slice(0, 20).map((item) => (
          <div key={item.id} className="border-b border-zinc-800/70 px-4 py-3 last:border-0">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-zinc-100">Score {item.score}</div>
                <div className="mt-1 text-xs text-zinc-500">{formatDate(item.created_at)}</div>
              </div>
              <span className={`rounded border px-2.5 py-1 text-xs font-medium ${statusClass(item.level)}`}>{item.level}</span>
            </div>
            {item.notes && <div className="mt-2 text-xs leading-5 text-zinc-500">{item.notes}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

function AlertsPanel({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="terminal-card rounded p-8 text-center text-sm text-zinc-500">
        No alerts recorded
      </div>
    )
  }

  return (
    <div className="terminal-card rounded">
      <div className="border-b border-zinc-800 px-4 py-3">
        <h3 className="text-sm font-medium text-zinc-100">Alerts</h3>
      </div>
      <div className="max-h-[460px] overflow-y-auto">
        {alerts.slice(0, 20).map((alert) => (
          <div key={alert.id} className="border-b border-zinc-800/70 px-4 py-3 last:border-0">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-zinc-100">{alert.message.split('\n')[0] || 'Alert'}</div>
                <div className="mt-1 text-xs text-zinc-500">{formatDate(alert.created_at)}</div>
              </div>
              <span className={`shrink-0 rounded border px-2.5 py-1 text-xs font-medium ${alert.severity === 'critical' ? signalClass('critical') : signalClass('watch')}`}>{alert.severity}</span>
            </div>
            {alert.message && <div className="mt-2 text-xs leading-5 text-zinc-500">{alert.message}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ClientReportPage() {
  const router = useRouter()
  const params = useParams()
  const access = useAccessStatus()
  const clientIdParam = params?.client_id
  const clientId = Array.isArray(clientIdParam) ? clientIdParam[0] : clientIdParam
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [insight, setInsight] = useState<ClientInsight | null>(null)
  const [investigationLogs, setInvestigationLogs] = useState<InvestigationLog[]>([])
  const [logError, setLogError] = useState<string | null>(null)
  const [savingLog, setSavingLog] = useState(false)
  const [newLogNote, setNewLogNote] = useState('')
  const [newLogSeverity, setNewLogSeverity] = useState<InvestigationLog['severity']>('note')
  const [newLogStatus, setNewLogStatus] = useState<InvestigationLog['status']>('open')

  const loadReport = useCallback(async (initial = false) => {
    if (!clientId) return
    if (initial) setLoading(true)
    else setRefreshing(true)
    setError(null)

    try {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user) {
        router.push('/auth')
        return
      }
      const token = await getAccessToken()

      const clientsRes = await getClients()
      if (clientsRes.error) {
        setError((clientsRes.error as any)?.message ?? 'Could not load clients')
        setInsight(null)
        return
      }

      const client = (clientsRes.data ?? []).find((item) => item.id === clientId)
      if (!client) {
        setError('Client not found or no longer available.')
        setInsight(null)
        return
      }

      const [snapshotsRes, riskStatusRes, riskHistoryRes, alertsRes] = await Promise.all([
        supabase
          .from('events')
          .select('id, client_id, type, metadata, created_at')
          .eq('client_id', clientId)
          .eq('type', 'PROFILE_SNAPSHOT')
          .order('created_at', { ascending: false })
          .limit(180),
        supabase
          .from('risk_status')
          .select('client_id, status, score, notes, updated_at')
          .eq('client_id', clientId)
          .maybeSingle(),
        supabase
          .from('risk_history')
          .select('id, client_id, event_id, score, level, notes, payload, created_at')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
          .limit(80),
        supabase
          .from('alerts')
          .select('*')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
          .limit(80),
      ])

      if (snapshotsRes.error) setError('Client loaded, but snapshots could not be read.')
      if (riskStatusRes.error) setError('Client loaded, but risk status could not be read.')
      if (riskHistoryRes.error) setError('Client loaded, but risk history could not be read.')
      if (alertsRes.error) setError('Client loaded, but alerts could not be read.')

      setInsight(buildClientInsight({
        client,
        snapshots: (snapshotsRes.data ?? []) as EventRow[],
        riskStatus: (riskStatusRes.data ?? null) as RiskStatusRow | null,
        riskHistory: (riskHistoryRes.data ?? []) as RiskHistoryRow[],
        alerts: (alertsRes.data ?? []) as Alert[],
      }))

      try {
        const logsBody = await apiFetch(`/api/clients/${clientId}/investigation-log`, token)
        setInvestigationLogs((logsBody.logs ?? []) as InvestigationLog[])
        setLogError(null)
      } catch (logsError) {
        setInvestigationLogs([])
        setLogError((logsError as Error).message)
      }
    } catch (loadError) {
      setError((loadError as any)?.message ?? 'Client report refresh failed')
      setInsight(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [clientId, router])

  useEffect(() => {
    loadReport(true)
  }, [loadReport])

  const charts = useMemo(() => {
    if (!insight) return null
    const riskPoints = insight.riskHistory
      .slice()
      .reverse()
      .filter((item) => item.created_at)
      .map((item) => ({ ts: item.created_at as string, value: item.score }))

    return {
      followers: trendSeries(insight.snapshots, 'followers'),
      following: trendSeries(insight.snapshots, 'following'),
      posts: trendSeries(insight.snapshots, 'posts'),
      stability: derivedTrend(insight.snapshots, 'profile_stability_score'),
      risk: riskPoints,
    }
  }, [insight])

  const saveInvestigationLog = useCallback(async () => {
    if (!clientId || !newLogNote.trim()) return
    setSavingLog(true)
    setLogError(null)
    try {
      const token = await getAccessToken()
      const body = await apiFetch(`/api/clients/${clientId}/investigation-log`, token, {
        method: 'POST',
        body: JSON.stringify({
          note: newLogNote.trim(),
          severity: newLogSeverity,
          status: newLogStatus,
        }),
      })
      setInvestigationLogs((logs) => [body.log as InvestigationLog, ...logs])
      setNewLogNote('')
      setNewLogSeverity('note')
      setNewLogStatus('open')
    } catch (saveError) {
      setLogError((saveError as Error).message)
    } finally {
      setSavingLog(false)
    }
  }, [clientId, newLogNote, newLogSeverity, newLogStatus])

  const exportCsv = useCallback(() => {
    if (insight) exportReportCsv(insight, investigationLogs)
  }, [insight, investigationLogs])

  const exportPdf = useCallback(() => {
    window.print()
  }, [])

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
          <div className="mb-6 h-8 w-64 animate-pulse rounded bg-zinc-900" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded border border-zinc-800 bg-zinc-900" />)}
          </div>
          <div className="mt-6 grid grid-cols-1 gap-4 xl:grid-cols-2">
            {[0, 1, 2, 3].map((item) => <div key={item} className="h-64 animate-pulse rounded border border-zinc-800 bg-zinc-900" />)}
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
          <div className="min-w-0">
            <div className="terminal-label text-xs">client intelligence report</div>
            <h1 className="mt-1 truncate text-2xl font-semibold text-zinc-50">{insight?.displayName ?? 'Client report'}</h1>
            <div className="mt-2 text-sm text-zinc-500">
              @{insight?.handle || insight?.accountId || 'unknown'} - {insight?.platform ?? 'IG'} - Latest snapshot {timeAgo(insight?.snapshotAt)}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link href="/clients" className="terminal-button-secondary focus-ring inline-flex items-center gap-2 rounded px-3 py-2 text-sm">
              <TerminalIcon name="briefcase" className="h-4 w-4" />
              All Clients
            </Link>
            <button
              type="button"
              disabled={!insight}
              onClick={exportCsv}
              className="no-print terminal-button-secondary focus-ring inline-flex items-center gap-2 rounded px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              <TerminalIcon name="database" className="h-4 w-4" />
              CSV
            </button>
            <button
              type="button"
              disabled={!insight}
              onClick={exportPdf}
              className="no-print terminal-button-secondary focus-ring inline-flex items-center gap-2 rounded px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              <TerminalIcon name="terminal" className="h-4 w-4" />
              PDF
            </button>
            <button
              type="button"
              disabled={refreshing}
              onClick={() => loadReport(false)}
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

        {!insight || !charts ? (
          <div className="rounded border border-dashed border-zinc-800 bg-zinc-900 p-10 text-center text-sm text-zinc-500">No client report available.</div>
        ) : (
          <>
            <CommandBrief insight={insight} />

            <div className="mb-6 grid grid-cols-1 gap-4">
              <BanReadinessPanel insight={insight} />
              <IncidentSeverityPanel insight={insight} />
            </div>

            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile label="Followers" value={formatCompact(insight.followers)} detail={`${formatNumber(insight.following)} following`} />
              <MetricTile label="Follower velocity" value={formatSigned(insight.followerVelocity7d, '/day')} detail={`${formatSigned(insight.followerPctChange30d, '%')} over 30d`} />
              <MetricTile label="Profile stability" value={typeof insight.profileStabilityScore === 'number' ? `${insight.profileStabilityScore}/100` : '-'} detail="Lower score means more profile movement" />
              <MetricTile label="Follow ratio" value={formatMetric(insight.followRatio, 2)} detail={`${formatSigned(insight.followRatioDriftPct, '%')} drift`} />
            </div>

            <section className="mb-6">
              <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-medium text-zinc-100">Trend Evidence</h2>
                  <p className="text-sm text-zinc-500">Use these as decision support: stable lines are good evidence, sudden shape changes deserve review.</p>
                </div>
                <div className="text-xs text-zinc-600">Visible window: latest {Math.max(charts.followers.length, charts.risk.length, charts.posts.length, charts.stability.length)} points</div>
              </div>
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <LineChart title="Follower Base" points={charts.followers} caption="Audience level across collected snapshots" />
                <LineChart title="Risk Score" points={charts.risk} caption="Audit trail of computed risk posture" tone="amber" formatValue={(value) => String(Math.round(value))} emptyHint="Risk history appears after snapshots are scored." />
                <LineChart title="Profile Stability" points={charts.stability} caption="100 is stable; drops mean profile movement increased" tone="zinc" formatValue={(value) => String(Math.round(value))} emptyHint="Stability appears after derived metrics are attached to snapshots." />
                <LineChart title="Post Count" points={charts.posts} caption="Posting cadence and content-volume movement" tone="zinc" formatValue={(value) => formatNumber(value)} />
              </div>
            </section>

            <section className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="terminal-card rounded p-4">
                <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-100">
                  <TerminalIcon name="activity" className="h-4 w-4 text-emerald-200" />
                  Calculated Signals
                </h3>
                <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-xs text-zinc-500">7d follower change</div>
                    <div className="mt-1 font-medium text-zinc-100">{formatSigned(insight.followerPctChange7d, '%')}</div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">30d follower change</div>
                    <div className="mt-1 font-medium text-zinc-100">{formatSigned(insight.followerPctChange30d, '%')}</div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">Following velocity</div>
                    <div className="mt-1 font-medium text-zinc-100">{formatSigned(insight.followingVelocity7d, '/day')}</div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">Post growth</div>
                    <div className="mt-1 font-medium text-zinc-100">{formatSigned(insight.postGrowthRate30d, '%')}</div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">Live follower delta</div>
                    <div className="mt-1 font-medium text-zinc-100">{formatSigned(insight.liveFollowerDelta)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">Minutes since previous</div>
                    <div className="mt-1 font-medium text-zinc-100">{formatNumber(insight.minutesSincePrev)}</div>
                  </div>
                </div>
              </div>

              <div className="terminal-card rounded p-4">
                <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-100">
                  <TerminalIcon name="eye" className="h-4 w-4 text-cyan-200" />
                  Profile State
                </h3>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-3"><span className="text-zinc-500">External link</span><span className="text-zinc-100">{insight.externalLinkPresent ? 'Present' : 'Not detected'}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-zinc-500">Verified badge</span><span className="text-zinc-100">{insight.verifiedBadge ? 'Verified' : 'Not verified'}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-zinc-500">Privacy</span><span className="text-zinc-100">{insight.isPrivate ? 'Private' : 'Public'}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-zinc-500">Username change</span><span className="text-zinc-100">{insight.usernameChangeDetected || insight.handleChanged ? 'Detected' : 'Not detected'}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-zinc-500">Profile image</span><span className="text-zinc-100">{insight.profilePictureChanged ? 'Changed recently' : 'Stable'}</span></div>
                </div>
              </div>

              <div className="terminal-card rounded p-4">
                <h3 className="flex items-center gap-2 text-sm font-medium text-zinc-100">
                  <TerminalIcon name="database" className="h-4 w-4 text-emerald-200" />
                  Account Details
                </h3>
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex justify-between gap-3"><span className="text-zinc-500">Handle</span><span className="truncate text-zinc-100">@{insight.handle || insight.accountId || 'unknown'}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-zinc-500">Platform</span><span className="text-zinc-100">{insight.platform}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-zinc-500">Posts</span><span className="text-zinc-100">{formatNumber(insight.posts)}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-zinc-500">Monitoring</span><span className="text-zinc-100">{insight.monitoringEnabled ? 'Active' : 'Paused'}</span></div>
                  <div className="flex justify-between gap-3"><span className="text-zinc-500">Bio</span><span className="max-w-[180px] truncate text-zinc-100">{insight.bio || '-'}</span></div>
                </div>
              </div>
            </section>

            <div className="mb-6 grid grid-cols-1 gap-4 xl:grid-cols-3">
              <InvestigationLogPanel
                logs={investigationLogs}
                note={newLogNote}
                severity={newLogSeverity}
                status={newLogStatus}
                saving={savingLog}
                error={logError}
                onNoteChange={setNewLogNote}
                onSeverityChange={setNewLogSeverity}
                onStatusChange={setNewLogStatus}
                onSubmit={saveInvestigationLog}
              />
              <RiskHistoryPanel insight={insight} />
              <AlertsPanel alerts={insight.alerts} />
            </div>

            <SnapshotTimeline snapshots={insight.snapshots} />
          </>
        )}
      </div>
    </DashboardShell>
  )
}
