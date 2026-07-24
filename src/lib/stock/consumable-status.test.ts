import { describe, expect, it } from 'vitest'
import {
  CANCELLED_STATUS_IDS,
  NON_CONSUMABLE_STATUS_MESSAGES,
  isConsumableStatus,
} from './consumable-status'

const CASES = [
  ['On-Hold integration', { status_id: null, status_message: 'On Hold', is_return: false }, false],
  ['Unfulfilled integration', { status_id: null, status_message: 'Unfulfilled', is_return: false }, false],
  ['Processing integration', { status_id: null, status_message: 'Processing', is_return: false }, false],
  ['null message integration', { status_id: null, status_message: null, is_return: false }, false],
  ['empty message integration', { status_id: null, status_message: '', is_return: false }, false],
  ['MOTIJET Fulfilled with null id', { status_id: null, status_message: 'Fulfilled', is_return: false }, true],
  ['Anteos Completed with null id', { status_id: null, status_message: 'Completed', is_return: false }, true],
  ['cancelled numeric 2000', { status_id: 2000, status_message: 'Annulé', is_return: false }, false],
  ['refused numeric 2001', { status_id: 2001, status_message: 'Refusé', is_return: false }, false],
  ['delivered numeric 11', { status_id: 11, status_message: 'Delivered', is_return: false }, true],
  ['ready to send defaults to consumable', { status_id: 1000, status_message: 'Ready to send', is_return: false }, true],
  ['announcement failed defaults to consumable', { status_id: 1002, status_message: 'Announcement failed', is_return: false }, true],
  ['return line', { status_id: 11, status_message: 'Delivered', is_return: true }, false],
  ['nullable return flag', { status_id: 11, status_message: 'Delivered', is_return: null }, true],
  ['cancelled by message', { status_id: null, status_message: 'Cancelled - customer', is_return: false }, false],
] as const

describe('isConsumableStatus', () => {
  it.each(CASES)('%s', (_label, row, expected) => {
    expect(isConsumableStatus(row)).toBe(expected)
  })

  it('exports the vocabulary awaiting client confirmation from one location', () => {
    expect(NON_CONSUMABLE_STATUS_MESSAGES).toEqual([
      'On Hold',
      'Unfulfilled',
      'Processing',
      '',
      'Cancelled',
      'Cancelled - customer',
    ])
    expect(CANCELLED_STATUS_IDS).toEqual([2000, 2001])
  })
})
