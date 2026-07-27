import { describe, it, expect } from 'vitest'
import { findLatentErrors, isWorthValidating, OBSERVED_RULES } from './validate'
import { detectAutoFixCause } from './detect'

const base = {
  address: '12 rue des Lilas',
  house_number: '12',
  city: 'Lyon',
  postal_code: '69000',
  parcel_items: [{ description: 'x', quantity: 1 }],
  order_status: { id: 'on_hold', message: 'On Hold' },
}

describe('detection des erreurs latentes', () => {
  it('ne signale rien sur une commande conforme', () => {
    expect(findLatentErrors(base)).toEqual([])
  })

  it('signale la voie combinee au numero au-dela de la limite', () => {
    const found = findLatentErrors({ ...base, address: '106 B Rue de la Richelandiere 42100', house_number: '106' })
    expect(found).toHaveLength(1)
    expect(found[0].field).toBe('address_1')
    expect(found[0].source).toBe('latent')
    expect(found[0].basis).toBe('observed_refusal')
    // Le message imite la formulation reelle : la classification en aval s'y fie.
    expect(found[0].message).toContain('at most 32 characters')
  })

  it('compte le numero de maison dans la limite, comme Sendcloud', () => {
    // 30 caracteres de voie : conforme seul, refuse une fois le numero ajoute.
    const voie = 'bis Avenue du President Wilson'
    expect(voie).toHaveLength(30)
    expect(findLatentErrors({ ...base, address: voie, house_number: undefined })).toEqual([])
    expect(findLatentErrors({ ...base, address: voie, house_number: '2712' })).toHaveLength(1)
  })

  it('signale une ville trop longue', () => {
    const found = findLatentErrors({ ...base, city: 'Saint-Remy-de-Provence-les-Bains-du-Nord' })
    expect(found).toHaveLength(1)
    expect(found[0].field).toBe('city')
  })

  it('signale une deuxieme ligne d adresse trop longue', () => {
    // Deux refus reels sur ce champ, a deux limites : Sendcloud a 32, le
    // transporteur a 30. On retient la plus stricte.
    const found = findLatentErrors({ ...base, address_2: 'Residence des Grands Chenes Batiment C' })
    expect(found).toHaveLength(1)
    expect(found[0].field).toBe('address_2')
    expect(found[0].message).toContain('at most 30')
  })

  it('laisse passer une deuxieme ligne conforme a la limite stricte', () => {
    expect(findLatentErrors({ ...base, address_2: 'Batiment C, appartement 12' })).toEqual([])
  })

  it('signale un numero de voie anormalement long', () => {
    // Presque toujours du texte saisi dans la mauvaise case.
    const found = findLatentErrors({ ...base, house_number: '12 bis rue haute' })
    expect(found.map((f) => f.field)).toContain('house_number')
  })

  it('signale une commande sans aucun article', () => {
    const found = findLatentErrors({ ...base, parcel_items: [] })
    expect(found.map((f) => f.field)).toEqual(['parcel_items'])
  })

  it('ignore une commande annulee ou un retour', () => {
    expect(isWorthValidating({ ...base, order_status: { id: 'cancelled - customer' } })).toBe(false)
    expect(isWorthValidating({ ...base, is_return: true })).toBe(false)
    expect(findLatentErrors({ ...base, parcel_items: [], order_status: { id: 'cancelled' } })).toEqual([])
  })

  it('respecte des limites desactivees', () => {
    const rules = { ...OBSERVED_RULES, addressCombinedMax: null }
    expect(findLatentErrors({ ...base, address: 'x'.repeat(60), house_number: '' }, rules)).toEqual([])
  })
})

describe('branchement dans le detecteur', () => {
  const tropLongue = { ...base, address: '43 RUE LE VOSGES LES JARDINS DE LOUIS', house_number: '' }

  it('ne change RIEN sans activation explicite', () => {
    expect(detectAutoFixCause(tropLongue, 'integration_shipment')).toBeNull()
  })

  it('cree une detection quand les regles sont activees', () => {
    const detection = detectAutoFixCause(tropLongue, 'integration_shipment', { latentRules: OBSERVED_RULES })
    expect(detection).not.toBeNull()
    expect(detection?.detectedPatterns).toContain('address_too_long')
    expect(detection?.sourceSummary.latent_only).toBe(true)
    expect(detection?.evidence[0].source).toBe('latent')
  })

  it('marque latent_only a faux quand Sendcloud a deja refuse', () => {
    const detection = detectAutoFixCause(
      { ...tropLongue, errors: { address_1: ['Ensure that address 1 combined with the house number has at most 32 characters (it has 37).'] } },
      'integration_shipment',
      { latentRules: OBSERVED_RULES },
    )
    expect(detection?.sourceSummary.latent_only).toBe(false)
  })

  it('donne la MEME empreinte a une detection latente et a sa confirmation reelle', () => {
    // Sinon le meme defaut sur le meme colis produirait deux taches, donc deux
    // corrections. L'empreinte identifie un probleme, pas qui l'a remarque.
    const message = 'Ensure that address 1 combined with the house number has at most 32 characters (it has 37).'
    const latente = detectAutoFixCause(tropLongue, 'integration_shipment', { latentRules: OBSERVED_RULES })
    const reelle = detectAutoFixCause({ ...tropLongue, errors: { address_1: [message] } }, 'integration_shipment')
    expect(latente?.sourceFingerprint).toBe(reelle?.sourceFingerprint)
  })
})
