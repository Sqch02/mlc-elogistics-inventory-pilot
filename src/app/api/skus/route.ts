import { NextRequest, NextResponse } from 'next/server'
import { getServerDb, getAdminDb } from '@/lib/supabase/untyped'
import { requireTenant, getCurrentUser, requireRole } from '@/lib/supabase/auth'
import { auditCreate } from '@/lib/audit'

const MLC_ROOT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

interface SKUWithStock {
  id: string
  sku_code: string
  name: string
  weight_grams: number | null
  volume_m3: number | null
  alert_threshold: number
  created_at: string
  tenant_id?: string
  tenant?: { id: string; name: string; code: string } | null
  stock_snapshots: Array<{ qty_current: number; updated_at: string }> | null
}

// GET /api/skus - List all SKUs with stock (excludes bundle SKUs by default)
// Supports cross-tenant listing when the caller is on the MLC root tenant
// (used by the Emplacements page so an MLC operator can assign any client's SKU).
export async function GET(request: NextRequest) {
  try {
    const tenantId = await requireTenant()
    const isMlcRoot = tenantId === MLC_ROOT_TENANT_ID
    const crossTenant =
      isMlcRoot && request.nextUrl.searchParams.get('cross_tenant') === 'true'
    const supabase = crossTenant ? getAdminDb() : await getServerDb()
    const includeAll = request.nextUrl.searchParams.get('all') === 'true'

    let skuQuery = supabase
      .from('skus')
      .select(`
        id,
        sku_code,
        name,
        weight_grams,
        volume_m3,
        alert_threshold,
        created_at,
        tenant_id,
        tenant:tenants(id, name, code),
        stock_snapshots(qty_current, updated_at)
      `)
      .eq('active', true)
      .order('sku_code')

    if (!crossTenant) {
      skuQuery = skuQuery.eq('tenant_id', tenantId)
    }

    const { data, error } = await skuQuery

    if (error) throw error

    let filtered = data || []

    // Exclude bundles unless ?all=true
    if (!includeAll) {
      let bundlesQuery = supabase.from('bundles').select('bundle_sku_id')
      if (!crossTenant) {
        bundlesQuery = bundlesQuery.eq('tenant_id', tenantId)
      }
      const { data: bundles } = await bundlesQuery

      const bundleSkuIds = new Set((bundles || []).map((b: { bundle_sku_id: string }) => b.bundle_sku_id))

      filtered = filtered.filter((sku: SKUWithStock) => {
        if (bundleSkuIds.has(sku.id)) return false
        if (sku.sku_code.toUpperCase().includes('BU-') || sku.sku_code.toUpperCase().startsWith('BUNDLE')) return false
        return true
      })
    }

    const skus = filtered.map((sku: SKUWithStock) => ({
      id: sku.id,
      sku_code: sku.sku_code,
      name: sku.name,
      weight_grams: sku.weight_grams,
      volume_m3: sku.volume_m3,
      alert_threshold: sku.alert_threshold,
      created_at: sku.created_at,
      tenant_id: sku.tenant_id,
      tenant: sku.tenant || null,
      qty_current: sku.stock_snapshots?.[0]?.qty_current || 0,
      stock_updated_at: sku.stock_snapshots?.[0]?.updated_at || null,
    }))

    return NextResponse.json({ skus, crossTenant })
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
    // P1-secu: mutating route requires admin/ops role.
    await requireRole(['super_admin', 'admin', 'ops'])

    const tenantId = await requireTenant()
    const user = await getCurrentUser()
    const supabase = await getServerDb()
    const body = await request.json()

    const { sku_code, name, weight_grams, volume_m3, alert_threshold, qty_initial } = body

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

    // Create SKU — l'INSERT declenche le trigger remap_on_sku_insert qui peut
    // creer un snapshot avec qty_current negatif (decrement des ventes
    // historiques retro-mappees sur ce nouveau SKU). On UPSERT ensuite le
    // snapshot a la valeur "stock initial" saisie par l'utilisateur, qui
    // represente le stock physique reel au moment de la creation. L'historique
    // de consommation reste trace via shipment_items pour les analytics 30/90j.
    const { data: sku, error: skuError } = await supabase
      .from('skus')
      .insert({
        tenant_id: tenantId,
        sku_code,
        name,
        weight_grams: weight_grams || null,
        volume_m3: volume_m3 || null,
        alert_threshold: alert_threshold || 10,
      })
      .select()
      .single()

    if (skuError) throw skuError

    const initialQty = Number.isFinite(qty_initial) ? qty_initial : 0
    const { error: stockError } = await supabase
      .from('stock_snapshots')
      .upsert(
        {
          tenant_id: tenantId,
          sku_id: sku.id,
          qty_current: initialQty,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'sku_id' }
      )

    if (stockError) {
      console.error('Error setting initial stock snapshot:', stockError)
    }

    // Audit log
    await auditCreate(
      tenantId,
      user?.id || null,
      'sku',
      sku.id,
      sku,
      request.headers
    )

    // Refresh the SKU metrics materialized view so the new product appears in
    // the Produits & Stock list immediately (otherwise it only shows after the
    // next cron refresh, which surprised users creating their first SKU).
    try {
      await supabase.rpc('refresh_sku_metrics')
    } catch (refreshError) {
      // Non-blocking : the cron will pick it up at the next 5-min interval.
      console.error('[skus] refresh_sku_metrics failed:', refreshError)
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
