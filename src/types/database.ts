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
    Tables: GeneratedDatabase['public']['Tables']
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
