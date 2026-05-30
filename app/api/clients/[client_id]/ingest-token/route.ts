import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import apiUtils from '../../../../../lib/apiUtils'
import logger from '../../../../../lib/logger'
import { createIngestToken, hashIngestToken } from '../../../../../lib/ingestAuth'
import { requireUserAccess } from '../../../../../lib/accessControl'

function getBearerToken(req: Request) {
  const header = req.headers.get('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match ? match[1] : null
}

export async function POST(req: Request, { params }: { params: { client_id: string } }) {
  const clientId = params?.client_id
  if (!clientId) {
    return NextResponse.json(apiUtils.errorPayload('Missing client_id'), { status: 400, headers: apiUtils.CORS_HEADERS })
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

    const { data: clientRow, error: clientError } = await db
      .from('clients')
      .select('id, user_id')
      .eq('id', clientId)
      .maybeSingle()

    if (clientError) {
      logger.warn('ingest token client lookup failed', clientError)
      return NextResponse.json(apiUtils.errorPayload('Client lookup failed'), { status: 500, headers: apiUtils.CORS_HEADERS })
    }

    if (!clientRow) {
      return NextResponse.json(apiUtils.errorPayload('Client not found'), { status: 404, headers: apiUtils.CORS_HEADERS })
    }

    if (clientRow.user_id !== user.id) {
      return NextResponse.json(apiUtils.errorPayload('Forbidden'), { status: 403, headers: apiUtils.CORS_HEADERS })
    }

    const ingestToken = createIngestToken()
    const createdAt = new Date().toISOString()

    const { error: updateError } = await db
      .from('clients')
      .update({
        ingest_token_hash: hashIngestToken(ingestToken),
        ingest_token_created_at: createdAt,
        ingest_token_last_used_at: null,
      })
      .eq('id', clientId)
      .eq('user_id', user.id)

    if (updateError) {
      logger.warn('ingest token update failed', updateError)
      const missingColumn = String(updateError.message || '').includes('ingest_token')
      return NextResponse.json(
        apiUtils.errorPayload(missingColumn ? 'Ingest token columns missing. Run sql/004_add_ingest_tokens.sql.' : 'Failed to issue ingest token'),
        { status: 500, headers: apiUtils.CORS_HEADERS },
      )
    }

    return NextResponse.json(apiUtils.okPayload({
      client_id: clientId,
      ingest_token: ingestToken,
      created_at: createdAt,
    }), { headers: apiUtils.CORS_HEADERS })
  } catch (error) {
    logger.error('ingest token issue exception', error)
    return NextResponse.json(apiUtils.errorPayload('Server error'), { status: 500, headers: apiUtils.CORS_HEADERS })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: apiUtils.CORS_HEADERS })
}
