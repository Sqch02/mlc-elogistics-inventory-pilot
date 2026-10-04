import { createHash, randomUUID } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { genererLienMotDePasse } from '@/lib/auth/lien-mot-de-passe'
import { resendSenderFromEnv } from '@/lib/notifications/resend-sender'

/**
 * Traitement d'une demande « mot de passe oublie », execute apres la reponse
 * HTTP. Voir la route `/api/auth/mot-de-passe-oublie` pour les protections.
 */

export const empreinte = (valeur: string) => createHash('sha256').update(valeur).digest('hex')

export async function traiterDemande(email: string, ip: string, origine: string): Promise<'envoye' | 'limite' | 'inconnu' | 'non_configure' | 'echec'> {
  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = admin as any

  const { data: autorise, error: limiteError } = await db.rpc('password_reset_allowed', {
    p_email_hash: empreinte(email),
    p_ip_hash: empreinte(ip),
  })
  if (limiteError) throw limiteError
  if (autorise !== true) return 'limite'

  // On ne genere un lien que pour un compte rattache a un client : un compte
  // d'authentification sans profil n'a acces a rien.
  const { data: profil } = await db
    .from('profiles')
    .select('id, tenant_id')
    // `_` et `%` sont des jokers pour ilike, et `_` est courant dans une
    // adresse : sans echappement, « jean_dupont@x.fr » viserait aussi
    // « jeanXdupont@x.fr ».
    .ilike('email', email.replace(/[\\%_]/g, '\\$&'))
    .maybeSingle()
  if (!profil) return 'inconnu'

  const expediteur = resendSenderFromEnv(process.env)
  if (!expediteur) {
    console.error('[MotDePasseOublie] RESEND_API_KEY ou NOTIFICATION_FROM_EMAIL absent : rien ne peut partir')
    return 'non_configure'
  }

  const lien = await genererLienMotDePasse(admin, email, origine)
  if (!lien) return 'echec'

  const resultat = await expediteur.send({
    id: randomUUID(),
    tenant_id: profil.tenant_id,
    event_type: 'password_reset',
    recipient: email,
    cc: [],
    subject: 'HME Logistics - Choisir un nouveau mot de passe',
    payload: { link: lien },
    attempt_count: 0,
  })
  if (!resultat.ok) {
    console.error('[MotDePasseOublie] envoi refuse :', resultat.error)
    return 'echec'
  }
  return 'envoye'
}
