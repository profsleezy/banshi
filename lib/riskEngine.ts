import type { Alert } from '../types/alert'
import type { RiskLevel } from '../types/client'

/**
 * Deterministic, pure function to compute client risk level from alerts.
 * Rules:
 * - 0 alerts => Healthy
 * - 1 warning => Watch
 * - 2 warnings => Risk
 * - any critical => Critical
 */
export function computeRiskLevel(alerts: Alert[] = []): RiskLevel {
  if (alerts.length === 0) return 'Healthy'

  // Any critical alert makes the client Critical
  for (const a of alerts) {
    if (a.severity === 'critical') return 'Critical'
  }

  // Count warnings deterministically
  const warnings = alerts.reduce((count, a) => count + (a.severity === 'warning' ? 1 : 0), 0)

  if (warnings >= 2) return 'Risk'
  if (warnings === 1) return 'Watch'

  return 'Healthy'
}

export default computeRiskLevel

// Compute derived metrics from historical PROFILE_SNAPSHOT events.
export function computeDerivedMetricsFromHistory(historyEvents: any[] = [], currentEvent: any) {
  try {
    if (!Array.isArray(historyEvents)) historyEvents = []
    // Normalize and sort events by created_at ascending
    const events = historyEvents.slice().filter(e => e && e.metadata && e.created_at).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    // Ensure currentEvent is included
    const cur = currentEvent && currentEvent.created_at ? currentEvent : null
    if (cur) {
      const exists = events.find(e => e.id === cur.id)
      if (!exists) events.push(cur)
    }

    const snapshotCount = events.length
    const nowTs = cur ? new Date(cur.created_at).getTime() : Date.now()
    const getNum = (ev: any, key: string) => (ev && ev.metadata && typeof ev.metadata[key] === 'number') ? ev.metadata[key] : null
    const getHandle = (ev: any) => (ev && ev.metadata && typeof ev.metadata.handle === 'string') ? ev.metadata.handle : null

    const currentFollowers = cur ? getNum(cur, 'followers') : null
    const currentFollowing = cur ? getNum(cur, 'following') : null
    const currentPosts = cur ? getNum(cur, 'posts') : null
    const currentHandle = cur ? getHandle(cur) : null
    const currentProfilePic = cur && cur.metadata ? (cur.metadata.profile_picture_url || null) : null
    const currentExternalLink = cur && cur.metadata ? (typeof cur.metadata.external_link_present === 'boolean' ? cur.metadata.external_link_present : null) : null
    const currentVerified = cur && cur.metadata ? (typeof cur.metadata.verified_badge === 'boolean' ? cur.metadata.verified_badge : null) : null
    const currentIsPrivate = cur && cur.metadata ? (typeof cur.metadata.is_private === 'boolean' ? cur.metadata.is_private : null) : null

    const findSnapshotAround = (windowMs: number) => {
      const windowStart = nowTs - windowMs
      // latest <= windowStart
      for (let i = events.length - 1; i >= 0; i--) {
        const ts = new Date(events[i].created_at).getTime()
        if (ts <= windowStart) return events[i]
      }
      // fallback: earliest after windowStart
      for (let i = 0; i < events.length; i++) {
        const ts = new Date(events[i].created_at).getTime()
        if (ts > windowStart) return events[i]
      }
      return null
    }

    const computeVelocity = (key: string, windowDays: number) => {
      if (!cur) return null
      const nowVal = getNum(cur, key)
      if (typeof nowVal !== 'number') return null
      const snap = findSnapshotAround(windowDays * 24 * 3600 * 1000)
      if (!snap) return null
      const snapVal = getNum(snap, key)
      if (typeof snapVal !== 'number') return null
      const snapTs = new Date(snap.created_at).getTime()
      const days = Math.max(0.001, (nowTs - snapTs) / 86400000)
      const delta = nowVal - snapVal
      const perDay = delta / days
      const pctChange = (snapVal > 0) ? (delta / Math.max(1, snapVal)) * 100 : null
      return { per_day: perDay, pct_change: pctChange, days }
    }

    const fvel7 = computeVelocity('followers', 7)
    const fvel30 = computeVelocity('followers', 30)
    const follvel7 = computeVelocity('following', 7)
    const posts30 = (function () {
      if (!cur) return null
      const snap = findSnapshotAround(30 * 24 * 3600 * 1000)
      if (!snap) return null
      const nowP = currentPosts
      const thenP = getNum(snap, 'posts')
      if (typeof nowP !== 'number' || typeof thenP !== 'number') return null
      const days = Math.max(0.001, (nowTs - new Date(snap.created_at).getTime()) / 86400000)
      const pct = (thenP > 0) ? ((nowP - thenP) / Math.max(1, thenP)) * 100 : null
      return { pct_change: pct, days }
    })()

    // posting_inactivity_days: days since last observed post increment
    let posting_inactivity_days: number | null = null
    if (typeof currentPosts === 'number') {
      // iterate snapshots descending to find last snapshot where posts < currentPosts
      for (let i = events.length - 1; i >= 0; i--) {
        const s = events[i]
        const p = getNum(s, 'posts')
        if (typeof p === 'number' && p < currentPosts) {
          posting_inactivity_days = Math.round((nowTs - new Date(s.created_at).getTime()) / 86400000)
          break
        }
      }
    }

    // follow_ratio and drift
    const follow_ratio_now = (typeof currentFollowers === 'number' && typeof currentFollowing === 'number') ? (currentFollowers / Math.max(1, currentFollowing)) : null
    let follow_ratio_30d = null
    let follow_ratio_drift = null
    let follow_ratio_drift_pct = null
    const snap30 = findSnapshotAround(30 * 24 * 3600 * 1000)
    if (snap30) {
      const f30 = getNum(snap30, 'followers')
      const g30 = getNum(snap30, 'following')
      if (typeof f30 === 'number' && typeof g30 === 'number') {
        follow_ratio_30d = f30 / Math.max(1, g30)
        if (follow_ratio_now !== null) {
          follow_ratio_drift = follow_ratio_now - follow_ratio_30d
          if (follow_ratio_30d > 0) follow_ratio_drift_pct = (follow_ratio_drift / follow_ratio_30d) * 100
        }
      }
    }

    // username change detection
    const handles = new Set(events.map(e => getHandle(e)).filter(Boolean))
    const username_change_detected = (handles.size > 1) && (!currentHandle || handles.has(currentHandle) || handles.size > 1)

    // profile stability score (0..100)
    let stability = 100
    if (username_change_detected) stability -= 40
    if (fvel30 && typeof fvel30.pct_change === 'number') {
      const absPct = Math.abs(fvel30.pct_change)
      if (absPct > 50) stability -= 40
      else if (absPct > 20) stability -= 20
      else if (absPct > 10) stability -= 10
    }
    if (posts30 && typeof posts30.pct_change === 'number') {
      const absP = Math.abs(posts30.pct_change)
      if (absP > 100) stability -= 30
      else if (absP > 50) stability -= 15
    }
    if (typeof posting_inactivity_days === 'number') {
      if (posting_inactivity_days > 60) stability -= 25
      else if (posting_inactivity_days > 30) stability -= 10
      else if (posting_inactivity_days > 14) stability -= 5
    }
    const profile_stability_score = Math.max(0, Math.min(100, Math.round(stability)))

    const account_age_confidence = Math.min(1, snapshotCount / 10)

    // Short-term / live deltas based on the previous snapshot (closest before current)
    let prev: any = null
    if (cur) {
      for (let i = events.length - 1; i >= 0; i--) {
        const s = events[i]
        if (s.id === cur.id) continue
        const ts = new Date(s.created_at).getTime()
        if (ts <= nowTs) {
          prev = s
          break
        }
      }
    }

    let live_follower_delta: number | null = null
    let live_follower_pct_change: number | null = null
    let live_followers_per_day: number | null = null
    let live_post_delta: number | null = null
    let live_posts_per_day: number | null = null
    let minutes_since_prev: number | null = null
    let handle_changed: boolean | null = null
    let profile_picture_changed: boolean | null = null
    let external_link_added: boolean | null = null
    let verified_changed: boolean | null = null
    let is_private_changed: boolean | null = null
    let short_term_spike: boolean | null = null

    if (prev && cur) {
      const prevFollowers = getNum(prev, 'followers')
      const prevPosts = getNum(prev, 'posts')
      const prevHandle = getHandle(prev)
      const prevProfilePic = prev && prev.metadata ? (prev.metadata.profile_picture_url || null) : null
      const prevExternal = prev && prev.metadata ? (typeof prev.metadata.external_link_present === 'boolean' ? prev.metadata.external_link_present : null) : null
      const prevVerified = prev && prev.metadata ? (typeof prev.metadata.verified_badge === 'boolean' ? prev.metadata.verified_badge : null) : null
      const prevIsPrivate = prev && prev.metadata ? (typeof prev.metadata.is_private === 'boolean' ? prev.metadata.is_private : null) : null

      if (typeof currentFollowers === 'number' && typeof prevFollowers === 'number') {
        live_follower_delta = currentFollowers - prevFollowers
        if (prevFollowers > 0) live_follower_pct_change = ((currentFollowers - prevFollowers) / Math.max(1, prevFollowers)) * 100
        const prevTs = new Date(prev.created_at).getTime()
        const days = Math.max(0.001, (nowTs - prevTs) / 86400000)
        live_followers_per_day = (currentFollowers - prevFollowers) / days
      }

      if (typeof currentPosts === 'number' && typeof prevPosts === 'number') {
        live_post_delta = currentPosts - prevPosts
        const prevTs = new Date(prev.created_at).getTime()
        const days = Math.max(0.001, (nowTs - prevTs) / 86400000)
        live_posts_per_day = (currentPosts - prevPosts) / days
      }

      minutes_since_prev = Math.round((nowTs - new Date(prev.created_at).getTime()) / 60000)
      handle_changed = (prevHandle && currentHandle) ? (prevHandle !== currentHandle) : null
      profile_picture_changed = (prevProfilePic || currentProfilePic) ? (prevProfilePic !== currentProfilePic) : null
      external_link_added = (prevExternal === false && currentExternalLink === true) ? true : false
      verified_changed = (prevVerified !== null && currentVerified !== null) ? (prevVerified !== currentVerified) : null
      is_private_changed = (prevIsPrivate !== null && currentIsPrivate !== null) ? (prevIsPrivate !== currentIsPrivate) : null

      short_term_spike = false
      if (typeof live_follower_pct_change === 'number' && Math.abs(live_follower_pct_change) > 20) short_term_spike = true
      if (typeof live_follower_delta === 'number' && Math.abs(live_follower_delta) > Math.max(500, (currentFollowers || 0) * 0.2)) short_term_spike = true
    }

    return {
      snapshot_count: snapshotCount,
      follower_velocity_7d: fvel7 ? fvel7.per_day : null,
      follower_pct_change_7d: fvel7 ? fvel7.pct_change : null,
      follower_velocity_30d: fvel30 ? fvel30.per_day : null,
      follower_pct_change_30d: fvel30 ? fvel30.pct_change : null,
      following_velocity_7d: follvel7 ? follvel7.per_day : null,
      post_growth_rate_30d: posts30 ? posts30.pct_change : null,
      post_growth_days_30d: posts30 ? posts30.days : null,
      posting_inactivity_days: posting_inactivity_days,
      follow_ratio: follow_ratio_now,
      follow_ratio_30d: follow_ratio_30d,
      follow_ratio_drift: follow_ratio_drift,
      follow_ratio_drift_pct: follow_ratio_drift_pct,
      username_change_detected: username_change_detected,
      profile_stability_score: profile_stability_score,
      account_age_confidence: account_age_confidence
      ,
      // Live / short-term derived fields
      previous_snapshot_id: prev ? prev.id : null,
      previous_snapshot_ts: prev ? prev.created_at : null,
      live_follower_delta: live_follower_delta,
      live_follower_pct_change: live_follower_pct_change,
      live_followers_per_day: live_followers_per_day,
      live_post_delta: live_post_delta,
      live_posts_per_day: live_posts_per_day,
      minutes_since_prev: minutes_since_prev,
      handle_changed: handle_changed,
      profile_picture_changed: profile_picture_changed,
      external_link_added: external_link_added,
      verified_changed: verified_changed,
      is_private_changed: is_private_changed,
      short_term_spike: short_term_spike
    }
  } catch (e) {
    return null
  }
}

