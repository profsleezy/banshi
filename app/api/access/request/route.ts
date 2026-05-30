import { NextResponse } from 'next/server'
import apiUtils from '../../../../lib/apiUtils'
import { getBearerToken } from '../../../../lib/serverAuth'
import logger from '../../../../lib/logger'

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max)
}

export async function POST(req: Request) {
  let body: any = null
  try {
    body = await req.json()
  } catch {
    return NextResponse.json(apiUtils.errorPayload('Invalid JSON'), { status: 400, headers: apiUtils.CORS_HEADERS })
  }

  const telegram = clean(body?.telegram, 120)
  const discord = clean(body?.discord, 120)
  if (!telegram && !discord) {
    return NextResponse.json(apiUtils.errorPayload('Add Telegram so setup can continue.'), { status: 400, headers: apiUtils.CORS_HEADERS })
  }

  const admin = apiUtils.makeAdminClient()
  if (!admin) {
    return NextResponse.json(apiUtils.errorPayload('Request intake is not configured.'), { status: 500, headers: apiUtils.CORS_HEADERS })
  }

  const token = getBearerToken(req)
  if (!token) {
    return NextResponse.json(apiUtils.errorPayload('Sign in before requesting access.', 'auth_required'), { status: 401, headers: apiUtils.CORS_HEADERS })
  }

  const { data, error: userError } = await admin.auth.getUser(token)
  const userId = data?.user?.id ?? null
  const email = clean(data?.user?.email, 160)
  if (userError || !userId || !email) {
    return NextResponse.json(apiUtils.errorPayload('Sign in before requesting access.', 'auth_required'), { status: 401, headers: apiUtils.CORS_HEADERS })
  }

  const row = {
    user_id: userId,
    email,
    name: clean(body?.name, 140),
    agency: clean(body?.agency, 160),
    plan: clean(body?.plan, 40),
    telegram,
    discord,
    message: clean(body?.message, 1200),
  }

  const { error } = await admin.from('access_requests').insert(row)
  if (error) {
    logger.warn('access request insert failed', error)
    return NextResponse.json(
      apiUtils.errorPayload('Could not save request. Run sql/008_add_user_access_paywall.sql.'),
      { status: 500, headers: apiUtils.CORS_HEADERS },
    )
  }

  return NextResponse.json(apiUtils.okPayload({ requested: true }), { status: 201, headers: apiUtils.CORS_HEADERS })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: apiUtils.CORS_HEADERS })
}
