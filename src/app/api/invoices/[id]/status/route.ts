import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/supabase/untyped'
import { requireTenant, requireRole } from '@/lib/supabase/auth'
import { handleAuthError } from '@/lib/api/errors'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // L'autorisation vient EN PREMIER, et le tenant est celui de la session :
    // il n'est jamais lu depuis la requete. Le service technique n'est
    // instancie qu'apres, une fois le perimetre etabli.
    await requireRole(['super_admin', 'admin', 'ops'])
    const tenantId = await requireTenant()
    const { id } = await params
    const { status } = await request.json()

    // Validate status
    if (!['draft', 'sent', 'paid'].includes(status)) {
      return NextResponse.json(
        { error: 'Statut invalide' },
        { status: 400 }
      )
    }

    // La transition et la mise en file de la notification se font dans la MEME
    // transaction. Si la facture ne passe pas a "envoyee", aucune notification
    // n'existe ; si la notification ne peut pas etre inseree, la transition
    // n'a pas lieu. L'envoi, lui, est asynchrone et son echec n'annule rien.
    //
    // La RPC ne met en file que sur la TRANSITION draft -> sent : repasser une
    // facture deja envoyee en "envoyee" ne la renvoie pas.
    // La transition passe par une fonction reservee au service technique :
    // elle prend un tenant en parametre, donc l'ouvrir aux comptes connectes
    // permettrait a l'un d'eux d'agir sur les factures d'un autre client.
    // C'est la raison du service role ici — et pourquoi il n'arrive qu'apres
    // requireRole et requireTenant.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getAdminDb() as any
    const { data, error } = await db.rpc('set_invoice_status_notifying', {
      p_tenant_id: tenantId,
      p_invoice_id: id,
      p_status: status,
    })

    if (error) {
      throw error
    }

    const resultat = Array.isArray(data) ? data[0] : data
    return NextResponse.json({
      success: true,
      status,
      notification_queued: resultat?.notification_queued ?? false,
    })
  } catch (error) {
    const authResponse = handleAuthError(error)
    if (authResponse) return authResponse
    console.error('Update invoice status error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
