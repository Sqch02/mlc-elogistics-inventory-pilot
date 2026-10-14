/**
 * Un compte desactive depuis l'administration est un compte BANNI dans
 * Supabase Auth (`banned_until` dans le futur), pas un drapeau du profil.
 *
 * Verifie le 14/10 en production sur un compte jetable : une fois banni,
 * Supabase refuse le compte a chaque appel, session deja ouverte comprise
 * (getUser, que le middleware appelle a chaque requete -> 403 user_banned),
 * ainsi que le rafraichissement de session, toute nouvelle connexion et le
 * jeton d'un lien de mot de passe.
 *
 * Prend le compte entier : le type `User` de @supabase/auth-js (2.89) ne
 * declare pas `banned_until`, que l'API renvoie pourtant.
 */
export function estDesactive(
  compte: object | null | undefined,
  maintenant: Date = new Date(),
): boolean {
  const jusqua = (compte as { banned_until?: unknown } | null | undefined)?.banned_until
  if (typeof jusqua !== 'string') return false
  const fin = Date.parse(jusqua)
  return Number.isFinite(fin) && fin > maintenant.getTime()
}

export const MESSAGE_COMPTE_DESACTIVE =
  'Ce compte a été désactivé. Contactez HME Logistics pour le réactiver.'

// Supabase repond en anglais (« User is banned », « Invalid login
// credentials ») : on traduit les cas qu'un client rencontre.
const MESSAGES_CONNEXION: Record<string, string> = {
  invalid_credentials: 'Email ou mot de passe incorrect.',
  user_banned: MESSAGE_COMPTE_DESACTIVE,
  over_request_rate_limit: 'Trop de tentatives. Réessayez dans quelques minutes.',
}

export function messageDeConnexion(erreur: { code?: string; message: string }): string {
  return (erreur.code && MESSAGES_CONNEXION[erreur.code]) || erreur.message
}
