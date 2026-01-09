import { NextRequest, NextResponse } from 'next/server'
import { getServerDb } from '@/lib/supabase/untyped'
import { requireTenant } from '@/lib/supabase/auth'

interface SKUWithStock {
  id: string
  sku_code: string
  name: string
  weight_grams: number | null
  alert_threshold: number
  created_at: string
  stock_snapshots: Array<{ qty_current: number; updated_at: string }> | null
}

// GET /api/skus - List all SKUs with stock
export async function GET() {
  try {
    const tenantId = await requireTenant()
    const supabase = await getServerDb()

    // Use left join (no !inner) to get all SKUs even without stock snapshots
    const { data, error } = await supabase
      .from('skus')
      .select(`
        id,
        sku_code,
        name,
        weight_grams,
        alert_threshold,
        created_at,
        stock_snapshots(qty_current, updated_at)
      `)
      .eq('tenant_id', tenantId)
      .eq('active', true)
      .order('sku_code')

    if (error) throw error

    const skus = (data || []).map((sku: SKUWithStock) => ({
      ...sku,
      qty_current: sku.stock_snapshots?.[0]?.qty_current || 0,
      stock_updated_at: sku.stock_snapshots?.[0]?.updated_at || null,
    }))

    return NextResponse.json({ skus })
  } catch (error) {
    console.error('Error fetching SKUs:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// POST /api/skus - Create a new SKU
export async function POST(request: NextRequest) {
  try {
    const tenantId = await requireTenant()
    const supabase = await getServerDb()
    const body = await request.json()

    const { sku_code, name, weight_grams, alert_threshold, qty_initial } = body

    if (!sku_code || !name) {
      return NextResponse.json(
        { error: 'sku_code et name sont requis' },
        { status: 400 }
      )
    }

    // Check if SKU already exists
    const { data: existing } = await supabase
      .from('skus')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('sku_code', sku_code)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: 'Ce code SKU existe déjà' },
        { status: 409 }
      )
    }

    // Create SKU
    const { data: sku, error: skuError } = await supabase
      .from('skus')
      .insert({
        tenant_id: tenantId,
        sku_code,
        name,
        weight_grams: weight_grams || null,
        alert_threshold: alert_threshold || 10,
      })
      .select()
      .single()

    if (skuError) throw skuError

    // Create initial stock snapshot
    const { error: stockError } = await supabase
      .from('stock_snapshots')
      .insert({
        tenant_id: tenantId,
        sku_id: sku.id,
        qty_current: qty_initial || 0,
      })

    if (stockError) {
      console.error('Error creating stock snapshot:', stockError)
    }

    return NextResponse.json({
      success: true,
      message: 'SKU créé avec succès',
      sku
    })
  } catch (error) {
    console.error('Error creating SKU:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
