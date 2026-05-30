import { NextResponse } from 'next/server'
import apiUtils from '../../../../lib/apiUtils'
import logger from '../../../../lib/logger'
import { getServerAuthContext } from '../../../../lib/serverAuth'

async function safeSelect(db: any, table: string, build: (query: any) => any) {
  try {
    const query = db.from(table).select('*')
    const { data, error } = await build(query)
    if (error) {
      if (String(error.message || '').includes('does not exist')) return []
      throw error
    }
    return data ?? []
  } catch (error) {
    logger.warn(`account export skipped ${table}`, error)
    return []
  }
}

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

    const { db, user } = auth.context

    const { data: clients, error: clientsError } = await db
      .from('clients')
      .select('id, user_id, name, platform, account_id, notes, latest_snapshot_metadata, monitoring_enabled, monitoring_updated_at, created_at, updated_at, last_checked')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (clientsError) {
      logger.warn('account export clients failed', clientsError)
      return NextResponse.json(apiUtils.errorPayload('Could not export clients'), { status: 500, headers: apiUtils.CORS_HEADERS })
    }

    const clientIds = (clients ?? []).map((client: any) => client.id)
    const withClientIds = (query: any) => clientIds.length ? query.in('client_id', clientIds) : Promise.resolve({ data: [], error: null })

    const [events, alerts, riskStatus, riskHistory, investigationLogs, notificationSettings, notificationDeliveries] = await Promise.all([
      safeSelect(db, 'events', (query) => withClientIds(query.order('created_at', { ascending: false }))),
      safeSelect(db, 'alerts', (query) => withClientIds(query.order('created_at', { ascending: false }))),
      safeSelect(db, 'risk_status', (query) => withClientIds(query.order('updated_at', { ascending: false }))),
      safeSelect(db, 'risk_history', (query) => withClientIds(query.order('created_at', { ascending: false }))),
      safeSelect(db, 'client_investigation_logs', (query) => withClientIds(query.order('created_at', { ascending: false }))),
      safeSelect(db, 'notification_settings', (query) => query.eq('user_id', user.id).limit(1)),
      safeSelect(db, 'notification_deliveries', (query) => query.eq('user_id', user.id).order('created_at', { ascending: false })),
    ])

    return NextResponse.json(
      apiUtils.okPayload({
        exported_at: new Date().toISOString(),
        user: {
          id: user.id,
          email: user.email ?? null,
          created_at: user.created_at ?? null,
        },
        clients: clients ?? [],
        events,
        alerts,
        risk_status: riskStatus,
        risk_history: riskHistory,
        client_investigation_logs: investigationLogs,
        notification_settings: notificationSettings,
        notification_deliveries: notificationDeliveries,
      }),
      { headers: apiUtils.CORS_HEADERS },
    )
  } catch (error) {
    logger.error('account export exception', error)
    return NextResponse.json(apiUtils.errorPayload('Server error'), { status: 500, headers: apiUtils.CORS_HEADERS })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: apiUtils.CORS_HEADERS })
}
