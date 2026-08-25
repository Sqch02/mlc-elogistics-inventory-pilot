import { describe, expect, it } from 'vitest'
import { redresserLignesInversees, planAddressShortening } from './address'

/**
 * Cas reels releves en production le 24/08, sur 346 paires inversees en
 * 90 jours. Le batiment occupe le champ voie, la vraie voie dort dans le
 * complement.
 */
describe('deux lignes d adresse interverties', () => {
  it.each([
    ['Appartement 2eme Étage Porte 21', '24 Rue Jean Mermoz'],
    ['Bat B Res Les Terrasses Du Vercors', '4 Rue Jean Et Jacques Geranton'],
    ['Les Fleurs de Grasse Apt 61 BAt Lilas', '50 Route DE Cannes'],
    ['APP B03 BAT A RES La Pleiade', '9 Impasse Ronsard'],
    ['Zone Dactivite Du Grand Pont', '81 Avenue Vega'],
    ['Batiment C2 RES Les Ombrages', '66 BD Hippolyte Mege Mouries'],
    ['appt 327, la corniche d or', '125 av de la corniche'],
    ['Grenaillages Produits et Services', '10 avenue de l industrie'],
  ])('redresse "%s" / "%s"', (voie, complement) => {
    const redresse = redresserLignesInversees(voie, complement)
    expect(redresse).not.toBeNull()
    // La voie reelle remonte en premiere ligne, telle quelle.
    expect(redresse?.address).toBe(complement)
    expect(redresse?.address_2).toBe(voie)
  })

  it('ne touche pas une adresse normale', () => {
    expect(redresserLignesInversees('12 rue des Lilas', 'Appartement 3')).toBeNull()
    expect(redresserLignesInversees('4 Rue Jean Mermoz', '')).toBeNull()
  })

  it('n echange jamais deux lignes qui ressemblent toutes deux a une voie', () => {
    // On ne saurait pas laquelle est la bonne : mieux vaut ne rien faire.
    expect(redresserLignesInversees('10 rue de la Gare', '24 Rue Jean Mermoz')).toBeNull()
    expect(redresserLignesInversees('rue de la Gare', '24 Rue Jean Mermoz')).toBeNull()
  })

  it('exige un numero en tete sur la seconde ligne', () => {
    // "Rue Jean Mermoz" sans numero peut etre un lieu-dit ou un complement :
    // le signal n'est pas assez net pour intervertir.
    expect(redresserLignesInversees('Batiment A', 'Rue Jean Mermoz')).toBeNull()
  })

  it('ignore les champs vides', () => {
    expect(redresserLignesInversees(undefined, '24 Rue Jean Mermoz')).toBeNull()
    expect(redresserLignesInversees('Batiment A', undefined)).toBeNull()
    expect(redresserLignesInversees('', '')).toBeNull()
  })
})

describe('le plan complet, sur des commandes reelles', () => {
  it('restaure la voie et confine la perte au batiment', () => {
    const plan = planAddressShortening(
      {
        address: 'Les Fleurs de Grasse Apt 61 BAt Lilas',
        address_2: '50 Route DE Cannes',
        house_number: '', city: 'Grasse', postal_code: '06130', country_code: 'FR',
      },
      [{ field: 'address_1', max: 32 }, { field: 'address_2', max: 30 }],
    )

    // La voie revient INTACTE : c'est elle qui fait arriver le colis.
    expect(plan.patch.address).toBe('50 Route DE Cannes')
    // Ce qu'il reste a perdre tombe sur le batiment, et nulle part ailleurs.
    expect(plan.lossyFields).toEqual(['address_2'])
    expect(plan.audit.some((e) => e.applied.includes('swap_address_lines'))).toBe(true)
  })

  it('ne perd rien du tout quand les deux lignes tiennent', () => {
    const plan = planAddressShortening(
      {
        address: 'Rez De Chaussé', address_2: '22 Rue Des Carrieres',
        house_number: '', city: 'Luxembourg', postal_code: '1234', country_code: 'LU',
      },
      [{ field: 'address_1', max: 32 }, { field: 'address_2', max: 30 }],
    )

    expect(plan.patch.address).toBe('22 Rue Des Carrieres')
    expect(plan.patch.address_2).toBe('Rez De Chaussé')
    expect(plan.lossyFields).toEqual([])
    expect(plan.ready).toBe(true)
  })

  it('laisse la ville a l arbitrage humain meme apres un redressement', () => {
    // La decision de Quentin porte sur le BATIMENT. Couper une ville peut
    // changer la destination : cela reste un arbitrage, redressement ou pas.
    const plan = planAddressShortening(
      {
        address: 'Batiment C2 RES Les Ombrages',
        address_2: '66 BD Hippolyte Mege Mouries',
        house_number: '', city: 'Wingersheim les Quatre Bans',
        postal_code: '67170', country_code: 'FR',
      },
      [{ field: 'address_1', max: 32 }, { field: 'city', max: 25 }],
    )

    expect(plan.lossyFields).toContain('city')
  })
})
