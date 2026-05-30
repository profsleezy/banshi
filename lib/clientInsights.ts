import type { Client as DBClient, RiskLevel } from '../types/client'
import type { Alert } from '../types/alert'

export type EventRow = {
  id: string
  client_id: string
  type?: string
  metadata?: any
  created_at?: string | null
}

export type RiskStatusRow = {
  client_id: string
  status: RiskLevel | string
  score: number
  notes?: string | null
  updated_at?: string | null
}

export type RiskHistoryRow = {
  id: string
  client_id: string
  event_id?: string | null
  score: number
  level: RiskLevel | string
  notes?: string | null
  payload?: any
  created_at?: string | null
}

export type TrendPoint = {
  ts: string
  value: number
}

export type ClientSignal = {
  label: string
  tone: 'good' | 'watch' | 'risk' | 'critical' | 'neutral'
  detail?: string
}

export type IncidentSeverityLevel = 'clear' | 'watch' | 'risk' | 'critical'

export type IncidentCategory =
  | 'account_takeover'
  | 'manipulation'
  | 'inactivity'
  | 'external_link_risk'
  | 'scraper_stale'

export type ClientIncidentSeverity = {
  category: IncidentCategory
  label: string
  severity: IncidentSeverityLevel
  score: number
  reason: string
  action: string
}

export type ClientInsight = {
  id: string
  name: string
  platform: string
  accountId?: string | null
  monitoringEnabled: boolean
  displayName: string
  handle?: string | null
  snapshotAt?: string | null
  lastChecked?: string | null
  riskStatus?: string | null
  riskScore?: number | null
  riskNotes?: string | null
  followers?: number | null
  following?: number | null
  posts?: number | null
  followRatio?: number | null
  followerVelocity7d?: number | null
  followerVelocity30d?: number | null
  followerPctChange7d?: number | null
  followerPctChange30d?: number | null
  followingVelocity7d?: number | null
  followRatioDriftPct?: number | null
  postGrowthRate30d?: number | null
  postingInactivityDays?: number | null
  profileStabilityScore?: number | null
  accountAgeConfidence?: number | null
  snapshotCount?: number | null
  usernameChangeDetected?: boolean | null
  handleChanged?: boolean | null
  profilePictureChanged?: boolean | null
  externalLinkPresent?: boolean | null
  externalLinkAdded?: boolean | null
  verifiedBadge?: boolean | null
  verifiedChanged?: boolean | null
  isPrivate?: boolean | null
  isPrivateChanged?: boolean | null
  shortTermSpike?: boolean | null
  liveFollowerDelta?: number | null
  liveFollowerPctChange?: number | null
  liveFollowersPerDay?: number | null
  livePostDelta?: number | null
  livePostsPerDay?: number | null
  minutesSincePrev?: number | null
  bio?: string | null
  staleData: boolean
  staleHours?: number | null
  freshnessStatus: 'live' | 'warming' | 'stale' | 'missing' | 'paused'
  banRiskReadinessScore: number
  banRiskReadinessLevel: 'Ready' | 'Watch' | 'Exposed'
  banRiskReadinessSummary: string
  incidentSeverities: ClientIncidentSeverity[]
  latestSnapshot?: EventRow | null
  snapshots: EventRow[]
  alerts: Alert[]
  riskHistory: RiskHistoryRow[]
  signals: ClientSignal[]
  priority: 'Routine' | 'Review' | 'Prepare' | 'Escalate'
  recommendedAction: string
}

