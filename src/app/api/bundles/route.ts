import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServerDb } from '@/lib/supabase/untyped'
import { requireTenant } from '@/lib/supabase/auth'

export async function GET() {
  try {
    const tenantId = await requireTenant()
    const supabase = await createClient()

    const { data: bundles, error } = await supabase
      .from('bundles')
      .select(`
        id,
        bundle_sku_id,
        bundle_sku:skus!bundle_sku_id(sku_code, name),
        components:bundle_components(
          id,
          qty_component,
          component_sku_id,
          component_sku:skus!component_sku_id(sku_code, name)
        )
      `)
      .eq('tenant_id', tenantId)

    if (error) {
      throw error
    }

    return NextResponse.json({ bundles })
  } catch (error) {
    console.error('Get bundles error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// POST /api/bundles - Create a new bundle
export async function POST(request: NextRequest) {
  try {
    const tenantId = await requireTenant()
    const supabase = await getServerDb()
    const body = await request.json()

    const { bundle_sku_code, components } = body

    if (!bundle_sku_code) {
      return NextResponse.json(
        { error: 'bundle_sku_code est requis' },
        { status: 400 }
      )
    }

    if (!components || !Array.isArray(components) || components.length === 0) {
      return NextResponse.json(
        { error: 'Au moins un composant est requis' },
        { status: 400 }
      )
    }

    // Find or create bundle SKU
    let { data: bundleSku } = await supabase
      .from('skus')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('sku_code', bundle_sku_code)
      .single()

    if (!bundleSku) {
      // Create the bundle SKU
      const { data: newSku, error: skuError } = await supabase
        .from('skus')
        .insert({
          tenant_id: tenantId,
          sku_code: bundle_sku_code,
          name: `Bundle ${bundle_sku_code}`,
        })
        .select('id')
        .single()

      if (skuError) throw skuError
      bundleSku = newSku
    }

    // Check if bundle already exists
    const { data: existingBundle } = await supabase
      .from('bundles')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('bundle_sku_id', bundleSku.id)
      .single()

    if (existingBundle) {
      return NextResponse.json(
        { error: 'Ce bundle existe déjà' },
        { status: 409 }
      )
    }

    // Create bundle
    const { data: bundle, error: bundleError } = await supabase
      .from('bundles')
      .insert({
        tenant_id: tenantId,
        bundle_sku_id: bundleSku.id,
      })
      .select('id')
      .single()

    if (bundleError) throw bundleError

    // Validate all component SKUs exist first
    const missingSkus: string[] = []
    const validComponents: Array<{ sku_id: string; qty: number }> = []

    for (const comp of components) {
      const { data: componentSku } = await supabase
        .from('skus')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('sku_code', comp.sku_code)
        .single()

      if (!componentSku) {
        missingSkus.push(comp.sku_code)
      } else {
        validComponents.push({
          sku_id: componentSku.id,
          qty: comp.qty || 1
        })
      }
    }

    // Return error if any SKUs are missing
    if (missingSkus.length > 0) {
      // Rollback: delete the bundle we just created
      await supabase.from('bundles').delete().eq('id', bundle.id)
      return NextResponse.json({
        error: `SKUs composants non trouvés: ${missingSkus.join(', ')}`,
        missing_skus: missingSkus
      }, { status: 400 })
    }

    // Add validated components
    for (const comp of validComponents) {
      await supabase.from('bundle_components').insert({
        tenant_id: tenantId,
        bundle_id: bundle.id,
        component_sku_id: comp.sku_id,
        qty_component: comp.qty,
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Bundle créé avec succès',
      bundle_id: bundle.id
    })
  } catch (error) {
    console.error('Error creating bundle:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
