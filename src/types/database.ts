import type {
  Database as GeneratedDatabase,
  Json,
} from './database.generated'

export type {
  CompositeTypes,
  Enums,
  Json,
  Tables,
  TablesInsert,
  TablesUpdate,
} from './database.generated'
export { Constants } from './database.generated'

/**
 * RPCs introduced by local migrations that are intentionally not in the
 * generated production schema until their isolated PRs are deployed.
 */
interface LocalFunctions {
  enqueue_auto_fix_jobs: {
    Args: { p_jobs: Json }
    Returns: number
  }
  get_auto_fix_simulated_tenants: {
    Args: { p_limit?: number }
    Returns: Json[]
  }
  claim_auto_fix_jobs: {
    Args: {
      p_tenant_id: string
      p_limit?: number
      p_lock_seconds?: number
      p_worker_id?: string
    }
    Returns: Json[]
  }
  plan_auto_fix_simulation: {
    Args: { p_job_id: string; p_worker_id: string; p_plan: Json }
    Returns: boolean
  }
  complete_auto_fix_simulation: {
    Args: { p_job_id: string; p_worker_id: string }
    Returns: boolean
  }
  fail_auto_fix_simulation: {
    Args: { p_job_id: string; p_worker_id: string; p_error: Json }
    Returns: string
  }
  cleanup_auto_fix_pii: {
    Args: { p_limit?: number }
    Returns: number
  }
  map_shipment_items_batch: {
    Args: { p_items: Json; p_tenant_id: string }
    Returns: Array<{ item_index: number; sku_id: string | null }>
  }
  reverse_duplicate_shipment_stock: {
    Args: { p_shipment_ids: string[]; p_tenant_id: string }
    Returns: Array<{
      shipments_deleted: number
      skus_reversed: number
      units_reversed: number
    }>
  }
}

type AutoFixJobRow = Record<string, unknown> & {
  id: string
  tenant_id: string
  shipment_id: string | null
  source_kind: string
  source_sendcloud_id: string
  source_order_ref_hash: string | null
  source_fingerprint: string
  primary_pattern: string
  detected_patterns: string[]
  mode: string
  operation_key: string
  state: string
  priority: number
  evidence_json: Json
  source_summary_json: Json
  plan_json: Json | null
  last_error_json: Json | null
  error_category: string | null
  attempt_count: number
  simulation_failure_count: number
  claim_count: number
  worker_id: string | null
  locked_until: string | null
  next_attempt_at: string
  original_sendcloud_id: string
  result_sendcloud_id: string | null
  source_observed_at: string
  first_seen_at: string
  last_seen_at: string
  queued_at: string
  claimed_at: string | null
  planned_at: string | null
  applied_at: string | null
  simulated_at: string | null
  verified_at: string | null
  resolved_at: string | null
  cancelled_at: string | null
  recreated_at: string | null
  linked_at: string | null
  pii_expires_at: string
  pii_redacted_at: string | null
  created_at: string
  updated_at: string
}

type AutoFixAuditRow = Record<string, unknown> & {
  id: string
  tenant_id: string
  job_id: string | null
  shipment_id: string | null
  event_key: string
  operation_key: string
  mode: string
  primary_pattern: string
  detected_patterns: string[]
  source_kind: string
  source_sendcloud_id: string
  original_sendcloud_id: string
  result_sendcloud_id: string | null
  action: string
  status: string
  source_fingerprint: string
  before_json: Json | null
  after_json: Json | null
  error_json: Json | null
  pii_expires_at: string
  pii_redacted_at: string | null
  created_at: string
}

type SendcloudSyncCheckpointRow = {
  tenant_id: string
  resource: 'parcels' | 'returns' | 'integration_shipments'
  partition_key: string
  watermark: string | null
  cursor: string | null
  continuation_url: string | null
  window_ends_at: string | null
  has_more: boolean
  consecutive_failures: number
  updated_at: string
}

type ReadOnlyLocalTable<Row extends Record<string, unknown>> = {
  Row: Row
  Insert: Record<string, never>
  Update: Record<string, never>
  Relationships: []
}

type GeneratedFunctions = GeneratedDatabase['public']['Functions']
type GeneratedTables = GeneratedDatabase['public']['Tables']
type TablesWithLocalMigrations = Omit<GeneratedTables, 'tenant_settings'> & {
  auto_fix_jobs: ReadOnlyLocalTable<AutoFixJobRow>
  auto_fixes: ReadOnlyLocalTable<AutoFixAuditRow>
  sendcloud_sync_checkpoints: {
    Row: SendcloudSyncCheckpointRow
    Insert: Omit<SendcloudSyncCheckpointRow, 'updated_at'> & { updated_at?: string }
    Update: Partial<SendcloudSyncCheckpointRow>
    Relationships: [
      {
        foreignKeyName: 'sendcloud_sync_checkpoints_tenant_id_fkey'
        columns: ['tenant_id']
        isOneToOne: false
        referencedRelation: 'tenants'
        referencedColumns: ['id']
      },
    ]
  }
  tenant_settings: {
    Row: GeneratedTables['tenant_settings']['Row'] & {
      auto_fix_mode: 'off' | 'simulated' | 'live'
      auto_fix_max_candidates: number
    }
    Insert: GeneratedTables['tenant_settings']['Insert'] & {
      auto_fix_mode?: 'off' | 'simulated' | 'live'
      auto_fix_max_candidates?: number
    }
    Update: GeneratedTables['tenant_settings']['Update'] & {
      auto_fix_mode?: 'off' | 'simulated' | 'live'
      auto_fix_max_candidates?: number
    }
    Relationships: GeneratedTables['tenant_settings']['Relationships']
  }
}
type FunctionsWithLocalMigrations = {
  [Name in keyof GeneratedFunctions | keyof LocalFunctions]:
    Name extends keyof LocalFunctions
      ? LocalFunctions[Name]
      : Name extends keyof GeneratedFunctions
        ? GeneratedFunctions[Name]
        : never
}

export type Database = {
  __InternalSupabase: GeneratedDatabase['__InternalSupabase']
  public: {
    Tables: TablesWithLocalMigrations
    Views: GeneratedDatabase['public']['Views']
    Functions: FunctionsWithLocalMigrations
    Enums: GeneratedDatabase['public']['Enums']
    CompositeTypes: GeneratedDatabase['public']['CompositeTypes']
  }
}

// Backwards-compatible aliases derived from the generated enums.
export type UserRole = GeneratedDatabase['public']['Enums']['user_role']
export type ClaimStatus = GeneratedDatabase['public']['Enums']['claim_status']
export type SyncStatus = GeneratedDatabase['public']['Enums']['sync_status']
export type InvoiceStatus = GeneratedDatabase['public']['Enums']['invoice_status']
export type PricingStatus = GeneratedDatabase['public']['Enums']['pricing_status']
