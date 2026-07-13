import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/supabase/untyped'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  // Verifie la connectivite DB mais on garde volontairement un HTTP 200 : renvoyer
  // 503 sur un blip Supabase transitoire ferait flapper/restart l'instance Render.
  // L'etat DB est remonte dans le corps (a surveiller par le monitoring).
  let db: 'ok' | 'unreachable' = 'ok'
  let dbLatencyMs: number | null = null
  const started = Date.now()
  try {
    const admin = getAdminDb()
    const { error } = await admin.from('tenants').select('id').limit(1)
    dbLatencyMs = Date.now() - started
    if (error) db = 'unreachable'
  } catch {
    db = 'unreachable'
    dbLatencyMs = Date.now() - started
  }

  return NextResponse.json(
    {
      status: 'ok',
      db,
      dbLatencyMs,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    }
  )
}
