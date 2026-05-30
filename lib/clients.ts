import supabase from './supabase'
import type { Client as DBClient } from '../types/client'

export type Result<T> = { data?: T; error?: Error }
type CreateResult<T> = Result<T> & { existed?: boolean }

export type NewClientPayload = {
  client_name: string
  platform: 'Meta' | 'IG'
  account_id: string
  notes?: string
}

const CLIENT_SELECT = 'id, user_id, name, platform, account_id, notes, latest_snapshot_metadata, monitoring_enabled, monitoring_updated_at, created_at, updated_at, last_checked'

async function getUserId(): Promise<Result<string>> {
  const { data, error } = await supabase.auth.getUser()
  if (error) return { error }
  const user = data?.user
  if (!user) return { error: new Error('Not authenticated') }
  return { data: user.id }
}

export async function createClient(payload: NewClientPayload): Promise<CreateResult<DBClient>> {
  const { data, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) return { error: sessionError }

  const token = data.session?.access_token
  if (!token) return { error: new Error('Not authenticated') }

  const res = await fetch('/api/clients', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const body = await res.json().catch(() => null)
  if (!res.ok || !body?.success) {
    return { error: new Error(body?.error || 'Failed to create client') }
  }

  return { data: body.client as DBClient, existed: !!body.existed }
}

export async function getClients(): Promise<Result<DBClient[]>> {
  const uid = await getUserId()
  if (uid.error) return { error: uid.error }

  const { data, error } = await supabase
    .from('clients')
    .select(CLIENT_SELECT)
    .eq('user_id', uid.data)
    .order('created_at', { ascending: false })

  if (error) return { error }
  return { data: data as DBClient[] }
}

export async function updateClient(id: string, changes: Partial<Pick<DBClient, 'name' | 'platform' | 'account_id' | 'notes'>>): Promise<Result<DBClient>> {
  const uid = await getUserId()
  if (uid.error) return { error: uid.error }

  const { data, error } = await supabase
    .from('clients')
    .update(changes)
    .eq('id', id)
    .eq('user_id', uid.data)
    .select(CLIENT_SELECT)
    .single()

  if (error) return { error }
  return { data: data as DBClient }
}

export async function deleteClient(id: string): Promise<Result<DBClient>> {
  const uid = await getUserId()
  if (uid.error) return { error: uid.error }

  const { data, error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id)
    .eq('user_id', uid.data)
    .select(CLIENT_SELECT)
    .single()

  if (error) return { error }
  return { data: data as DBClient }
}

export async function deleteClientAndRelated(id: string): Promise<Result<{ deleted: boolean; client_id: string }>> {
  const { data, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) return { error: sessionError }

  const token = data.session?.access_token
  if (!token) return { error: new Error('Not authenticated') }

  const res = await fetch(`/api/clients/${id}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  let body: any = null
  try {
    body = await res.json()
  } catch (e) {
    body = null
  }

  if (!res.ok || !body?.success) {
    return { error: new Error(body?.error || 'Failed to delete client') }
  }

  return { data: { deleted: true, client_id: id } }
}

export async function setClientMonitoring(id: string, enabled: boolean): Promise<Result<DBClient>> {
  const { data, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) return { error: sessionError }

  const token = data.session?.access_token
  if (!token) return { error: new Error('Not authenticated') }

  const res = await fetch(`/api/clients/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ monitoring_enabled: enabled }),
  })

  let body: any = null
  try {
    body = await res.json()
  } catch (e) {
    body = null
  }

  if (!res.ok || !body?.success) {
    return { error: new Error(body?.error || 'Failed to update monitoring state') }
  }

  return { data: body.client as DBClient }
}

export async function issueClientIngestToken(id: string): Promise<Result<{ client_id: string; ingest_token: string; created_at: string }>> {
  const { data, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) return { error: sessionError }

  const token = data.session?.access_token
  if (!token) return { error: new Error('Not authenticated') }

  const res = await fetch(`/api/clients/${id}/ingest-token`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })

  let body: any = null
  try {
    body = await res.json()
  } catch (e) {
    body = null
  }

  if (!res.ok || !body?.success || !body?.ingest_token) {
    return { error: new Error(body?.error || 'Failed to issue ingest token') }
  }

  return {
    data: {
      client_id: body.client_id,
      ingest_token: body.ingest_token,
      created_at: body.created_at,
    },
  }
}
