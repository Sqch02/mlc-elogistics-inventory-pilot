import { describe, expect, it } from 'vitest'
import { completerAdresseEnPointRelais, planAddressShortening } from './address'

/**
 * Demande de Quentin le 30/08 : quand la livraison se fait en point relais ou
 * en casier, l'adresse du domicile figure sur l'etiquette mais ne sert pas a
 * l'acheminement — c'est le code du point qui achemine. Il complete donc a la
 * main un « 0 » pour le numero de voie manquant, « rue » pour le nom de rue.
 *
 * Le principe est deja admis pour les COUPES d'adresse en point relais.
 * Remplir un champ VIDE detruit encore moins : rien n'est perdu, puisqu'il n'y
 * avait rien.
 *
 * Mesure au 30/08 : 3 taches en attente correspondent exactement a ce cas,
 * toutes avec une rue vide et un numero present.
 */
describe('completement d adresse en point relais', () => {
  it('remplit la rue absente', () => {
    const resultat = completerAdresseEnPointRelais({
      address: '', house_number: '12', service_point_present: true,
    })
    expect(resultat?.patch.address).toBe('rue')
    expect(resultat?.applied).toContain('fill_street_for_service_point')
  })

  it('remplit le numero de voie absent', () => {
    const resultat = completerAdresseEnPointRelais({
      address: 'rue des Lilas', house_number: '', service_point_present: true,
    })
    expect(resultat?.patch.house_number).toBe('0')
  })

  it('NE TOUCHE JAMAIS a une livraison a domicile', () => {
    // La meme operation y produirait une etiquette inlivrable. La condition
    // est sans exception.
    expect(completerAdresseEnPointRelais({
      address: '', house_number: '', service_point_present: false,
    })).toBeNull()
    expect(completerAdresseEnPointRelais({
      address: '', house_number: '',
    })).toBeNull()
  })

  it('ne touche pas une adresse deja complete', () => {
    expect(completerAdresseEnPointRelais({
      address: 'rue des Lilas', house_number: '12', service_point_present: true,
    })).toBeNull()
  })

  it('#555868 : la commande reelle se corrige sans perte', () => {
    // Rue vide, numero present, livraison en point relais.
    const plan = planAddressShortening(
      {
        address: '', address_2: '', house_number: '12',
        city: 'Villefranche', postal_code: '69400', country_code: 'FR',
        service_point_present: true,
      },
      [{ field: 'address_1', max: 32 }],
    )

    expect(plan.patch.address).toBe('rue')
    expect(plan.lossyFields).toEqual([])
    expect(plan.ready).toBe(true)
  })

  it('la meme commande a domicile ne se repare pas toute seule', () => {
    const plan = planAddressShortening(
      {
        address: '', address_2: '', house_number: '12',
        city: 'Villefranche', postal_code: '69400', country_code: 'FR',
        service_point_present: false,
      },
      [{ field: 'address_1', max: 32 }],
    )

    expect(plan.patch.address).toBeUndefined()
    expect(plan.ready).toBe(false)
  })
})
