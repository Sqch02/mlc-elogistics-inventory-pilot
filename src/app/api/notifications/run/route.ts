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
  const result = await runNotificationOutboxWorker(
    getAdminDb() as never,
    process.env,
    sender ?? undefined,
  )

  return NextResponse.json(result)
}
