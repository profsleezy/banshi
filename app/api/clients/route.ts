import { NextResponse } from 'next/server'
import apiUtils from '../../../lib/apiUtils'
import logger from '../../../lib/logger'
import { getServerAuthContext } from '../../../lib/serverAuth'
import { canCreateClient, requireUserAccess } from '../../../lib/accessControl'

const CLIENT_SELECT = 'id, user_id, name, platform, account_id, notes, latest_snapshot_metadata, monitoring_enabled, monitoring_updated_at, created_at, updated_at, last_checked'
const platforms = new Set(['Meta', 'IG'])

function clean(value: unknown, max = 240) {
  return String(value ?? '').trim().slice(0, max)
}

export async function POST(req: Request) {
  let body: any = null
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(apiUtils.errorPayload('Invalid JSON'), { status: 400, headers: apiUtils.CORS_HEADERS })
  }

  const clientName = clean(body?.client_name)
  const accountId = clean(body?.account_id)
  const platform = platforms.has(body?.platform) ? body.platform : 'IG'
  const notes = clean(body?.notes, 1200)

  if (!clientName || !accountId) {
    return NextResponse.json(apiUtils.errorPayload('client_name and account_id are required'), { status: 400, headers: apiUtils.CORS_HEADERS })
  }

  try {
    const admin = apiUtils.makeAdminClient()
    const auth = await getServerAuthContext(req, admin)
    if (!auth.ok) {
      return NextResponse.json(apiUtils.errorPayload(auth.error), { status: auth.status, headers: apiUtils.CORS_HEADERS })
    }

    const access = await requireUserAccess(admin ?? auth.context.db, auth.context.user.id)
    if (!access.ok) return access.response

    const db = admin ?? auth.context.db

    const { data: existing, error: existingError } = await db
      .from('clients')
      .select(CLIENT_SELECT)
      .eq('user_id', auth.context.user.id)
      .eq('platform', platform)
      .eq('account_id', accountId)
      .maybeSingle()

    if (existingError) {
      logger.warn('client existing lookup failed', existingError)
      return NextResponse.json(apiUtils.errorPayload('Could not check existing client'), { status: 500, headers: apiUtils.CORS_HEADERS })
    }

    if (existing) {
      return NextResponse.json(apiUtils.okPayload({ client: existing, existed: true, access: access.status }), { headers: apiUtils.CORS_HEADERS })
    }

    if (!canCreateClient(access.status)) {
      return NextResponse.json(
        apiUtils.errorPayload(`Your ${access.status.planName} plan is limited to ${access.status.clientLimit} clients.`, 'client_limit_reached'),
        { status: 402, headers: apiUtils.CORS_HEADERS },
      )
    }

    const { data, error } = await db
      .from('clients')
      .insert({
        user_id: auth.context.user.id,
        name: clientName,
        platform,
        account_id: accountId,
        notes: notes || null,
        monitoring_enabled: true,
        monitoring_updated_at: new Date().toISOString(),
      })
      .select(CLIENT_SELECT)
      .single()

    if (error) {
      logger.warn('client insert failed', error)
      return NextResponse.json(apiUtils.errorPayload('Could not create client'), { status: 500, headers: apiUtils.CORS_HEADERS })
    }

    return NextResponse.json(apiUtils.okPayload({ client: data, existed: false, access: access.status }), { status: 201, headers: apiUtils.CORS_HEADERS })
  } catch (error) {
    logger.error('client create exception', error)
    return NextResponse.json(apiUtils.errorPayload('Server error'), { status: 500, headers: apiUtils.CORS_HEADERS })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: apiUtils.CORS_HEADERS })
}
