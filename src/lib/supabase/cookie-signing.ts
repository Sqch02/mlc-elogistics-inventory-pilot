import { createHmac, timingSafeEqual } from 'crypto'

/**
 * HMAC-signs an arbitrary JSON-serializable payload for storage in a cookie.
 *
 * Output format: <base64url(json)>.<hex(hmac)>
 *
 * Reason: the _profile_cache cookie was previously stored as raw JSON. A user
 * could open DevTools, edit their `role` to 'super_admin', set the cookie back,
 * and pass the middleware's role check on /admin (P0-secu audit finding).
 *
 * The signing secret is COOKIE_SIGNING_SECRET if set, otherwise derived from
 * SUPABASE_SERVICE_ROLE_KEY (always present in our envs). This keeps existing
 * deployments working without an extra env var to configure.
 */

function getSigningSecret(): string {
  const explicit = process.env.COOKIE_SIGNING_SECRET
  if (explicit && explicit.length >= 32) return explicit

  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRole) {
    throw new Error('Missing COOKIE_SIGNING_SECRET or SUPABASE_SERVICE_ROLE_KEY for cookie signing')
  }
  return createHmac('sha256', serviceRole).update('profile-cache-v1').digest('hex')
}

function toBase64Url(buf: Buffer): string {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): Buffer {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)
  return Buffer.from(padded, 'base64')
}

export function signCookieValue<T>(payload: T): string {
  const secret = getSigningSecret()
  const json = JSON.stringify(payload)
  const body = toBase64Url(Buffer.from(json, 'utf-8'))
  const sig = createHmac('sha256', secret).update(body).digest('hex')
  return `${body}.${sig}`
}

export function verifyAndParseCookieValue<T>(value: string | undefined | null): T | null {
  if (!value || typeof value !== 'string') return null
  const dot = value.lastIndexOf('.')
  if (dot < 0) return null

  const body = value.slice(0, dot)
  const sigHex = value.slice(dot + 1)
  if (!body || !sigHex) return null

  let expected: Buffer
  try {
    expected = Buffer.from(createHmac('sha256', getSigningSecret()).update(body).digest('hex'), 'hex')
  } catch {
    return null
  }

  let provided: Buffer
  try {
    provided = Buffer.from(sigHex, 'hex')
  } catch {
    return null
  }

  if (expected.length !== provided.length) return null
  if (!timingSafeEqual(expected, provided)) return null

  try {
    const json = fromBase64Url(body).toString('utf-8')
    return JSON.parse(json) as T
  } catch {
    return null
  }
}
