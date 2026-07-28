import { NextRequest, NextResponse } from 'next/server'
import { runAutoFixLiveWorker } from '@/lib/auto-fix/live-worker'
import { getAdminDb } from '@/lib/supabase/untyped'
import { safeEqual } from '@/lib/utils/safe-compare'
import type { SendcloudCredentials } from '@/lib/sendcloud/types'

export const dynamic = 'force-dynamic'

/**
 * Declenchement du moteur d'ecriture.
 *
 * ROUTE SEPAREE DE CELLE DE SIMULATION, ET C'EST DELIBERE. La route
 * /api/auto-fix/run n'importe aucun client Sendcloud : sa garantie de ne rien
 * ecrire tient a ce qu'elle n'en a pas les moyens. Ajouter un parametre `mode`
 * lui aurait fait perdre cette propriete, et une erreur d'appel serait devenue
 * une ecriture reelle.
 *
 * Cette route-ci n'ecrit toujours rien tant que AUTO_FIX_LIVE_ENABLED ne vaut
 * pas exactement 'true' ET qu'aucun client n'est en auto_fix_mode='live'. Les
 * deux conditions sont verifiees dans le worker, pas ici.
 */
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }
  if (!safeEqual(request.headers.get('authorization'), `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getAdminDb()

  // Le client typé expose un `rpc` restreint aux fonctions declarees, alors
  // que le worker appelle ses RPC par nom. La conversion est volontaire et
  // locale a l'appel.
  const rpcClient = db as unknown as Parameters<typeof runAutoFixLiveWorker>[0]

  const result = await runAutoFixLiveWorker(rpcClient, process.env, {
    async credentials(tenantId: string): Promise<SendcloudCredentials | null> {
      const { data } = await db
        .from('tenant_settings')
        .select('sendcloud_api_key, sendcloud_secret')
        .eq('tenant_id', tenantId)
        .single()
      if (!data?.sendcloud_api_key || !data?.sendcloud_secret) return null
      return { apiKey: data.sendcloud_api_key, secret: data.sendcloud_secret }
    },

    async readParcel(credentials, sendcloudId) {
      const { getParcel } = await import('@/lib/sendcloud/client')
      const reponse = await getParcel(credentials, sendcloudId)
      if (!reponse.success || !reponse.parcel) return null

      // Le worker raisonne sur la charge utile Sendcloud, pas sur notre forme
      // normalisee : c'est elle qui porte status.id et date_announced, dont
      // depend le refus d'ecrire sur un colis deja annonce.
      const raw = (reponse.parcel.raw_json ?? {}) as Record<string, unknown>
      const status = raw.status as { id?: number } | undefined

      return {
        ...raw,
        sendcloud_id: sendcloudId,
        status_id: typeof status?.id === 'number' ? status.id : null,
        // L'empreinte protege d'un colis modifie entre la detection et
        // l'ecriture. `updated_at` suffit a le detecter.
        fingerprint: String(raw.updated_at ?? ''),
        date_announced: (raw.date_announced as string | null) ?? null,
      }
    },

    /**
     * Le pont entre les deux mondes. La tache ne porte que le shipment_uuid, et
     * l'API v3 ne l'expose pas : le numero de commande vient de notre base.
     */
    async resolveOrderRef(tenantId: string, sendcloudId: string): Promise<string | null> {
      const { data } = await db
        .from('shipments')
        .select('order_ref')
        .eq('tenant_id', tenantId)
        .eq('sendcloud_id', sendcloudId)
        .maybeSingle()
      return data?.order_ref ?? null
    },
  })

  return NextResponse.json(result)
}
