import { createHash, randomBytes, timingSafeEqual } from 'crypto'

const TOKEN_PREFIX = 'banshi_live_'

export function createIngestToken() {
  return `${TOKEN_PREFIX}${randomBytes(32).toString('base64url')}`
}

export function hashIngestToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function verifyIngestToken(token: unknown, expectedHash: unknown) {
  if (typeof token !== 'string' || token.length < TOKEN_PREFIX.length + 16) return false
  if (typeof expectedHash !== 'string' || !/^[a-f0-9]{64}$/i.test(expectedHash)) return false

  const actual = Buffer.from(hashIngestToken(token), 'hex')
  const expected = Buffer.from(expectedHash, 'hex')
  if (actual.length !== expected.length) return false

  return timingSafeEqual(actual, expected)
}
