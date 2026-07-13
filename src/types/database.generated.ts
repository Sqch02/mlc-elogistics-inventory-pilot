export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      bundle_components: {
        Row: {
          bundle_id: string
          component_sku_id: string
          id: string
          qty_component: number
          tenant_id: string
        }
        Insert: {
          bundle_id: string
          component_sku_id: string
          id?: string
          qty_component?: number
          tenant_id: string
        }
        Update: {
          bundle_id?: string
          component_sku_id?: string
          id?: string
          qty_component?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bundle_components_bundle_id_fkey"
            columns: ["bundle_id"]
            isOneToOne: false
            referencedRelation: "bundles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_components_component_sku_id_fkey"
            columns: ["component_sku_id"]
            isOneToOne: false
            referencedRelation: "mv_sku_metrics"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "bundle_components_component_sku_id_fkey"
            columns: ["component_sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundle_components_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bundles: {
        Row: {
          bundle_sku_id: string
          created_at: string
          id: string
          tenant_id: string
        }
        Insert: {
          bundle_sku_id: string
          created_at?: string
          id?: string
          tenant_id: string
        }
        Update: {
          bundle_sku_id?: string
          created_at?: string
          id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bundles_bundle_sku_id_fkey"
            columns: ["bundle_sku_id"]
            isOneToOne: false
            referencedRelation: "mv_sku_metrics"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "bundles_bundle_sku_id_fkey"
            columns: ["bundle_sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bundles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_history: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          claim_id: string
          id: string
          new_value: Json | null
          note: string | null
          old_value: Json | null
          tenant_id: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          claim_id: string
          id?: string
          new_value?: Json | null
          note?: string | null
          old_value?: Json | null
          tenant_id: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          claim_id?: string
          id?: string
          new_value?: Json | null
          note?: string | null
          old_value?: Json | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_history_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          auto_created: boolean | null
          claim_type: Database["public"]["Enums"]["claim_type"] | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          description: string | null
          id: string
          indemnity_eur: number | null
          indemnity_source: string | null
          opened_at: string
          order_ref: string | null
          priority: string | null
          resolution_deadline: string | null
          sendcloud_status_id: number | null
          sendcloud_status_message: string | null
          shipment_id: string | null
          status: Database["public"]["Enums"]["claim_status"]
          tenant_id: string
        }
        Insert: {
          auto_created?: boolean | null
          claim_type?: Database["public"]["Enums"]["claim_type"] | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          description?: string | null
          id?: string
          indemnity_eur?: number | null
          indemnity_source?: string | null
          opened_at?: string
          order_ref?: string | null
          priority?: string | null
          resolution_deadline?: string | null
          sendcloud_status_id?: number | null
          sendcloud_status_message?: string | null
          shipment_id?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          tenant_id: string
        }
        Update: {
          auto_created?: boolean | null
          claim_type?: Database["public"]["Enums"]["claim_type"] | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          description?: string | null
          id?: string
          indemnity_eur?: number | null
          indemnity_source?: string | null
          opened_at?: string
          order_ref?: string | null
          priority?: string | null
          resolution_deadline?: string | null
          sendcloud_status_id?: number | null
          sendcloud_status_message?: string | null
          shipment_id?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claims_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "mv_shopify_anomaly_items"
            referencedColumns: ["shipment_id"]
          },
          {
            foreignKeyName: "claims_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cron_tenant_locks: {
        Row: {
          locked_at: string
          locked_until: string
          tenant_id: string
        }
        Insert: {
          locked_at?: string
          locked_until: string
          tenant_id: string
        }
        Update: {
          locked_at?: string
          locked_until?: string
          tenant_id?: string
        }
        Relationships: []
      }
      dismissed_anomalies: {
        Row: {
          anomaly_type: string
          dismissed_at: string
          dismissed_by: string | null
          id: string
          raw_description: string | null
          raw_sku: string | null
          tenant_id: string
        }
        Insert: {
          anomaly_type: string
          dismissed_at?: string
          dismissed_by?: string | null
          id?: string
          raw_description?: string | null
          raw_sku?: string | null
          tenant_id: string
        }
        Update: {
          anomaly_type?: string
          dismissed_at?: string
          dismissed_by?: string | null
          id?: string
          raw_description?: string | null
          raw_sku?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dismissed_anomalies_dismissed_by_fkey"
            columns: ["dismissed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dismissed_anomalies_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_restock: {
        Row: {
          accepted_qty: number | null
          batch_reference: string | null
          created_at: string
          created_by: string | null
          eta_date: string
          group_id: string | null
          id: string
          lot_number: string | null
          nb_palettes: number | null
          note: string | null
          qty: number
          received: boolean
          received_at: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sku_id: string
          status: string | null
          supplier: string | null
          tenant_id: string
        }
        Insert: {
          accepted_qty?: number | null
          batch_reference?: string | null
          created_at?: string
          created_by?: string | null
          eta_date: string
          group_id?: string | null
          id?: string
          lot_number?: string | null
          nb_palettes?: number | null
          note?: string | null
          qty: number
          received?: boolean
          received_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sku_id: string
          status?: string | null
          supplier?: string | null
          tenant_id: string
        }
        Update: {
          accepted_qty?: number | null
          batch_reference?: string | null
          created_at?: string
          created_by?: string | null
          eta_date?: string
          group_id?: string | null
          id?: string
          lot_number?: string | null
          nb_palettes?: number | null
          note?: string | null
          qty?: number
          received?: boolean
          received_at?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sku_id?: string
          status?: string | null
          supplier?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbound_restock_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "mv_sku_metrics"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "inbound_restock_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_restock_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_lines: {
        Row: {
          carrier: string | null
          description: string | null
          id: string
          invoice_id: string
          line_type: string | null
          quantity: number | null
          shipment_count: number
          tenant_id: string
          total_eur: number
          unit_price_eur: number | null
          vat_amount: number | null
          weight_max_grams: number | null
          weight_min_grams: number | null
        }
        Insert: {
          carrier?: string | null
          description?: string | null
          id?: string
          invoice_id: string
          line_type?: string | null
          quantity?: number | null
          shipment_count?: number
          tenant_id: string
          total_eur?: number
          unit_price_eur?: number | null
          vat_amount?: number | null
          weight_max_grams?: number | null
          weight_min_grams?: number | null
        }
        Update: {
          carrier?: string | null
          description?: string | null
          id?: string
          invoice_id?: string
          line_type?: string | null
          quantity?: number | null
          shipment_count?: number
          tenant_id?: string
          total_eur?: number
          unit_price_eur?: number | null
          vat_amount?: number | null
          weight_max_grams?: number | null
          weight_min_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_lines_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices_monthly"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_lines_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices_monthly: {
        Row: {
          created_at: string
          free_returns_count: number | null
          id: string
          invoice_number: string | null
          missing_pricing_count: number
          month: string
          reception_quarters: number | null
          returns_count: number | null
          status: Database["public"]["Enums"]["invoice_status"]
          storage_m3: number | null
          subtotal_ht: number | null
          tenant_id: string
          total_eur: number
          total_ttc: number | null
          vat_amount: number | null
        }
        Insert: {
          created_at?: string
          free_returns_count?: number | null
          id?: string
          invoice_number?: string | null
          missing_pricing_count?: number
          month: string
          reception_quarters?: number | null
          returns_count?: number | null
          status?: Database["public"]["Enums"]["invoice_status"]
          storage_m3?: number | null
          subtotal_ht?: number | null
          tenant_id: string
          total_eur?: number
          total_ttc?: number | null
          vat_amount?: number | null
        }
        Update: {
          created_at?: string
          free_returns_count?: number | null
          id?: string
          invoice_number?: string | null
          missing_pricing_count?: number
          month?: string
          reception_quarters?: number | null
          returns_count?: number | null
          status?: Database["public"]["Enums"]["invoice_status"]
          storage_m3?: number | null
          subtotal_ht?: number | null
          tenant_id?: string
          total_eur?: number
          total_ttc?: number | null
          vat_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_monthly_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      location_assignments: {
        Row: {
          assigned_at: string
          id: string
          location_id: string
          note: string | null
          sku_id: string
          tenant_id: string
        }
        Insert: {
          assigned_at?: string
          id?: string
          location_id: string
          note?: string | null
          sku_id: string
          tenant_id: string
        }
        Update: {
          assigned_at?: string
          id?: string
          location_id?: string
          note?: string | null
          sku_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_assignments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_assignments_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "mv_sku_metrics"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "location_assignments_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "location_assignments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          active: boolean
          allee: string | null
          code: string
          col_number: number | null
          content: string | null
          created_at: string
          expiry_date: string | null
          hauteur_max: string | null
          height_level: string | null
          id: string
          label: string | null
          max_weight_kg: number | null
          rack: string | null
          row_number: number | null
          status: string | null
          tenant_id: string
          zone_code: string | null
        }
        Insert: {
          active?: boolean
          allee?: string | null
          code: string
          col_number?: number | null
          content?: string | null
          created_at?: string
          expiry_date?: string | null
          hauteur_max?: string | null
          height_level?: string | null
          id?: string
          label?: string | null
          max_weight_kg?: number | null
          rack?: string | null
          row_number?: number | null
          status?: string | null
          tenant_id: string
          zone_code?: string | null
        }
        Update: {
          active?: boolean
          allee?: string | null
          code?: string
          col_number?: number | null
          content?: string | null
          created_at?: string
          expiry_date?: string | null
          hauteur_max?: string | null
          height_level?: string | null
          id?: string
          label?: string | null
          max_weight_kg?: number | null
          rack?: string | null
          row_number?: number | null
          status?: string | null
          tenant_id?: string
          zone_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rules: {
        Row: {
          carrier: string
          created_at: string
          destination: string | null
          id: string
          price_eur: number
          tenant_id: string
          weight_max_grams: number
          weight_min_grams: number
        }
        Insert: {
          carrier: string
          created_at?: string
          destination?: string | null
          id?: string
          price_eur: number
          tenant_id: string
          weight_max_grams: number
          weight_min_grams: number
        }
        Update: {
          carrier?: string
          created_at?: string
          destination?: string | null
          id?: string
          price_eur?: number
          tenant_id?: string
          weight_max_grams?: number
          weight_min_grams?: number
        }
        Relationships: [
          {
            foreignKeyName: "pricing_rules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          tenant_id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          tenant_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      returns: {
        Row: {
          announced_at: string | null
          carrier: string | null
          created_at: string
          delivered_at: string | null
          id: string
          order_ref: string | null
          original_shipment_id: string | null
          raw_json: Json | null
          restock_note: string | null
          restock_qty: number | null
          restock_status: string | null
          restocked_at: string | null
          restocked_by: string | null
          return_reason: string | null
          return_reason_comment: string | null
          sendcloud_id: string
          sendcloud_return_id: string | null
          sender_address: string | null
          sender_city: string | null
          sender_company: string | null
          sender_country_code: string | null
          sender_email: string | null
          sender_name: string | null
          sender_phone: string | null
          sender_postal_code: string | null
          service: string | null
          status: string
          status_message: string | null
          tenant_id: string
          tracking_number: string | null
          tracking_url: string | null
        }
        Insert: {
          announced_at?: string | null
          carrier?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          order_ref?: string | null
          original_shipment_id?: string | null
          raw_json?: Json | null
          restock_note?: string | null
          restock_qty?: number | null
          restock_status?: string | null
          restocked_at?: string | null
          restocked_by?: string | null
          return_reason?: string | null
          return_reason_comment?: string | null
          sendcloud_id: string
          sendcloud_return_id?: string | null
          sender_address?: string | null
          sender_city?: string | null
          sender_company?: string | null
          sender_country_code?: string | null
          sender_email?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          sender_postal_code?: string | null
          service?: string | null
          status?: string
          status_message?: string | null
          tenant_id: string
          tracking_number?: string | null
          tracking_url?: string | null
        }
        Update: {
          announced_at?: string | null
          carrier?: string | null
          created_at?: string
          delivered_at?: string | null
          id?: string
          order_ref?: string | null
          original_shipment_id?: string | null
          raw_json?: Json | null
          restock_note?: string | null
          restock_qty?: number | null
          restock_status?: string | null
          restocked_at?: string | null
          restocked_by?: string | null
          return_reason?: string | null
          return_reason_comment?: string | null
          sendcloud_id?: string
          sendcloud_return_id?: string | null
          sender_address?: string | null
          sender_city?: string | null
          sender_company?: string | null
          sender_country_code?: string | null
          sender_email?: string | null
          sender_name?: string | null
          sender_phone?: string | null
          sender_postal_code?: string | null
          service?: string | null
          status?: string
          status_message?: string | null
          tenant_id?: string
          tracking_number?: string | null
          tracking_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "returns_original_shipment_id_fkey"
            columns: ["original_shipment_id"]
            isOneToOne: false
            referencedRelation: "mv_shopify_anomaly_items"
            referencedColumns: ["shipment_id"]
          },
          {
            foreignKeyName: "returns_original_shipment_id_fkey"
            columns: ["original_shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "returns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sendcloud_sku_mappings: {
        Row: {
          created_at: string
          description_pattern: string
          id: string
          sku_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          description_pattern: string
          id?: string
          sku_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          description_pattern?: string
          id?: string
          sku_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sendcloud_sku_mappings_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "mv_sku_metrics"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sendcloud_sku_mappings_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sendcloud_sku_mappings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      shipment_items: {
        Row: {
          id: string
          qty: number
          shipment_id: string
          sku_id: string
          tenant_id: string
        }
        Insert: {
          id?: string
          qty?: number
          shipment_id: string
          sku_id: string
          tenant_id: string
        }
        Update: {
          id?: string
          qty?: number
          shipment_id?: string
          sku_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_items_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "mv_shopify_anomaly_items"
            referencedColumns: ["shipment_id"]
          },
          {
            foreignKeyName: "shipment_items_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "mv_sku_metrics"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "shipment_items_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          carrier: string
          city: string | null
          collo_count: number | null
          computed_cost_eur: number | null
          country_code: string | null
          country_name: string | null
          created_at: string
          currency: string | null
          date_announced: string | null
          date_created: string | null
          date_updated: string | null
          error_message: string | null
          external_order_id: string | null
          has_error: boolean | null
          height_cm: number | null
          house_number: string | null
          id: string
          is_return: boolean | null
          label_url: string | null
          length_cm: number | null
          order_ref: string | null
          postal_code: string | null
          pricing_status: Database["public"]["Enums"]["pricing_status"]
          raw_json: Json | null
          recipient_company: string | null
          recipient_email: string | null
          recipient_name: string | null
          recipient_phone: string | null
          reconcile_checked_at: string | null
          sendcloud_id: string
          service: string | null
          service_point_id: string | null
          shipped_at: string
          status_id: number | null
          status_message: string | null
          stock_consumed_at: string | null
          tenant_id: string
          total_value: number | null
          tracking: string | null
          tracking_url: string | null
          unmapped_items: Json | null
          weight_grams: number
          width_cm: number | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          carrier: string
          city?: string | null
          collo_count?: number | null
          computed_cost_eur?: number | null
          country_code?: string | null
          country_name?: string | null
          created_at?: string
          currency?: string | null
          date_announced?: string | null
          date_created?: string | null
          date_updated?: string | null
          error_message?: string | null
          external_order_id?: string | null
          has_error?: boolean | null
          height_cm?: number | null
          house_number?: string | null
          id?: string
          is_return?: boolean | null
          label_url?: string | null
          length_cm?: number | null
          order_ref?: string | null
          postal_code?: string | null
          pricing_status?: Database["public"]["Enums"]["pricing_status"]
          raw_json?: Json | null
          recipient_company?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          reconcile_checked_at?: string | null
          sendcloud_id: string
          service?: string | null
          service_point_id?: string | null
          shipped_at: string
          status_id?: number | null
          status_message?: string | null
          stock_consumed_at?: string | null
          tenant_id: string
          total_value?: number | null
          tracking?: string | null
          tracking_url?: string | null
          unmapped_items?: Json | null
          weight_grams: number
          width_cm?: number | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          carrier?: string
          city?: string | null
          collo_count?: number | null
          computed_cost_eur?: number | null
          country_code?: string | null
          country_name?: string | null
          created_at?: string
          currency?: string | null
          date_announced?: string | null
          date_created?: string | null
          date_updated?: string | null
          error_message?: string | null
          external_order_id?: string | null
          has_error?: boolean | null
          height_cm?: number | null
          house_number?: string | null
          id?: string
          is_return?: boolean | null
          label_url?: string | null
          length_cm?: number | null
          order_ref?: string | null
          postal_code?: string | null
          pricing_status?: Database["public"]["Enums"]["pricing_status"]
          raw_json?: Json | null
          recipient_company?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          recipient_phone?: string | null
          reconcile_checked_at?: string | null
          sendcloud_id?: string
          service?: string | null
          service_point_id?: string | null
          shipped_at?: string
          status_id?: number | null
          status_message?: string | null
          stock_consumed_at?: string | null
          tenant_id?: string
          total_value?: number | null
          tracking?: string | null
          tracking_url?: string | null
          unmapped_items?: Json | null
          weight_grams?: number
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sku_mappings: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          match_type: string
          pattern: string
          source: string
          target_sku_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          match_type?: string
          pattern: string
          source: string
          target_sku_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          match_type?: string
          pattern?: string
          source?: string
          target_sku_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sku_mappings_target_sku_id_fkey"
            columns: ["target_sku_id"]
            isOneToOne: false
            referencedRelation: "mv_sku_metrics"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "sku_mappings_target_sku_id_fkey"
            columns: ["target_sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sku_mappings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      skus: {
        Row: {
          active: boolean
          alert_threshold: number | null
          created_at: string
          description: string | null
          gtin: string | null
          id: string
          name: string
          sendcloud_filter: string | null
          shopify_variant_id: string | null
          sku_code: string
          tenant_id: string
          unit_price_eur: number | null
          updated_at: string
          volume_m3: number | null
          weight_grams: number | null
        }
        Insert: {
          active?: boolean
          alert_threshold?: number | null
          created_at?: string
          description?: string | null
          gtin?: string | null
          id?: string
          name: string
          sendcloud_filter?: string | null
          shopify_variant_id?: string | null
          sku_code: string
          tenant_id: string
          unit_price_eur?: number | null
          updated_at?: string
          volume_m3?: number | null
          weight_grams?: number | null
        }
        Update: {
          active?: boolean
          alert_threshold?: number | null
          created_at?: string
          description?: string | null
          gtin?: string | null
          id?: string
          name?: string
          sendcloud_filter?: string | null
          shopify_variant_id?: string | null
          sku_code?: string
          tenant_id?: string
          unit_price_eur?: number | null
          updated_at?: string
          volume_m3?: number | null
          weight_grams?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "skus_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          adjustment: number
          created_at: string
          id: string
          movement_type: string
          qty_after: number
          qty_before: number
          reason: string | null
          reference_id: string | null
          reference_type: string | null
          sku_id: string
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          adjustment: number
          created_at?: string
          id?: string
          movement_type: string
          qty_after: number
          qty_before: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          sku_id: string
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          adjustment?: number
          created_at?: string
          id?: string
          movement_type?: string
          qty_after?: number
          qty_before?: number
          reason?: string | null
          reference_id?: string | null
          reference_type?: string | null
          sku_id?: string
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "mv_sku_metrics"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "stock_movements_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_snapshots: {
        Row: {
          id: string
          qty_current: number
          sku_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          id?: string
          qty_current?: number
          sku_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          id?: string
          qty_current?: number
          sku_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_snapshots_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "mv_sku_metrics"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "stock_snapshots_sku_id_fkey"
            columns: ["sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_snapshots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_runs: {
        Row: {
          cursor: string | null
          ended_at: string | null
          error_text: string | null
          id: string
          source: string
          started_at: string
          stats_json: Json | null
          status: Database["public"]["Enums"]["sync_status"]
          tenant_id: string
        }
        Insert: {
          cursor?: string | null
          ended_at?: string | null
          error_text?: string | null
          id?: string
          source?: string
          started_at?: string
          stats_json?: Json | null
          status?: Database["public"]["Enums"]["sync_status"]
          tenant_id: string
        }
        Update: {
          cursor?: string | null
          ended_at?: string | null
          error_text?: string | null
          id?: string
          source?: string
          started_at?: string
          stats_json?: Json | null
          status?: Database["public"]["Enums"]["sync_status"]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_runs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_billing_config: {
        Row: {
          arrivage_billing_mode: string | null
          arrivage_box_price_eur: number | null
          arrivage_palette_price_eur: number | null
          arrivage_unit_price_eur: number | null
          created_at: string | null
          free_returns_pct: number | null
          fuel_surcharge_pct: number | null
          id: string
          reception_fee_per_15min: number | null
          return_fee_eur: number | null
          software_fee_eur: number | null
          storage_fee_per_m3: number | null
          tenant_id: string
          updated_at: string | null
          vat_rate_pct: number | null
        }
        Insert: {
          arrivage_billing_mode?: string | null
          arrivage_box_price_eur?: number | null
          arrivage_palette_price_eur?: number | null
          arrivage_unit_price_eur?: number | null
          created_at?: string | null
          free_returns_pct?: number | null
          fuel_surcharge_pct?: number | null
          id?: string
          reception_fee_per_15min?: number | null
          return_fee_eur?: number | null
          software_fee_eur?: number | null
          storage_fee_per_m3?: number | null
          tenant_id: string
          updated_at?: string | null
          vat_rate_pct?: number | null
        }
        Update: {
          arrivage_billing_mode?: string | null
          arrivage_box_price_eur?: number | null
          arrivage_palette_price_eur?: number | null
          arrivage_unit_price_eur?: number | null
          created_at?: string | null
          free_returns_pct?: number | null
          fuel_surcharge_pct?: number | null
          id?: string
          reception_fee_per_15min?: number | null
          return_fee_eur?: number | null
          software_fee_eur?: number | null
          storage_fee_per_m3?: number | null
          tenant_id?: string
          updated_at?: string | null
          vat_rate_pct?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_billing_config_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_invitations: {
        Row: {
          created_at: string | null
          email: string
          expires_at: string | null
          id: string
          invited_by: string | null
          role: string
          tenant_id: string
          used_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          role: string
          tenant_id: string
          used_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          invited_by?: string | null
          role?: string
          tenant_id?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tenant_invitations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_settings: {
        Row: {
          bank_details: string | null
          company_address: string | null
          company_city: string | null
          company_country: string | null
          company_email: string | null
          company_name: string | null
          company_phone: string | null
          company_postal_code: string | null
          company_siret: string | null
          company_vat_number: string | null
          created_at: string
          default_hs_code: string | null
          default_origin_country: string | null
          default_vat_rate: number | null
          id: string
          invoice_bank_details: string | null
          invoice_next_number: number | null
          invoice_payment_terms: string | null
          invoice_prefix: string | null
          payment_terms: string | null
          sendcloud_api_key: string | null
          sendcloud_secret: string | null
          sendcloud_webhook_secret: string | null
          sync_enabled: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          bank_details?: string | null
          company_address?: string | null
          company_city?: string | null
          company_country?: string | null
          company_email?: string | null
          company_name?: string | null
          company_phone?: string | null
          company_postal_code?: string | null
          company_siret?: string | null
          company_vat_number?: string | null
          created_at?: string
          default_hs_code?: string | null
          default_origin_country?: string | null
          default_vat_rate?: number | null
          id?: string
          invoice_bank_details?: string | null
          invoice_next_number?: number | null
          invoice_payment_terms?: string | null
          invoice_prefix?: string | null
          payment_terms?: string | null
          sendcloud_api_key?: string | null
          sendcloud_secret?: string | null
          sendcloud_webhook_secret?: string | null
          sync_enabled?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          bank_details?: string | null
          company_address?: string | null
          company_city?: string | null
          company_country?: string | null
          company_email?: string | null
          company_name?: string | null
          company_phone?: string | null
          company_postal_code?: string | null
          company_siret?: string | null
          company_vat_number?: string | null
          created_at?: string
          default_hs_code?: string | null
          default_origin_country?: string | null
          default_vat_rate?: number | null
          id?: string
          invoice_bank_details?: string | null
          invoice_next_number?: number | null
          invoice_payment_terms?: string | null
          invoice_prefix?: string | null
          payment_terms?: string | null
          sendcloud_api_key?: string | null
          sendcloud_secret?: string | null
          sendcloud_webhook_secret?: string | null
          sync_enabled?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          address: string | null
          city: string | null
          code: string | null
          country: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          phone: string | null
          postal_code: string | null
          siren: string | null
          siret: string | null
          vat_number: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          code?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          phone?: string | null
          postal_code?: string | null
          siren?: string | null
          siret?: string | null
          vat_number?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          code?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          phone?: string | null
          postal_code?: string | null
          siren?: string | null
          siret?: string | null
          vat_number?: string | null
        }
        Relationships: []
      }
      unmapped_items: {
        Row: {
          created_at: string | null
          id: string
          qty: number
          raw_description: string | null
          raw_product_id: string | null
          raw_sku: string | null
          raw_variant_id: string | null
          resolved_at: string | null
          resolved_sku_id: string | null
          shipment_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          qty?: number
          raw_description?: string | null
          raw_product_id?: string | null
          raw_sku?: string | null
          raw_variant_id?: string | null
          resolved_at?: string | null
          resolved_sku_id?: string | null
          shipment_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          qty?: number
          raw_description?: string | null
          raw_product_id?: string | null
          raw_sku?: string | null
          raw_variant_id?: string | null
          resolved_at?: string | null
          resolved_sku_id?: string | null
          shipment_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unmapped_items_resolved_sku_id_fkey"
            columns: ["resolved_sku_id"]
            isOneToOne: false
            referencedRelation: "mv_sku_metrics"
            referencedColumns: ["sku_id"]
          },
          {
            foreignKeyName: "unmapped_items_resolved_sku_id_fkey"
            columns: ["resolved_sku_id"]
            isOneToOne: false
            referencedRelation: "skus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unmapped_items_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "mv_shopify_anomaly_items"
            referencedColumns: ["shipment_id"]
          },
          {
            foreignKeyName: "unmapped_items_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unmapped_items_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      mv_dashboard_daily: {
        Row: {
          day: string | null
          shipments_cost: number | null
          shipments_count: number | null
          shipments_missing_pricing: number | null
          shipments_priced: number | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_shopify_anomaly_items: {
        Row: {
          anomaly_type: string | null
          order_ref: string | null
          qty: number | null
          raw_description: string | null
          raw_sku: string | null
          recipient_name: string | null
          shipment_id: string | null
          shipped_at: string | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      mv_sku_metrics: {
        Row: {
          alert_threshold: number | null
          avg_daily_90d: number | null
          consumption_30d: number | null
          consumption_90d: number | null
          days_remaining: number | null
          is_bundle: boolean | null
          name: string | null
          pending_restock: number | null
          projected_stock: number | null
          qty_current: number | null
          sku_code: string | null
          sku_id: string | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "skus_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      v_physical_shipment_items: {
        Row: {
          includes_bundle: boolean | null
          is_return: boolean | null
          original_qty: number | null
          physical_qty: number | null
          shipment_id: string | null
          shipped_at: string | null
          sku_id: string | null
          status_message: string | null
          tenant_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      analytics_monthly_shipments: {
        Args: { p_end_date: string; p_start_date: string; p_tenant_id: string }
        Returns: {
          claims: number
          cost: number
          indemnity: number
          month: string
          shipments: number
        }[]
      }
      analytics_sku_sales: {
        Args: { p_end_date: string; p_start_date: string; p_tenant_id: string }
        Returns: {
          name: string
          quantity_sold: number
          sku_code: string
          sku_id: string
        }[]
      }
      apply_stock_delta: {
        Args: {
          p_delta: number
          p_movement_type?: string
          p_reason?: string
          p_reference_id?: string
          p_reference_type?: string
          p_sku_id: string
          p_tenant_id: string
          p_user_id?: string
        }
        Returns: {
          qty_after: number
          qty_before: number
          sku_id: string
          was_bundle: boolean
        }[]
      }
      cleanup_old_sync_runs: { Args: { p_days?: number }; Returns: number }
      cleanup_resolved_unmapped_items: {
        Args: { p_days?: number }
        Returns: number
      }
      consume_shipment_stock: {
        Args: { p_shipment_id: string; p_tenant_id: string }
        Returns: {
          consumed: boolean
          item_count: number
        }[]
      }
      detect_shopify_anomalies: {
        Args: { p_tenant_id: string }
        Returns: {
          anomaly_type: string
          nb_occurrences: number
          raw_description: string
          raw_sku: string
          sample_order_refs: string[]
          total_qty: number
        }[]
      }
      get_all_claims: {
        Args: { p_tenant_id: string }
        Returns: {
          auto_created: boolean
          claim_type: string
          created_at: string
          decided_at: string
          decision_note: string
          description: string
          id: string
          indemnity_eur: number
          opened_at: string
          order_ref: string
          priority: string
          resolution_deadline: string
          sendcloud_status_id: number
          sendcloud_status_message: string
          shipment_carrier: string
          shipment_id: string
          shipment_order_ref: string
          shipment_sendcloud_id: string
          status: string
          tenant_id: string
        }[]
      }
      get_carrier_performance: {
        Args: { p_end_date: string; p_start_date: string; p_tenant_id: string }
        Returns: {
          avg_cost: number
          carrier: string
          claim_rate: number
          claims: number
          shipments: number
          total_cost: number
        }[]
      }
      get_daily_shipments_aggregated: {
        Args: { p_end_date: string; p_start_date: string; p_tenant_id: string }
        Returns: {
          cost: number
          day: string
          shipments: number
        }[]
      }
      get_dashboard_metrics: {
        Args: {
          p_month_end: string
          p_month_start: string
          p_tenant_id: string
          p_yesterday: string
        }
        Returns: {
          day: string
          metric: string
          shipments_cost: number
          shipments_count: number
          shipments_missing_pricing: number
        }[]
      }
      get_last_sync_cursor:
        | { Args: { p_tenant_id: string }; Returns: string }
        | { Args: { p_source?: string; p_tenant_id: string }; Returns: string }
      get_monthly_indemnities: {
        Args: { p_end_date: string; p_start_date: string; p_tenant_id: string }
        Returns: {
          indemnity_eur: number
        }[]
      }
      get_my_profile: {
        Args: never
        Returns: {
          email: string
          full_name: string
          id: string
          role: string
          tenant_id: string
        }[]
      }
      get_products_metrics: {
        Args: {
          p_end_date: string
          p_limit?: number
          p_start_date: string
          p_tenant_id: string
        }
        Returns: Json
      }
      get_shipment_stats: {
        Args: {
          p_carrier?: string
          p_delivery_status?: string
          p_from?: string
          p_pricing_status?: string
          p_search?: string
          p_shipment_status?: string
          p_tenant_id: string
          p_to?: string
        }
        Returns: Json
      }
      get_shipping_price: {
        Args: { p_carrier: string; p_tenant_id: string; p_weight_grams: number }
        Returns: number
      }
      get_sku_consumption_metrics: {
        Args: { p_tenant_id: string }
        Returns: {
          sku_id: string
          total_qty_30d: number
          total_qty_90d: number
        }[]
      }
      get_tenant_id: { Args: never; Returns: string }
      is_super_admin: { Args: never; Returns: boolean }
      map_shipment_item: {
        Args: {
          p_raw_description: string
          p_raw_sku: string
          p_raw_variant_id: string
          p_tenant_id: string
        }
        Returns: string
      }
      map_shipment_items_batch: {
        Args: { p_items: Json; p_tenant_id: string }
        Returns: {
          item_index: number
          sku_id: string
        }[]
      }
      normalize_label: { Args: { p_txt: string }; Returns: string }
      reconcile_stuck_candidates: {
        Args: { p_limit: number; p_tenant_id: string }
        Returns: {
          id: string
          order_ref: string
          sendcloud_id: string
        }[]
      }
      refresh_all_analytics_views: { Args: never; Returns: undefined }
      refresh_dashboard_daily: { Args: never; Returns: undefined }
      refresh_physical_items_view: { Args: never; Returns: undefined }
      refresh_shopify_anomaly_items: { Args: never; Returns: undefined }
      refresh_sku_metrics: { Args: never; Returns: undefined }
      release_cron_tenant_lock: {
        Args: { p_tenant_id: string }
        Returns: boolean
      }
      remap_unmapped_items:
        | {
            Args: { p_tenant_id: string }
            Returns: {
              resolved: number
              still_unmapped: number
            }[]
          }
        | {
            Args: { p_limit?: number; p_tenant_id: string }
            Returns: {
              resolved: number
              still_unmapped: number
            }[]
          }
      reverse_duplicate_shipment_stock: {
        Args: { p_shipment_ids: string[]; p_tenant_id: string }
        Returns: {
          shipments_deleted: number
          skus_reversed: number
          units_reversed: number
        }[]
      }
      suggest_skus_for_label: {
        Args: {
          p_raw_description: string
          p_raw_sku: string
          p_raw_variant_id: string
          p_tenant_id: string
        }
        Returns: {
          name: string
          score: number
          sku_code: string
          sku_id: string
        }[]
      }
      try_cron_tenant_lock: { Args: { p_tenant_id: string }; Returns: boolean }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      claim_priority: "low" | "normal" | "high" | "urgent"
      claim_status:
        | "ouverte"
        | "en_analyse"
        | "indemnisee"
        | "refusee"
        | "cloturee"
      claim_type:
        | "lost"
        | "damaged"
        | "delay"
        | "wrong_content"
        | "missing_items"
        | "other"
      invoice_status: "draft" | "validated" | "sent" | "paid"
      pricing_status: "ok" | "missing"
      return_reason:
        | "refund"
        | "exchange"
        | "defective"
        | "wrong_item"
        | "not_as_described"
        | "other"
      return_status:
        | "announced"
        | "ready"
        | "in_transit"
        | "delivered"
        | "cancelled"
      sync_status: "running" | "success" | "partial" | "failed"
      user_role: "super_admin" | "admin" | "ops" | "sav" | "client"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      claim_priority: ["low", "normal", "high", "urgent"],
      claim_status: [
        "ouverte",
        "en_analyse",
        "indemnisee",
        "refusee",
        "cloturee",
      ],
      claim_type: [
        "lost",
        "damaged",
        "delay",
        "wrong_content",
        "missing_items",
        "other",
      ],
      invoice_status: ["draft", "validated", "sent", "paid"],
      pricing_status: ["ok", "missing"],
      return_reason: [
        "refund",
        "exchange",
        "defective",
        "wrong_item",
        "not_as_described",
        "other",
      ],
      return_status: [
        "announced",
        "ready",
        "in_transit",
        "delivered",
        "cancelled",
      ],
      sync_status: ["running", "success", "partial", "failed"],
      user_role: ["super_admin", "admin", "ops", "sav", "client"],
    },
  },
} as const