export function safeNumber(value: unknown): number | null {
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

export function normalizeIdentity(value: unknown) {
  return String(value ?? '').trim().replace(/^@/, '').toLowerCase()
}

export function cleanProfileName(value: unknown, handle: unknown, fallback: string) {
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

export function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

export function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return value

  try {
    return JSON.parse(trimmed)
  } catch (e) {
    return value
  }
}

export function candidatePayloads(source: any): Record<string, any>[] {
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

export function readFirst(sources: any[], key: string) {
  for (const source of sources) {
    for (const candidate of candidatePayloads(source)) {
      if (candidate[key] !== undefined && candidate[key] !== null) return candidate[key]
    }
  }
  return null
}

export function readAny(sources: any[], keys: string[]) {
  for (const key of keys) {
    const value = readFirst(sources, key)
    if (value !== null) return value
  }
  return null
}

export function readDerived(sources: any[]) {
  for (const source of sources) {
    for (const candidate of candidatePayloads(source)) {
      if (isRecord(candidate.derived)) return candidate.derived
    }
  }
  return {}
}

export function sortSnapshotsAscending(snapshots: EventRow[]) {
  return snapshots
    .filter((snapshot) => snapshot?.created_at)
    .slice()
    .sort((a, b) => new Date(a.created_at ?? '').getTime() - new Date(b.created_at ?? '').getTime())
}

export function trendSeries(snapshots: EventRow[], key: string): TrendPoint[] {
  return sortSnapshotsAscending(snapshots)
    .map((snapshot) => {
      const value = safeNumber(snapshot.metadata?.[key])
      if (value === null || !snapshot.created_at) return null
      return { ts: snapshot.created_at, value }
    })
    .filter((point): point is TrendPoint => !!point)
}

function boolFromSources(sources: any[], key: string): boolean | null {
  const value = readFirst(sources, key)
  return typeof value === 'boolean' ? value : null
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

function severityFromScore(score: number): IncidentSeverityLevel {
  if (score >= 80) return 'critical'
  if (score >= 55) return 'risk'
  if (score >= 25) return 'watch'
  return 'clear'
}

function hoursSince(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return Math.max(0, (Date.now() - date.getTime()) / 3600000)
}

function deriveFreshness(snapshotAt?: string | null, monitoringEnabled = true) {
  if (!monitoringEnabled) {
    return {
      staleData: false,
      staleHours: snapshotAt ? hoursSince(snapshotAt) : null,
      freshnessStatus: 'paused' as const,
    }
  }

  const staleHours = hoursSince(snapshotAt)
  if (staleHours === null) {
    return { staleData: true, staleHours: null, freshnessStatus: 'missing' as const }
  }
  if (staleHours <= 2) return { staleData: false, staleHours, freshnessStatus: 'live' as const }
  if (staleHours <= 6) return { staleData: false, staleHours, freshnessStatus: 'warming' as const }
  return { staleData: true, staleHours, freshnessStatus: 'stale' as const }
}

function computeBanRiskReadiness(insight: Partial<ClientInsight>) {
  let score = 100

  if (!insight.monitoringEnabled) score -= 35
  if (!insight.snapshotAt) score -= 35
  else if ((insight.staleHours ?? 0) > 24) score -= 30
  else if ((insight.staleHours ?? 0) > 6) score -= 18

  const snapshotCount = insight.snapshotCount ?? insight.snapshots?.length ?? 0
  if (snapshotCount < 3) score -= 25
  else if (snapshotCount < 10) score -= 12

  if (typeof insight.accountAgeConfidence === 'number') {
    if (insight.accountAgeConfidence < 0.5) score -= 15
    else if (insight.accountAgeConfidence < 0.8) score -= 8
  } else {
    score -= 10
  }

  if (insight.riskStatus === 'Critical') score -= 15
  else if (insight.riskStatus === 'Risk') score -= 10
  else if (insight.riskStatus === 'Watch') score -= 5

  if (insight.externalLinkAdded) score -= 8
  else if (insight.externalLinkPresent) score -= 4
  if (insight.usernameChangeDetected || insight.handleChanged) score -= 10

  const readyScore = Math.round(clamp(score))
  const level: ClientInsight['banRiskReadinessLevel'] = readyScore >= 75 ? 'Ready' : readyScore >= 50 ? 'Watch' : 'Exposed'
  const summary =
    level === 'Ready'
      ? 'Coverage is fresh enough for confident monitoring.'
      : level === 'Watch'
        ? 'Coverage is usable, but the baseline or freshness needs attention.'
        : 'Coverage is weak. Reconnect monitoring before relying on this report.'

  return { banRiskReadinessScore: readyScore, banRiskReadinessLevel: level, banRiskReadinessSummary: summary }
}

function buildIncidentSeverities(insight: Partial<ClientInsight>): ClientIncidentSeverity[] {
  const takeoverScore = clamp(
    (insight.usernameChangeDetected || insight.handleChanged ? 45 : 0) +
    (insight.profilePictureChanged ? 20 : 0) +
    (insight.verifiedChanged ? 30 : 0) +
    (insight.isPrivateChanged ? 20 : 0) +
    (insight.riskStatus === 'Critical' ? 20 : insight.riskStatus === 'Risk' ? 10 : 0),
  )

  const manipulationScore = clamp(
    (insight.shortTermSpike ? 35 : 0) +
    (Math.abs(insight.followerPctChange7d ?? 0) >= 20 ? 35 : Math.abs(insight.followerPctChange7d ?? 0) >= 8 ? 18 : 0) +
    (Math.abs(insight.followerVelocity7d ?? 0) >= 1000 ? 20 : 0) +
    (Math.abs(insight.followRatioDriftPct ?? 0) >= 20 ? 18 : 0),
  )

  const inactivityDays = insight.postingInactivityDays ?? null
  const inactivityScore = clamp(
    typeof inactivityDays === 'number'
      ? inactivityDays >= 45 ? 80 : inactivityDays >= 21 ? 58 : inactivityDays >= 10 ? 30 : 0
      : (insight.postGrowthRate30d ?? 1) <= 0 && (insight.posts ?? 0) > 0 ? 20 : 0,
  )

  const externalLinkScore = clamp(
    insight.externalLinkAdded ? 65 : insight.externalLinkPresent ? 30 : 0,
  )

  const scraperStaleScore = clamp(
    insight.freshnessStatus === 'missing'
      ? 80
      : insight.freshnessStatus === 'stale'
        ? (insight.staleHours ?? 0) > 24 ? 75 : 55
        : insight.freshnessStatus === 'warming'
          ? 20
          : insight.freshnessStatus === 'paused'
            ? 35
            : 0,
  )

  return [
    {
      category: 'account_takeover',
      label: 'Account takeover',
      severity: severityFromScore(takeoverScore),
      score: takeoverScore,
      reason: takeoverScore ? 'Identity, verification, privacy, or profile media moved.' : 'No identity-control change detected.',
      action: takeoverScore >= 55 ? 'Verify owner access and preserve evidence before client messaging.' : 'Keep watching handle, verification, and privacy fields.',
    },
    {
      category: 'manipulation',
      label: 'Manipulation',
      severity: severityFromScore(manipulationScore),
      score: manipulationScore,
      reason: manipulationScore ? 'Audience velocity, percentage movement, or follow-ratio drift is elevated.' : 'Audience movement is inside the current baseline.',
      action: manipulationScore >= 55 ? 'Compare movement against campaigns, giveaways, paid pushes, or suspicious growth.' : 'Let the baseline mature and compare against campaign calendars.',
    },
    {
      category: 'inactivity',
      label: 'Inactivity',
      severity: severityFromScore(inactivityScore),
      score: inactivityScore,
      reason: inactivityScore ? 'Posting cadence indicates possible inactivity.' : 'No material posting inactivity signal.',
      action: inactivityScore >= 55 ? 'Check whether inactivity is planned; prepare a client follow-up.' : 'Keep watching post cadence.',
    },
    {
      category: 'external_link_risk',
      label: 'External-link risk',
      severity: severityFromScore(externalLinkScore),
      score: externalLinkScore,
      reason: externalLinkScore ? 'External profile link is present or was recently added.' : 'No external-link risk detected.',
      action: externalLinkScore >= 55 ? 'Open and verify destination ownership before approving the profile state.' : 'Confirm the link remains client-approved.',
    },
    {
      category: 'scraper_stale',
      label: 'Scraper stale',
      severity: severityFromScore(scraperStaleScore),
      score: scraperStaleScore,
      reason: scraperStaleScore ? 'The extension has not produced a fresh enough snapshot.' : 'Snapshot coverage is fresh.',
      action: scraperStaleScore >= 55 ? 'Open the Instagram profile tab and confirm the extension is linked.' : 'Keep the profile tab available in Chrome.',
    },
  ]
}

function derivePriority(score?: number | null, status?: string | null, monitoringEnabled = true) {
  if (!monitoringEnabled) return 'Review' as const
  if (status === 'Critical' || (typeof score === 'number' && score >= 80)) return 'Escalate' as const
  if (status === 'Risk' || (typeof score === 'number' && score >= 60)) return 'Prepare' as const
  if (status === 'Watch' || (typeof score === 'number' && score >= 30)) return 'Review' as const
  return 'Routine' as const
}

function recommendedAction(priority: ClientInsight['priority'], insight: Partial<ClientInsight>) {
  if (!insight.monitoringEnabled) return 'Monitoring is paused. Re-enable it before relying on this account for live incident coverage.'
  if (insight.staleData) return 'Coverage is stale. Reopen the Instagram profile tab and confirm the extension is still linked before acting on this report.'
  if (priority === 'Escalate') return 'Escalate now: preserve the latest snapshot, review recent profile changes, and prepare stakeholder messaging.'
  if (priority === 'Prepare') return 'Prepare a response: verify ownership signals, inspect external links, and watch the next snapshot closely.'
  if (priority === 'Review') return 'Review today: confirm whether the flagged movement is expected and keep the account in the agency queue.'
  return 'No immediate action. Keep monitoring and use the timeline as the account health baseline.'
}

function buildSignals(insight: Partial<ClientInsight>) {
  const signals: ClientSignal[] = []

  if (!insight.monitoringEnabled) signals.push({ label: 'Monitoring paused', tone: 'watch', detail: 'Snapshots are not being collected.' })
  else if (insight.staleData) signals.push({ label: 'Scraper stale', tone: insight.freshnessStatus === 'missing' || (insight.staleHours ?? 0) > 24 ? 'risk' : 'watch', detail: 'Extension has not sent a fresh snapshot.' })
  if (insight.riskStatus === 'Critical') signals.push({ label: 'Critical risk status', tone: 'critical' })
  else if (insight.riskStatus === 'Risk') signals.push({ label: 'Risk status', tone: 'risk' })
  else if (insight.riskStatus === 'Watch') signals.push({ label: 'Watch status', tone: 'watch' })

  if (insight.shortTermSpike) signals.push({ label: 'Short-term follower spike', tone: 'risk' })
  if (insight.usernameChangeDetected || insight.handleChanged) signals.push({ label: 'Handle movement', tone: 'critical' })
  if (insight.profilePictureChanged) signals.push({ label: 'Profile image changed', tone: 'watch' })
  if (insight.externalLinkAdded) signals.push({ label: 'External link added', tone: 'risk' })
  else if (insight.externalLinkPresent) signals.push({ label: 'External link present', tone: 'watch' })
  if (insight.verifiedChanged) signals.push({ label: 'Verification changed', tone: 'critical' })
  else if (insight.verifiedBadge) signals.push({ label: 'Verified', tone: 'good' })
  if (insight.isPrivateChanged) signals.push({ label: 'Privacy changed', tone: 'risk' })
  else if (insight.isPrivate) signals.push({ label: 'Private profile', tone: 'neutral' })

  if (typeof insight.profileStabilityScore === 'number' && insight.profileStabilityScore < 70) {
    signals.push({ label: 'Stability below baseline', tone: insight.profileStabilityScore < 40 ? 'risk' : 'watch' })
  }

  if (signals.length === 0) signals.push({ label: 'No flagged changes', tone: 'good' })
  return signals
}

export function buildClientInsight(input: {
  client: DBClient
  snapshots?: EventRow[]
  riskStatus?: RiskStatusRow | null
  riskHistory?: RiskHistoryRow[]
  alerts?: Alert[]
}): ClientInsight {
  const client = input.client
  const snapshots = (input.snapshots ?? []).slice().sort((a, b) => new Date(b.created_at ?? '').getTime() - new Date(a.created_at ?? '').getTime())
  const latestSnapshot = snapshots[0] ?? null
  const latestHistory = (input.riskHistory ?? [])[0] ?? null
  const latestAlert = (input.alerts ?? [])[0] ?? null
  const latestSnapshotMetadata = (client as any).latest_snapshot_metadata
  const cachedSnapshot = isRecord(latestSnapshotMetadata)
    ? {
        id: `client-cache-${client.id}`,
        client_id: client.id,
        type: 'PROFILE_SNAPSHOT',
        metadata: latestSnapshotMetadata,
        created_at: client.last_checked ?? undefined,
      } as EventRow
    : null
  const effectiveLatest = latestSnapshot ?? cachedSnapshot
  const sources = [effectiveLatest?.metadata, latestAlert?.payload, latestHistory?.payload]
  const derived = readDerived(sources)
  const rawHandle = readAny(sources, ['handle', 'username', 'account_id'])
  const handle = client.account_id || (typeof rawHandle === 'string' ? rawHandle : null)
  const rawName = readAny(sources, ['name', 'full_name', 'profile_name'])
  const fallbackName = handle || client.name || 'Unknown profile'
  const displayName = cleanProfileName(rawName, handle, fallbackName)
  const stability = safeNumber(derived.profile_stability_score)
  const riskScore = safeNumber(input.riskStatus?.score) ?? safeNumber(latestHistory?.score) ?? (stability !== null ? Math.max(0, 100 - stability) : null)
  const riskStatus = input.riskStatus?.status ?? latestHistory?.level ?? (effectiveLatest ? 'Healthy' : null)
  const monitoringEnabled = (client as any).monitoring_enabled !== false
  const snapshotAt = effectiveLatest?.created_at ?? null
  const followers = safeNumber(readAny(sources, ['followers', 'followers_count', 'follower_count']))
  const following = safeNumber(readAny(sources, ['following', 'following_count']))
  const posts = safeNumber(readAny(sources, ['posts', 'posts_count', 'post_count', 'media_count']))
  const followRatio = safeNumber(derived.follow_ratio)
  const followerVelocity7d = safeNumber(derived.follower_velocity_7d)
  const followerVelocity30d = safeNumber(derived.follower_velocity_30d)
  const followerPctChange7d = safeNumber(derived.follower_pct_change_7d)
  const followerPctChange30d = safeNumber(derived.follower_pct_change_30d)
  const followingVelocity7d = safeNumber(derived.following_velocity_7d)
  const followRatioDriftPct = safeNumber(derived.follow_ratio_drift_pct)
  const postGrowthRate30d = safeNumber(derived.post_growth_rate_30d)
  const postingInactivityDays = safeNumber(derived.posting_inactivity_days)
  const accountAgeConfidence = safeNumber(derived.account_age_confidence)
  const snapshotCount = safeNumber(derived.snapshot_count) ?? snapshots.length
  const freshness = deriveFreshness(snapshotAt, monitoringEnabled)
  const insightSeed: Partial<ClientInsight> = {
    monitoringEnabled,
    snapshotAt,
    snapshots,
    riskStatus,
    riskScore,
    followers,
    following,
    posts,
    followRatio,
    followerVelocity7d,
    followerVelocity30d,
    followerPctChange7d,
    followerPctChange30d,
    followingVelocity7d,
    followRatioDriftPct,
    postGrowthRate30d,
    postingInactivityDays,
    profileStabilityScore: stability,
    accountAgeConfidence,
    snapshotCount,
    ...freshness,
    shortTermSpike: typeof derived.short_term_spike === 'boolean' ? derived.short_term_spike : null,
    usernameChangeDetected: typeof derived.username_change_detected === 'boolean' ? derived.username_change_detected : null,
    handleChanged: typeof derived.handle_changed === 'boolean' ? derived.handle_changed : null,
    profilePictureChanged: typeof derived.profile_picture_changed === 'boolean' ? derived.profile_picture_changed : null,
    externalLinkPresent: boolFromSources(sources, 'external_link_present'),
    externalLinkAdded: typeof derived.external_link_added === 'boolean' ? derived.external_link_added : null,
    verifiedBadge: boolFromSources(sources, 'verified_badge'),
    verifiedChanged: typeof derived.verified_changed === 'boolean' ? derived.verified_changed : null,
    isPrivate: boolFromSources(sources, 'is_private'),
    isPrivateChanged: typeof derived.is_private_changed === 'boolean' ? derived.is_private_changed : null,
  }
  const priority = insightSeed.staleData && monitoringEnabled ? 'Review' : derivePriority(riskScore, riskStatus, monitoringEnabled)
  const signals = buildSignals(insightSeed)
  const readiness = computeBanRiskReadiness(insightSeed)
  const incidentSeverities = buildIncidentSeverities(insightSeed)

  return {
    id: client.id,
    name: client.name,
    platform: client.platform ?? 'IG',
    accountId: client.account_id,
    monitoringEnabled,
    displayName,
    handle,
    snapshotAt,
    lastChecked: client.last_checked ?? client.updated_at ?? client.created_at,
    riskStatus,
    riskScore,
    riskNotes: input.riskStatus?.notes ?? latestHistory?.notes ?? (effectiveLatest ? 'No suspicious metadata signals' : null),
    followers,
    following,
    posts,
    followRatio,
    followerVelocity7d,
    followerVelocity30d,
    followerPctChange7d,
    followerPctChange30d,
    followingVelocity7d,
    followRatioDriftPct,
    postGrowthRate30d,
    postingInactivityDays,
    profileStabilityScore: stability,
    accountAgeConfidence,
    snapshotCount,
    usernameChangeDetected: insightSeed.usernameChangeDetected,
    handleChanged: insightSeed.handleChanged,
    profilePictureChanged: insightSeed.profilePictureChanged,
    externalLinkPresent: insightSeed.externalLinkPresent,
    externalLinkAdded: insightSeed.externalLinkAdded,
    verifiedBadge: insightSeed.verifiedBadge,
    verifiedChanged: insightSeed.verifiedChanged,
    isPrivate: insightSeed.isPrivate,
    isPrivateChanged: insightSeed.isPrivateChanged,
    shortTermSpike: insightSeed.shortTermSpike,
    liveFollowerDelta: safeNumber(derived.live_follower_delta),
    liveFollowerPctChange: safeNumber(derived.live_follower_pct_change),
    liveFollowersPerDay: safeNumber(derived.live_followers_per_day),
    livePostDelta: safeNumber(derived.live_post_delta),
    livePostsPerDay: safeNumber(derived.live_posts_per_day),
    minutesSincePrev: safeNumber(derived.minutes_since_prev),
    bio: typeof readFirst(sources, 'bio') === 'string' ? readFirst(sources, 'bio') : null,
    staleData: freshness.staleData,
    staleHours: freshness.staleHours,
    freshnessStatus: freshness.freshnessStatus,
    banRiskReadinessScore: readiness.banRiskReadinessScore,
    banRiskReadinessLevel: readiness.banRiskReadinessLevel,
    banRiskReadinessSummary: readiness.banRiskReadinessSummary,
    incidentSeverities,
    latestSnapshot: effectiveLatest,
    snapshots,
    alerts: input.alerts ?? [],
    riskHistory: input.riskHistory ?? [],
    signals,
    priority,
    recommendedAction: recommendedAction(priority, { ...insightSeed, monitoringEnabled }),
  }
}

export function groupByClientId<T extends { client_id: string }>(rows: T[] = []) {
  const map = new Map<string, T[]>()
  rows.forEach((row) => {
    const list = map.get(row.client_id) ?? []
    list.push(row)
    map.set(row.client_id, list)
  })
  return map
}
