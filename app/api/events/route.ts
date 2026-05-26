import { NextResponse } from 'next/server'
import supabase from '../../../lib/supabase'
import { updateRiskStatusForClient } from '../../../lib/updateRiskStatus'
import { computeRiskScoreFromSnapshot, computeDerivedMetricsFromHistory } from '../../../lib/riskEngine'
import apiUtils from '../../../lib/apiUtils'
import logger from '../../../lib/logger'
import { allowRequest } from '../../../lib/rateLimiter'

type Incoming = {
  client_id: string
  type: 'PROFILE_SNAPSHOT'
  metadata: {
    followers: number | null
    following: number | null
    posts: number | null
    bio: string
    handle: string
  }
  timestamp?: number
}

function isValidIncoming(obj: any): obj is Incoming {
  if (!obj || typeof obj !== 'object') return false
  if (typeof obj.client_id !== 'string' || obj.client_id.length === 0) return false
  if (obj.type !== 'PROFILE_SNAPSHOT') return false
  if (!obj.metadata || typeof obj.metadata !== 'object') return false
  const m = obj.metadata
  const numOrNull = (v: any) => v === null || typeof v === 'number'
  if (!numOrNull(m.followers)) return false
  if (!numOrNull(m.following)) return false
  if (!numOrNull(m.posts)) return false
  if (typeof m.bio !== 'string') return false
  if (typeof m.handle !== 'string') return false
  if (obj.timestamp !== undefined && typeof obj.timestamp !== 'number') return false
  return true
}

