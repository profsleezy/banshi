import supabase from './supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import { computeRiskLevel } from './riskEngine'
import type { Alert } from '../types/alert'
import type { RiskStatus } from '../types/client'

type Result<T> = { data?: T; error?: Error }

async function fetchAlertsForClient(clientId: string, db?: SupabaseClient): Promise<Result<Alert[]>> {
  const cli = db ?? supabase
  const { data, error } = await cli
    .from('alerts')
    .select('*')
    .eq('client_id', clientId)

  if (error) return { error }
  return { data: data ?? [] }
}

async function upsertRiskStatus(clientId: string, status: RiskStatus['status'], score = 0, db?: SupabaseClient): Promise<Result<RiskStatus>> {
  const cli = db ?? supabase
  const payload = {
    client_id: clientId,
    status,
    score,
    notes: null,
  }

  const { data, error } = await cli
    .from('risk_status')
    .upsert(payload, { onConflict: 'client_id' })
    .select()
    .single()

  if (error) return { error }
  return { data: data as RiskStatus }
}

/**
 * Fetches alerts for a client, computes risk via riskEngine, and upserts the risk_status row.
 * Pure computation is delegated to computeRiskLevel; this function performs DB I/O.
 */
export async function updateRiskStatusForClient(clientId: string, db?: SupabaseClient): Promise<Result<RiskStatus>> {
  const alertsRes = await fetchAlertsForClient(clientId, db)
  if (alertsRes.error) return { error: alertsRes.error }

  const alerts = alertsRes.data ?? []
  const level = computeRiskLevel(alerts)
  const score = alerts.length

  const upsertRes = await upsertRiskStatus(clientId, level, score, db)
  if (upsertRes.error) return { error: upsertRes.error }
  // best-effort: append to risk_history for audit/trends
  try {
    const cli = db ?? supabase
    await cli.from('risk_history').insert({
      client_id: clientId,
      event_id: null,
      score,
      level,
      notes: null,
      payload: { alerts_count: alerts.length }
    })
  } catch (e) {
    // ignore
  }

  return { data: upsertRes.data }
}

export default updateRiskStatusForClient
