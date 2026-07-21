import { NextRequest, NextResponse } from 'next/server'
import { runAutoFixDryRunWorker } from '@/lib/auto-fix'
import { getAdminDb } from '@/lib/supabase/untyped'
import { safeEqual } from '@/lib/utils/safe-compare'

export const dynamic = 'force-dynamic'

/**
 * Separate worker endpoint. There is deliberately no mode parameter and no
 * Sendcloud client import: this release can only plan and audit simulations.
 */
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }
  if (!safeEqual(request.headers.get('authorization'), `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Service role is instantiated only after endpoint authorization.
  const result = await runAutoFixDryRunWorker(getAdminDb(), process.env)
  return NextResponse.json(result)
}
