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

export type ReviewUrgency = 'review_now' | 'monitor' | 'healthy' | 'paused'

export type AssistantFinding = {
  title: string
  detail: string
  action: string
  tone: ClientSignal['tone']
  evidence?: string
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
  externalLinkRemoved?: boolean | null
  bioChanged?: boolean | null
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
  reviewUrgency: ReviewUrgency
  reviewLabel: string
  reviewSummary: string
  assistantFindings: AssistantFinding[]
  nextBestAction: string
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

  if (insight.externalLinkAdded || insight.externalLinkRemoved) score -= 8
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
    insight.externalLinkAdded || insight.externalLinkRemoved ? 65 : insight.externalLinkPresent ? 30 : 0,
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
      reason: externalLinkScore ? 'External profile link is present, changed, or removed.' : 'No external-link risk detected.',
      action: externalLinkScore >= 55 ? 'Verify the link state with the account owner before approving the profile state.' : 'Confirm the link remains client-approved.',
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

function absPct(value?: number | null, digits = 1) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return `${Math.abs(value).toFixed(Math.abs(value) >= 10 ? 0 : digits)}%`
}

function signedCompact(value?: number | null, suffix = '') {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  const sign = value > 0 ? '+' : ''
  const compact = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
  return `${sign}${compact}${suffix}`
}

function findingRank(tone: ClientSignal['tone']) {
  if (tone === 'critical') return 0
  if (tone === 'risk') return 1
  if (tone === 'watch') return 2
  if (tone === 'neutral') return 3
  return 4
}

function addFinding(findings: AssistantFinding[], finding: AssistantFinding) {
  if (!findings.some((item) => item.title === finding.title)) findings.push(finding)
}

