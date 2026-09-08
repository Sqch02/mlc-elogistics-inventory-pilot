import { describe, expect, it } from 'vitest'
import { convertPaymentDetails, patchOrderCurrency } from './orders-v3'

/**
 * Commande #560292, le 08/09. Le moteur a converti cinq montants sur six : le
 * sous-total est passe a 91,44 EUR, le total est reste a 86. La relecture a
 * valide, parce qu'elle controlait la devise et non l'accord des montants.
 * Sur une declaration douaniere vers la Suisse, cela sous-estime la valeur de
 * 6 %.
 *
 * La regle est desormais tout ou rien : un montant present qu'on ne sait pas
 * convertir arrete la conversion entiere.
 */
const TAUX = 0.9405 // francs par euro, cotation BCE du 07/09

const argent = (value: number, currency = 'CHF') => ({ value, currency })

describe('conversion de devise, tout ou rien', () => {
  it('#560292 : un total deja en euros arrete la conversion', () => {
    const paiement = {
      subtotal_price: argent(86),
      estimated_shipping_price: argent(0),
      estimated_tax_price: argent(0),
      total_price: argent(86, 'EUR'),
      discount_granted: argent(0),
      freight_costs: argent(0),
    }
    const { converted, ignores } = convertPaymentDetails(paiement, TAUX)
    expect(converted).toBe(5)
    expect(ignores).toEqual(['total_price'])
  })

  it('un montant d une forme illisible arrete aussi la conversion', () => {
    const paiement = {
      subtotal_price: argent(86),
      total_price: { value: '86.00', currency: 'CHF' },
    }
    expect(convertPaymentDetails(paiement, TAUX).ignores).toEqual(['total_price'])
  })

  it('rien n est ecrit chez Sendcloud quand la conversion serait partielle', async () => {
    let appele = false
    const resultat = await patchOrderCurrency(
      { apiKey: 'k', secret: 's' },
      {
        id: 'abc', order_details: { status: { code: 'on_hold' } },
        payment_details: { subtotal_price: argent(86), total_price: argent(86, 'EUR') },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      TAUX,
      (async () => { appele = true; return new Response('{}', { status: 200 }) }) as typeof fetch,
    )
    expect(appele).toBe(false)
    expect(resultat.ok).toBe(false)
    if (resultat.ok) return
    expect(resultat.reason).toBe('partial_conversion')
    expect(resultat.detail).toContain('total_price')
  })

  it('une commande entierement en francs se convertit toujours, totaux accordes', () => {
    // Forme des quatre commandes du 07/09, qui doivent continuer de passer.
    const paiement = {
      subtotal_price: argent(86),
      estimated_shipping_price: argent(8),
      estimated_tax_price: argent(0.6),
      total_price: argent(94),
      discount_granted: argent(0),
      freight_costs: argent(8),
    }
    const { patch, converted, ignores } = convertPaymentDetails(paiement, TAUX)
    expect(converted).toBe(6)
    expect(ignores).toEqual([])
    expect(patch.subtotal_price.value).toBe(91.44)
    expect(patch.total_price.value).toBe(99.95)
    // L'accord total = sous-total + port survit a la conversion, au centime.
    const somme = patch.subtotal_price.value + patch.estimated_shipping_price.value
    expect(Math.abs(patch.total_price.value - somme)).toBeLessThanOrEqual(0.02)
  })

  it('un montant absent n empeche rien : seul un montant PRESENT compte', () => {
    const { converted, ignores } = convertPaymentDetails(
      { subtotal_price: argent(86), total_price: argent(86) },
      TAUX,
    )
    expect(converted).toBe(2)
    expect(ignores).toEqual([])
  })
})
