import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { AutoFixDashboardResponse } from '@/lib/auto-fix/dashboard-types'
import { AUTO_FIX_JOB_STATES } from '@/lib/auto-fix/types'

vi.mock('@tanstack/react-query', () => ({ useInfiniteQuery: vi.fn() }))
vi.mock('@/components/providers/TenantProvider', () => ({ useTenant: vi.fn() }))

import { useInfiniteQuery } from '@tanstack/react-query'
import { useTenant } from '@/components/providers/TenantProvider'
import { CorrectionsAutoClient } from './CorrectionsAutoClient'

const emptyStates = Object.fromEntries(AUTO_FIX_JOB_STATES.map((state) => [state, 0])) as AutoFixDashboardResponse['jobsByState']

const fixture: AutoFixDashboardResponse = {
  generatedAt: '2026-07-21T12:00:00.000Z',
  gate: {
    globalPaused: false,
    dryRunEnabled: true,
    tenantMode: 'simulated',
    effective: 'simulated',
  },
  kpis: {
    totalJobs: 2,
    simulated: 2,
    pendingManual: 0,
    manualForecast: 1,
    unknown: 0,
    simulatedRate: 100,
    pendingManualRate: 0,
  },
  jobsByState: { ...emptyStates, simulated: 2 },
  patterns: [
    { pattern: 'address_too_long', count: 1 },
    { pattern: 'service_point_missing', count: 1 },
    { pattern: 'currency_chf', count: 0 },
    { pattern: 'hs_code_missing', count: 0 },
    { pattern: 'weight_too_low', count: 0 },
    { pattern: 'sender_eori_missing', count: 0 },
    { pattern: 'unknown', count: 0 },
  ],
  patternSample: { sampledJobs: 2, totalJobs: 2, truncated: false },
  manualItems: [{
    id: 'manual-forecast',
    state: 'simulated',
    kind: 'simulated_forecast',
    primaryPattern: 'service_point_missing',
    detectedPatterns: ['service_point_missing'],
    sourceKind: 'parcel',
    sourceSendcloudId: '12345',
    action: 'manual_required',
    reason: 'Aucun point relais compatible trouvé.',
    createdAt: '2026-07-21T11:00:00.000Z',
  }],
  audits: [{
    id: 'audit-1',
    jobId: 'job-1',
    primaryPattern: 'address_too_long',
    detectedPatterns: ['address_too_long'],
    sourceKind: 'parcel',
    sourceSendcloudId: '67890',
    action: 'put_update',
    status: 'simulated',
    before: { address: 'Une adresse beaucoup trop longue' },
    after: { address: 'Adresse courte' },
    piiRedactedAt: null,
    createdAt: '2026-07-21T10:00:00.000Z',
  }],
  pagination: { limit: 25, nextCursor: null },
}

function mockQuery(data: AutoFixDashboardResponse) {
  vi.mocked(useInfiniteQuery).mockReturnValue({
    data: { pages: [data], pageParams: [undefined] },
    isLoading: false,
    isError: false,
    error: null,
    isFetching: false,
    isFetchingNextPage: false,
    hasNextPage: false,
    refetch: vi.fn(),
    fetchNextPage: vi.fn(),
  } as never)
}

describe('CorrectionsAutoClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useTenant).mockReturnValue({
      activeTenantId: 'tenant-a',
      activeTenant: { id: 'tenant-a', name: 'Anteos', code: 'ANTEOS' },
      isLoading: false,
    } as never)
  })

  it('renders clean empty states while production tables are empty', () => {
    mockQuery({
      ...fixture,
      kpis: { ...fixture.kpis, totalJobs: 0, simulated: 0, manualForecast: 0, simulatedRate: 0 },
      jobsByState: emptyStates,
      patterns: fixture.patterns.map((pattern) => ({ ...pattern, count: 0 })),
      patternSample: { sampledJobs: 0, totalJobs: 0, truncated: false },
      manualItems: [],
      audits: [],
    })

    render(<CorrectionsAutoClient />)

    expect(screen.getByText('DRY-RUN — observation uniquement')).toBeInTheDocument()
    expect(screen.getByText('Aucun job')).toBeInTheDocument()
    expect(screen.getByText('Aucune intervention en attente')).toBeInTheDocument()
    expect(screen.getByText('Aucun audit simulé')).toBeInTheDocument()
  })

  it('shows manual forecasts and the expandable before/after plan', async () => {
    mockQuery(fixture)
    const user = userEvent.setup()

    render(<CorrectionsAutoClient />)

    expect(screen.getByText('Aucun point relais compatible trouvé.')).toBeInTheDocument()
    expect(screen.getByText('Prévision dry-run')).toBeInTheDocument()
    expect(screen.getByText('Mise à jour du colis')).toBeInTheDocument()

    await user.click(screen.getByText('Adresse trop longue', { selector: 'div.font-medium' }))
    expect(screen.getByText(/Adresse courte/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /activer|appliquer|retry/i })).not.toBeInTheDocument()
  })
})
