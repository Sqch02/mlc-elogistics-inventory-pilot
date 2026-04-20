import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/supabase/untyped'
import { requireTenant } from '@/lib/supabase/auth'

export type AnomalyType =
  | 'order_ref_as_description'
  | 'empty_sku'
  | 'sku_with_spaces'
  | 'sku_with_accents'

interface RpcRow {
  anomaly_type: AnomalyType
  raw_sku: string | null
  raw_description: string | null
  nb_occurrences: number | string
  total_qty: number | string
  sample_order_refs: string[] | null
}

interface ShipmentInfoRow {
  order_ref: string | null
  shipped_at: string | null
  recipient_name: string | null
}

export interface SampleOrder {
  order_ref: string
  date: string | null
  client: string | null
}

export interface AnomalyGroup {
  type: AnomalyType
  raw_sku: string | null
  raw_description: string | null
  nb_occurrences: number
  total_qty: number
  sample_orders: SampleOrder[]
  suggested_action: string
}

function toInt(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0
  const n = typeof value === 'string' ? parseInt(value, 10) : value
  return Number.isFinite(n) ? n : 0
}

function suggestedAction(type: AnomalyType, rawDescription: string | null, rawSku: string | null): string {
  switch (type) {
    case 'order_ref_as_description':
      return `Le champ "description" contient un numero de commande (${rawDescription ?? ''}) au lieu du nom du produit. Corriger la fiche produit dans Shopify > Produits.`
    case 'empty_sku':
      return `Le champ SKU est vide dans Shopify pour le produit "${rawDescription ?? ''}". Ouvrir Shopify > Produits > ${rawDescription ?? ''} et renseigner un code SKU.`
    case 'sku_with_spaces':
      return `Le champ SKU contient des espaces ("${rawSku ?? ''}"), il s'agit probablement d'un nom de produit. Remplacer par un vrai code SKU dans Shopify > Produits > ${rawDescription ?? rawSku ?? ''}.`
    case 'sku_with_accents':
      return `Le champ SKU contient des accents ("${rawSku ?? ''}"), les codes SKU ne doivent pas contenir d'accents. Corriger dans Shopify > Produits > ${rawDescription ?? rawSku ?? ''}.`
    default:
      return 'Corriger la fiche produit dans Shopify.'
  }
}

// GET /api/mapping/anomalies - Detect Shopify product data issues
export async function GET() {
  try {
    const tenantId = await requireTenant()
    const adminClient = getAdminDb()

    const { data: rpcData, error: rpcError } = await adminClient.rpc(
      'detect_shopify_anomalies',
      { p_tenant_id: tenantId }
    )

    if (rpcError) throw rpcError

    const rows: RpcRow[] = (rpcData || []) as RpcRow[]

    // Collect all sample order_refs so we can fetch date + client in one batch
    const allOrderRefs = new Set<string>()
    for (const row of rows) {
      for (const ref of row.sample_order_refs || []) {
        if (ref) allOrderRefs.add(ref)
      }
    }

    const orderInfoMap = new Map<string, ShipmentInfoRow>()
    if (allOrderRefs.size > 0) {
      const { data: shipments } = await adminClient
        .from('shipments')
        .select('order_ref, shipped_at, recipient_name')
        .eq('tenant_id', tenantId)
        .in('order_ref', Array.from(allOrderRefs))

      for (const s of (shipments || []) as ShipmentInfoRow[]) {
        if (s.order_ref && !orderInfoMap.has(s.order_ref)) {
          orderInfoMap.set(s.order_ref, s)
        }
      }
    }

    const anomalies: AnomalyGroup[] = rows.map((row) => {
      const refs = (row.sample_order_refs || []).filter((r): r is string => !!r)
      const sampleOrders: SampleOrder[] = refs.map((ref) => {
        const info = orderInfoMap.get(ref)
        return {
          order_ref: ref,
          date: info?.shipped_at ?? null,
          client: info?.recipient_name ?? null,
        }
      })

      return {
        type: row.anomaly_type,
        raw_sku: row.raw_sku,
        raw_description: row.raw_description,
        nb_occurrences: toInt(row.nb_occurrences),
        total_qty: toInt(row.total_qty),
        sample_orders: sampleOrders,
        suggested_action: suggestedAction(row.anomaly_type, row.raw_description, row.raw_sku),
      }
    })

    return NextResponse.json({
      anomalies,
      total_anomalies: anomalies.length,
    })
  } catch (error) {
    console.error('[api/mapping/anomalies] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
