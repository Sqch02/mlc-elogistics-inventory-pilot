import { NextRequest, NextResponse } from 'next/server'
import { getServerDb } from '@/lib/supabase/untyped'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireTenant } from '@/lib/supabase/auth'

interface PhysicalItem {
  physical_qty: number | null
}

// Fetch all physical shipment items for a SKU in a date range with pagination.
// Uses v_physical_shipment_items so bundles are decomposed into physical components
// (i.e. the SKU's monthly volume includes quantities shipped as part of bundles).
async function fetchAllShipmentItems(
  tenantId: string,
  skuId: string,
  startDate: Date,
  endDate: Date
): Promise<PhysicalItem[]> {
  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = adminClient as any
  const allItems: PhysicalItem[] = []
  const pageSize = 1000
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const { data, error } = await db
      .from('v_physical_shipment_items')
      .select('physical_qty')
      .eq('tenant_id', tenantId)
      .eq('sku_id', skuId)
      .eq('is_return', false)
      .gte('shipped_at', startDate.toISOString())
      .lte('shipped_at', endDate.toISOString())
      .range(offset, offset + pageSize - 1)

    if (error) {
      console.error('Error fetching shipment items:', error)
      break
    }

    if (data && data.length > 0) {
      allItems.push(...data)
      if (data.length < pageSize) {
        hasMore = false
      } else {
        offset += pageSize
      }
    } else {
      hasMore = false
    }
  }

  return allItems
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requireTenant()
    const supabase = await getServerDb()
    const { id } = await params

    // Get the SKU to find its sku_code
    const { data: sku, error: skuError } = await supabase
      .from('skus')
      .select('id, sku_code, name')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (skuError || !sku) {
      return NextResponse.json({ error: 'SKU non trouvé' }, { status: 404 })
    }

    // Get monthly volumes for the last 12 months (fetch all in parallel)
    const now = new Date()
    const monthSpecs = Array.from({ length: 12 }, (_, idx) => {
      const i = 11 - idx
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const monthLabel = date.toLocaleDateString('fr-FR', { month: 'short' }).toUpperCase()
      return { startOfMonth, endOfMonth, monthKey, monthLabel }
    })

    const months = await Promise.all(
      monthSpecs.map(async (spec) => {
        const items = await fetchAllShipmentItems(tenantId, id, spec.startOfMonth, spec.endOfMonth)
        const volume = items.reduce((sum: number, item: PhysicalItem) => sum + (item.physical_qty || 0), 0)
        return { month: spec.monthKey, label: spec.monthLabel, volume }
      })
    )

    // Calculate total and average
    const totalVolume = months.reduce((sum, m) => sum + m.volume, 0)
    const avgVolume = Math.round(totalVolume / 12)

    return NextResponse.json({
      sku: {
        id: sku.id,
        sku_code: sku.sku_code,
        name: sku.name,
      },
      months,
      totalVolume,
      avgVolume,
    }, {
      headers: {
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    console.error('Error fetching monthly volume:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
