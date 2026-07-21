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

type GeneratedFunctions = GeneratedDatabase['public']['Functions']
type GeneratedTables = GeneratedDatabase['public']['Tables']
type TablesWithLocalMigrations = Omit<GeneratedTables, 'tenant_settings'> & {
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
