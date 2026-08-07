import { NextRequest, NextResponse } from 'next/server'
import { runNotificationOutboxWorker } from '@/lib/notifications/outbox'
import { resendSenderFromEnv } from '@/lib/notifications/resend-sender'
import { getAdminDb } from '@/lib/supabase/untyped'
import { safeEqual } from '@/lib/utils/safe-compare'

export const dynamic = 'force-dynamic'

/**
 * Vide la file de notifications.
 *
 * Sans fournisseur configure, le worker ne reclame RIEN — il ne se contente
 * pas d'echouer a l'envoi. La difference compte : reclamer puis echouer
 * consomme des tentatives et finirait par marquer en echec definitif des
 * messages parfaitement valides, simplement parce qu'une cle manquait.
 *
 * L'evenement a ete insere dans la meme transaction que la mutation metier ;
 * ici on ne fait qu'envoyer, et un echec ne peut plus rien annuler.
 */
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }
  if (!safeEqual(request.headers.get('authorization'), `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sender = resendSenderFromEnv(process.env)
  const db = getAdminDb()

  const result = await runNotificationOutboxWorker(
    db as never,
    process.env,
    sender ?? undefined,
    async (message) => {
      if (message.event_type !== 'invoice_sent') return []
      const invoiceId = message.payload.invoice_id
      if (typeof invoiceId !== 'string') return []

      const [{ buildInvoicePdfData }, { renderInvoicePdf }] = await Promise.all([
        import('@/lib/notifications/invoice-attachment'),
        import('@/lib/utils/invoice-pdf-server'),
      ])

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const untyped = db as any
      const { data: facture } = await untyped
        .from('invoices_monthly')
        .select('invoice_number, month, created_at, subtotal_ht, vat_amount, total_ttc, missing_pricing_count, invoice_lines(*)')
        .eq('id', invoiceId)
        .eq('tenant_id', message.tenant_id)
        .maybeSingle()
      if (!facture) return []

      const { data: reglages } = await untyped
        .from('tenant_settings').select('*').eq('tenant_id', message.tenant_id).maybeSingle()
      const { data: client } = await untyped
        .from('tenants').select('name').eq('id', message.tenant_id).maybeSingle()

      const donnees = buildInvoicePdfData(facture, reglages ?? null, client?.name ?? 'Client')
      if (!donnees) return []

      const rendu = await renderInvoicePdf(donnees)
      return [{
        filename: rendu.filename,
        content: rendu.bytes,
        contentType: rendu.contentType,
      }]
    },
  )

  return NextResponse.json(result)
}
