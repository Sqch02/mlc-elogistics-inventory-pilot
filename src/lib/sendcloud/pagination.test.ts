import { describe, expect, it } from 'vitest'
import {
  DEFAULT_CRON_MAX_PAGES,
  MAX_CRON_MAX_PAGES,
  SendcloudPaginationLimitError,
  getCronMaxPages,
} from './pagination'

describe('getCronMaxPages', () => {
  it.each([undefined, '', 'abc', '0', '-3'])(
    'uses the safe default for %s',
    (value) => {
      expect(getCronMaxPages(value)).toBe(DEFAULT_CRON_MAX_PAGES)
    },
  )

  it('accepts a positive page budget and floors decimals', () => {
    expect(getCronMaxPages('25')).toBe(25)
    expect(getCronMaxPages('12.9')).toBe(12)
  })

  it('caps the budget to protect the cron lease', () => {
    expect(getCronMaxPages('500')).toBe(MAX_CRON_MAX_PAGES)
  })
})

describe('SendcloudPaginationLimitError', () => {
  it('exposes the truncated resource and configured limit', () => {
    const error = new SendcloudPaginationLimitError('parcels', 10)

    expect(error).toMatchObject({
      name: 'SendcloudPaginationLimitError',
      resource: 'parcels',
      maxPages: 10,
    })
    expect(error.message).toContain('still has data after 10 pages')
  })
})
