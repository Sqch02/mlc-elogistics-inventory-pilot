/**
 * Webhook signature validation utilities
 * Extracted from webhook handler for testability
 */

import { createHmac } from 'crypto'

/**
 * Validate HMAC-SHA256 signature from Sendcloud webhook
 * Uses constant-time comparison to prevent timing attacks
 */
export function validateSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  if (!secret || !signature) {
    return false
  }

  const expectedSignature = createHmac('sha256', secret)
    .update(payload)
    .digest('hex')

  // Constant-time comparison to prevent timing attacks
  if (signature.length !== expectedSignature.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i)
  }

  return result === 0
}

/**
 * Generate HMAC-SHA256 signature for testing
 */
export function generateSignature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex')
}

/**
 * Validate webhook timestamp is reasonable (between 1970 and 2100)
 */
export function isValidTimestamp(timestamp: number): boolean {
  return timestamp > 0 && timestamp < 4102444800 // Year 2100 in Unix time
}

/**
 * Sendcloud parcel actions that we process
 */
export const PARCEL_ACTIONS = [
  'parcel_status_changed',
  'parcel_created',
  'parcel_cancelled',
] as const

export type ParcelAction = (typeof PARCEL_ACTIONS)[number]

/**
 * Check if action is a parcel-related action
 */
export function isParcelAction(action: string): action is ParcelAction {
  return PARCEL_ACTIONS.includes(action as ParcelAction)
}
