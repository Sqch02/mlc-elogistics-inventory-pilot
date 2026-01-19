import { NextRequest, NextResponse } from 'next/server'
import { getServerDb } from '@/lib/supabase/untyped'
import { requireTenant } from '@/lib/supabase/auth'

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

      // Get shipment items for this month
      const { data: items } = await supabase
        .from('shipment_items')
        .select('qty, shipments!inner(shipped_at)')
        .eq('sku_id', id)
        .gte('shipments.shipped_at', startOfMonth.toISOString())
        .lte('shipments.shipped_at', endOfMonth.toISOString())

      const volume = items?.reduce((sum: number, item: { qty: number | null }) => sum + (item.qty || 0), 0) || 0

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