function buildAssistantFindings(insight: Partial<ClientInsight>): AssistantFinding[] {
  const findings: AssistantFinding[] = []
  const follower7 = insight.followerPctChange7d
  const follower30 = insight.followerPctChange30d
  const velocity7 = insight.followerVelocity7d
  const followingVelocity = insight.followingVelocity7d
  const drift = insight.followRatioDriftPct
  const snapshotCount = insight.snapshotCount ?? insight.snapshots?.length ?? 0

  if (!insight.monitoringEnabled) {
    addFinding(findings, {
      title: 'Monitoring is paused',
      tone: 'watch',
      detail: 'No new snapshots will be collected until this profile is linked again.',
      action: 'Turn monitoring back on before using this account for live incident coverage.',
      evidence: 'Collector paused',
    })
  } else if (insight.staleData) {
    const hours = typeof insight.staleHours === 'number' ? `${insight.staleHours.toFixed(1)}h` : 'unknown age'
    addFinding(findings, {
      title: 'Collector needs attention',
      tone: insight.freshnessStatus === 'missing' || (insight.staleHours ?? 0) > 24 ? 'risk' : 'watch',
      detail: `The latest snapshot is stale (${hours}). The report may miss current changes.`,
      action: 'Open the Instagram profile tab and confirm the extension is still linked before trusting today\'s read.',
      evidence: insight.freshnessStatus,
    })
  }

  if (insight.riskStatus === 'Critical' || insight.riskStatus === 'Risk' || insight.riskStatus === 'Watch') {
    addFinding(findings, {
      title: 'Risk score elevated',
      tone: insight.riskStatus === 'Critical' ? 'critical' : insight.riskStatus === 'Risk' ? 'risk' : 'watch',
      detail: `Current status is ${insight.riskStatus}${typeof insight.riskScore === 'number' ? ` with score ${insight.riskScore}` : ''}.`,
      action: 'Open the report, read the top findings, and decide whether this is expected campaign activity or an account issue.',
      evidence: insight.riskStatus,
    })
  }

  if (insight.usernameChangeDetected || insight.handleChanged) {
    addFinding(findings, {
      title: 'Handle changed',
      tone: 'critical',
      detail: 'The account identity moved. This is one of the clearest account-control signals.',
      action: 'Confirm the change was intentional, verify owner access, and preserve the latest snapshot for the client trail.',
      evidence: 'username_change_detected',
    })
  }

  if (insight.verifiedChanged) {
    addFinding(findings, {
      title: 'Verification changed',
      tone: 'critical',
      detail: 'The verification state changed on a profile where trust signals matter.',
      action: 'Treat this as an owner-access check: verify login access, profile settings, and recent account notices.',
      evidence: 'verified_changed',
    })
  }

  if (insight.bioChanged) {
    addFinding(findings, {
      title: 'Bio changed',
      tone: 'watch',
      detail: 'Profile copy changed after the account had an established baseline.',
      action: 'Confirm the bio edit was intentional and approved before the next client check-in.',
      evidence: 'bio_changed',
    })
  }

  if (insight.externalLinkRemoved) {
    addFinding(findings, {
      title: 'Link removed',
      tone: 'risk',
      detail: 'The external link disappeared from the profile.',
      action: 'Verify this was intentional. Link removals can happen during takeovers, profile cleanups, or account transitions.',
      evidence: 'external_link_removed',
    })
  } else if (insight.externalLinkAdded) {
    addFinding(findings, {
      title: 'New external link',
      tone: 'risk',
      detail: 'A profile link was added or changed from the previous baseline.',
      action: 'Open the destination and confirm it is client-approved before treating the profile as safe.',
      evidence: 'external_link_added',
    })
  } else if (insight.externalLinkPresent) {
    addFinding(findings, {
      title: 'External link present',
      tone: 'watch',
      detail: 'The profile is sending traffic outside Instagram.',
      action: 'Confirm the destination is still owned or approved by the client.',
      evidence: 'external_link_present',
    })
  }

  if (typeof follower7 === 'number' && follower7 <= -10) {
    const pct = absPct(follower7)
    addFinding(findings, {
      title: 'Follower drop',
      tone: follower7 <= -18 ? 'risk' : 'watch',
      detail: `Followers dropped ${pct} over the last 7 days.`,
      action: 'Check whether the account was restricted, whether recent content triggered churn, and whether traffic sources changed.',
      evidence: `${follower7.toFixed(1)}% 7d`,
    })
  } else if (typeof follower30 === 'number' && follower30 <= -15) {
    const pct = absPct(follower30)
    addFinding(findings, {
      title: 'Follower drop',
      tone: 'watch',
      detail: `Followers dropped ${pct} over the last 30 days.`,
      action: 'Compare the drop against posting cadence, content removals, promos ending, and account restriction notices.',
      evidence: `${follower30.toFixed(1)}% 30d`,
    })
  }

  if (typeof follower7 === 'number' && follower7 >= 15) {
    const pct = absPct(follower7)
    addFinding(findings, {
      title: 'Follower spike',
      tone: follower7 >= 30 ? 'risk' : 'watch',
      detail: `Followers increased ${pct} over the last 7 days.`,
      action: 'Match the jump against campaigns, paid pushes, or viral posts. If none explain it, review for suspicious growth.',
      evidence: `${follower7.toFixed(1)}% 7d`,
    })
  } else if (insight.shortTermSpike) {
    addFinding(findings, {
      title: 'Short-term spike',
      tone: 'risk',
      detail: 'The latest snapshot triggered a short-term audience movement signal.',
      action: 'Compare the spike to recent campaigns or posts before assuming it is healthy growth.',
      evidence: 'short_term_spike',
    })
  }

  if (typeof velocity7 === 'number' && Math.abs(velocity7) >= 1000) {
    addFinding(findings, {
      title: 'Audience velocity moved fast',
      tone: 'watch',
      detail: `Follower velocity is ${signedCompact(velocity7, '/day')}.`,
      action: 'Check whether this pace matches a real campaign. If not, keep the account in review until the next snapshot.',
      evidence: `${velocity7.toFixed(1)}/day`,
    })
  }

  if (typeof followingVelocity === 'number' && Math.abs(followingVelocity) >= 100) {
    addFinding(findings, {
      title: 'Following count moved fast',
      tone: 'watch',
      detail: `Following velocity is ${signedCompact(followingVelocity, '/day')}.`,
      action: 'Confirm no aggressive follow or unfollow activity is happening from the account.',
      evidence: `${followingVelocity.toFixed(1)}/day`,
    })
  }

  if (typeof drift === 'number' && Math.abs(drift) >= 20) {
    addFinding(findings, {
      title: 'Follow ratio drift',
      tone: 'watch',
      detail: `Follow ratio drifted ${absPct(drift)} from the recent baseline.`,
      action: 'Check whether the account changed its follow strategy or whether audience movement looks manipulated.',
      evidence: `${drift.toFixed(1)}% drift`,
    })
  }

  if (insight.profilePictureChanged) {
    addFinding(findings, {
      title: 'Profile image changed',
      tone: 'watch',
      detail: 'The visual identity moved from the previous baseline.',
      action: 'Confirm the image change is approved and not part of an account-control issue.',
      evidence: 'profile_picture_changed',
    })
  }

  if (insight.isPrivateChanged) {
    addFinding(findings, {
      title: 'Privacy changed',
      tone: 'risk',
      detail: 'The account privacy setting changed.',
      action: 'Confirm whether the client intentionally changed visibility and check whether reach or restrictions changed afterward.',
      evidence: 'is_private_changed',
    })
  }

  if (typeof insight.postingInactivityDays === 'number' && insight.postingInactivityDays >= 21) {
    addFinding(findings, {
      title: 'Posting inactivity',
      tone: insight.postingInactivityDays >= 45 ? 'risk' : 'watch',
      detail: `No meaningful posting movement for about ${Math.round(insight.postingInactivityDays)} days.`,
      action: 'Confirm inactivity is planned. If not, check account access, content queue, and recent platform notices.',
      evidence: `${Math.round(insight.postingInactivityDays)} days`,
    })
  }

  if (typeof insight.profileStabilityScore === 'number' && insight.profileStabilityScore < 70) {
    addFinding(findings, {
      title: 'Profile stability dropped',
      tone: insight.profileStabilityScore < 40 ? 'risk' : 'watch',
      detail: `Profile stability is ${Math.round(insight.profileStabilityScore)}/100.`,
      action: 'Review the exact profile fields that moved and confirm each change with the client or operator.',
      evidence: `${Math.round(insight.profileStabilityScore)}/100`,
    })
  }

  if (snapshotCount < 3 && insight.monitoringEnabled) {
    addFinding(findings, {
      title: 'Baseline is still thin',
      tone: 'neutral',
      detail: 'There are not enough snapshots to make strong trend calls yet.',
      action: 'Keep the profile tab available and treat today\'s report as an early read, not a final verdict.',
      evidence: `${snapshotCount} snapshots`,
    })
  }

  if (findings.length === 0) {
    addFinding(findings, {
      title: 'No unusual activity',
      tone: 'good',
      detail: 'Current public signals are inside the available baseline.',
      action: 'No action needed today. Keep monitoring so the account history keeps improving.',
      evidence: 'stable',
    })
  }

  return findings.sort((a, b) => findingRank(a.tone) - findingRank(b.tone))
}

