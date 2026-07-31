import { describe, it, expect, vi } from 'vitest'
import {
  findOrderByNumber,
  patchOrderShippingAddress,
  verifyOrderAddress,
  isCorrigible,
  type OrderV3,
  convertPaymentDetails,
} from './orders-v3'

const credentials = { apiKey: 'k', secret: 's' }

const commande = (over: Partial<OrderV3> = {}): OrderV3 => ({
  id: '841973149',
  order_number: '#540787',
  shipping_address: {
    address_line_1: '76 grand rue hoscas Herbignac 44410',
    house_number: null,
    city: 'Herbignac',
    postal_code: '44410',
    country_code: 'FR',
  },
  order_details: { status: { code: 'on_hold' } },
  ...over,
})

const reponse = (body: unknown, ok = true, status = 200) =>
  ({ ok, status, json: async () => body, text: async () => JSON.stringify(body) }) as unknown as Response

describe('retrouver une commande par son numero', () => {
  it('renvoie la commande quand le filtre a bien ete applique', async () => {
    const f = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => reponse({ data: [commande()] }))
    const result = await findOrderByNumber(credentials, '#540787', f as never)
    expect(result).toEqual({ ok: true, order: commande() })
    expect(String(f.mock.calls[0][0])).toContain('order_number=%23540787')
  })

  it('REFUSE quand l API ignore le filtre et renvoie toute la collection', async () => {
    // Verifie en direct : `search`, `query` et `filter[order_number]` sont
    // ignores en silence. Si un jour `order_number` l'etait aussi, corriger la
    // premiere commande venue serait catastrophique.
    const f = vi.fn(async () =>
      reponse({ data: [commande({ order_number: '#000001' }), commande({ order_number: '#000002' })] }),
    )
    const result = await findOrderByNumber(credentials, '#540787', f as never)
    expect(result.ok).toBe(false)
    expect(result).toMatchObject({ reason: 'not_found' })
  })

  it('refuse plutot que de choisir en cas de doublon de numero', async () => {
    const f = vi.fn(async () => reponse({ data: [commande(), commande({ id: '999' })] }))
    const result = await findOrderByNumber(credentials, '#540787', f as never)
    expect(result).toMatchObject({ ok: false, reason: 'ambiguous' })
  })

  it('signale une erreur HTTP au lieu de la confondre avec une absence', async () => {
    const f = vi.fn(async () => reponse({}, false, 503))
    const result = await findOrderByNumber(credentials, '#540787', f as never)
    expect(result).toMatchObject({ ok: false, reason: 'http_error' })
  })
})

describe('corriger l adresse', () => {
  it('n envoie QUE les champs corriges', async () => {
    const f = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => reponse({ data: commande() }))
    await patchOrderShippingAddress(credentials, commande(), { address_line_1: '76 grand rue hoscas' }, f as never)

    const init = f.mock.calls[0][1] as RequestInit
    expect(init.method).toBe('PATCH')
    // Ne jamais renvoyer l'adresse entiere : un humain a pu modifier un autre
    // champ entre la detection et l'ecriture.
    expect(JSON.parse(String(init.body))).toEqual({
      shipping_address: { address_line_1: '76 grand rue hoscas' },
    })
  })

  it('refuse une commande deja expediee', async () => {
    const f = vi.fn()
    const expediee = commande({ order_details: { status: { code: 'shipped' } } })
    const result = await patchOrderShippingAddress(credentials, expediee, { address_line_1: 'x' }, f as never)
    expect(result).toMatchObject({ ok: false, reason: 'not_corrigible' })
    expect(f).not.toHaveBeenCalled()
  })

  it('refuse un patch vide plutot que d ecrire sans effet', async () => {
    const f = vi.fn()
    const result = await patchOrderShippingAddress(credentials, commande(), {}, f as never)
    expect(result).toMatchObject({ ok: false, reason: 'unchanged' })
    expect(f).not.toHaveBeenCalled()
  })

  it('remonte le corps de l erreur HTTP, qui porte la cause du refus', async () => {
    const f = vi.fn(async () => reponse({ detail: 'address too long' }, false, 400))
    const result = await patchOrderShippingAddress(credentials, commande(), { address_line_1: 'x' }, f as never)
    expect(result).toMatchObject({ ok: false, reason: 'http_error' })
    expect((result as { detail: string }).detail).toContain('400')
  })

  it('accepte les statuts encore a traiter', () => {
    expect(isCorrigible(commande())).toBe(true)
    expect(isCorrigible(commande({ order_details: { status: { code: 'unfulfilled' } } }))).toBe(true)
    expect(isCorrigible(commande({ order_details: { status: { code: 'cancelled' } } }))).toBe(false)
    expect(isCorrigible(commande({ order_details: {} }))).toBe(false)
  })
})

describe('verification par relecture', () => {
  it('confirme uniquement sur une relecture, pas sur la reponse du PATCH', async () => {
    const corrigee = commande({
      shipping_address: { ...commande().shipping_address, address_line_1: '76 grand rue hoscas' },
    })
    const f = vi.fn(async () => reponse({ data: [corrigee] }))
    const result = await verifyOrderAddress(credentials, '#540787', { address_line_1: '76 grand rue hoscas' }, f as never)
    expect(result.ok).toBe(true)
    expect(result.ecarts).toEqual([])
  })

  it('detecte une valeur non conservee', async () => {
    const f = vi.fn(async () => reponse({ data: [commande()] }))
    const result = await verifyOrderAddress(credentials, '#540787', { address_line_1: '76 grand rue hoscas' }, f as never)
    expect(result.ok).toBe(false)
    expect(result.ecarts[0]).toContain('address_line_1')
  })

  it('ne conclut jamais au succes quand la relecture echoue', async () => {
    const f = vi.fn(async () => reponse({}, false, 500))
    const result = await verifyOrderAddress(credentials, '#540787', { address_line_1: 'x' }, f as never)
    expect(result.ok).toBe(false)
  })
})

describe('conversion de devise', () => {
  const paiement = {
    subtotal_price: { value: 48, currency: 'CHF' },
    estimated_shipping_price: { value: 8, currency: 'CHF' },
    estimated_tax_price: { value: 0.6, currency: 'CHF' },
    total_price: { value: 56, currency: 'CHF' },
  }

  it('convertit chaque montant au taux de la BCE', () => {
    // 1 EUR = 0,9324 CHF, donc convertir divise.
    const { patch, converted } = convertPaymentDetails(paiement, 0.9324)
    expect(converted).toBe(4)
    expect(patch.total_price).toEqual({ value: 60.06, currency: 'EUR' })
    expect(patch.subtotal_price).toEqual({ value: 51.48, currency: 'EUR' })
  })

  it('laisse tranquille ce qui est deja en euros', () => {
    const { converted } = convertPaymentDetails(
      { total_price: { value: 56, currency: 'EUR' } }, 0.9324)
    expect(converted).toBe(0)
  })

  it('ne convertit RIEN avec un taux absurde', () => {
    // Un montant errone sur une declaration douaniere est pire qu'un colis en
    // attente : sans taux valable, on ne touche a rien.
    expect(convertPaymentDetails(paiement, 0).converted).toBe(0)
    expect(convertPaymentDetails(paiement, Number.NaN).converted).toBe(0)
    expect(convertPaymentDetails(paiement, -1).converted).toBe(0)
  })

  it('ignore un champ mal forme plutot que de produire un montant faux', () => {
    const { converted } = convertPaymentDetails(
      { total_price: { value: 'beaucoup', currency: 'CHF' } } as never, 0.9324)
    expect(converted).toBe(0)
  })
})
