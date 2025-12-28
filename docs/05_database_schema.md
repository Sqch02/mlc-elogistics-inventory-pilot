# Schéma base de données (proposition V1)

## Tables
- tenants
  - id (uuid)
  - name
  - created_at

- users (ou profils)
  - id (uuid)
  - tenant_id
  - role (admin, ops, sav)
  - email
  - created_at

- skus
  - id
  - tenant_id
  - sku_code (unique par tenant)
  - name
  - weight_grams (optionnel)
  - active

- stock_snapshots (ou stock_current)
  - id
  - tenant_id
  - sku_id
  - qty_current
  - updated_at

- inbound_restock
  - id
  - tenant_id
  - sku_id
  - qty
  - eta_date
  - note

- bundles
  - id
  - tenant_id
  - bundle_sku_id

- bundle_components
  - id
  - tenant_id
  - bundle_id
  - component_sku_id
  - qty_component

- locations
  - id
  - tenant_id
  - code (ex A-01-02)
  - label
  - active

- location_assignments
  - id
  - tenant_id
  - location_id
  - sku_id
  - assigned_at
  - note
  - Contrainte: unique(location_id) = 1 SKU par emplacement

- shipments
  - id
  - tenant_id
  - sendcloud_id (unique)
  - shipped_at
  - carrier
  - service
  - weight_grams
  - order_ref
  - tracking
  - raw_json (jsonb) optionnel

- shipment_items
  - id
  - tenant_id
  - shipment_id
  - sku_id
  - qty

- pricing_rules
  - id
  - tenant_id
  - carrier
  - weight_min_grams
  - weight_max_grams
  - price_eur

- invoices_monthly
  - id
  - tenant_id
  - month (YYYY-MM)
  - status (draft, validated)
  - total_eur
  - created_at

- invoice_lines
  - id
  - tenant_id
  - invoice_id
  - carrier
  - weight_min_grams
  - weight_max_grams
  - shipment_count
  - total_eur

- claims
  - id
  - tenant_id
  - shipment_id (nullable)
  - order_ref (nullable)
  - opened_at
  - status
  - indemnity_eur (nullable)
  - decision_note
  - decided_at (nullable)

- sync_runs
  - id
  - tenant_id
  - source (sendcloud)
  - started_at
  - ended_at
  - status (success, partial, failed)
  - stats_json
  - error_text
