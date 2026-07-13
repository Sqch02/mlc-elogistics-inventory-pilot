import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/supabase/untyped'
import { requireRole, requireTenant } from '@/lib/supabase/auth'
import { handleAuthError } from '@/lib/api/errors'

interface UnmappedRow {
  id: string
  shipment_id: string
  raw_sku: string | null
  raw_description: string | null
  raw_variant_id: string | null
  qty: number
  created_at: string | null
}

interface ShipmentRow {
  id: string
  order_ref: string | null
}

export interface SkuSuggestion {
  sku_id: string
  sku_code: string
  name: string
  score: number
}

export interface UnmappedGroup {
  raw_sku: string | null
  raw_description: string | null
  raw_variant_id: string | null
  total_qty: number
  nb_shipments: number
  first_seen: string | null
  last_seen: string | null
  sample_orders: string[]
  suggestions: SkuSuggestion[]
}

// GET /api/mapping/unmapped - Aggregated unmapped items for the current tenant
// Admin-only: clients should not see internal mapping issues
export async function GET() {
  try {
    await requireRole(['admin', 'super_admin'])
    const tenantId = await requireTenant()
    const adminClient = getAdminDb()

    // Fetch all unresolved unmapped items for this tenant
    const { data: rows, error } = await adminClient
      .from('unmapped_items')
      .select('id, shipment_id, raw_sku, raw_description, raw_variant_id, qty, created_at')
      .eq('tenant_id', tenantId)
      .is('resolved_at', null)
      .order('created_at', { ascending: false })

    if (error) throw error

    const items: UnmappedRow[] = rows || []

    // Collect shipment IDs to fetch order_ref
    const shipmentIds = Array.from(new Set(items.map((i) => i.shipment_id).filter(Boolean)))

    const shipmentRefs = new Map<string, string | null>()
    if (shipmentIds.length > 0) {
      const { data: shipments } = await adminClient
        .from('shipments')
        .select('id, order_ref')
        .in('id', shipmentIds)

      for (const s of (shipments || []) as ShipmentRow[]) {
        shipmentRefs.set(s.id, s.order_ref)
      }
    }

    // Group by (raw_sku, raw_description, raw_variant_id)
    const groupMap = new Map<
      string,
      {
        raw_sku: string | null
        raw_description: string | null
        raw_variant_id: string | null
        total_qty: number
        shipment_ids: Set<string>
        first_seen: string | null
        last_seen: string | null
        order_refs: string[]
      }
    >()

    for (const item of items) {
      const key = [
        item.raw_sku ?? '',
        item.raw_description ?? '',
        item.raw_variant_id ?? '',
      ].join('||')

      const existing = groupMap.get(key)
      const orderRef = shipmentRefs.get(item.shipment_id) ?? null

      if (existing) {
        existing.total_qty += item.qty || 0
        existing.shipment_ids.add(item.shipment_id)
        if (item.created_at) {
          if (!existing.first_seen || item.created_at < existing.first_seen) {
            existing.first_seen = item.created_at
          }
          if (!existing.last_seen || item.created_at > existing.last_seen) {
            existing.last_seen = item.created_at
          }
        }
        if (orderRef && existing.order_refs.length < 5 && !existing.order_refs.includes(orderRef)) {
          existing.order_refs.push(orderRef)
        }
      } else {
        groupMap.set(key, {
          raw_sku: item.raw_sku,
          raw_description: item.raw_description,
          raw_variant_id: item.raw_variant_id,
          total_qty: item.qty || 0,
          shipment_ids: new Set([item.shipment_id]),
          first_seen: item.created_at,
          last_seen: item.created_at,
          order_refs: orderRef ? [orderRef] : [],
        })
      }
    }

    const baseGroups = Array.from(groupMap.values())
      .map((g) => ({
        raw_sku: g.raw_sku,
        raw_description: g.raw_description,
        raw_variant_id: g.raw_variant_id,
        total_qty: g.total_qty,
        nb_shipments: g.shipment_ids.size,
        first_seen: g.first_seen,
        last_seen: g.last_seen,
        sample_orders: g.order_refs,
      }))
      .sort((a, b) => b.total_qty - a.total_qty)

    // Couche 3: attach a best-guess product suggestion to each group so the
    // admin can valider en 1 clic (suggest_skus_for_label = mots-cles + trigram).
    const groups: UnmappedGroup[] = await Promise.all(
      baseGroups.map(async (g) => {
        let suggestions: SkuSuggestion[] = []
        try {
          const { data: sugg } = await adminClient.rpc('suggest_skus_for_label', {
            p_tenant_id: tenantId,
            p_raw_sku: g.raw_sku ?? '',
            p_raw_description: g.raw_description ?? '',
            p_raw_variant_id: g.raw_variant_id ?? '',
          })
          suggestions = (sugg || []).map(
            (s) => ({ sku_id: s.sku_id, sku_code: s.sku_code, name: s.name, score: Number(s.score) })
          )
        } catch (e) {
          console.error('[api/mapping/unmapped] suggestion error:', e)
        }
        return { ...g, suggestions }
      })
    )

    return NextResponse.json({ groups })
  } catch (error) {
    const authResponse = handleAuthError(error)
    if (authResponse) return authResponse
    console.error('[api/mapping/unmapped] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
