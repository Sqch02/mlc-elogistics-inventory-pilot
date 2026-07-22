import { describe, expect, it, vi } from 'vitest'
import { reconcileTenantStock } from './reconcile-stock'

describe('reconcileTenantStock', () => {
  it('is a no-op while the global sync kill-switch is active', async () => {
    const rpc = vi.fn()
    const result = await reconcileTenantStock({ rpc }, 'tenant-1', 200, { SYNC_PAUSED: 'true' })

    expect(result).toEqual({ consumed: 0, reversed: 0, paused: true })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('calls the tenant-scoped RPC with the default hard bound', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ consumed_count: 3, reversed_count: 2 }],
      error: null,
    })

    await expect(reconcileTenantStock({ rpc }, 'tenant-1')).resolves.toEqual({
      consumed: 3,
      reversed: 2,
      paused: false,
    })
    expect(rpc).toHaveBeenCalledWith('reconcile_tenant_stock', {
      p_tenant_id: 'tenant-1',
      p_limit: 200,
    })
  })

  it('clamps any caller-provided limit to 200', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ consumed_count: 0, reversed_count: 0 }],
      error: null,
    })

    await reconcileTenantStock({ rpc }, 'tenant-1', 50_000)

    expect(rpc).toHaveBeenCalledWith('reconcile_tenant_stock', expect.objectContaining({
      p_limit: 200,
    }))
  })

  it('throws database errors for the isolated cron try/catch to log', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: 'timeout' } })

    await expect(reconcileTenantStock({ rpc }, 'tenant-1')).rejects.toThrow(
      'reconcile_tenant_stock failed for tenant tenant-1: timeout',
    )
  })
})
