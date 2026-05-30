import { NextResponse } from 'next/server'
import apiUtils from '../../../../lib/apiUtils'
import logger from '../../../../lib/logger'
import { checkRateLimiterIntegration } from '../../../../lib/rateLimiter'
import { getServerAuthContext } from '../../../../lib/serverAuth'
import { requireUserAccess } from '../../../../lib/accessControl'

type StatusItem = {
  key: string
  label: string
  status: 'ok' | 'warn' | 'bad'
  detail: string
}

function envPresent(name: string) {
  return !!String(process.env[name] ?? '').trim()
}

function schemaMissing(error: any) {
  const message = String(error?.message || '')
  return message.includes('notification_') || message.includes('schema cache')
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

    const items: StatusItem[] = []

    items.push({
      key: 'supabase_auth',
      label: 'Supabase auth',
      status: 'ok',
      detail: `Signed in as ${auth.context.user.email || auth.context.user.id}.`,
    })

    items.push({
      key: 'service_role',
      label: 'Service role',
      status: envPresent('SUPABASE_SERVICE_ROLE_KEY') ? 'ok' : 'warn',
      detail: envPresent('SUPABASE_SERVICE_ROLE_KEY')
        ? 'Server-side admin client can bypass RLS for ingestion and notifications.'
        : 'Missing SUPABASE_SERVICE_ROLE_KEY; server writes may depend on user RLS.',
    })

    const redis = await checkRateLimiterIntegration()
    items.push({
      key: 'rate_limiter',
      label: 'Rate limiter',
      status: redis.ok ? 'ok' : redis.configured ? 'bad' : 'warn',
      detail: redis.detail,
    })

    const settingsRes = await auth.context.db
      .from('notification_settings')
      .select('*')
      .eq('user_id', auth.context.user.id)
      .maybeSingle()

    const notificationSettings = settingsRes.data ?? null
    items.push({
      key: 'notification_schema',
      label: 'Notification tables',
      status: settingsRes.error ? 'bad' : 'ok',
      detail: settingsRes.error
        ? schemaMissing(settingsRes.error)
          ? 'Run sql/006_add_notification_settings.sql in Supabase.'
          : settingsRes.error.message
        : 'Settings and delivery log tables are reachable.',
    })

    items.push({
      key: 'webhook',
      label: 'Webhook delivery',
      status: notificationSettings?.webhook_enabled && notificationSettings?.webhook_url ? 'ok' : 'warn',
      detail: notificationSettings?.webhook_enabled && notificationSettings?.webhook_url
        ? 'Webhook delivery is enabled.'
        : 'Optional: add a webhook URL for Slack/Discord/custom automations.',
    })

    items.push({
      key: 'app_url',
      label: 'App URL',
      status: envPresent('NEXT_PUBLIC_APP_URL') || envPresent('APP_URL') ? 'ok' : 'warn',
      detail: envPresent('NEXT_PUBLIC_APP_URL') || envPresent('APP_URL')
        ? 'Report links in notifications use the configured app URL.'
        : 'Missing NEXT_PUBLIC_APP_URL; notification links fall back to localhost.',
    })

    const deliveriesRes = await auth.context.db
      .from('notification_deliveries')
      .select('id, status, channel, created_at')
      .eq('user_id', auth.context.user.id)
      .order('created_at', { ascending: false })
      .limit(1)

    items.push({
      key: 'delivery_log',
      label: 'Delivery log',
      status: deliveriesRes.error ? 'bad' : 'ok',
      detail: deliveriesRes.error
        ? schemaMissing(deliveriesRes.error)
          ? 'Run sql/006_add_notification_settings.sql in Supabase.'
          : deliveriesRes.error.message
        : deliveriesRes.data?.[0]
          ? `Latest ${deliveriesRes.data[0].channel} delivery is ${deliveriesRes.data[0].status}.`
          : 'No notification attempts recorded yet.',
    })

    return NextResponse.json(apiUtils.okPayload({ items }), { headers: apiUtils.CORS_HEADERS })
  } catch (error) {
    logger.error('integration status exception', error)
    return NextResponse.json(apiUtils.errorPayload('Server error'), { status: 500, headers: apiUtils.CORS_HEADERS })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: apiUtils.CORS_HEADERS })
}
