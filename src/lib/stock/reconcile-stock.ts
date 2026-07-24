const DEFAULT_RECONCILE_LIMIT = 200
const MAX_RECONCILE_LIMIT = 200

interface ReconcileRpcClient {
  rpc(
    name: 'reconcile_tenant_stock',
    args: { p_tenant_id: string; p_limit: number },
  ): PromiseLike<{
    data: unknown
    error: { message: string } | null
  }>
}

export interface StockReconcileResult {
  consumed: number
  reversed: number
  paused: boolean
}

export async function reconcileTenantStock(
  adminClient: ReconcileRpcClient,
  tenantId: string,
  limit = DEFAULT_RECONCILE_LIMIT,
  env: Readonly<Record<string, string | undefined>> = process.env,
): Promise<StockReconcileResult> {
  if (env.SYNC_PAUSED === 'true') {
    return { consumed: 0, reversed: 0, paused: true }
  }

  const boundedLimit = Math.max(1, Math.min(MAX_RECONCILE_LIMIT, Math.trunc(limit)))
  const { data, error } = await adminClient.rpc('reconcile_tenant_stock', {
    p_tenant_id: tenantId,
    p_limit: boundedLimit,
  })
  if (error) {
    throw new Error(`reconcile_tenant_stock failed for tenant ${tenantId}: ${error.message}`)
  }

  const row = (Array.isArray(data) ? data[0] : null) as {
    consumed_count?: number
    reversed_count?: number
  } | null
  return {
    consumed: Number(row?.consumed_count ?? 0),
    reversed: Number(row?.reversed_count ?? 0),
    paused: false,
  }
}
