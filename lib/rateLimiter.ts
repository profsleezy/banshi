const buckets: Map<string, number[]> = new Map()

type RedisCommand = Array<string | number>

/**
 * Production-aware rate limiter.
 *
 * If UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are present, limits are
 * stored in Redis so multiple hosted instances share the same counters. Local
 * development falls back to the original in-memory sliding window.
 */
export async function allowRequest(key: string, maxRequests = 120, windowMs = 60 * 1000): Promise<boolean> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  const limit = normalizePositiveInt(maxRequests, 120)
  const window = normalizePositiveInt(windowMs, 60 * 1000)

  if (url && token) {
    try {
      return await allowRedisRequest({ key, maxRequests: limit, windowMs: window, url, token })
    } catch (error) {
      console.warn('Redis rate limiter failed; using local fallback', error)
    }
  }

  return allowLocalRequest(key, limit, window)
}

export async function checkRateLimiterIntegration() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    return { configured: false, ok: false, detail: 'Upstash env vars missing; using local fallback.' }
  }

  try {
    const result = await upstashCommand<string>(url, token, ['PING'])
    return { configured: true, ok: result === 'PONG', detail: result === 'PONG' ? 'Upstash Redis responded.' : `Unexpected Redis response: ${String(result)}` }
  } catch (error) {
    return { configured: true, ok: false, detail: (error as Error).message }
  }
}

function normalizePositiveInt(value: number, fallback: number) {
  if (!Number.isFinite(value) || value <= 0) return fallback
  return Math.floor(value)
}

function allowLocalRequest(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now()
  const arr = buckets.get(key) || []
  const recent = arr.filter((t) => now - t <= windowMs)
  if (recent.length >= maxRequests) {
    buckets.set(key, recent)
    return false
  }
  recent.push(now)
  buckets.set(key, recent)
  return true
}

async function allowRedisRequest({
  key,
  maxRequests,
  windowMs,
  url,
  token,
}: {
  key: string
  maxRequests: number
  windowMs: number
  url: string
  token: string
}): Promise<boolean> {
  const prefix = process.env.RATE_LIMIT_PREFIX || 'banshi:rate'
  const windowId = Math.floor(Date.now() / windowMs)
  const redisKey = `${prefix}:${key}:${windowId}`
  const count = Number(await upstashCommand(url, token, ['INCR', redisKey]))

  if (!Number.isFinite(count)) {
    throw new Error('Redis INCR returned a non-numeric result')
  }

  if (count === 1) {
    const ttlSeconds = Math.max(1, Math.ceil(windowMs / 1000) + 30)
    await upstashCommand(url, token, ['EXPIRE', redisKey, ttlSeconds])
  }

  return count <= maxRequests
}

async function upstashCommand<T = unknown>(url: string, token: string, command: RedisCommand): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
    cache: 'no-store',
  })

  const body = await res.json().catch(() => null)
  if (!res.ok || body?.error) {
    throw new Error(body?.error || `Upstash request failed (${res.status})`)
  }

  return body?.result as T
}

export function resetKey(key: string) {
  buckets.delete(key)
}
