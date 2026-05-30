import { NextResponse } from 'next/server'
import apiUtils from '../../../lib/apiUtils'
import logger from '../../../lib/logger'
import { getServerAuthContext } from '../../../lib/serverAuth'
import { requireUserAccess } from '../../../lib/accessControl'

function schemaMissing(error: any) {
  const message = String(error?.message || '')
  return message.includes('notification_deliveries') || message.includes('schema cache')
}

export async function GET(req: Request) {
  try {
    const admin = apiUtils.makeAdminClient()
    const auth = await getServerAuthContext(req, admin)
    if (!auth.ok) {
      return NextResponse.json(apiUtils.errorPayload(auth.error), { status: auth.status, headers: apiUtils.CORS_HEADERS })
    }
    const access = await requireUserAccess(admin ?? auth.context.db, auth.context.user.id)
    if (!access.ok) return access.response

    const url = new URL(req.url)
    const parsedLimit = Number(url.searchParams.get('limit') ?? 25)
    const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(100, Math.floor(parsedLimit))) : 25

    const result = await auth.context.db
      .from('notification_deliveries')
      .select('*')
      .eq('user_id', auth.context.user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (result.error) {
      logger.warn('notification deliveries GET failed', result.error)
      return NextResponse.json(
        apiUtils.errorPayload(
          schemaMissing(result.error) ? 'Notification tables missing. Run sql/006_add_notification_settings.sql.' : 'Could not load notification delivery logs',
          schemaMissing(result.error) ? 'notification_schema_missing' : 'error',
        ),
        { status: 500, headers: apiUtils.CORS_HEADERS },
      )
    }

    return NextResponse.json(apiUtils.okPayload({ deliveries: result.data ?? [] }), { headers: apiUtils.CORS_HEADERS })
  } catch (error) {
    logger.error('notification deliveries GET exception', error)
    return NextResponse.json(apiUtils.errorPayload('Server error'), { status: 500, headers: apiUtils.CORS_HEADERS })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: apiUtils.CORS_HEADERS })
}