function deriveReviewUrgency(insight: Partial<ClientInsight>, findings: AssistantFinding[]): ReviewUrgency {
  if (!insight.monitoringEnabled) return 'paused'
  if (findings.some((finding) => finding.tone === 'critical' || finding.tone === 'risk')) return 'review_now'
  if (insight.priority === 'Escalate' || insight.priority === 'Prepare') return 'review_now'
  if (findings.some((finding) => finding.tone === 'watch') || insight.priority === 'Review') return 'monitor'
  return 'healthy'
}

function reviewLabel(urgency: ReviewUrgency) {
  if (urgency === 'review_now') return 'Review now'
  if (urgency === 'monitor') return 'Monitor'
  if (urgency === 'paused') return 'Paused'
  return 'Healthy'
}

function reviewSummary(urgency: ReviewUrgency, findings: AssistantFinding[]) {
  if (urgency === 'paused') return 'Monitoring is paused.'
  const visible = findings.filter((finding) => finding.tone !== 'good').slice(0, 3)
  if (urgency === 'healthy' || visible.length === 0) return 'No unusual activity.'
  return visible.map((finding) => finding.title.toLowerCase()).join(' + ')
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
  if (insight.bioChanged) signals.push({ label: 'Bio changed', tone: 'watch' })
  if (insight.profilePictureChanged) signals.push({ label: 'Profile image changed', tone: 'watch' })
  if (insight.externalLinkRemoved) signals.push({ label: 'External link removed', tone: 'risk' })
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
    externalLinkRemoved: typeof derived.external_link_removed === 'boolean' ? derived.external_link_removed : boolFromSources(sources, 'external_link_removed'),
    bioChanged: typeof derived.bio_changed === 'boolean' ? derived.bio_changed : boolFromSources(sources, 'bio_changed'),
    verifiedBadge: boolFromSources(sources, 'verified_badge'),
    verifiedChanged: typeof derived.verified_changed === 'boolean' ? derived.verified_changed : null,
    isPrivate: boolFromSources(sources, 'is_private'),
    isPrivateChanged: typeof derived.is_private_changed === 'boolean' ? derived.is_private_changed : null,
  }
  const priority = insightSeed.staleData && monitoringEnabled ? 'Review' : derivePriority(riskScore, riskStatus, monitoringEnabled)
  const signals = buildSignals(insightSeed)
  const readiness = computeBanRiskReadiness(insightSeed)
  const incidentSeverities = buildIncidentSeverities(insightSeed)
  const assistantFindings = buildAssistantFindings({ ...insightSeed, priority, monitoringEnabled })
  const reviewUrgencyValue = deriveReviewUrgency({ ...insightSeed, priority, monitoringEnabled }, assistantFindings)
  const primaryFinding = !monitoringEnabled
    ? assistantFindings.find((finding) => finding.title === 'Monitoring is paused') ?? assistantFindings[0]
    : assistantFindings[0]
  const nextBestAction = primaryFinding?.action ?? recommendedAction(priority, { ...insightSeed, monitoringEnabled })

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
    externalLinkRemoved: insightSeed.externalLinkRemoved,
    bioChanged: insightSeed.bioChanged,
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
    reviewUrgency: reviewUrgencyValue,
    reviewLabel: reviewLabel(reviewUrgencyValue),
    reviewSummary: reviewSummary(reviewUrgencyValue, assistantFindings),
    assistantFindings,
    nextBestAction,
    recommendedAction: nextBestAction,
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
