import supabase from './supabase'
import type { Alert } from '../types/alert'
import { getClients } from './clients'
import { updateRiskStatusForClient } from './updateRiskStatus'

type Result<T> = { data?: T; error?: Error }

export type NewAlertPayload = {
  client_id: string
  severity: Alert['severity']
  message: string
  payload?: Record<string, unknown> | null
}

async function getUserId(): Promise<Result<string>> {
  const { data, error } = await supabase.auth.getUser()
  if (error) return { error }
  const user = data?.user
  if (!user) return { error: new Error('Not authenticated') }
  return { data: user.id }
}

export async function createAlert(payload: NewAlertPayload): Promise<Result<Alert>> {
  const uidRes = await getUserId()
  if (uidRes.error) return { error: uidRes.error }

  // Ensure the client belongs to the user
  const clientsRes = await getClients()
  if (clientsRes.error) return { error: clientsRes.error }
  const clientIds = (clientsRes.data ?? []).map(c => c.id)
  if (!clientIds.includes(payload.client_id)) {
    return { error: new Error('Unauthorized to add alert for this client') }
  }

  const insert = {
    client_id: payload.client_id,
    severity: payload.severity,
    message: payload.message,
    payload: payload.payload ?? null,
    acknowledged: false,
  }

  const { data, error } = await supabase.from('alerts').insert(insert).select().single()
  if (error) return { error }

  // Update risk status for the client (best-effort)
  try {
    await updateRiskStatusForClient(payload.client_id)
  } catch (e) {
    // swallow; return created alert but surface in logs
    // eslint-disable-next-line no-console
    console.warn('updateRiskStatusForClient failed', e)
  }

  return { data: data as Alert }
}

export async function getAlertsByClient(clientId: string): Promise<Result<Alert[]>> {
  // ensure client belongs to user
  const clientsRes = await getClients()
  if (clientsRes.error) return { error: clientsRes.error }
  const clientIds = (clientsRes.data ?? []).map(c => c.id)
  if (!clientIds.includes(clientId)) return { error: new Error('Unauthorized') }

  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (error) return { error }
  return { data: data ?? [] }
}

export async function getRecentAlerts(limit = 50): Promise<Result<Alert[]>> {
  // fetch user's clients and then alerts for those
  const clientsRes = await getClients()
  if (clientsRes.error) return { error: clientsRes.error }
  const clientIds = (clientsRes.data ?? []).map(c => c.id)
  if (clientIds.length === 0) return { data: [] }

  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .in('client_id', clientIds)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return { error }
  return { data: data ?? [] }
}

export async function deleteAlert(alertId: string): Promise<Result<Alert>> {
  // fetch alert to determine client
  const { data: found, error: fetchErr } = await supabase.from('alerts').select('*').eq('id', alertId).single()
  if (fetchErr) return { error: fetchErr }
  if (!found) return { error: new Error('Alert not found') }

  // ensure the client belongs to the user
  const clientsRes = await getClients()
  if (clientsRes.error) return { error: clientsRes.error }
  const clientIds = (clientsRes.data ?? []).map(c => c.id)
  if (!clientIds.includes(found.client_id)) return { error: new Error('Unauthorized') }

  const { data, error } = await supabase.from('alerts').delete().eq('id', alertId).select().single()
  if (error) return { error }

  // update risk status after deletion
  try {
    await updateRiskStatusForClient(found.client_id)
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('updateRiskStatusForClient failed', e)
  }

  return { data: data as Alert }
}

export default { createAlert, getAlertsByClient, getRecentAlerts, deleteAlert }
