import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import apiUtils from './apiUtils'
import logger from './logger'
import { getPlan, type AccessStatusValue, type UserAccessStatus } from './accessPlans'

export const activeAccessStatuses = new Set<AccessStatusValue>(['trial', 'active', 'comped'])

export function accessControlEnabled() {
  return process.env.DISABLE_ACCESS_CONTROL !== 'true'
}

export function isAccessActive(status: UserAccessStatus) {
  return status.active
}

export function accessDeniedResponse(status?: UserAccessStatus) {
  return NextResponse.json(
    apiUtils.errorPayload(status?.reason || 'Paid access required', 'paid_access_required'),
    {
      status: 402,
      headers: apiUtils.CORS_HEADERS,
    },
  )
}

export async function getUserAccessStatus(db: SupabaseClient | null, userId: string): Promise<UserAccessStatus> {
  if (!accessControlEnabled()) {
    const plan = getPlan('founder')
    return {
      active: true,
      status: 'active',
      plan: plan.key,
      planName: plan.name,
      clientLimit: plan.clientLimit,
      clientCount: 0,
      remainingClients: plan.clientLimit,
      features: { dev_bypass: true },
      expiresAt: null,
    }
  }

  if (!db) {
    return {
      active: false,
      status: 'missing',
      plan: 'request',
      planName: 'Request access',
      clientLimit: 0,
      clientCount: 0,
      remainingClients: 0,
      features: {},
      expiresAt: null,
      reason: 'Server access control is not configured.',
    }
  }

  try {
    const [accessRes, countRes] = await Promise.all([
      db
        .from('user_access')
        .select('status, plan, client_limit, features, expires_at')
        .eq('user_id', userId)
        .maybeSingle(),
      db
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId),
    ])

    if (accessRes.error) {
      logger.warn('access lookup failed', accessRes.error)
      return {
        active: false,
        status: 'missing',
        plan: 'request',
        planName: 'Request access',
        clientLimit: 0,
        clientCount: countRes.count ?? 0,
        remainingClients: 0,
        features: {},
        expiresAt: null,
        reason: 'Access table is not ready. Run sql/008_add_user_access_paywall.sql.',
      }
    }

    const row = accessRes.data as any
    if (!row) {
      return {
        active: false,
        status: 'pending',
        plan: 'request',
        planName: 'Request access',
        clientLimit: 0,
        clientCount: countRes.count ?? 0,
        remainingClients: 0,
        features: {},
        expiresAt: null,
        reason: 'Request access to unlock the workspace.',
      }
    }

    const plan = getPlan(row?.plan)
    const status = (row?.status ?? 'pending') as UserAccessStatus['status']
    const expiresAt = row?.expires_at ?? null
    const expired = expiresAt ? new Date(expiresAt).getTime() <= Date.now() : false
    const clientCount = countRes.count ?? 0
    const clientLimit = typeof row?.client_limit === 'number' ? row.client_limit : 0
    const active = activeAccessStatuses.has(status as AccessStatusValue) && !expired

    return {
      active,
      status,
      plan: plan.key,
      planName: plan.name,
      clientLimit,
      clientCount,
      remainingClients: Math.max(0, clientLimit - clientCount),
      features: row?.features && typeof row.features === 'object' ? row.features : {},
      expiresAt,
      reason: active ? undefined : expired ? 'Your access period has expired.' : 'Request access to unlock the workspace.',
    }
  } catch (error) {
    logger.warn('access lookup exception', error)
    return {
      active: false,
      status: 'missing',
      plan: 'request',
      planName: 'Request access',
      clientLimit: 0,
      clientCount: 0,
      remainingClients: 0,
      features: {},
      expiresAt: null,
      reason: 'Could not verify paid access.',
    }
  }
}

export async function requireUserAccess(db: SupabaseClient | null, userId: string) {
  const status = await getUserAccessStatus(db, userId)
  if (!status.active) return { ok: false as const, status, response: accessDeniedResponse(status) }
  return { ok: true as const, status }
}

export function canCreateClient(status: UserAccessStatus) {
  return status.active && status.clientCount < status.clientLimit
}
