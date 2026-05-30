import type { SupabaseClient } from '@supabase/supabase-js'
import logger from './logger'

type RiskLevel = 'Healthy' | 'Watch' | 'Risk' | 'Critical'
type Channel = 'email' | 'webhook'

type NotificationSettings = {
  user_id: string
  email_enabled: boolean
  email_recipients: string[]
  webhook_enabled: boolean
  webhook_url?: string | null
  min_level: RiskLevel
  dedupe_minutes: number
}

export type RiskNotificationInput = {
  db: SupabaseClient
  userId?: string | null
  clientId: string
  clientName?: string | null
  platform?: string | null
  handle?: string | null
  eventId?: string | null
  riskHistoryId?: string | null
  level: RiskLevel
  previousLevel?: RiskLevel | null
  score: number
  previousScore?: number | null
  reason?: string | null
  snapshotAt?: string | null
  metadata?: Record<string, unknown> | null
}

export type TestNotificationInput = {
  db: SupabaseClient
  userId: string
  userEmail?: string | null
}

const levelRank: Record<RiskLevel, number> = {
  Healthy: 0,
  Watch: 1,
  Risk: 2,
  Critical: 3,
}

function normalizeLevel(value?: string | null): RiskLevel {
  if (value === 'Critical' || value === 'Risk' || value === 'Watch' || value === 'Healthy') return value
  return 'Risk'
}

function formatHandle(handle?: string | null) {
  const clean = String(handle || '').trim().replace(/^@/, '')
  return clean ? `@${clean}` : 'unknown profile'
}

function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '')
}

function shouldNotifyLevel(level: RiskLevel, minLevel: RiskLevel) {
  return levelRank[level] >= levelRank[minLevel] && levelRank[level] > levelRank.Healthy
}

function emailNotificationsEnabled() {
  return process.env.ENABLE_EMAIL_NOTIFICATIONS === 'true'
}

async function getSettings(db: SupabaseClient, userId: string, userEmail?: string | null): Promise<NotificationSettings | null> {
  const { data, error } = await db
    .from('notification_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    logger.warn('notification settings lookup failed', error)
    return null
  }

  if (data) return data as NotificationSettings

  const defaults = {
    user_id: userId,
    email_enabled: false,
    email_recipients: userEmail ? [userEmail] : [],
    webhook_enabled: false,
    webhook_url: null,
    min_level: 'Risk',
    dedupe_minutes: 60,
  }

  const created = await db
    .from('notification_settings')
    .insert(defaults)
    .select('*')
    .single()

  if (created.error) {
    logger.warn('notification settings default insert failed', created.error)
    return defaults as NotificationSettings
  }

  return created.data as NotificationSettings
}

async function hasRecentDelivery(db: SupabaseClient, input: {
  userId: string
  clientId?: string | null
  channel: Channel
  triggerKey: string
  dedupeMinutes: number
}) {
  const since = new Date(Date.now() - input.dedupeMinutes * 60 * 1000).toISOString()
  let query = db
    .from('notification_deliveries')
    .select('id')
    .eq('user_id', input.userId)
    .eq('channel', input.channel)
    .eq('trigger_key', input.triggerKey)
    .gte('created_at', since)
    .limit(1)

  if (input.clientId) query = query.eq('client_id', input.clientId)

  const { data, error } = await query
  if (error) {
    logger.warn('notification dedupe lookup failed', error)
    return false
  }

  return (data ?? []).length > 0
}

async function logDelivery(db: SupabaseClient, input: {
  userId: string
  clientId?: string | null
  riskHistoryId?: string | null
  channel: Channel
  destination?: string | null
  triggerKey: string
  status: 'sent' | 'failed' | 'skipped'
  payload?: Record<string, unknown> | null
  responseStatus?: number | null
  responseBody?: string | null
  error?: string | null
}) {
  const { error } = await db.from('notification_deliveries').insert({
    user_id: input.userId,
    client_id: input.clientId ?? null,
    risk_history_id: input.riskHistoryId ?? null,
    channel: input.channel,
    destination: input.destination ?? null,
    trigger_key: input.triggerKey,
    status: input.status,
    payload: input.payload ?? null,
    response_status: input.responseStatus ?? null,
    response_body: input.responseBody ? input.responseBody.slice(0, 2000) : null,
    error: input.error ? input.error.slice(0, 1000) : null,
  })

  if (error) logger.warn('notification delivery log failed', error)
}

