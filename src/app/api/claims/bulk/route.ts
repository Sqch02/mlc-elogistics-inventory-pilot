import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireTenant, getCurrentUser, requireRole } from '@/lib/supabase/auth'
import { handleAuthError } from '@/lib/api/errors'

type BulkAction = 'en_analyse' | 'close' | 'refuse' | 'delete'

interface BulkRequest {
  action: BulkAction
  ids: string[]
}

export async function POST(request: NextRequest) {
  try {
    // Le module SAV (creation/cloture/refus/suppression en masse) est reserve
    // aux roles internes; un role 'client' ne doit pas modifier ni bulk-delete.
    await requireRole(['super_admin', 'admin', 'ops', 'sav'])
    const tenantId = await requireTenant()
    const profile = await getCurrentUser()
    const supabase = await createClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const body = await request.json() as BulkRequest

    const { action, ids } = body

    if (!action || !ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: 'Action et IDs requis' },
        { status: 400 }
      )
    }

    if (ids.length > 100) {
      return NextResponse.json(
        { error: 'Maximum 100 éléments à la fois' },
        { status: 400 }
      )
    }

    let message: string

    switch (action) {
      case 'en_analyse': {
        const { error } = await db
          .from('claims')
          .update({ status: 'en_analyse' })
          .eq('tenant_id', tenantId)
          .in('id', ids)
          .eq('status', 'ouverte')

        if (error) throw error
        message = `${ids.length} réclamation(s) en cours d'analyse`
        break
      }

      case 'close': {
        const { error } = await db
          .from('claims')
          .update({
            status: 'cloturee',
            decided_at: new Date().toISOString(),
            decided_by: profile?.id,
          })
          .eq('tenant_id', tenantId)
          .in('id', ids)

        if (error) throw error
        message = `${ids.length} réclamation(s) clôturée(s)`
        break
      }

      case 'refuse': {
        const { error } = await db
          .from('claims')
          .update({
            status: 'refusee',
            decided_at: new Date().toISOString(),
            decided_by: profile?.id,
          })
          .eq('tenant_id', tenantId)
          .in('id', ids)

        if (error) throw error
        message = `${ids.length} réclamation(s) refusée(s)`
        break
      }

      case 'delete': {
        const { error } = await db
          .from('claims')
          .delete()
          .eq('tenant_id', tenantId)
          .in('id', ids)
          .eq('status', 'ouverte')

        if (error) throw error
        message = `${ids.length} réclamation(s) supprimée(s)`
        break
      }

      default:
        return NextResponse.json(
          { error: 'Action non reconnue' },
          { status: 400 }
        )
    }

    return NextResponse.json({
      success: true,
      message,
      count: ids.length,
    })

  } catch (error) {

    const authResponse = handleAuthError(error)

    if (authResponse) return authResponse
    console.error('[Bulk Claims] Error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'opération en masse' },
      { status: 500 }
    )
  }
}
