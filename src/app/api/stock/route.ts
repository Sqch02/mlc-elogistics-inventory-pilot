import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/supabase/auth'
import { handleAuthError } from '@/lib/api/errors'
import { calculateSKUMetrics } from '@/lib/utils/stock'

export async function GET(request: NextRequest) {
  try {
    const tenantId = await requireTenant()

    const searchParams = request.nextUrl.searchParams
    const skuId = searchParams.get('sku_id') || undefined

    const metrics = await calculateSKUMetrics(tenantId, skuId)

    return NextResponse.json({ metrics })
  } catch (error) {
    const authResponse = handleAuthError(error)
    if (authResponse) return authResponse
    console.error('Stock metrics error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
