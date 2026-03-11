import { NextResponse } from 'next/server'
import { getServerDb } from '@/lib/supabase/untyped'
import { requireTenant } from '@/lib/supabase/auth'

export async function GET() {
  try {
    const tenantId = await requireTenant()
    const supabase = await getServerDb()

    const { data, error } = await supabase
      .from('shipments')
      .select('carrier')
      .eq('tenant_id', tenantId)
      .not('carrier', 'is', null)

    if (error) throw error

    const carriers = [...new Set((data || []).map((s: { carrier: string }) => s.carrier))].sort()

    return NextResponse.json({ carriers })
  } catch (error) {
    console.error('Carriers error:', error)
    return NextResponse.json({ carriers: [] })
  }
}
