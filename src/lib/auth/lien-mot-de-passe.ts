import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Lien qui permet a un utilisateur de choisir son mot de passe.
 *
 * Sert a trois parcours : le client qui a oublie son mot de passe, le compte
 * cree sans mot de passe depuis l'administration, et le lien de
 * reinitialisation emis par un administrateur.
 *
 * POURQUOI PAS LE LIEN DE SUPABASE TEL QUEL
 * Le lien brut (`action_link`) passe par Supabase puis renvoie vers le site
 * avec la session dans le fragment de l'URL. Aucune page de l'application ne
 * la recuperait : l'utilisateur arrivait connecte une fois, sans jamais
 * pouvoir choisir de mot de passe, donc sans pouvoir revenir. On construit
 * donc notre propre lien vers `/nouveau-mot-de-passe`, avec le jeton haché,
 * que la page valide seulement quand l'utilisateur soumet son mot de passe.
 *
 * POURQUOI TOUJOURS « recovery »
 * Supabase refuse un lien de type « invite » pour un compte qui existe deja,
 * or l'administration cree le compte juste avant de demander le lien. Constate
 * le 04/10 : le lien d'invitation n'avait jamais pu etre genere. Le type
 * « recovery » fonctionne sur un compte existant et mene au meme ecran.
 */

/** Seules origines vers lesquelles un lien peut pointer. */
export const ORIGINES_AUTORISEES = [
  'https://app.homemade-elogistics.com',
  'https://mlc-elogistics-inventory-pilot.onrender.com',
  'http://localhost:3000',
] as const

export const ORIGINE_PAR_DEFAUT = 'https://app.homemade-elogistics.com'

/**
 * L'origine du lien. On ne fait jamais confiance a l'en-tete de la requete :
 * une origine hors liste retombe sur le domaine client, sinon une requete
 * forgee ferait envoyer a un client un lien vers un site tiers.
 */
export function origineDuLien(origineDemandee: string | null | undefined): string {
  const candidate = (origineDemandee ?? '').replace(/\/+$/, '')
  return (ORIGINES_AUTORISEES as readonly string[]).includes(candidate) ? candidate : ORIGINE_PAR_DEFAUT
}

export function construireLien(origine: string, jetonHache: string): string {
  return `${origineDuLien(origine)}/nouveau-mot-de-passe?token_hash=${encodeURIComponent(jetonHache)}`
}

/**
 * Genere le lien pour une adresse. Renvoie null si Supabase refuse : adresse
 * inconnue, compte supprime, service indisponible.
 */
export async function genererLienMotDePasse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any>,
  email: string,
  origine: string | null | undefined,
): Promise<string | null> {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'recovery', email })
  const jeton = data?.properties?.hashed_token
  if (error || !jeton) return null
  return construireLien(origineDuLien(origine), jeton)
}
