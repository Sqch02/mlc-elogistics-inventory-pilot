import { NextRequest, NextResponse } from 'next/server'
import { getServerDb, getAdminDb } from '@/lib/supabase/untyped'
import { getFastTenantId } from '@/lib/supabase/fast-auth'

// The MLC master tenant owns the warehouse. When viewing Emplacements as MLC,
// we aggregate locations across all tenants so a single page covers the full
// physical warehouse (pallets can belong to any client).
const MLC_ROOT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

export async function GET(request: NextRequest) {
  try {
    const tenantId = await getFastTenantId()
    if (!tenantId) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const isMlcRoot = tenantId === MLC_ROOT_TENANT_ID
    // Cross-tenant reads bypass RLS cleanly via the admin client.
    const supabase = isMlcRoot ? getAdminDb() : await getServerDb()

    const searchParams = request.nextUrl.searchParams
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(2000, Math.max(1, parseInt(searchParams.get('limit') || '1000', 10)))
    const from = (page - 1) * limit
    const to = from + limit - 1

    let query = supabase
      .from('locations')
      .select(`
        id,
        tenant_id,
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
        tenant:tenants(id, name, code),
        assignment:location_assignments(
          assigned_at,
          sku:skus(id, sku_code, name, tenant_id, stock_snapshots(qty_current))
        )
      `, { count: 'exact' })
      .order('zone_code')
      .order('row_number')
      .order('col_number')
      .order('height_level', { ascending: false })
      .range(from, to)

    if (!isMlcRoot) {
      query = query.eq('tenant_id', tenantId)
    }

    const { data: locations, error, count } = await query

    if (error) {
      throw error
    }

    // Flatten assignment (only one per location)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const formattedLocations = locations?.map((loc: any) => ({
      ...loc,
      assignment: loc.assignment?.[0] || null,
    }))

    return NextResponse.json({
      locations: formattedLocations || [],
      total: count ?? (locations?.length || 0),
      page,
      limit,
      mlcRoot: isMlcRoot,
    }, {
      headers: {
        'Cache-Control': 'private, no-store'
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

    const isMlcRoot = tenantId === MLC_ROOT_TENANT_ID
    const supabase = isMlcRoot ? getAdminDb() : await getServerDb()
    const body = await request.json()

    // On MLC root view, allow the caller to specify which client owns the new
    // location (for clarity in listings). Default to MLC root otherwise.
    const targetTenantId =
      (isMlcRoot && typeof body.tenant_id === 'string' && body.tenant_id)
        ? body.tenant_id
        : tenantId

    const { data: location, error } = await supabase
      .from('locations')
      .insert({
        tenant_id: targetTenantId,
        code: body.code,
        label: body.label || null,
        active: body.active ?? true,
        content: body.content || null,
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
