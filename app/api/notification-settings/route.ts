import { NextResponse } from 'next/server'
import apiUtils from '../../../lib/apiUtils'
import logger from '../../../lib/logger'
import { getServerAuthContext } from '../../../lib/serverAuth'
import { requireUserAccess } from '../../../lib/accessControl'

const LEVELS = ['Watch', 'Risk', 'Critical'] as const

function normalizeRecipients(value: unknown) {
  const raw = Array.isArray(value) ? value : String(value ?? '').split(/[\n,;]/)
  return raw
    .map((item) => String(item).trim())
    .filter(Boolean)
    .filter((item, index, arr) => arr.indexOf(item) === index)
    .slice(0, 20)
}

function normalizeWebhookUrl(value: unknown) {
  const url = String(value ?? '').trim()
  if (!url) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed.toString()
  } catch (e) {
    return null
  }
}

function schemaMissing(error: any) {
  const message = String(error?.message || '')
  return message.includes('notification_settings') || message.includes('schema cache')
}

async function getOrCreateSettings(db: any, user: any) {
  const existing = await db
    .from('notification_settings')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing.error) return existing
  if (existing.data) return existing

  return db
    .from('notification_settings')
    .insert({
      user_id: user.id,
      email_enabled: false,
      email_recipients: user.email ? [user.email] : [],
      webhook_enabled: false,
      webhook_url: null,
      min_level: 'Risk',
      dedupe_minutes: 60,
    })
    .select('*')
    .single()
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

    const result = await getOrCreateSettings(auth.context.db, auth.context.user)
    if (result.error) {
      logger.warn('notification settings GET failed', result.error)
      return NextResponse.json(
        apiUtils.errorPayload(
          schemaMissing(result.error) ? 'Notification tables missing. Run sql/006_add_notification_settings.sql.' : 'Could not load notification settings',
          schemaMissing(result.error) ? 'notification_schema_missing' : 'error',
        ),
        { status: 500, headers: apiUtils.CORS_HEADERS },
      )
    }

    return NextResponse.json(apiUtils.okPayload({ settings: result.data }), { headers: apiUtils.CORS_HEADERS })
  } catch (error) {
    logger.error('notification settings GET exception', error)
    return NextResponse.json(apiUtils.errorPayload('Server error'), { status: 500, headers: apiUtils.CORS_HEADERS })
  }
}

export async function PATCH(req: Request) {
  let body: any = null
  try {
    body = await req.json()
  } catch (error) {
    return NextResponse.json(apiUtils.errorPayload('Invalid JSON'), { status: 400, headers: apiUtils.CORS_HEADERS })
  }

  try {
    const admin = apiUtils.makeAdminClient()
    const auth = await getServerAuthContext(req, admin)
    if (!auth.ok) {
      return NextResponse.json(apiUtils.errorPayload(auth.error), { status: auth.status, headers: apiUtils.CORS_HEADERS })
    }
    const access = await requireUserAccess(admin ?? auth.context.db, auth.context.user.id)
    if (!access.ok) return access.response

    const webhookUrl = normalizeWebhookUrl(body?.webhook_url)
    const minLevel = LEVELS.includes(body?.min_level) ? body.min_level : 'Risk'
    const dedupeMinutesRaw = Number(body?.dedupe_minutes ?? 60)
    const dedupeMinutes = Number.isFinite(dedupeMinutesRaw)
      ? Math.max(5, Math.min(1440, Math.floor(dedupeMinutesRaw)))
      : 60

    if (body?.webhook_enabled && !webhookUrl) {
      return NextResponse.json(apiUtils.errorPayload('Webhook URL must be a valid http(s) URL'), { status: 400, headers: apiUtils.CORS_HEADERS })
    }

    const payload = {
      user_id: auth.context.user.id,
      email_enabled: false,
      email_recipients: [],
      webhook_enabled: !!body?.webhook_enabled,
      webhook_url: webhookUrl,
      min_level: minLevel,
      dedupe_minutes: dedupeMinutes,
      updated_at: new Date().toISOString(),
    }

    const result = await auth.context.db
      .from('notification_settings')
      .upsert(payload, { onConflict: 'user_id' })
      .select('*')
      .single()

    if (result.error) {
      logger.warn('notification settings PATCH failed', result.error)
      return NextResponse.json(
        apiUtils.errorPayload(
          schemaMissing(result.error) ? 'Notification tables missing. Run sql/006_add_notification_settings.sql.' : 'Could not save notification settings',
          schemaMissing(result.error) ? 'notification_schema_missing' : 'error',
        ),
        { status: 500, headers: apiUtils.CORS_HEADERS },
      )
    }

    return NextResponse.json(apiUtils.okPayload({ settings: result.data }), { headers: apiUtils.CORS_HEADERS })
  } catch (error) {
    logger.error('notification settings PATCH exception', error)
    return NextResponse.json(apiUtils.errorPayload('Server error'), { status: 500, headers: apiUtils.CORS_HEADERS })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: apiUtils.CORS_HEADERS })
}
