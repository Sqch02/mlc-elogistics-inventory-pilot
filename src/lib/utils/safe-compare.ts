import { timingSafeEqual } from 'crypto'

/**
 * Constant-time string comparison for secrets (cron bearer token, etc.).
 * A plain `a === b` short-circuits on the first differing byte, leaking timing
 * information about how much of the secret was guessed correctly. This compares
 * in time independent of the content. Length mismatch still returns false early
 * (the length of a fixed server secret is not sensitive).
 */
export function safeEqual(a: string | null | undefined, b: string | null | undefined): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}
