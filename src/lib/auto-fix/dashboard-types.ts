import type { Json } from '@/types/database'
import type {
  AutoFixAction,
  AutoFixJobState,
  AutoFixPattern,
  AutoFixSourceKind,
} from './types'

export type AutoFixTenantMode = 'off' | 'simulated' | 'live'

export interface AutoFixGateView {
  globalPaused: boolean
  dryRunEnabled: boolean
  tenantMode: AutoFixTenantMode
  effective: 'global_paused' | 'dry_run_disabled' | 'tenant_off' | 'simulated' | 'live_ignored'
}

export interface AutoFixDashboardKpis {
  totalJobs: number
  simulated: number
  pendingManual: number
  manualForecast: number
  unknown: number
  simulatedRate: number
  pendingManualRate: number
}

export interface AutoFixPatternCount {
  pattern: AutoFixPattern
  count: number
}

export interface AutoFixManualItem {
  id: string
  state: AutoFixJobState
  kind: 'current' | 'simulated_forecast'
  primaryPattern: AutoFixPattern
  detectedPatterns: AutoFixPattern[]
  sourceKind: AutoFixSourceKind
  sourceSendcloudId: string
  action: AutoFixAction
  reason: string
  createdAt: string
}

export interface AutoFixAuditItem {
  id: string
  jobId: string | null
  primaryPattern: AutoFixPattern
  detectedPatterns: AutoFixPattern[]
  sourceKind: AutoFixSourceKind
  sourceSendcloudId: string
  action: AutoFixAction
  status: 'simulated'
  before: Json | null
  after: Json | null
  piiRedactedAt: string | null
  createdAt: string
}

export interface AutoFixDashboardResponse {
  generatedAt: string
  gate: AutoFixGateView
  kpis: AutoFixDashboardKpis
  jobsByState: Record<AutoFixJobState, number>
  patterns: AutoFixPatternCount[]
  patternSample: {
    sampledJobs: number
    totalJobs: number
    truncated: boolean
  }
  manualItems: AutoFixManualItem[]
  audits: AutoFixAuditItem[]
  pagination: {
    limit: number
    nextCursor: string | null
  }
}

export interface AutoFixAuditPage {
  audits: AutoFixAuditItem[]
  pagination: {
    limit: number
    nextCursor: string | null
  }
}
