import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSyncLogger } from './sync-logger'

describe('createSyncLogger', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('prefixes every level with the same run correlation id', () => {
    const info = vi.spyOn(console, 'log').mockImplementation(() => undefined)
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const logger = createSyncLogger('Cron', 'run-123')

    logger.info('started')
    logger.warn('slow', 42)
    logger.error('failed', new Error('boom'))

    expect(info).toHaveBeenCalledWith('[Cron][run:run-123]', 'started')
    expect(warn).toHaveBeenCalledWith('[Cron][run:run-123]', 'slow', 42)
    expect(error).toHaveBeenCalledWith(
      '[Cron][run:run-123]',
      'failed',
      expect.any(Error),
    )
    expect(logger.correlationId).toBe('run-123')
  })
})
