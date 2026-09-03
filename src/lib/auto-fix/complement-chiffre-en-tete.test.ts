import { describe, expect, it } from 'vitest'
import { extractComplement, planAddressShortening } from './address'

/**
 * Commande #557904 (03/09) : « Les Pervenches esc2 bt2  552avenue de
 * Parades », sans complement. Le moteur proposait « Les Pervenches esc2 bt2
 * 552 Av », une perte a valider, alors que la voie et le complement tiennent
 * chacun dans leur champ. Deux obstacles : un chiffre dans le complement
 * (« esc2 »), et le numero colle au mot de voie (« 552avenue »).
 * 41 voies de cette forme en 90 jours, 21 trop longues.
 */
describe('complement chiffre en tete, numero colle a la voie', () => {
  it('#557904 : la voie va dans son champ, le complement dans le sien', () => {
    expect(extractComplement('Les Pervenches esc2 bt2  552avenue de Parades')).toEqual({
      address: '552 avenue de Parades',
      complement: 'Les Pervenches esc2 bt2',
    })
    expect(extractComplement('Les Hauts de Celony n9, 115 chemin du Puy du Roy')).toEqual({
      address: '115 chemin du Puy du Roy',
      complement: 'Les Hauts de Celony n9',
    })
  })

  it('ne coupe pas une voie dont le nombre fait partie du nom', () => {
    expect(extractComplement('rue du 8 mai 1945')).toBeNull()
    expect(extractComplement('avenue du 11 novembre')).toBeNull()
    expect(extractComplement('12 rue des Lilas')).toBeNull()
  })

  it('le plan propose les deux champs sans perte', () => {
    const plan = planAddressShortening(
      {
        address: 'Les Pervenches esc2 bt2  552avenue de Parades', address_2: '', house_number: '',
        city: 'Menton', postal_code: '06500', country_code: 'FR',
      },
      [{ field: 'address_1', max: 32 }],
    )
    expect(plan.reason).toBe('ok')
    expect(plan.patch.address).toBe('552 avenue de Parades')
    expect(plan.patch.address_2).toBe('Les Pervenches esc2 bt2')
    expect(plan.lossyFields).toEqual([])
  })
})
