import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

describe('consume-at-ship route contracts', () => {
  it.each([
    'src/app/api/sync/sendcloud/cron/route.ts',
    'src/app/api/sync/sendcloud/run/route.ts',
    'src/app/api/webhooks/sendcloud/[tenantCode]/route.ts',
  ])('%s gates consumption with the shared predicate', (path) => {
    const code = source(path)
    expect(code).toContain('isConsumableStatus')
    expect(code).toContain('stock_consumed_at')
    expect(code).toContain('consumeShipmentStockOnce')
  })

  it('manual sync scopes Sendcloud identity by tenant', () => {
    const code = source('src/app/api/sync/sendcloud/run/route.ts')
    const lookup = code.slice(code.indexOf(".from('shipments')"), code.indexOf('const isNewShipment'))
    expect(lookup).toContain(".eq('tenant_id', tenantId)")
    expect(lookup).toContain(".eq('sendcloud_id', parcel.sendcloud_id)")
  })

  it('legacy create only maps items and never mutates stock directly', () => {
    const code = source('src/app/api/shipments/create/route.ts')
    expect(code).not.toContain(".from('stock_snapshots')")
    expect(code).not.toContain(".from('stock_movements')")
    expect(code).not.toContain('apply_stock_delta')
  })

  it('legacy recalculate uses the bounded central shipment consumer', () => {
    const code = source('src/app/api/stock/recalculate/route.ts')
    expect(code).toContain('RECALCULATE_LIMIT = 200')
    expect(code).toContain('isConsumableStatus')
    expect(code).toContain('consumeShipmentStockOnce')
    expect(code).not.toContain('consumeStock(')
  })

  it('UI cancellation and numeric webhook cancellation use atomic restock', () => {
    expect(source('src/app/api/shipments/[id]/cancel/route.ts')).toContain('restockShipmentStock')
    const webhook = source('src/app/api/webhooks/sendcloud/[tenantCode]/route.ts')
    expect(webhook).toContain('CANCELLED_STATUS_IDS')
    expect(webhook).toContain('restockShipmentStock')
  })

  it('cron keeps the page budget unchanged and runs one bounded stock sweeper', () => {
    const cron = source('src/app/api/sync/sendcloud/cron/route.ts')
    expect(source('src/lib/sendcloud/pagination.ts')).toContain('DEFAULT_CRON_MAX_PAGES = 2')
    expect(cron.match(/reconcileTenantStock\(/g)).toHaveLength(1)
    expect(cron.match(/refreshCronAnalytics\(/g)?.length).toBeGreaterThanOrEqual(1)
  })
})
