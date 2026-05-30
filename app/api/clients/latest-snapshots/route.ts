import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import apiUtils from '../../../../lib/apiUtils'
import logger from '../../../../lib/logger'
import { requireUserAccess } from '../../../../lib/accessControl'

function getBearerToken(req: Request) {
  const header = req.headers.get('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match ? match[1] : null
}

function normalizeClientIds(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.filter((id): id is string => typeof id === 'string' && id.length > 0).slice(0, 500)
}

export async function POST(req: Request) {
  let body: any = null
  try {
    body = await req.json()
  } catch (error) {
    return NextResponse.json(apiUtils.errorPayload('Invalid JSON'), { status: 400, headers: apiUtils.CORS_HEADERS })
  }

  const requestedIds = normalizeClientIds(body?.client_ids)
  if (requestedIds.length === 0) {
    return NextResponse.json(apiUtils.okPayload({ events: [] }), { headers: apiUtils.CORS_HEADERS })
  }

  const token = getBearerToken(req)
  if (!token) {
    return NextResponse.json(apiUtils.errorPayload('Missing authorization token'), { status: 401, headers: apiUtils.CORS_HEADERS })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(apiUtils.errorPayload('Supabase env vars missing'), { status: 500, headers: apiUtils.CORS_HEADERS })
  }

  try {
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const { data: userData, error: userError } = await authClient.auth.getUser(token)
    const user = userData?.user
    if (userError || !user) {
      return NextResponse.json(apiUtils.errorPayload('Unauthorized'), { status: 401, headers: apiUtils.CORS_HEADERS })
    }

    const admin = apiUtils.makeAdminClient()
    const db = admin ?? authClient
    const access = await requireUserAccess(admin ?? db, user.id)
    if (!access.ok) return access.response

    const { data: clients, error: clientsError } = await db
      .from('clients')
      .select('id, user_id')
      .in('id', requestedIds)

    if (clientsError) {
      logger.warn('latest snapshots client lookup failed', clientsError)
      return NextResponse.json(apiUtils.errorPayload('Client lookup failed'), { status: 500, headers: apiUtils.CORS_HEADERS })
    }

    const allowedIds = (clients ?? [])
      .filter((client: any) => client.user_id === user.id)
      .map((client: any) => client.id)

    if (allowedIds.length === 0) {
      return NextResponse.json(apiUtils.okPayload({ events: [] }), { headers: apiUtils.CORS_HEADERS })
    }

    const rpcRes = await db.rpc('latest_profile_snapshots', { p_client_ids: allowedIds })
    if (!rpcRes.error) {
      return NextResponse.json(apiUtils.okPayload({ events: rpcRes.data ?? [] }), { headers: apiUtils.CORS_HEADERS })
    }

    logger.warn('latest_profile_snapshots RPC failed, using fallback query', rpcRes.error)

    const fallbackLimit = Math.min(5000, Math.max(allowedIds.length * 25, allowedIds.length))
    const { data: rows, error: eventsError } = await db
      .from('events')
      .select('id, client_id, type, metadata, created_at')
      .in('client_id', allowedIds)
      .eq('type', 'PROFILE_SNAPSHOT')
      .order('created_at', { ascending: false })
      .limit(fallbackLimit)

    if (eventsError) {
      logger.warn('latest snapshots fallback failed', eventsError)
      return NextResponse.json(apiUtils.errorPayload('Snapshot lookup failed'), { status: 500, headers: apiUtils.CORS_HEADERS })
    }

    const seen = new Set<string>()
    const events: any[] = []
    for (const row of rows ?? []) {
      if (seen.has(row.client_id)) continue
      seen.add(row.client_id)
      events.push(row)
    }

    return NextResponse.json(apiUtils.okPayload({ events }), { headers: apiUtils.CORS_HEADERS })
  } catch (error) {
    logger.error('latest snapshots exception', error)
    return NextResponse.json(apiUtils.errorPayload('Server error'), { status: 500, headers: apiUtils.CORS_HEADERS })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: apiUtils.CORS_HEADERS })
}
