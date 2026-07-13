export type WebhookSecretSource = 'dedicated' | 'integration' | 'global'

export interface ResolvedWebhookSecret {
  secret: string
  source: WebhookSecretSource
}

function nonEmptySecret(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/**
 * Resolve a Sendcloud webhook secret without breaking tenants that have not
 * completed the dedicated-secret rollout yet. The order is intentionally
 * strict: dedicated tenant secret, tenant integration secret, global legacy
 * fallback.
 */
export function resolveWebhookSecret(input: {
  dedicatedSecret: string | null
  integrationSecret: string | null
  globalFallback: string | undefined
}): ResolvedWebhookSecret | null {
  const dedicated = nonEmptySecret(input.dedicatedSecret)
  if (dedicated) return { secret: dedicated, source: 'dedicated' }

  const integration = nonEmptySecret(input.integrationSecret)
  if (integration) return { secret: integration, source: 'integration' }

  const global = nonEmptySecret(input.globalFallback)
  if (global) return { secret: global, source: 'global' }

  return null
}