export async function POST(req: Request) {
  let body: any
  try {
    body = await req.json()
  } catch (e) {
    return NextResponse.json(apiUtils.errorPayload('Invalid JSON'), { status: 400, headers: apiUtils.CORS_HEADERS })
  }
  const v = apiUtils.validateProfileSnapshot(body)
  if (!v.ok) return NextResponse.json(apiUtils.errorPayload(v.error), { status: 400, headers: apiUtils.CORS_HEADERS })

  const incoming: Incoming = body

  // Simple per-client rate limiting to protect DB from accidental floods
  try {
    const key = `client:${incoming.client_id}`
    if (!allowRequest(key, Number(process.env.PROFILE_SNAPSHOT_MAX_PER_MIN || 120), 60 * 1000)) {
      logger.warn('rate limit exceeded for', key)
      return NextResponse.json(apiUtils.errorPayload('rate limit exceeded'), { status: 429, headers: apiUtils.CORS_HEADERS })
    }
  } catch (e) {
    // if rate limiter fails, continue (fail-open)
    logger.warn('rate limiter error', e)
  }
  const event = {
    client_id: incoming.client_id,
    type: 'PROFILE_SNAPSHOT',
    value: null,
    metadata: incoming.metadata,
    created_at: new Date(incoming.timestamp ? incoming.timestamp : Date.now()).toISOString(),
  }

  try {
    // Use a service-role admin client server-side to bypass RLS for inserts when available.
    const admin = apiUtils.makeAdminClient()
    const db = admin ?? supabase

    // Ensure client exists and fetch its user_id
    const { data: clientRow, error: clientErr } = await db.from('clients').select('user_id').eq('id', event.client_id).maybeSingle()
    if (clientErr) {
      logger.warn('failed to lookup client for event', clientErr)
      return NextResponse.json(apiUtils.errorPayload('Client lookup failed'), { status: 500, headers: apiUtils.CORS_HEADERS })
    }
    if (!clientRow) {
      return NextResponse.json({ success: false, error: 'Client not found' }, { status: 400, headers: CORS_HEADERS })
    }

    // Try inserting the event including user_id. If the DB schema hasn't been migrated
    // (PGRST204 complaining about missing column), retry without user_id.
    let evData: any = null
    let evError: any = null
      try {
        const res = await db.from('events').insert({
          client_id: event.client_id,
          user_id: clientRow.user_id,
          type: event.type,
          metadata: event.metadata,
          created_at: event.created_at,
        }).select().single()
        evData = res.data
        evError = res.error
      } catch (e) {
        logger.warn('events insert threw', e)
        evError = e
      }

    if (evError) {
      // If schema cache is missing 'user_id' column, retry without it (best-effort)
      const isSchemaMissing = (evError && ((evError.code === 'PGRST204') || (evError.message && String(evError.message).includes("Could not find the 'user_id'"))))
      if (isSchemaMissing) {
        try {
          const r2 = await db.from('events').insert({
            client_id: event.client_id,
            type: event.type,
            metadata: event.metadata,
            created_at: event.created_at,
          }).select().single()
          evData = r2.data
          evError = r2.error
        } catch (e) {
          console.warn('events insert retry threw', e)
          evError = e
        }
      }
    }

    // Update client's last_checked timestamp regardless of whether event insert succeeded
    try {
      await db.from('clients').update({ last_checked: event.created_at }).eq('id', event.client_id)
    } catch (e) {
      logger.warn('failed to update clients.last_checked', e)
    }

    if (!evData || evError) {
      console.warn('failed to insert event', evError)
      return NextResponse.json({ success: false, error: 'Failed to insert event' }, { status: 500, headers: CORS_HEADERS })
    }

    // Update risk status: compute derived features using historical snapshots and numeric score (best-effort)
    try {
      // fetch historical profile snapshots for this client (include newly inserted event)
      let history: any[] = []
      try {
        const hres = await db.from('events').select('id, metadata, created_at').eq('client_id', event.client_id).eq('type', 'PROFILE_SNAPSHOT').order('created_at', { ascending: true }).limit(2000)
        if (hres && hres.data) history = hres.data
      } catch (e) {
        // ignore history fetch errors
        history = []
      }

      // compute derived metrics from history
      let derived: any = null
      try {
        derived = computeDerivedMetricsFromHistory(history, evData)
      } catch (e) { derived = null }

      // merge derived into event metadata in DB (best-effort)
      try {
        const newMeta = Object.assign({}, evData.metadata || {}, { derived })
        const up = await db.from('events').update({ metadata: newMeta }).eq('id', evData.id).select().single()
        if (up && up.data) evData = up.data
      } catch (e) {
        logger.warn('failed to merge derived into event metadata', e)
      }

      // fetch previous snapshot for deltas (closest before current)
      let prevEvent: any = null
      try {
        // look for latest event with created_at < current.created_at
        const prevRes = await db.from('events')
          .select('*')
          .eq('client_id', event.client_id)
          .neq('id', evData.id)
          .lt('created_at', evData.created_at)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (prevRes && prevRes.data) prevEvent = prevRes.data
      } catch (e) {
        // ignore
      }

      // fetch recent alerts for this client to include in scoring
      let recentAlerts: any[] = []
      try {
        const ares = await db.from('alerts').select('*').eq('client_id', event.client_id).order('created_at', { ascending: false }).limit(50)
        if (ares && ares.data) recentAlerts = ares.data
      } catch (e) {
        // ignore
      }

      const scoreRes = computeRiskScoreFromSnapshot({ currentEvent: evData, previousEvent: prevEvent, alerts: recentAlerts })
      try {
        await db.from('risk_status').upsert({ client_id: event.client_id, status: scoreRes.level, score: scoreRes.score, notes: scoreRes.reason }, { onConflict: 'client_id' })
      } catch (e) {
        logger.warn('failed to upsert risk_status', e)
      }

      // Append to risk_history for auditing/trends (best-effort)
      try {
        await db.from('risk_history').insert({
          client_id: event.client_id,
          event_id: evData.id,
          score: scoreRes.score,
          level: scoreRes.level,
          notes: scoreRes.reason,
          payload: { derived, previous_event_id: prevEvent ? prevEvent.id : null }
        })
      } catch (e) {
        logger.warn('failed to insert risk_history', e)
      }

      // Kick off a best-effort background recompute (do not block response)
      try {
        const adminCli = apiUtils.makeAdminClient()
        updateRiskStatusForClient(event.client_id, adminCli ?? undefined).catch((err) => logger.warn('updateRiskStatusForClient failed', err))
      } catch (e) {
        logger.warn('scheduling updateRiskStatusForClient failed', e)
      }

      // Return inserted event and derived risk summary
      return NextResponse.json(apiUtils.okPayload({ event: evData, derived, risk: { score: scoreRes.score, level: scoreRes.level, reason: scoreRes.reason } }), { status: 201, headers: apiUtils.CORS_HEADERS })
    } catch (e) {
      console.warn('risk scoring failed', e)
      return NextResponse.json({ success: true, event: evData }, { status: 201, headers: CORS_HEADERS })
    }
  } catch (e) {
    logger.error('insert exception', e)
    return NextResponse.json(apiUtils.errorPayload('DB error'), { status: 500, headers: apiUtils.CORS_HEADERS })
  }
}

// respond to preflight CORS requests
export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: apiUtils.CORS_HEADERS })
}
