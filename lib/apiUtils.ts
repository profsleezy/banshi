import { createClient, SupabaseClient } from '@supabase/supabase-js'
import supabase from './supabase'
import logger from './logger'

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

let adminClient: SupabaseClient | null = null
export function makeAdminClient(): SupabaseClient | null {
  if (adminClient) return adminClient
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    logger.warn('makeAdminClient: missing SUPABASE_URL or SERVICE_ROLE_KEY')
    return null
  }
  try {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    return adminClient
  } catch (e) {
    logger.error('makeAdminClient: failed to create admin client', e)
    return null
  }
}

export function okPayload(obj: any = {}) {
  return Object.assign({ success: true }, obj)
}

export function errorPayload(message: string, code?: string) {
  return { success: false, error: message, code: code ?? 'error' }
}

export function validateProfileSnapshot(body: any) {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid JSON body' }
  if (!body.client_id || typeof body.client_id !== 'string') return { ok: false, error: 'client_id required' }
  if (body.type !== 'PROFILE_SNAPSHOT') return { ok: false, error: "type must be 'PROFILE_SNAPSHOT'" }
  if (!body.metadata || typeof body.metadata !== 'object') return { ok: false, error: 'metadata required' }
  const m = body.metadata
  const numOrNull = (v: any) => v === null || typeof v === 'number'
  if (!numOrNull(m.followers)) return { ok: false, error: 'metadata.followers must be number or null' }
  if (!numOrNull(m.following)) return { ok: false, error: 'metadata.following must be number or null' }
  if (!numOrNull(m.posts)) return { ok: false, error: 'metadata.posts must be number or null' }
  if (m.bio !== undefined && typeof m.bio !== 'string') return { ok: false, error: 'metadata.bio must be string' }
  if (m.handle !== undefined && typeof m.handle !== 'string') return { ok: false, error: 'metadata.handle must be string' }
  return { ok: true, parsed: body }
}

export default {
  CORS_HEADERS,
  makeAdminClient,
  okPayload,
  errorPayload,
  validateProfileSnapshot,
}
