import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { estDesactive, messageDeConnexion, MESSAGE_COMPTE_DESACTIVE } from './acces-du-compte'

const lire = (chemin: string) => readFileSync(join(process.cwd(), chemin), 'utf8')

describe('compte desactive', () => {
  const maintenant = new Date('2026-10-14T08:00:00Z')

  it('suit la date de fin du bannissement Supabase', () => {
    // Valeur reelle relevee le 14/10 apres un bannissement de 876000 h.
    expect(estDesactive({ banned_until: '2126-09-20T06:19:37.530857Z' }, maintenant)).toBe(true)
    expect(estDesactive({ banned_until: '2026-10-14T07:59:59Z' }, maintenant)).toBe(false)
    // Reactive (ban_duration 'none') : Supabase ne renvoie plus de date.
    expect(estDesactive({}, maintenant)).toBe(false)
    expect(estDesactive({ banned_until: null }, maintenant)).toBe(false)
    expect(estDesactive({ banned_until: 'pas une date' }, maintenant)).toBe(false)
    // Compte introuvable : rien a refuser ici, la suite du parcours echouera.
    expect(estDesactive(null, maintenant)).toBe(false)
    expect(estDesactive(undefined, maintenant)).toBe(false)
  })
})

describe('messages de connexion', () => {
  it('traduit les refus que Supabase renvoie en anglais', () => {
    // Codes releves en production le 14/10.
    expect(messageDeConnexion({ code: 'invalid_credentials', message: 'Invalid login credentials' }))
      .toBe('Email ou mot de passe incorrect.')
    expect(messageDeConnexion({ code: 'user_banned', message: 'User is banned' }))
      .toBe(MESSAGE_COMPTE_DESACTIVE)
  })

  it('garde le message d origine pour un cas imprevu', () => {
    expect(messageDeConnexion({ code: 'autre_chose', message: 'Something else' })).toBe('Something else')
    expect(messageDeConnexion({ message: 'Sans code' })).toBe('Sans code')
  })

  it('la page de connexion et la page du lien s en servent', () => {
    expect(lire('src/app/(auth)/login/page.tsx')).toContain('setError(messageDeConnexion(error))')
    const page = lire('src/app/(auth)/nouveau-mot-de-passe/page.tsx')
    expect(page).toContain("erreurLien.code === 'user_banned'")
    expect(page).toContain('MESSAGE_COMPTE_DESACTIVE')
  })
})

describe('branchement dans la fiche client', () => {
  // La route existait depuis le 26/07 sans qu'aucun ecran ne l'appelle, comme
  // le lien de reinitialisation avant le 22/09. Une route que rien n'appelle
  // n'existe pas pour l'exploitant.
  const fiche = lire('src/app/(admin)/admin/tenants/[id]/page.tsx')

  it('la fiche client appelle la route d activation et de desactivation', () => {
    expect(fiche).toContain('`/api/admin/users/${user.id}/access`')
    expect(fiche).toContain("method: 'PATCH'")
    expect(fiche).toContain('JSON.stringify({ enabled: activer })')
  })

  it('demande confirmation avant de couper un acces, pas avant de le rendre', () => {
    const gestion = fiche.slice(fiche.indexOf('async function handleAcces'), fiche.indexOf('const copyResetLink'))
    expect(gestion).toMatch(/if \(!activer && !confirm\(/)
  })
})
