import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { handleAuthError } from '@/lib/api/errors'
import { readAutoFixDashboard } from '@/lib/auto-fix/dashboard-query'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole, requireTenant } from '@/lib/supabase/auth'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const querySchema = z.object({
  limit: z.coerce.number().int().min(10).max(50).default(25),
  cursor: z.string().datetime({ offset: true }).optional(),
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

    // Both clients are created after authorization. Auto-fix tables use the
    // authenticated client (RLS + explicit tenant scope). The admin client is
    // limited to tenant_settings, whose existing RLS is super-admin-only.
    const [readClient, settingsClient] = await Promise.all([
      createClient(),
      Promise.resolve(createAdminClient()),
    ])
    const dashboard = await readAutoFixDashboard(
      readClient,
      settingsClient,
      tenantId,
      { auditLimit: parsed.data.limit, auditCursor: parsed.data.cursor },
      process.env,
    )

    return NextResponse.json(dashboard, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (error) {
    const authResponse = handleAuthError(error)
    if (authResponse) return authResponse
    console.error('Get auto-fix dashboard error:', error)
    return NextResponse.json({ error: 'Impossible de charger les corrections automatiques' }, { status: 500 })
  }
}
