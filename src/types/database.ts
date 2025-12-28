export type UserRole = 'super_admin' | 'admin' | 'ops' | 'sav'
export type ClaimStatus = 'ouverte' | 'en_analyse' | 'indemnisee' | 'refusee' | 'cloturee'
export type SyncStatus = 'running' | 'success' | 'partial' | 'failed'
export type InvoiceStatus = 'draft' | 'validated'
export type PricingStatus = 'ok' | 'missing'

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
      }
      profiles: {
        Row: {
          id: string
          tenant_id: string
          role: UserRole
          email: string
          full_name: string | null
          created_at: string
        }
        Insert: {
          id: string
          tenant_id: string
          role?: UserRole
          email: string
          full_name?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          role?: UserRole
          email?: string
          full_name?: string | null
          created_at?: string
        }
      }
      skus: {
        Row: {
          id: string
          tenant_id: string
          sku_code: string
          name: string
          weight_grams: number | null
          active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          sku_code: string
          name: string
          weight_grams?: number | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          sku_code?: string
          name?: string
          weight_grams?: number | null
          active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      stock_snapshots: {
        Row: {
          id: string
          tenant_id: string
          sku_id: string
          qty_current: number
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          sku_id: string
          qty_current: number
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          sku_id?: string
          qty_current?: number
          updated_at?: string
        }
      }
      inbound_restock: {
        Row: {
          id: string
          tenant_id: string
          sku_id: string
          qty: number
          eta_date: string
          note: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          sku_id: string
          qty: number
          eta_date: string
          note?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          sku_id?: string
          qty?: number
          eta_date?: string
          note?: string | null
          created_at?: string
        }
      }
      bundles: {
        Row: {
          id: string
          tenant_id: string
          bundle_sku_id: string
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          bundle_sku_id: string
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          bundle_sku_id?: string
          created_at?: string
        }
      }
      bundle_components: {
        Row: {
          id: string
          tenant_id: string
          bundle_id: string
          component_sku_id: string
          qty_component: number
        }
        Insert: {
          id?: string
          tenant_id: string
          bundle_id: string
          component_sku_id: string
          qty_component: number
        }
        Update: {
          id?: string
          tenant_id?: string
          bundle_id?: string
          component_sku_id?: string
          qty_component?: number
        }
      }
      locations: {
        Row: {
          id: string
          tenant_id: string
          code: string
          label: string | null
          active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          code: string
          label?: string | null
          active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          code?: string
          label?: string | null
          active?: boolean
          created_at?: string
        }
      }
      location_assignments: {
        Row: {
          id: string
          tenant_id: string
          location_id: string
          sku_id: string
          assigned_at: string
          note: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          location_id: string
          sku_id: string
          assigned_at?: string
          note?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          location_id?: string
          sku_id?: string
          assigned_at?: string
          note?: string | null
        }
      }
      shipments: {
        Row: {
          id: string
          tenant_id: string
          sendcloud_id: string
          shipped_at: string
          carrier: string
          service: string | null
          weight_grams: number
          order_ref: string | null
          tracking: string | null
          pricing_status: PricingStatus
          computed_cost_eur: number | null
          raw_json: Record<string, unknown> | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          sendcloud_id: string
          shipped_at: string
          carrier: string
          service?: string | null
          weight_grams: number
          order_ref?: string | null
          tracking?: string | null
          pricing_status?: PricingStatus
          computed_cost_eur?: number | null
          raw_json?: Record<string, unknown> | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          sendcloud_id?: string
          shipped_at?: string
          carrier?: string
          service?: string | null
          weight_grams?: number
          order_ref?: string | null
          tracking?: string | null
          pricing_status?: PricingStatus
          computed_cost_eur?: number | null
          raw_json?: Record<string, unknown> | null
          created_at?: string
        }
      }
      shipment_items: {
        Row: {
          id: string
          tenant_id: string
          shipment_id: string
          sku_id: string
          qty: number
        }
        Insert: {
          id?: string
          tenant_id: string
          shipment_id: string
          sku_id: string
          qty: number
        }
        Update: {
          id?: string
          tenant_id?: string
          shipment_id?: string
          sku_id?: string
          qty?: number
        }
      }
      pricing_rules: {
        Row: {
          id: string
          tenant_id: string
          carrier: string
          weight_min_grams: number
          weight_max_grams: number
          price_eur: number
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          carrier: string
          weight_min_grams: number
          weight_max_grams: number
          price_eur: number
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          carrier?: string
          weight_min_grams?: number
          weight_max_grams?: number
          price_eur?: number
          created_at?: string
        }
      }
      invoices_monthly: {
        Row: {
          id: string
          tenant_id: string
          month: string
          status: InvoiceStatus
          total_eur: number
          missing_pricing_count: number
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          month: string
          status?: InvoiceStatus
          total_eur?: number
          missing_pricing_count?: number
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          month?: string
          status?: InvoiceStatus
          total_eur?: number
          missing_pricing_count?: number
          created_at?: string
        }
      }
      invoice_lines: {
        Row: {
          id: string
          tenant_id: string
          invoice_id: string
          carrier: string
          weight_min_grams: number
          weight_max_grams: number
          shipment_count: number
          total_eur: number
        }
        Insert: {
          id?: string
          tenant_id: string
          invoice_id: string
          carrier: string
          weight_min_grams: number
          weight_max_grams: number
          shipment_count: number
          total_eur: number
        }
        Update: {
          id?: string
          tenant_id?: string
          invoice_id?: string
          carrier?: string
          weight_min_grams?: number
          weight_max_grams?: number
          shipment_count?: number
          total_eur?: number
        }
      }
      claims: {
        Row: {
          id: string
          tenant_id: string
          shipment_id: string | null
          order_ref: string | null
          opened_at: string
          status: ClaimStatus
          description: string | null
          indemnity_eur: number | null
          decision_note: string | null
          decided_at: string | null
          decided_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          shipment_id?: string | null
          order_ref?: string | null
          opened_at?: string
          status?: ClaimStatus
          description?: string | null
          indemnity_eur?: number | null
          decision_note?: string | null
          decided_at?: string | null
          decided_by?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          shipment_id?: string | null
          order_ref?: string | null
          opened_at?: string
          status?: ClaimStatus
          description?: string | null
          indemnity_eur?: number | null
          decision_note?: string | null
          decided_at?: string | null
          decided_by?: string | null
          created_at?: string
        }
      }
      sync_runs: {
        Row: {
          id: string
          tenant_id: string
          source: string
          started_at: string
          ended_at: string | null
          status: SyncStatus
          stats_json: Record<string, unknown> | null
          error_text: string | null
          cursor: string | null
        }
        Insert: {
          id?: string
          tenant_id: string
          source: string
          started_at?: string
          ended_at?: string | null
          status?: SyncStatus
          stats_json?: Record<string, unknown> | null
          error_text?: string | null
          cursor?: string | null
        }
        Update: {
          id?: string
          tenant_id?: string
          source?: string
          started_at?: string
          ended_at?: string | null
          status?: SyncStatus
          stats_json?: Record<string, unknown> | null
          error_text?: string | null
          cursor?: string | null
        }
      }
      tenant_settings: {
        Row: {
          id: string
          tenant_id: string
          sendcloud_api_key: string | null
          sendcloud_secret: string | null
          sync_enabled: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          tenant_id: string
          sendcloud_api_key?: string | null
          sendcloud_secret?: string | null
          sync_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          tenant_id?: string
          sendcloud_api_key?: string | null
          sendcloud_secret?: string | null
          sync_enabled?: boolean
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: UserRole
      claim_status: ClaimStatus
      sync_status: SyncStatus
      invoice_status: InvoiceStatus
      pricing_status: PricingStatus
    }
  }
}
