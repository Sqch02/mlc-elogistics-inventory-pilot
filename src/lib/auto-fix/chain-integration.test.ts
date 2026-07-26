import { describe, it, expect } from 'vitest'
import { detectAutoFixCause } from './detect'
import { OBSERVED_RULES } from './validate'
import { planAddressShortening, type AddressLimit } from './address'

/**
 * Le chemin critique de la phase 2, de bout en bout.
 *
 * Trois modules ecrits separement doivent s'emboiter exactement :
 *
 *   1. la detection latente fabrique une preuve au format Sendcloud
 *   2. le detecteur en extrait une limite chiffree et un nom de champ
 *   3. le planner retrouve la valeur a raccourcir et calcule le patch
 *
 * Chaque maillon est teste chez lui, mais c'est la JONCTION qui casse en
 * silence : Sendcloud nomme le champ `address_1` quand la commande l'appelle
 * `address`, et la limite porte sur la voie COMBINEE au numero. Une seule de
 * ces deux subtilites oubliee, et la chaine produit un plan vide sans que rien
 * ne signale d'erreur.
 */

const commande = {
  order_number: '#000001',
  address: '18 chemin de la porterie 33670 SADIRAC',
  house_number: '',
  address_2: '',
  city: 'SADIRAC',
  postal_code: '33670',
  country: 'FR',
  parcel_items: [{ description: 'article', quantity: 1 }],
  order_status: { id: 'on_hold', message: 'On Hold' },
}

describe('chaine complete : detection latente -> patch concret', () => {
  it('va de la commande brute au patch, sans qu aucun maillon ne se perde', () => {
    // 1. Rien ne signale encore cette commande : Sendcloud n'a pas ete sollicite.
    expect(detectAutoFixCause(commande, 'integration_shipment')).toBeNull()

    // 2. Les regles connues la reperent.
    const detection = detectAutoFixCause(commande, 'integration_shipment', {
      latentRules: OBSERVED_RULES,
    })
    expect(detection).not.toBeNull()
    expect(detection?.detectedPatterns).toContain('address_too_long')
    expect(detection?.sourceSummary.latent_only).toBe(true)

    // 3. La limite a bien ete extraite du message, avec le nom de champ Sendcloud.
    const limits = detection?.sourceSummary.address_limits as unknown as AddressLimit[]
    expect(limits).toEqual([{ field: 'address_1', max: 32 }])

    // 4. Le planner retrouve `address` derriere `address_1` et calcule la valeur.
    const plan = planAddressShortening(commande, limits)
    expect(plan.ready).toBe(true)
    expect(plan.patch.address).toBe('18 chemin de la porterie')
    expect(plan.audit[0].lossy).toBe(false)
    expect((plan.patch.address ?? '').length).toBeLessThanOrEqual(32)
  })

  it('refuse la chaine complete quand seule une coupe destructrice est possible', () => {
    const difficile = { ...commande, address: '43 RUE LE VOSGES LES JARDINS DE LOUIS', city: 'Port de Bouc' }
    const detection = detectAutoFixCause(difficile, 'integration_shipment', { latentRules: OBSERVED_RULES })
    const limits = detection?.sourceSummary.address_limits as unknown as AddressLimit[]
    const plan = planAddressShortening(difficile, limits)

    expect(plan.ready).toBe(false)
    expect(plan.reason).toBe('lossy_shortening_requires_review')
  })

  it('reserve la place du numero de voie sur toute la chaine', () => {
    // 30 caracteres de voie + un numero de 2 : conforme seule, refusee combinee.
    const avecNumero = {
      ...commande,
      address: 'bis Avenue du President Wilson',
      house_number: '27',
      city: 'Montvilliers',
      postal_code: '76290',
    }
    const detection = detectAutoFixCause(avecNumero, 'integration_shipment', { latentRules: OBSERVED_RULES })
    expect(detection).not.toBeNull()

    const limits = detection?.sourceSummary.address_limits as unknown as AddressLimit[]
    const plan = planAddressShortening(avecNumero, limits)
    expect(plan.ready).toBe(true)

    const combine = `${plan.patch.address} 27`
    expect(combine.length).toBeLessThanOrEqual(32)
  })
})
