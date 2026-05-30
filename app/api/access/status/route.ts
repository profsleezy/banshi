import { NextResponse } from 'next/server'
import apiUtils from '../../../../lib/apiUtils'
import { getServerAuthContext } from '../../../../lib/serverAuth'
import { getUserAccessStatus } from '../../../../lib/accessControl'

export async function GET(req: Request) {
  try {
    const admin = apiUtils.makeAdminClient()
    const auth = await getServerAuthContext(req, admin)
    if (!auth.ok) {
      return NextResponse.json(apiUtils.errorPayload(auth.error), {
        status: auth.status,
        headers: apiUtils.CORS_HEADERS,
      })
    }

    const access = await getUserAccessStatus(admin ?? auth.context.db, auth.context.user.id)
    return NextResponse.json(apiUtils.okPayload({ access }), { headers: apiUtils.CORS_HEADERS })
  } catch (error) {
    return NextResponse.json(apiUtils.errorPayload('Could not check access'), { status: 500, headers: apiUtils.CORS_HEADERS })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: apiUtils.CORS_HEADERS })
}
