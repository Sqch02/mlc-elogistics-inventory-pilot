import { describe, expect, it } from 'vitest'
import { nettoyerVille, planAddressShortening, stripRedundantLocality } from './address'

/**
 * Deux recopies sans perte relevees le 03/09 sur 90 jours de commandes :
 *   - le code postal en tete de la ville, "17340 - Châtelaillon-Plage"
 *     (137 villes, 6 refusees pour longueur) ;
 *   - la voie recopiee en tete du complement, "201allée des Ondines. Adelinde
 *     3. Entrée B." (165 complements, 6 refuses).
 * Dans les deux cas la valeur sans le doublon tient dans la limite : le
 * moteur doit la proposer seul, sans arbitrage humain.
 */
describe('code postal recopie en tete de la ville', () => {
  it('retire le code postal exact suivi d un separateur', () => {
    expect(nettoyerVille('17340 - Châtelaillon-Plage', '17340')).toEqual({
      value: 'Châtelaillon-Plage',
      applied: ['drop_leading_postal_code_in_city'],
    })
    expect(nettoyerVille('79370 - FRESSINES', '79370').value).toBe('FRESSINES')
    expect(nettoyerVille('75011, Paris', '75011').value).toBe('Paris')
  })

  it('ne touche pas a un code postal different ni a un nombre sans separateur', () => {
    expect(nettoyerVille('17340 - Châtelaillon-Plage', '17000').applied).toEqual([])
    expect(nettoyerVille('17340 Châtelaillon-Plage', '17340').applied).toEqual([])
  })
})

describe('voie recopiee en tete du complement', () => {
  it('retire la voie, numero colle et ponctuation compris', () => {
    expect(
      stripRedundantLocality('201allée des Ondines. Adelinde 3. Entrée B.', {
        city: 'Mons',
        postalCode: '7000',
        street: '201 allée des Ondines',
      }),
    ).toEqual({ value: 'Adelinde 3. Entrée B.', applied: ['drop_street_repeated_in_complement'] })
  })

  it('ne retire rien quand la voie n est pas en tete, ni quand elle EST tout le complement', () => {
    const contexte = { city: 'Mons', postalCode: '7000', street: '201 allée des Ondines' }
    expect(stripRedundantLocality('Adelinde 3, 201 allée des Ondines', contexte).applied).toEqual([])
    expect(stripRedundantLocality('201 allée des Ondines', contexte).applied).toEqual([])
  })

  it('le plan propose le complement sans la voie, sans perte', () => {
    const plan = planAddressShortening(
      {
        address: 'allée des Ondines',
        house_number: '201',
        address_2: '201allée des Ondines. Adelinde 3. Entrée B.',
        city: 'Mons',
        postal_code: '7000',
        country_code: 'BE',
      },
      [{ field: 'address_2', max: 35 }],
    )
    expect(plan.reason).toBe('ok')
    expect(plan.patch.address_2).toBe('Adelinde 3. Entrée B.')
    expect(plan.lossyFields).toEqual([])
  })
})
