import { NextRequest, NextResponse } from 'next/server'
import { getServerDb } from '@/lib/supabase/untyped'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireTenant } from '@/lib/supabase/auth'

interface ShipmentItem {
  qty: number | null
}

// Fetch all shipment items for a SKU in a date range with pagination
async function fetchAllShipmentItems(
  skuId: string,
  startDate: Date,
  endDate: Date
): Promise<ShipmentItem[]> {
  const adminClient = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = adminClient as any
  const allItems: ShipmentItem[] = []
  const pageSize = 1000
  let offset = 0
  let hasMore = true

  while (hasMore) {
    const { data, error } = await db
      .from('shipment_items')
      .select('qty, shipments!inner(shipped_at)')
      .eq('sku_id', skuId)
      .gte('shipments.shipped_at', startDate.toISOString())
      .lte('shipments.shipped_at', endDate.toISOString())
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

    // Get monthly volumes for the last 12 months
    const now = new Date()
    const months: { month: string; label: string; volume: number }[] = []

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1)
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)

      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const monthLabel = date.toLocaleDateString('fr-FR', { month: 'short' }).toUpperCase()

      // Get ALL shipment items for this month (with pagination)
      const items = await fetchAllShipmentItems(id, startOfMonth, endOfMonth)

      const volume = items.reduce((sum: number, item: ShipmentItem) => sum + (item.qty || 0), 0)

      months.push({
        month: monthKey,
        label: monthLabel,
        volume,
      })
    }

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
    })
  } catch (error) {
    console.error('Error fetching monthly volume:', error)
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
