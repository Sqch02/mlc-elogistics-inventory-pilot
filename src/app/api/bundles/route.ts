import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
          qty_component,
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
