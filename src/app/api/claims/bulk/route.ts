import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth, getCurrentUser } from '@/lib/supabase/auth'

type BulkAction = 'en_analyse' | 'close' | 'refuse' | 'delete'

interface BulkRequest {
  action: BulkAction
  ids: string[]
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth()
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
          .in('id', ids)

        if (error) throw error
        message = `${ids.length} réclamation(s) refusée(s)`
        break
      }

      case 'delete': {
        const { error } = await db
          .from('claims')
          .delete()
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
    console.error('[Bulk Claims] Error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'opération en masse' },
      { status: 500 }
    )
  }
}
