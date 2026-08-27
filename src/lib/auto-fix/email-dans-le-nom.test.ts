import { describe, expect, it } from 'vitest'
import { retirerEmailDuNom, planAddressShortening } from './address'

/**
 * Commande #554551 : le nom valait "murielh.hernandez@laposte.net Hernandez",
 * 39 caracteres pour 32. Le raccourcissement ordinaire coupait au mot le plus
 * proche et gardait l'E-MAIL en jetant le patronyme.
 *
 * Mesure sur 90 jours : 8 commandes concernees, 5 bloquantes, et dans tous les
 * cas il restait un vrai nom apres retrait.
 */
describe('adresse e-mail glissee dans le nom', () => {
  it('#554551 : garde le nom, retire l e-mail', () => {
    const plan = planAddressShortening(
      {
        name: 'murielh.hernandez@laposte.net Hernandez',
        company_name: '', email: 'murielh.hernandez@gmail.com',
        address: '9 Chemin De Rapin', address_2: '', house_number: '',
        city: 'Lavit', postal_code: '82120', country_code: 'FR',
      },
      [{ field: 'name', max: 32 }],
    )

    expect(plan.patch.name).toBe('Hernandez')
    // L'e-mail du nom differe de celui du contact : l'information disparait
    // vraiment, donc un humain tranche.
    expect(plan.lossyFields).toContain('name')
  })

  it('sans perte quand l e-mail est deja celui du contact', () => {
    // 6 des 8 cas mesures. Le retrait ne perd alors rien, comme pour une
    // entreprise dupliquee.
    const resultat = retirerEmailDuNom('jean.dupont@gmail.com Dupont', 'jean.dupont@gmail.com')
    expect(resultat).toEqual({ name: 'Dupont', lossy: false })
  })

  it('ne vide JAMAIS le champ nom', () => {
    // Un colis sans destinataire serait pire qu'un nom trop long.
    expect(retirerEmailDuNom('jean.dupont@gmail.com', 'jean.dupont@gmail.com')).toBeNull()
    expect(retirerEmailDuNom('   ', 'x@y.fr')).toBeNull()
  })

  it('laisse tranquille un nom ordinaire', () => {
    expect(retirerEmailDuNom('Marie Durand', 'marie@example.com')).toBeNull()
    expect(retirerEmailDuNom(undefined, undefined)).toBeNull()
  })

  it('retire l e-mail quelle que soit sa place dans le nom', () => {
    // Mesure : 3 des 8 cas avaient l'e-mail en seconde position.
    expect(retirerEmailDuNom('Dominique d.martin@free.fr', 'd.martin@free.fr'))
      .toEqual({ name: 'Dominique', lossy: false })
  })
})
