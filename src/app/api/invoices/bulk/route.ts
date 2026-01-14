import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/supabase/auth'

type BulkAction = 'mark_paid' | 'mark_sent' | 'delete'

interface BulkRequest {
  action: BulkAction
  ids: string[]
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth()
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
      case 'mark_paid': {
        const { error } = await db
          .from('invoices_monthly')
          .update({ status: 'paid' })
          .in('id', ids)
          .eq('status', 'sent') // Only sent invoices can be marked paid

        if (error) throw error
        message = `${ids.length} facture(s) marquée(s) payée(s)`
        break
      }

      case 'mark_sent': {
        const { error } = await db
          .from('invoices_monthly')
          .update({ status: 'sent' })
          .in('id', ids)
          .eq('status', 'draft') // Only draft invoices can be marked sent

        if (error) throw error
        message = `${ids.length} facture(s) marquée(s) envoyée(s)`
        break
      }

      case 'delete': {
        // Only delete draft invoices
        const { error } = await db
          .from('invoices_monthly')
          .delete()
          .in('id', ids)
          .eq('status', 'draft')

        if (error) throw error
        message = `${ids.length} facture(s) supprimée(s)`
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
    console.error('[Bulk Invoices] Error:', error)
    return NextResponse.json(
      { error: 'Erreur lors de l\'opération en masse' },
      { status: 500 }
    )
  }
}
