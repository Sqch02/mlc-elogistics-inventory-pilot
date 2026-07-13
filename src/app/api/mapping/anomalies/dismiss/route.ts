import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/supabase/untyped'
import { requireRole, requireTenant } from '@/lib/supabase/auth'
import { handleAuthError } from '@/lib/api/errors'

interface DismissBody {
  anomaly_type: string
  raw_sku: string | null
  raw_description: string | null
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(['admin', 'super_admin'])
    const tenantId = await requireTenant()
    const body = (await request.json()) as DismissBody

    if (!body.anomaly_type) {
      return NextResponse.json(
        { error: 'anomaly_type requis' },
        { status: 400 }
      )
    }

    const db = getAdminDb()
    const { error } = await db
      .from('dismissed_anomalies')
      .upsert(
        {
          tenant_id: tenantId,
          anomaly_type: body.anomaly_type,
          raw_sku: body.raw_sku ?? null,
          raw_description: body.raw_description ?? null,
          dismissed_by: user.id,
        },
        {
          onConflict:
            'tenant_id,anomaly_type,COALESCE(raw_sku, \'\'),COALESCE(raw_description, \'\')',
          ignoreDuplicates: true,
        }
      )

    if (error) {
      // Fallback: do a plain insert and swallow duplicate errors
      const { error: insertErr } = await db.from('dismissed_anomalies').insert({
        tenant_id: tenantId,
        anomaly_type: body.anomaly_type,
        raw_sku: body.raw_sku ?? null,
        raw_description: body.raw_description ?? null,
        dismissed_by: user.id,
      })
      if (insertErr && !insertErr.message.includes('duplicate')) {
        throw insertErr
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const authResponse = handleAuthError(error)
    if (authResponse) return authResponse
    console.error('[api/mapping/anomalies/dismiss] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}

// Optional: DELETE to un-dismiss (admin tool, not wired in UI yet)
export async function DELETE(request: NextRequest) {
  try {
    await requireRole(['admin', 'super_admin'])
    const tenantId = await requireTenant()
    const body = (await request.json()) as DismissBody

    const db = getAdminDb()
    const { error } = await db
      .from('dismissed_anomalies')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('anomaly_type', body.anomaly_type)
      .eq('raw_sku', body.raw_sku ?? '')
      .eq('raw_description', body.raw_description ?? '')

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    const authResponse = handleAuthError(error)
    if (authResponse) return authResponse
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
