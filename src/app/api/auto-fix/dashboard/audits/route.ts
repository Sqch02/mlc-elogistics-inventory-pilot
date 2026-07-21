import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { handleAuthError } from '@/lib/api/errors'
import { readAutoFixAuditPage } from '@/lib/auto-fix/dashboard-query'
import { requireRole, requireTenant } from '@/lib/supabase/auth'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  limit: z.coerce.number().int().min(10).max(50).default(25),
  cursor: z.string().datetime({ offset: true }),
})

export async function GET(request: NextRequest) {
  try {
    await requireRole(['super_admin', 'admin', 'ops'])
    const tenantId = await requireTenant()
    const parsed = querySchema.safeParse({
      limit: request.nextUrl.searchParams.get('limit') ?? undefined,
      cursor: request.nextUrl.searchParams.get('cursor') || undefined,
    })
    if (!parsed.success) {
      return NextResponse.json({ error: 'Pagination invalide' }, { status: 400 })
    }

    const readClient = await createClient()
    const page = await readAutoFixAuditPage(readClient, tenantId, {
      auditLimit: parsed.data.limit,
      auditCursor: parsed.data.cursor,
    })
    return NextResponse.json(page, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    const authResponse = handleAuthError(error)
    if (authResponse) return authResponse
    console.error('Get auto-fix audit page error:', error)
    return NextResponse.json({ error: 'Impossible de charger les audits simulés' }, { status: 500 })
  }
}
