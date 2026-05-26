const buckets: Map<string, number[]> = new Map()

/**
 * Very small in-memory sliding-window rate limiter.
 * Note: this is best-effort and not distributed. Suitable as a baseline.
 */
export function allowRequest(key: string, maxRequests = 120, windowMs = 60 * 1000): boolean {
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

export function resetKey(key: string) {
  buckets.delete(key)
}
