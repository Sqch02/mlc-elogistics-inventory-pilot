import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireTenant, requireRole } from '@/lib/supabase/auth'

// GET: List distinct carriers across shipments and pricing_rules
export async function GET() {
  try {
    const tenantId = await requireTenant()
    const adminClient = createAdminClient()

    // Get distinct carriers from shipments
    const { data: shipmentCarriers } = await adminClient
      .from('shipments')
      .select('carrier')
      .eq('tenant_id', tenantId)
      .not('carrier', 'is', null)

    // Get distinct carriers from pricing_rules
    const { data: pricingCarriers } = await adminClient
      .from('pricing_rules')
      .select('carrier')
      .eq('tenant_id', tenantId)

    // Merge and deduplicate
    const carrierSet = new Map<string, { shipmentCount: number; pricingCount: number }>()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const row of (shipmentCarriers || []) as any[]) {
      const name = (row.carrier as string || '').trim()
      if (!name) continue
      const key = name.toLowerCase()
      const existing = carrierSet.get(key) || { shipmentCount: 0, pricingCount: 0 }
      existing.shipmentCount++
      carrierSet.set(key, existing)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const row of (pricingCarriers || []) as any[]) {
      const name = (row.carrier as string || '').trim()
      if (!name) continue
      const key = name.toLowerCase()
      const existing = carrierSet.get(key) || { shipmentCount: 0, pricingCount: 0 }
      existing.pricingCount++
      carrierSet.set(key, existing)
    }

    const carriers = Array.from(carrierSet.entries())
      .map(([key, stats]) => ({
        name: key,
        shipmentCount: stats.shipmentCount,
        pricingRuleCount: stats.pricingCount,
      }))
      .sort((a, b) => b.shipmentCount - a.shipmentCount)

    return NextResponse.json({ carriers })
  } catch (error) {
    console.error('Carriers error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PATCH: Rename a carrier (cascading update on shipments + pricing_rules)
export async function PATCH(request: NextRequest) {
  try {
    const tenantId = await requireTenant()
    await requireRole(['super_admin', 'admin', 'ops'])
    const adminClient = createAdminClient()

    const { oldName, newName } = await request.json()

    if (!oldName || !newName) {
      return NextResponse.json(
        { error: 'oldName et newName sont requis' },
        { status: 400 }
      )
    }

    const trimmedNew = newName.trim()
    if (!trimmedNew) {
      return NextResponse.json(
        { error: 'Le nouveau nom ne peut pas etre vide' },
        { status: 400 }
      )
    }

    // Update shipments
    const { count: shipmentCount } = await adminClient
      .from('shipments')
      .update({ carrier: trimmedNew } as never)
      .eq('tenant_id', tenantId)
      .ilike('carrier', oldName)

    // Update pricing_rules
    const { count: pricingCount } = await adminClient
      .from('pricing_rules')
      .update({ carrier: trimmedNew } as never)
      .eq('tenant_id', tenantId)
      .ilike('carrier', oldName)

    return NextResponse.json({
      success: true,
      message: `Transporteur renomme: "${oldName}" → "${trimmedNew}"`,
      updated: {
        shipments: shipmentCount || 0,
        pricingRules: pricingCount || 0,
      },
    })
  } catch (error) {
    console.error('Carrier rename error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
