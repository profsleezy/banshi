import { NextResponse } from 'next/server'
import apiUtils from '../../../../../lib/apiUtils'
import logger from '../../../../../lib/logger'
import { getServerAuthContext } from '../../../../../lib/serverAuth'
import { requireUserAccess } from '../../../../../lib/accessControl'

const LOG_SELECT = 'id, user_id, client_id, note, severity, status, created_at, updated_at'
const severities = new Set(['note', 'watch', 'risk', 'critical'])
const statuses = new Set(['open', 'reviewing', 'resolved'])

async function authorizeClient(req: Request, clientId: string) {
  const auth = await getServerAuthContext(req, apiUtils.makeAdminClient())
  if (!auth.ok) {
    return {
      response: NextResponse.json(apiUtils.errorPayload(auth.error), {
        status: auth.status,
        headers: apiUtils.CORS_HEADERS,
      }),
    }
  }

  const { db, user } = auth.context
  const access = await requireUserAccess(apiUtils.makeAdminClient() ?? db, user.id)
  if (!access.ok) {
    return {
      response: access.response,
    }
  }

  const { data: client, error } = await db
    .from('clients')
    .select('id, user_id')
    .eq('id', clientId)
    .maybeSingle()

  if (error) {
    logger.warn('investigation log client lookup failed', error)
    return {
      response: NextResponse.json(apiUtils.errorPayload('Client lookup failed'), {
        status: 500,
        headers: apiUtils.CORS_HEADERS,
      }),
    }
  }

  if (!client) {
    return {
      response: NextResponse.json(apiUtils.errorPayload('Client not found'), {
        status: 404,
        headers: apiUtils.CORS_HEADERS,
      }),
    }
  }

  if (client.user_id !== user.id) {
    return {
      response: NextResponse.json(apiUtils.errorPayload('Forbidden'), {
        status: 403,
        headers: apiUtils.CORS_HEADERS,
      }),
    }
  }

  return { db, user, client }
}

export async function GET(req: Request, { params }: { params: { client_id: string } }) {
  const clientId = params?.client_id
  if (!clientId) {
    return NextResponse.json(apiUtils.errorPayload('Missing client_id'), { status: 400, headers: apiUtils.CORS_HEADERS })
  }

  try {
    const context = await authorizeClient(req, clientId)
    if (context.response) return context.response

    const { data, error } = await context.db
      .from('client_investigation_logs')
      .select(LOG_SELECT)
      .eq('client_id', clientId)
      .eq('user_id', context.user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) {
      logger.warn('investigation log GET failed', error)
      return NextResponse.json(
        apiUtils.errorPayload('Investigation log table is not ready. Run sql/007_add_investigation_and_account_controls.sql.'),
        { status: 500, headers: apiUtils.CORS_HEADERS },
      )
    }

    return NextResponse.json(apiUtils.okPayload({ logs: data ?? [] }), { headers: apiUtils.CORS_HEADERS })
  } catch (error) {
    logger.error('investigation log GET exception', error)
    return NextResponse.json(apiUtils.errorPayload('Server error'), { status: 500, headers: apiUtils.CORS_HEADERS })
  }
}

export async function POST(req: Request, { params }: { params: { client_id: string } }) {
  const clientId = params?.client_id
  if (!clientId) {
    return NextResponse.json(apiUtils.errorPayload('Missing client_id'), { status: 400, headers: apiUtils.CORS_HEADERS })
  }

  let body: any = null
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(apiUtils.errorPayload('Invalid JSON'), { status: 400, headers: apiUtils.CORS_HEADERS })
  }

  const note = String(body?.note ?? '').trim()
  const severity = severities.has(body?.severity) ? body.severity : 'note'
  const status = statuses.has(body?.status) ? body.status : 'open'

  if (!note) {
    return NextResponse.json(apiUtils.errorPayload('note is required'), { status: 400, headers: apiUtils.CORS_HEADERS })
  }

  try {
    const context = await authorizeClient(req, clientId)
    if (context.response) return context.response

    const { data, error } = await context.db
      .from('client_investigation_logs')
      .insert({
        user_id: context.user.id,
        client_id: clientId,
        note,
        severity,
        status,
      })
      .select(LOG_SELECT)
      .single()

    if (error) {
      logger.warn('investigation log POST failed', error)
      return NextResponse.json(
        apiUtils.errorPayload('Could not save investigation log. Run sql/007_add_investigation_and_account_controls.sql if needed.'),
        { status: 500, headers: apiUtils.CORS_HEADERS },
      )
    }

    return NextResponse.json(apiUtils.okPayload({ log: data }), { status: 201, headers: apiUtils.CORS_HEADERS })
  } catch (error) {
    logger.error('investigation log POST exception', error)
    return NextResponse.json(apiUtils.errorPayload('Server error'), { status: 500, headers: apiUtils.CORS_HEADERS })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: apiUtils.CORS_HEADERS })
}
