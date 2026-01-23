import { NextResponse } from 'next/server'
import { getServerDb } from '@/lib/supabase/untyped'
import { getFastTenantId } from '@/lib/supabase/fast-auth'

export async function GET() {
  try {
    const tenantId = await getFastTenantId()
    if (!tenantId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    const supabase = await getServerDb()

    const { data: locations, error } = await supabase
      .from('locations')
      .select(`
        id,
        code,
        label,
        active,
        zone_code,
        row_number,
        col_number,
        height_level,
        content,
        expiry_date,
        status,
        max_weight_kg,
        assignment:location_assignments(
          assigned_at,
          sku:skus(sku_code, name, stock_snapshots(qty_current))
        )
      `)
      .eq('tenant_id', tenantId)
      .order('zone_code')
      .order('row_number')
      .order('col_number')
      .order('height_level', { ascending: false })

    if (error) {
      throw error
    }

    // Flatten assignment (only one per location)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formattedLocations = locations?.map((loc: any) => ({
      ...loc,
      assignment: loc.assignment?.[0] || null,
    }))

    return NextResponse.json({ locations: formattedLocations }, {
      headers: {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=300'
      }
    })
  } catch (error) {
    console.error('Get locations error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const tenantId = await getFastTenantId()
    if (!tenantId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    const supabase = await getServerDb()
    const body = await request.json()

    const { data: location, error } = await supabase
      .from('locations')
      .insert({
        tenant_id: tenantId,
        code: body.code,
        label: body.label || null,
        active: body.active ?? true,
      })
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true, location })
  } catch (error) {
    console.error('Create location error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
