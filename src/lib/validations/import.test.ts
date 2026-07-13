import { describe, expect, it } from 'vitest'
import { claimsImportRowSchema } from './import'

describe('claimsImportRowSchema', () => {
  it.each([
    ['haute', 'high'],
    ['high', 'high'],
    ['basse', 'low'],
    ['low', 'low'],
    ['urgent', 'urgent'],
    [undefined, 'normal'],
  ])('maps priority %s to the PostgreSQL enum %s', (priority, expected) => {
    const result = claimsImportRowSchema.parse({
      order_ref: 'ORDER-1',
      priority,
    })

    expect(result.priority).toBe(expected)
  })
})
