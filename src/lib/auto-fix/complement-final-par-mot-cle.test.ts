import { describe, expect, it } from 'vitest'
import { extractComplement, planAddressShortening } from './address'

/**
 * Releve du 03/09 sur 90 jours : 181 voies trop longues alors que le
 * complement etait libre. Le motif le plus frequent : une voie complete
 * suivie d'un complement introduit par un mot-cle (residence, lieu-dit,
 * villa, appartement, batiment...). Le moteur coupait au mot le plus proche
 * et demandait un arbitrage ; deplacer le complement suffit.
 */
describe('complement final introduit par un mot-cle', () => {
  it.each([
    ["10 All. de l'Impératrice res leia", "10 All. de l'Impératrice", 'res leia'],
    ['65 route de brennilis. lieu-dit solvargoz', '65 route de brennilis', 'lieu-dit solvargoz'],
    ["2 route de l'étang lieu-dit Fléchat", "2 route de l'étang", 'lieu-dit Fléchat'],
    ['620 AV de lattre de tassigny villa 3', '620 AV de lattre de tassigny', 'villa 3'],
    ['1746 RTE de ST romain RES les sables', '1746 RTE de ST romain', 'RES les sables'],
    ['5 rue Guy de Maupassant imm Ango appart 32', '5 rue Guy de Maupassant', 'imm Ango appart 32'],
    ['411 cours de la Libération appt A26', '411 cours de la Libération', 'appt A26'],
    ['22 Av de Toulon les Roches Fleuries bat B', '22 Av de Toulon les Roches Fleuries', 'bat B'],
    ['62 Rue de Paris 16 eme etage apt 238', '62 Rue de Paris', '16 eme etage apt 238'],
    ['12 route de gunsbach parc de la fecht', '12 route de gunsbach', 'parc de la fecht'],
  ])('%s', (entree, voie, complement) => {
    expect(extractComplement(entree)).toEqual({ address: voie, complement })
  })

  it('ne coupe pas quand le mot-cle nomme la voie', () => {
    expect(extractComplement('2 rue Hameau du Parc La Jumellière')).toBeNull()
    expect(extractComplement('18 TER Lotissement Du Fief Du Pre Chardon')).toBeNull()
    expect(extractComplement('70 Lotissement de la Croix de la Romiguière')).toBeNull()
    expect(extractComplement('12 avenue du Parc des Sports')).toBeNull()
    expect(extractComplement('Domaine de la Viva Clos Scaglione')).toBeNull()
  })

  it('coupe au premier tiret qui suit une voie complete', () => {
    expect(extractComplement('90 Route du Val de Gorbio - Azur Parc - Le Thuya')).toEqual({
      address: '90 Route du Val de Gorbio',
      complement: 'Azur Parc - Le Thuya',
    })
    expect(extractComplement('46, avenue de montlouis - Allée 4 - 3ème étage')).toEqual({
      address: '46, avenue de montlouis',
      complement: 'Allée 4 - 3ème étage',
    })
  })

  it('le plan deplace le complement sans perte', () => {
    const plan = planAddressShortening(
      {
        address: '620 AV de lattre de tassigny villa 3', address_2: '', house_number: '',
        city: 'Toulon', postal_code: '83000', country_code: 'FR',
      },
      [{ field: 'address_1', max: 32 }],
    )
    expect(plan.reason).toBe('ok')
    expect(plan.patch.address).toBe('620 AV de lattre de tassigny')
    expect(plan.patch.address_2).toBe('villa 3')
  })
})
