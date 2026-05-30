import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import apiUtils from '../../../../lib/apiUtils'
import logger from '../../../../lib/logger'
import { requireUserAccess } from '../../../../lib/accessControl'

type AuthorizedClientContext = {
  response?: NextResponse
  db?: any
  user?: any
  clientRow?: any
}

const CLIENT_SELECT = 'id, user_id, name, platform, account_id, notes, latest_snapshot_metadata, monitoring_enabled, monitoring_updated_at, created_at, updated_at, last_checked'

function getBearerToken(req: Request) {
  const header = req.headers.get('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match ? match[1] : null
}

async function getAuthorizedClientContext(req: Request, clientId: string): Promise<AuthorizedClientContext> {
  const token = getBearerToken(req)
  if (!token) {
    return {
      response: NextResponse.json(apiUtils.errorPayload('Missing authorization token'), {
        status: 401,
        headers: apiUtils.CORS_HEADERS,
      }),
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      response: NextResponse.json(apiUtils.errorPayload('Supabase env vars missing'), {
        status: 500,
        headers: apiUtils.CORS_HEADERS,
      }),
    }
  }

  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: userData, error: userError } = await authClient.auth.getUser(token)
  const user = userData?.user
  if (userError || !user) {
    return {
      response: NextResponse.json(apiUtils.errorPayload('Unauthorized'), {
        status: 401,
        headers: apiUtils.CORS_HEADERS,
      }),
    }
  }

  const admin = apiUtils.makeAdminClient()
  const db = admin ?? authClient
  const access = await requireUserAccess(admin ?? db, user.id)
  if (!access.ok) {
    return {
      response: access.response,
    }
  }

  const { data: clientRow, error: clientError } = await db
    .from('clients')
    .select('id, user_id')
    .eq('id', clientId)
    .maybeSingle()

  if (clientError) {
    logger.warn('client lookup failed', clientError)
    return {
      response: NextResponse.json(apiUtils.errorPayload('Client lookup failed'), {
        status: 500,
        headers: apiUtils.CORS_HEADERS,
      }),
    }
  }

  if (!clientRow) {
    return {
      response: NextResponse.json(apiUtils.errorPayload('Client not found'), {
        status: 404,
        headers: apiUtils.CORS_HEADERS,
      }),
    }
  }

  if (clientRow.user_id !== user.id) {
    return {
      response: NextResponse.json(apiUtils.errorPayload('Forbidden'), {
        status: 403,
        headers: apiUtils.CORS_HEADERS,
      }),
    }
  }

  return { db, user, clientRow }
}

export async function PATCH(req: Request, { params }: { params: { client_id: string } }) {
  const clientId = params?.client_id
  if (!clientId) {
    return NextResponse.json(apiUtils.errorPayload('Missing client_id'), { status: 400, headers: apiUtils.CORS_HEADERS })
  }

  let body: any = null
  try {
    body = await req.json()
  } catch (error) {
    return NextResponse.json(apiUtils.errorPayload('Invalid JSON'), { status: 400, headers: apiUtils.CORS_HEADERS })
  }

  if (typeof body?.monitoring_enabled !== 'boolean') {
    return NextResponse.json(apiUtils.errorPayload('monitoring_enabled must be boolean'), { status: 400, headers: apiUtils.CORS_HEADERS })
  }

  try {
    const context = await getAuthorizedClientContext(req, clientId)
    if (context.response) return context.response

    const { data, error } = await context.db
      .from('clients')
      .update({
        monitoring_enabled: body.monitoring_enabled,
        monitoring_updated_at: new Date().toISOString(),
      })
      .eq('id', clientId)
      .eq('user_id', context.user.id)
      .select(CLIENT_SELECT)
      .single()

    if (error) {
      logger.warn('monitoring state update failed', error)
      return NextResponse.json(
        apiUtils.errorPayload('Failed updating monitoring state. Run sql/003_add_monitoring_state.sql if this column is missing.'),
        { status: 500, headers: apiUtils.CORS_HEADERS },
      )
    }

    return NextResponse.json(apiUtils.okPayload({ client: data }), { headers: apiUtils.CORS_HEADERS })
  } catch (error) {
    logger.error('monitoring state update exception', error)
    return NextResponse.json(apiUtils.errorPayload('Server error'), { status: 500, headers: apiUtils.CORS_HEADERS })
  }
}

export async function DELETE(req: Request, { params }: { params: { client_id: string } }) {
  const clientId = params?.client_id
  if (!clientId) {
    return NextResponse.json(apiUtils.errorPayload('Missing client_id'), { status: 400, headers: apiUtils.CORS_HEADERS })
  }

  try {
    const context = await getAuthorizedClientContext(req, clientId)
    if (context.response) return context.response

    const { db, user } = context
    const childTables = ['client_investigation_logs', 'alerts', 'risk_status', 'risk_history', 'events']
    for (const table of childTables) {
      const { error } = await db.from(table).delete().eq('client_id', clientId)
      if (error) {
        if (table === 'client_investigation_logs' && String(error.message || '').includes('does not exist')) continue
        logger.warn(`delete client child cleanup failed for ${table}`, error)
        return NextResponse.json(apiUtils.errorPayload(`Failed deleting ${table}`), { status: 500, headers: apiUtils.CORS_HEADERS })
      }
    }

    const { error: deleteError } = await db
      .from('clients')
      .delete()
      .eq('id', clientId)
      .eq('user_id', user.id)

    if (deleteError) {
      logger.warn('delete client failed', deleteError)
      return NextResponse.json(apiUtils.errorPayload('Failed deleting client'), { status: 500, headers: apiUtils.CORS_HEADERS })
    }

    return NextResponse.json(apiUtils.okPayload({ deleted: true, client_id: clientId }), { headers: apiUtils.CORS_HEADERS })
  } catch (error) {
    logger.error('delete client exception', error)
    return NextResponse.json(apiUtils.errorPayload('Server error'), { status: 500, headers: apiUtils.CORS_HEADERS })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: apiUtils.CORS_HEADERS })
}
