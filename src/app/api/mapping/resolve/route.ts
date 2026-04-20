import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/supabase/untyped'
import { requireTenant, getCurrentUser } from '@/lib/supabase/auth'

type ResolveAction = 'map_to_sku' | 'create_sku' | 'add_rule'

interface ResolveBody {
  action: ResolveAction
  raw_sku?: string | null
  raw_description?: string | null
  raw_variant_id?: string | null
  target_sku_id?: string
  new_sku?: {
    sku_code: string
    name: string
  }
  rule?: {
    source: 'description' | 'variant_id' | 'sku_alias'
    pattern: string
    match_type: 'exact' | 'ilike' | 'contains'
  }
}

interface SkuRow {
  id: string
  sku_code: string
  name: string
}

interface InsertMappingPayload {
  tenant_id: string
  source: 'description' | 'variant_id' | 'sku_alias'
  pattern: string
  match_type: 'exact' | 'ilike' | 'contains'
  target_sku_id: string
  created_by?: string | null
}

// POST /api/mapping/resolve - Create a mapping rule or new SKU to resolve unmapped items
export async function POST(request: NextRequest) {
  try {
    const tenantId = await requireTenant()
    const user = await getCurrentUser()
    const db = getAdminDb()
    const body = (await request.json()) as ResolveBody

    if (!body || !body.action) {
      return NextResponse.json({ error: 'action requis' }, { status: 400 })
    }

    const rawSku = body.raw_sku ?? null
    const rawDescription = body.raw_description ?? null
    const rawVariantId = body.raw_variant_id ?? null

    // --- Helper: insert mapping rule inferred from the raw item data ----------
    const insertInferredMapping = async (targetSkuId: string) => {
      // Prefer variant_id, then sku_alias (raw_sku), then description
      let source: 'description' | 'variant_id' | 'sku_alias'
      let pattern: string | null = null
      let matchType: 'exact' | 'ilike' | 'contains' = 'exact'

      if (rawVariantId) {
        source = 'variant_id'
        pattern = rawVariantId
        matchType = 'exact'
      } else if (rawSku) {
        source = 'sku_alias'
        pattern = rawSku
        matchType = 'exact'
      } else if (rawDescription) {
        source = 'description'
        pattern = rawDescription
        matchType = 'ilike'
      } else {
        return null
      }

      const payload: InsertMappingPayload = {
        tenant_id: tenantId,
        source,
        pattern,
        match_type: matchType,
        target_sku_id: targetSkuId,
        created_by: user?.id ?? null,
      }

      const { data, error } = await db
        .from('sku_mappings')
        .insert(payload)
        .select()
        .single()

      if (error) {
        // Ignore unique-constraint violations - mapping already exists
        if (error.code === '23505') return null
        throw error
      }
      return data
    }

    // --- map_to_sku -----------------------------------------------------------
    if (body.action === 'map_to_sku') {
      if (!body.target_sku_id) {
        return NextResponse.json(
          { error: 'target_sku_id requis pour map_to_sku' },
          { status: 400 }
        )
      }

      // Verify the SKU belongs to the tenant
      const { data: sku, error: skuErr } = await db
        .from('skus')
        .select('id')
        .eq('id', body.target_sku_id)
        .eq('tenant_id', tenantId)
        .single()

      if (skuErr || !sku) {
        return NextResponse.json(
          { error: 'SKU introuvable pour ce tenant' },
          { status: 404 }
        )
      }

      const mapping = await insertInferredMapping(body.target_sku_id)
      return NextResponse.json({ success: true, mapping })
    }

    // --- create_sku -----------------------------------------------------------
    if (body.action === 'create_sku') {
      const newSku = body.new_sku
      if (!newSku?.sku_code || !newSku?.name) {
        return NextResponse.json(
          { error: 'new_sku.sku_code et new_sku.name requis' },
          { status: 400 }
        )
      }

      // Check duplicate
      const { data: existing } = await db
        .from('skus')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('sku_code', newSku.sku_code)
        .maybeSingle()

      let skuId: string
      if (existing) {
        skuId = (existing as SkuRow).id
      } else {
        const { data: created, error: createErr } = await db
          .from('skus')
          .insert({
            tenant_id: tenantId,
            sku_code: newSku.sku_code,
            name: newSku.name,
          })
          .select('id, sku_code, name')
          .single()

        if (createErr) throw createErr
        skuId = (created as SkuRow).id

        // Create initial stock snapshot (0)
        await db
          .from('stock_snapshots')
          .insert({
            tenant_id: tenantId,
            sku_id: skuId,
            qty_current: 0,
          })
      }

      const mapping = await insertInferredMapping(skuId)
      return NextResponse.json({ success: true, sku_id: skuId, mapping })
    }

    // --- add_rule -------------------------------------------------------------
    if (body.action === 'add_rule') {
      if (!body.target_sku_id) {
        return NextResponse.json(
          { error: 'target_sku_id requis pour add_rule' },
          { status: 400 }
        )
      }
      if (!body.rule || !body.rule.source || !body.rule.pattern || !body.rule.match_type) {
        return NextResponse.json(
          { error: 'rule.source, rule.pattern et rule.match_type requis' },
          { status: 400 }
        )
      }

      // Verify the SKU belongs to the tenant
      const { data: sku, error: skuErr } = await db
        .from('skus')
        .select('id')
        .eq('id', body.target_sku_id)
        .eq('tenant_id', tenantId)
        .single()

      if (skuErr || !sku) {
        return NextResponse.json(
          { error: 'SKU introuvable pour ce tenant' },
          { status: 404 }
        )
      }

      const payload: InsertMappingPayload = {
        tenant_id: tenantId,
        source: body.rule.source,
        pattern: body.rule.pattern,
        match_type: body.rule.match_type,
        target_sku_id: body.target_sku_id,
        created_by: user?.id ?? null,
      }

      const { data, error } = await db
        .from('sku_mappings')
        .insert(payload)
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          return NextResponse.json(
            { error: 'Cette regle existe deja' },
            { status: 409 }
          )
        }
        throw error
      }

      return NextResponse.json({ success: true, mapping: data })
    }

    return NextResponse.json(
      { error: `action inconnue: ${body.action}` },
      { status: 400 }
    )
  } catch (error) {
    console.error('[api/mapping/resolve] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
