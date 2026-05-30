import { NextResponse } from 'next/server'
import apiUtils from '../../../lib/apiUtils'
import logger from '../../../lib/logger'
import { sendTestNotification } from '../../../lib/notifications'
import { getServerAuthContext } from '../../../lib/serverAuth'
import { requireUserAccess } from '../../../lib/accessControl'

export async function POST(req: Request) {
  try {
    const admin = apiUtils.makeAdminClient()
    const auth = await getServerAuthContext(req, admin)
    if (!auth.ok) {
      return NextResponse.json(apiUtils.errorPayload(auth.error), { status: auth.status, headers: apiUtils.CORS_HEADERS })
    }
    const access = await requireUserAccess(admin ?? auth.context.db, auth.context.user.id)
    if (!access.ok) return access.response

    const result = await sendTestNotification({
      db: auth.context.db,
      userId: auth.context.user.id,
      userEmail: auth.context.user.email,
    })

    if (!result.sent) {
      return NextResponse.json(
        apiUtils.errorPayload(
          result.reason === 'no_channels_enabled'
            ? 'Enable webhook notifications and add a webhook URL first.'
            : 'Could not send test notification.',
          result.reason ?? 'notification_test_failed',
        ),
        { status: 400, headers: apiUtils.CORS_HEADERS },
      )
    }

    return NextResponse.json(apiUtils.okPayload({ result }), { headers: apiUtils.CORS_HEADERS })
  } catch (error) {
    logger.error('notification test exception', error)
    return NextResponse.json(apiUtils.errorPayload('Server error'), { status: 500, headers: apiUtils.CORS_HEADERS })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: apiUtils.CORS_HEADERS })
}