export function computeRiskScoreFromSnapshot(opts: { currentEvent: any; previousEvent?: any; alerts?: Alert[] }) {
  const { currentEvent, previousEvent, alerts = [] } = opts || {}
  const meta = (currentEvent && currentEvent.metadata) ? currentEvent.metadata : {}
  const followers = typeof meta.followers === 'number' ? meta.followers : null
  const following = typeof meta.following === 'number' ? meta.following : null
  const posts = typeof meta.posts === 'number' ? meta.posts : null
  const bio = typeof meta.bio === 'string' ? meta.bio : ''
  const recent_posts = Array.isArray(meta.recent_posts) ? meta.recent_posts : null
  const avg_likes = typeof meta.avg_likes === 'number' ? meta.avg_likes : null
  const avg_comments = typeof meta.avg_comments === 'number' ? meta.avg_comments : null

  // derived metrics (optional, computed server-side)
  const derived = (meta && meta.derived) ? meta.derived : null

  const reasons: string[] = []
  let score = 0

  // Follower change percentage vs previous snapshot
  // Prefer short-term live deltas when available
  let deltaPct: number | null = null
  let liveDelta: number | null = null
  let minutesSincePrev: number | null = null
  if (derived) {
    if (typeof derived.live_follower_pct_change === 'number') deltaPct = derived.live_follower_pct_change
    if (typeof derived.live_follower_delta === 'number') liveDelta = derived.live_follower_delta
    if (typeof derived.minutes_since_prev === 'number') minutesSincePrev = derived.minutes_since_prev
  }

  // Fallback to previousEvent if live fields unavailable
  if (deltaPct === null && previousEvent && previousEvent.metadata && typeof previousEvent.metadata.followers === 'number' && typeof followers === 'number') {
    const prevFollowers = previousEvent.metadata.followers
    if (prevFollowers > 0) deltaPct = ((followers - prevFollowers) / prevFollowers) * 100
  }

  if (typeof deltaPct === 'number') {
    if (deltaPct > 25) {
      score += 50
      reasons.push('big follower spike')
    } else if (deltaPct > 12) {
      score += 25
      reasons.push('moderate follower spike')
    } else if (deltaPct < -20) {
      score += 35
      reasons.push('rapid follower loss')
    }
  }

  // Immediate large absolute follower changes
  if (typeof liveDelta === 'number') {
    if (Math.abs(liveDelta) > 2000) { score += 50; reasons.push('very large follower change (live)') }
    else if (Math.abs(liveDelta) > 800) { score += 30; reasons.push('large follower change (live)') }
    else if (Math.abs(liveDelta) > 250) { score += 12; reasons.push('noticeable follower change (live)') }
  }

  // If a huge change happened very recently, escalate
  if (minutesSincePrev !== null && typeof liveDelta === 'number') {
    if (minutesSincePrev <= 60 && Math.abs(liveDelta) > 500) { score += 30; reasons.push('rapid follower change in last hour') }
  }

  // follower/following ratio
  if (typeof followers === 'number' && typeof following === 'number') {
    const ratio = followers / Math.max(1, following)
    if (followers > 1000 && ratio < 0.05) {
      score += 30
      reasons.push('low follower/following ratio')
    }
    if (following > (followers * 3) && followers < 500) {
      score += 20
      reasons.push('follows many accounts')
    }
  }

  // posts per day spike (approx)
  if (typeof posts === 'number' && previousEvent && typeof previousEvent.metadata.posts === 'number') {
    const prevPosts = previousEvent.metadata.posts
    const postsDelta = posts - prevPosts
    const curTs = new Date(currentEvent.created_at).getTime()
    const prevTs = new Date(previousEvent.created_at).getTime()
    const days = Math.max(0.001, (curTs - prevTs) / 86400000)
    const postsPerDay = postsDelta / days
    if (postsPerDay > 5) {
      score += 15
      reasons.push('sudden posting burst')
    } else if (postsPerDay > 2) {
      score += 8
      reasons.push('increased posting')
    }
  }

  // bio checks
  if (bio && typeof bio === 'string') {
    if (/(follow4follow|follow for follow|free followers|buy followers|promo|promotion|dm for)/i.test(bio)) {
      score += 25
      reasons.push('suspicious bio keywords')
    }
    if (/(https?:\/\/|www\.)/i.test(bio)) {
      score += 15
      reasons.push('bio contains external link')
    }
  }

  // engagement checks (avg likes vs followers)
  if (typeof avg_likes === 'number' && typeof followers === 'number' && followers > 0) {
    const engagementRate = avg_likes / Math.max(1, followers)
    if (followers > 1000 && engagementRate < 0.005) {
      score += 30
      reasons.push('low engagement')
    } else if (engagementRate < 0.01) {
      score += 10
      reasons.push('low engagement')
    }
  }

  // incorporate existing alerts as additive risk
  if (Array.isArray(alerts) && alerts.length > 0) {
    for (const a of alerts) {
      if (a.severity === 'critical') score += 50
      else if (a.severity === 'warning') score += 10
    }
  }

  // Use derived metrics when available to add deterministic signals
  if (derived) {
    try {
      if (typeof derived.username_change_detected === 'boolean' && derived.username_change_detected) {
        score += 30
        reasons.push('username changed')
      }

      if (typeof derived.follower_pct_change_30d === 'number') {
        if (derived.follower_pct_change_30d > 50) { score += 40; reasons.push('big follower spike (30d)') }
        else if (derived.follower_pct_change_30d > 20) { score += 20; reasons.push('moderate follower spike (30d)') }
        else if (derived.follower_pct_change_30d < -25) { score += 30; reasons.push('rapid follower loss (30d)') }
      }

      if (typeof derived.posting_inactivity_days === 'number') {
        if (derived.posting_inactivity_days > 60) { score += 25; reasons.push('posting inactivity > 60d') }
        else if (derived.posting_inactivity_days > 30) { score += 10; reasons.push('posting inactivity > 30d') }
      }

      // Short-term / live signals
      if (typeof derived.short_term_spike === 'boolean' && derived.short_term_spike) {
        score += 30
        reasons.push('short-term follower spike')
      }
      if (typeof derived.live_follower_pct_change === 'number') {
        if (derived.live_follower_pct_change > 50) { score += 40; reasons.push('very large follower spike (live)') }
        else if (derived.live_follower_pct_change > 25) { score += 25; reasons.push('large follower spike (live)') }
        else if (derived.live_follower_pct_change < -30) { score += 30; reasons.push('rapid follower loss (live)') }
      }

      if (typeof derived.handle_changed === 'boolean' && derived.handle_changed) {
        score += 25
        reasons.push('handle changed recently')
      }

      if (typeof derived.profile_picture_changed === 'boolean' && derived.profile_picture_changed) {
        score += 10
        reasons.push('profile picture changed')
      }

      if (typeof derived.external_link_added === 'boolean' && derived.external_link_added) {
        score += 10
        reasons.push('external link added to profile')
      }

      if (typeof derived.verified_changed === 'boolean' && derived.verified_changed) {
        score += 30
        reasons.push('verified status changed')
      }

      if (typeof derived.is_private_changed === 'boolean' && derived.is_private_changed) {
        score += 15
        reasons.push('privacy setting changed')
      }

      if (typeof derived.follow_ratio_drift_pct === 'number' && derived.follow_ratio_drift_pct < -50) {
        score += 15
        reasons.push('follow ratio dropped significantly')
      }

      if (typeof derived.profile_stability_score === 'number') {
        if (derived.profile_stability_score < 40) { score += Math.round((50 - derived.profile_stability_score) / 2); reasons.push('low profile stability') }
      }
    } catch (e) {
      // ignore derived errors
    }
  }

  score = Math.min(100, score)

  let level: RiskLevel = 'Healthy'
  if (score >= 80) level = 'Critical'
  else if (score >= 60) level = 'Risk'
  else if (score >= 30) level = 'Watch'

  const reason = reasons.length > 0 ? reasons.join(', ') : 'no suspicious signals'

  return { score, reason, level }
}
