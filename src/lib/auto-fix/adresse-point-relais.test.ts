import { describe, expect, it } from 'vitest'
import { completerAdresseEnPointRelais, planAddressShortening, decouperLigneDeVoie } from './address'

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

  it('remplit les deux quand tout manque', () => {
    const resultat = completerAdresseEnPointRelais({
      address: '', house_number: '', service_point_present: true,
    })
    expect(resultat?.patch.address).toBe('rue')
    expect(resultat?.patch.house_number).toBe('0')
  })

  /**
   * #555868 : l'adresse ne contenait que « 20 ». Le champ brut n'etant pas
   * vide, ma premiere version remplissait le NUMERO avec « 0 » — alors que
   * c'est le nom de rue qui manquait, et que « 20 » etait le numero.
   *
   * Sendcloud decoupe la ligne au premier espace quand le champ numero est
   * vide. Il faut donc raisonner sur ce qu'il ANALYSE, pas sur les champs
   * bruts. Meme piege que celui deja corrige pour le numero de voie le 25/08.
   */
  it('#555868 : rend le numero a sa place au lieu de le remplacer', () => {
    const resultat = completerAdresseEnPointRelais({
      address: '20', house_number: '', service_point_present: true,
    })
    expect(resultat?.patch.address).toBe('rue')
    expect(resultat?.patch.house_number).toBe('20')
    // Surtout pas « 0 » : le numero existait, il etait juste au mauvais endroit.
    expect(resultat?.patch.house_number).not.toBe('0')
  })

  it('ne touche pas une ligne combinee deja complete', () => {
    expect(completerAdresseEnPointRelais({
      address: '12 rue des Lilas', house_number: '', service_point_present: true,
    })).toBeNull()
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

  it('la commande reelle se corrige sans perte', () => {
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

/**
 * Ce que Sendcloud lit comme numero de voie dans une ligne d'adresse.
 *
 * Il n'en tire un numero que si le premier mot COMMENCE PAR UN CHIFFRE ; sinon
 * il considere le champ absent et le reclame. Le modele se verifie sur quatre
 * commandes reelles, et il les explique toutes.
 *
 * Ma premiere version prenait le premier mot sans condition : elle lisait donc
 * un numero « rue » sur #556739 et concluait qu'il ne manquait rien.
 */
describe('decoupage de la ligne de voie, tel que Sendcloud le fait', () => {
  it.each([
    ['401chemin de la blanchonne', '401chemin', 'de la blanchonne', '#553869, refuse trop long'],
    ['20', '20', '', '#555868, nom de rue absent'],
    ['rue des Volontaires de Guerre', '', 'rue des Volontaires de Guerre', '#556739, numero reclame'],
    ['9 Chemin De Rapin', '9', 'Chemin De Rapin', 'ligne complete'],
  ])('%s', (ligne, numero, rue) => {
    expect(decouperLigneDeVoie(ligne, '')).toEqual({ numero, rue })
  })

  it('respecte le champ numero quand il est renseigne', () => {
    expect(decouperLigneDeVoie('rue des Lilas', '12')).toEqual({
      numero: '12', rue: 'rue des Lilas',
    })
  })
})

describe('#556739 : numero de voie reclame en casier', () => {
  it('remplit le numero sans toucher au nom de rue', () => {
    const plan = planAddressShortening(
      {
        address: 'rue des Volontaires de Guerre', address_2: '', house_number: '',
        city: 'Sambreville', postal_code: '5060', country_code: 'BE',
        service_point_present: true,
      },
      [{ field: 'house_number', max: 8 }],
    )

    expect(plan.patch.house_number).toBe('0')
    // La rue est reelle et complete : on n'y touche pas.
    expect(plan.patch.address).toBeUndefined()
    expect(plan.lossyFields).toEqual([])
  })

  it('la meme commande a domicile reste un travail humain', () => {
    const plan = planAddressShortening(
      {
        address: 'rue des Volontaires de Guerre', address_2: '', house_number: '',
        city: 'Sambreville', postal_code: '5060', country_code: 'BE',
        service_point_present: false,
      },
      [{ field: 'house_number', max: 8 }],
    )

    expect(plan.patch.house_number).toBeUndefined()
  })
})