function buildRiskMessage(input: RiskNotificationInput) {
  const name = input.clientName || input.handle || 'Client'
  const handle = formatHandle(input.handle)
  const subject = `[Banshi] ${input.level} risk: ${name}`
  const reportUrl = `${appUrl()}/clients/${input.clientId}`
  const text = [
    `${name} moved to ${input.level} risk.`,
    `Handle: ${handle}`,
    `Score: ${input.score}`,
    input.previousLevel ? `Previous: ${input.previousLevel}${typeof input.previousScore === 'number' ? ` (${input.previousScore})` : ''}` : null,
    input.reason ? `Reason: ${input.reason}` : null,
    `Report: ${reportUrl}`,
  ].filter(Boolean).join('\n')

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.55;color:#111827">
      <p style="font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280">Banshi account integrity</p>
      <h1 style="font-size:22px;margin:0 0 12px">${escapeHtml(name)} moved to ${escapeHtml(input.level)} risk</h1>
      <p><strong>Handle:</strong> ${escapeHtml(handle)}</p>
      <p><strong>Score:</strong> ${input.score}</p>
      ${input.previousLevel ? `<p><strong>Previous:</strong> ${escapeHtml(input.previousLevel)}${typeof input.previousScore === 'number' ? ` (${input.previousScore})` : ''}</p>` : ''}
      ${input.reason ? `<p><strong>Reason:</strong> ${escapeHtml(input.reason)}</p>` : ''}
      <p><a href="${escapeHtml(reportUrl)}">Open client report</a></p>
    </div>
  `

  return { subject, text, html, reportUrl }
}

async function sendEmail(db: SupabaseClient, input: {
  userId: string
  clientId?: string | null
  riskHistoryId?: string | null
  to: string[]
  triggerKey: string
  subject: string
  text: string
  html: string
  payload: Record<string, unknown>
}) {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.ALERT_FROM_EMAIL
  const destination = input.to.join(', ')

  if (!apiKey || !from) {
    await logDelivery(db, { ...input, channel: 'email', destination, status: 'failed', error: 'RESEND_API_KEY or ALERT_FROM_EMAIL missing' })
    return
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `${input.triggerKey}:email:${input.riskHistoryId || Date.now()}`,
      },
      body: JSON.stringify({
        from,
        to: input.to,
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
    })
    const body = await res.text()
    await logDelivery(db, {
      ...input,
      channel: 'email',
      destination,
      status: res.ok ? 'sent' : 'failed',
      responseStatus: res.status,
      responseBody: body,
      error: res.ok ? null : body,
    })
  } catch (error) {
    await logDelivery(db, { ...input, channel: 'email', destination, status: 'failed', error: (error as Error).message })
  }
}

async function sendWebhook(db: SupabaseClient, input: {
  userId: string
  clientId?: string | null
  riskHistoryId?: string | null
  url: string
  triggerKey: string
  payload: Record<string, unknown>
}) {
  try {
    const res = await fetch(input.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input.payload),
    })
    const body = await res.text()
    await logDelivery(db, {
      ...input,
      channel: 'webhook',
      destination: input.url,
      status: res.ok ? 'sent' : 'failed',
      responseStatus: res.status,
      responseBody: body,
      error: res.ok ? null : body,
    })
  } catch (error) {
    await logDelivery(db, { ...input, channel: 'webhook', destination: input.url, status: 'failed', error: (error as Error).message })
  }
}

export async function notifyRiskStateChange(input: RiskNotificationInput) {
  if (!input.userId) return { sent: false, reason: 'missing_user_id' }

  const level = normalizeLevel(input.level)
  const previousLevel = normalizeLevel(input.previousLevel)
  if (input.previousLevel && previousLevel === level) {
    return { sent: false, reason: 'risk_level_unchanged' }
  }

  const settings = await getSettings(input.db, input.userId)
  if (!settings) return { sent: false, reason: 'settings_missing' }
  const minLevel = normalizeLevel(settings.min_level)
  if (!shouldNotifyLevel(level, minLevel)) return { sent: false, reason: 'below_min_level' }

  const channels: Channel[] = []
  const recipients = (settings.email_recipients ?? []).map((email) => String(email).trim()).filter(Boolean)
  if (emailNotificationsEnabled() && settings.email_enabled && recipients.length > 0) channels.push('email')
  if (settings.webhook_enabled && settings.webhook_url) channels.push('webhook')
  if (channels.length === 0) return { sent: false, reason: 'no_channels_enabled' }

  const triggerKey = `risk:${input.clientId}:${level}`
  const message = buildRiskMessage({ ...input, level })
  const payload = {
    type: 'risk_state_changed',
    text: message.text,
    content: message.text,
    client_id: input.clientId,
    client_name: input.clientName,
    platform: input.platform,
    handle: input.handle,
    event_id: input.eventId,
    risk_history_id: input.riskHistoryId,
    level,
    previous_level: input.previousLevel ?? null,
    score: input.score,
    previous_score: input.previousScore ?? null,
    reason: input.reason,
    snapshot_at: input.snapshotAt,
    report_url: message.reportUrl,
  }

  let attempted = 0
  for (const channel of channels) {
    const duplicate = await hasRecentDelivery(input.db, {
      userId: input.userId,
      clientId: input.clientId,
      channel,
      triggerKey,
      dedupeMinutes: settings.dedupe_minutes || 60,
    })
    if (duplicate) continue

    attempted += 1
    if (channel === 'email') {
      await sendEmail(input.db, {
        userId: input.userId,
        clientId: input.clientId,
        riskHistoryId: input.riskHistoryId,
        to: recipients,
        triggerKey,
        subject: message.subject,
        text: message.text,
        html: message.html,
        payload,
      })
    } else if (settings.webhook_url) {
      await sendWebhook(input.db, {
        userId: input.userId,
        clientId: input.clientId,
        riskHistoryId: input.riskHistoryId,
        url: settings.webhook_url,
        triggerKey,
        payload,
      })
    }
  }

  return { sent: attempted > 0, attempted }
}

export async function sendTestNotification(input: TestNotificationInput) {
  const settings = await getSettings(input.db, input.userId, input.userEmail)
  if (!settings) return { sent: false, reason: 'settings_missing' }

  const recipients = (settings.email_recipients ?? []).map((email) => String(email).trim()).filter(Boolean)
  const channels: Channel[] = []
  if (emailNotificationsEnabled() && settings.email_enabled && recipients.length > 0) channels.push('email')
  if (settings.webhook_enabled && settings.webhook_url) channels.push('webhook')
  if (channels.length === 0) return { sent: false, reason: 'no_channels_enabled' }

  const triggerKey = `test:${input.userId}:${Date.now()}`
  const payload = {
    type: 'integration_test',
    text: 'Banshi notification test delivered.',
    content: 'Banshi notification test delivered.',
    message: 'Banshi notification integration test',
    created_at: new Date().toISOString(),
    app_url: appUrl(),
  }

  for (const channel of channels) {
    if (channel === 'email') {
      await sendEmail(input.db, {
        userId: input.userId,
        to: recipients,
        triggerKey,
        subject: '[Banshi] Notification test',
        text: 'Banshi notification test delivered.',
        html: '<p>Banshi notification test delivered.</p>',
        payload,
      })
    } else if (settings.webhook_url) {
      await sendWebhook(input.db, {
        userId: input.userId,
        url: settings.webhook_url,
        triggerKey,
        payload,
      })
    }
  }

  return { sent: true, channels }
}
