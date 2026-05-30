import { NextResponse } from 'next/server'
import apiUtils from '../../../../lib/apiUtils'
import logger from '../../../../lib/logger'
import { getServerAuthContext } from '../../../../lib/serverAuth'

async function deleteFromTable(db: any, table: string, build: (query: any) => any) {
  const query = db.from(table).delete()
  const { error } = await build(query)
  if (error) {
    if (String(error.message || '').includes('does not exist')) return
    throw error
  }
}

export async function DELETE(req: Request) {
  let body: any = null
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  if (body?.confirm !== 'DELETE') {
    return NextResponse.json(apiUtils.errorPayload('Type DELETE to confirm account deletion'), { status: 400, headers: apiUtils.CORS_HEADERS })
  }

  try {
    const admin = apiUtils.makeAdminClient()
    if (!admin) {
      return NextResponse.json(apiUtils.errorPayload('Service role key is required for account deletion'), { status: 500, headers: apiUtils.CORS_HEADERS })
    }

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
      .select('id')
      .eq('user_id', user.id)

    if (clientsError) {
      logger.warn('account delete client lookup failed', clientsError)
      return NextResponse.json(apiUtils.errorPayload('Could not look up account clients'), { status: 500, headers: apiUtils.CORS_HEADERS })
    }

    const clientIds = (clients ?? []).map((client: any) => client.id)
    const deleteClientRows = async (table: string) => {
      if (clientIds.length === 0) return
      await deleteFromTable(db, table, (query) => query.in('client_id', clientIds))
    }

    for (const table of ['client_investigation_logs', 'notification_deliveries', 'alerts', 'risk_status', 'risk_history', 'events']) {
      if (table === 'notification_deliveries') {
        await deleteFromTable(db, table, (query) => query.eq('user_id', user.id))
      } else {
        await deleteClientRows(table)
      }
    }

    await deleteFromTable(db, 'notification_settings', (query) => query.eq('user_id', user.id))
    await deleteFromTable(db, 'clients', (query) => query.eq('user_id', user.id))

    const { error: authDeleteError } = await admin.auth.admin.deleteUser(user.id)
    if (authDeleteError) {
      logger.warn('auth user deletion failed after data cleanup', authDeleteError)
      return NextResponse.json(
        apiUtils.okPayload({
          deleted: true,
          auth_deleted: false,
          warning: 'Workspace data was deleted, but the auth user could not be removed automatically.',
        }),
        { headers: apiUtils.CORS_HEADERS },
      )
    }

    return NextResponse.json(apiUtils.okPayload({ deleted: true, auth_deleted: true }), { headers: apiUtils.CORS_HEADERS })
  } catch (error) {
    logger.error('account delete exception', error)
    return NextResponse.json(apiUtils.errorPayload('Account deletion failed'), { status: 500, headers: apiUtils.CORS_HEADERS })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: apiUtils.CORS_HEADERS })
}
