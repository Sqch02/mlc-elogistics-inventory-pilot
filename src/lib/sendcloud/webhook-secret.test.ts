import { describe, expect, it } from 'vitest'
import { resolveWebhookSecret } from './webhook-secret'

describe('resolveWebhookSecret', () => {
  it('prefers the dedicated tenant secret', () => {
    expect(resolveWebhookSecret({
      dedicatedSecret: ' dedicated ',
      integrationSecret: 'integration',
      globalFallback: 'global',
    })).toEqual({ secret: 'dedicated', source: 'dedicated' })
  })

  it('uses the tenant integration secret during migration', () => {
    expect(resolveWebhookSecret({
      dedicatedSecret: null,
      integrationSecret: 'integration',
      globalFallback: 'global',
    })).toEqual({ secret: 'integration', source: 'integration' })
  })

  it('keeps the global fallback for an unconfigured tenant', () => {
    expect(resolveWebhookSecret({
      dedicatedSecret: '  ',
      integrationSecret: null,
      globalFallback: 'global',
    })).toEqual({ secret: 'global', source: 'global' })
  })

  it('fails closed when no usable secret exists', () => {
    expect(resolveWebhookSecret({
      dedicatedSecret: null,
      integrationSecret: ' ',
      globalFallback: undefined,
    })).toBeNull()
  })
})
