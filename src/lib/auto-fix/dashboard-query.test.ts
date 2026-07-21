import { describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'
import { readAutoFixAuditPage, readAutoFixDashboard } from './dashboard-query'

type FixtureRow = Record<string, unknown>
type FixtureTables = Record<string, FixtureRow[]>

interface QueryLog {
  table: string
  filters: Array<{ operator: 'eq' | 'lt'; column: string; value: unknown }>
}

class FixtureQuery implements PromiseLike<unknown> {
  private filters: QueryLog['filters'] = []
  private countRequested = false
  private head = false
  private maxRows: number | undefined
  private orderColumn: string | undefined
  private ascending = true
  private single = false

  constructor(
    private readonly table: string,
    private readonly rows: FixtureRow[],
    private readonly logs: QueryLog[],
  ) {}

  select(_columns: string, options?: { count?: string; head?: boolean }) {
    this.countRequested = options?.count === 'exact'
    this.head = options?.head === true
    return this
  }

  eq(column: string, value: unknown) {
    this.filters.push({ operator: 'eq', column, value })
    return this
  }

  lt(column: string, value: unknown) {
    this.filters.push({ operator: 'lt', column, value })
    return this
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orderColumn = column
    this.ascending = options?.ascending !== false
    return this
  }

  limit(value: number) {
    this.maxRows = value
    return this
  }

  maybeSingle() {
    this.single = true
    return this
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    this.logs.push({ table: this.table, filters: [...this.filters] })
    let filtered = this.rows.filter((row) => this.filters.every((filter) => {
      if (filter.operator === 'eq') return row[filter.column] === filter.value
      return String(row[filter.column]) < String(filter.value)
    }))
    const count = this.countRequested ? filtered.length : null
    if (this.orderColumn) {
      const column = this.orderColumn
      const direction = this.ascending ? 1 : -1
      filtered = [...filtered].sort((left, right) => String(left[column]).localeCompare(String(right[column])) * direction)
    }
    if (this.maxRows !== undefined) filtered = filtered.slice(0, this.maxRows)
    const data = this.head ? null : this.single ? filtered[0] ?? null : filtered
    return Promise.resolve({ data, count, error: null }).then(onfulfilled, onrejected)
  }
}

function fixtureClient(tables: FixtureTables, logs: QueryLog[] = []) {
  const client = {
    from: vi.fn((table: string) => new FixtureQuery(table, tables[table] ?? [], logs)),
  }
  return { client: client as unknown as SupabaseClient<Database>, logs }
}

const job = (overrides: FixtureRow): FixtureRow => ({
  id: 'job-default',
  tenant_id: 'tenant-a',
  primary_pattern: 'address_too_long',
  detected_patterns: ['address_too_long'],
  source_kind: 'parcel',
  source_sendcloud_id: '100',
  plan_json: null,
  state: 'queued',
  created_at: '2026-07-21T10:00:00.000Z',
  ...overrides,
})

const audit = (overrides: FixtureRow): FixtureRow => ({
  id: 'audit-default',
  tenant_id: 'tenant-a',
  job_id: 'job-default',
  primary_pattern: 'address_too_long',
  detected_patterns: ['address_too_long'],
  source_kind: 'parcel',
  source_sendcloud_id: '100',
  action: 'put_update',
  status: 'simulated',
  before_json: { address: 'Adresse longue' },
  after_json: { address: 'Adresse courte' },
  pii_redacted_at: null,
  created_at: '2026-07-21T10:00:00.000Z',
  ...overrides,
})

describe('readAutoFixDashboard', () => {
  it('aggregates bounded fixtures and scopes every read to the requested tenant', async () => {
    const logs: QueryLog[] = []
    const read = fixtureClient({
      auto_fix_jobs: [
        job({ id: 'sim-1', state: 'simulated', created_at: '2026-07-21T12:00:00.000Z' }),
        job({
          id: 'sim-manual',
          state: 'simulated',
          primary_pattern: 'service_point_missing',
          detected_patterns: ['service_point_missing'],
          plan_json: { action: 'manual_required', wouldEndState: 'pending_manual', warnings: ['Aucun point relais compatible trouvé.'] },
          created_at: '2026-07-21T11:00:00.000Z',
        }),
        job({
          id: 'manual-1',
          state: 'pending_manual',
          primary_pattern: 'sender_eori_missing',
          detected_patterns: ['sender_eori_missing'],
          plan_json: { action: 'account_configuration', wouldEndState: 'pending_manual' },
          created_at: '2026-07-21T10:00:00.000Z',
        }),
        job({ id: 'unknown-1', state: 'queued', primary_pattern: 'unknown', detected_patterns: ['unknown'] }),
        job({ id: 'other-tenant', tenant_id: 'tenant-b', state: 'simulated' }),
      ],
      auto_fixes: [
        audit({ id: 'audit-new', created_at: '2026-07-21T12:00:00.000Z' }),
        audit({ id: 'audit-old', action: 'manual_required', created_at: '2026-07-21T11:00:00.000Z' }),
        audit({ id: 'audit-other', tenant_id: 'tenant-b' }),
      ],
    }, logs)
    const settings = fixtureClient({ tenant_settings: [{ tenant_id: 'tenant-a', auto_fix_mode: 'simulated' }] }, logs)

    const result = await readAutoFixDashboard(
      read.client,
      settings.client,
      'tenant-a',
      { auditLimit: 1 },
      { AUTO_FIX_PAUSED: 'false', AUTO_FIX_DRY_RUN_ENABLED: 'true' },
    )

    expect(result.gate.effective).toBe('simulated')
    expect(result.kpis).toMatchObject({
      totalJobs: 4,
      simulated: 2,
      pendingManual: 1,
      manualForecast: 1,
      unknown: 1,
      simulatedRate: 66.7,
      pendingManualRate: 33.3,
    })
    expect(result.manualItems.map((item) => item.kind)).toEqual(['simulated_forecast', 'current'])
    expect(result.manualItems[0].reason).toBe('Aucun point relais compatible trouvé.')
    expect(result.audits.map((item) => item.id)).toEqual(['audit-new'])
    expect(result.pagination.nextCursor).toBe('2026-07-21T12:00:00.000Z')
    expect(logs.length).toBeGreaterThan(0)
    expect(logs.every((log) => log.filters.some((filter) => (
      filter.operator === 'eq' && filter.column === 'tenant_id' && filter.value === 'tenant-a'
    )))).toBe(true)
  })

  it('returns a complete empty state while all gates are closed', async () => {
    const read = fixtureClient({ auto_fix_jobs: [], auto_fixes: [] })
    const settings = fixtureClient({ tenant_settings: [{ tenant_id: 'tenant-a', auto_fix_mode: 'off' }] })

    const result = await readAutoFixDashboard(read.client, settings.client, 'tenant-a', { auditLimit: 25 }, {})

    expect(result.gate).toMatchObject({ globalPaused: true, dryRunEnabled: false, tenantMode: 'off', effective: 'global_paused' })
    expect(result.kpis.totalJobs).toBe(0)
    expect(result.patterns.every((item) => item.count === 0)).toBe(true)
    expect(result.manualItems).toEqual([])
    expect(result.audits).toEqual([])
    expect(result.pagination.nextCursor).toBeNull()
  })

  it('paginates audit history without recomputing the dashboard aggregates', async () => {
    const read = fixtureClient({
      auto_fixes: [
        audit({ id: 'newer', created_at: '2026-07-21T12:00:00.000Z' }),
        audit({ id: 'older', created_at: '2026-07-20T09:00:00.000Z' }),
      ],
      auto_fix_jobs: [job({ id: 'must-not-be-read' })],
    })

    const result = await readAutoFixAuditPage(read.client, 'tenant-a', {
      auditLimit: 25,
      auditCursor: '2026-07-21T11:00:00.000Z',
    })

    expect(result.audits.map((item) => item.id)).toEqual(['older'])
    expect(read.logs.map((log) => log.table)).toEqual(['auto_fixes'])
  })
})
