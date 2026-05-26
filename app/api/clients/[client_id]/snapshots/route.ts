import { NextResponse } from 'next/server'
import supabase from '../../../../../lib/supabase'
import apiUtils from '../../../../../lib/apiUtils'
import logger from '../../../../../lib/logger'
import { createClient } from '@supabase/supabase-js'
import { allowRequest } from '../../../../../lib/rateLimiter'

export async function GET(req: Request, { params }: { params: { client_id: string } }) {
  const clientId = params && params.client_id ? params.client_id : null
  if (!clientId) return NextResponse.json(apiUtils.errorPayload('Missing client_id'), { status: 400, headers: apiUtils.CORS_HEADERS })

  // parse query params
  const url = new URL(req.url)
  const limitParam = url.searchParams.get('limit')
  const pageParam = url.searchParams.get('page')
  const orderParam = (url.searchParams.get('order') || 'desc').toLowerCase()
  const since = url.searchParams.get('since')
  const until = url.searchParams.get('until')

  const limit = Math.min(1000, Math.max(1, Number(limitParam || 200)))
  const page = Math.max(0, Number(pageParam || 0))
  const asc = orderParam === 'asc'
  const start = page * limit
  const end = start + limit - 1

  try {
    const admin = apiUtils.makeAdminClient()
    const db = admin ?? supabase

    // lightweight rate limiting on reads to protect the DB from abusive clients
    try {
      const key = `snapshots:client:${clientId}`
      if (!allowRequest(key, Number(process.env.SNAPSHOTS_MAX_PER_MIN || 60), 60 * 1000)) {
        logger.warn('snapshots GET rate limit', key)
        return NextResponse.json(apiUtils.errorPayload('rate limit exceeded'), { status: 429, headers: apiUtils.CORS_HEADERS })
      }
    } catch (e) {
      logger.warn('rate limiter failed for snapshots GET', e)
    }

    let query = db.from('events').select('id, client_id, metadata, created_at').eq('client_id', clientId).eq('type', 'PROFILE_SNAPSHOT')
    if (since) {
      const s = Number(since)
      if (!Number.isNaN(s)) query = query.gte('created_at', new Date(s).toISOString())
      else query = query.gte('created_at', since)
    }
    if (until) {
      const u = Number(until)
      if (!Number.isNaN(u)) query = query.lte('created_at', new Date(u).toISOString())
      else query = query.lte('created_at', until)
    }

    query = query.order('created_at', { ascending: asc }).range(start, end)

    const res = await query
    if (res.error) {
      logger.warn('snapshots GET failed', res.error)
      return NextResponse.json(apiUtils.errorPayload('DB error'), { status: 500, headers: apiUtils.CORS_HEADERS })
    }

    const rows = res.data || []
    return NextResponse.json(apiUtils.okPayload({ events: rows, page, limit }), { headers: apiUtils.CORS_HEADERS })
  } catch (e) {
    logger.error('snapshots GET exception', e)
    return NextResponse.json(apiUtils.errorPayload('Server error'), { status: 500, headers: apiUtils.CORS_HEADERS })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: apiUtils.CORS_HEADERS })
}
