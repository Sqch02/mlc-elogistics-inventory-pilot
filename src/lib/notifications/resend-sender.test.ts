import { describe, it, expect, vi } from 'vitest'
import { createResendSender, resendSenderFromEnv, buildEmailBody } from './resend-sender'
import type { OutboxMessage } from './outbox'

const message = (over: Partial<OutboxMessage> = {}): OutboxMessage => ({
  id: 'msg-1',
  tenant_id: 'tenant-1',
  event_type: 'invoice_sent',
  recipient: 'client@exemple.fr',
  cc: [],
  subject: 'Votre facture 2026-07',
  payload: { invoice_number: '2026-07', total_ttc: 1234.5 },
  attempt_count: 0,
  ...over,
})

const reponse = (ok: boolean, status: number, body: unknown = {}) =>
  ({ ok, status, json: async () => body, text: async () => JSON.stringify(body) }) as unknown as Response

describe('envoi', () => {
  it('transmet destinataire, copie et corps', async () => {
    const f = vi.fn(async (_u: string | URL | Request, _i?: RequestInit) => reponse(true, 200, { id: 'resend-42' }))
    const sender = createResendSender({ apiKey: 'k', from: 'no-reply@exemple.fr', fetchImpl: f as never })

    const outcome = await sender.send(message({ cc: ['equipe@exemple.fr'] }))

    expect(outcome).toMatchObject({ ok: true, providerMessageId: 'resend-42' })
    const corps = JSON.parse(String((f.mock.calls[0][1] as RequestInit).body))
    expect(corps.to).toEqual(['client@exemple.fr'])
    expect(corps.cc).toEqual(['equipe@exemple.fr'])
    expect(corps.text).toContain('2026-07')
  })

  it('omet la copie quand il n y en a pas, plutot que d envoyer un tableau vide', async () => {
    const f = vi.fn(async (_u: string | URL | Request, _i?: RequestInit) => reponse(true, 200, { id: 'x' }))
    const sender = createResendSender({ apiKey: 'k', from: 'a@b.fr', fetchImpl: f as never })
    await sender.send(message())
    expect(JSON.parse(String((f.mock.calls[0][1] as RequestInit).body))).not.toHaveProperty('cc')
  })

  it('porte une cle d idempotence : deux tentatives ne font pas deux emails', async () => {
    const f = vi.fn(async (_u: string | URL | Request, _i?: RequestInit) => reponse(true, 200, { id: 'x' }))
    const sender = createResendSender({ apiKey: 'k', from: 'a@b.fr', fetchImpl: f as never })
    await sender.send(message())
    const headers = (f.mock.calls[0][1] as RequestInit).headers as Record<string, string>
    expect(headers['Idempotency-Key']).toBe('msg-1')
  })
})

describe('classement des echecs', () => {
  it.each([
    [422, 'adresse refusee'],
    [400, 'charge utile invalide'],
    [401, 'cle invalide'],
    [403, 'acces refuse'],
  ])('traite %i comme DEFINITIF (%s)', async (status) => {
    // Reessayer une adresse invalide ne la rendra pas valide, et reessayer
    // avec une mauvaise cle ne ferait que noyer le journal.
    const f = vi.fn(async () => reponse(false, status, { message: 'nope' }))
    const sender = createResendSender({ apiKey: 'k', from: 'a@b.fr', fetchImpl: f as never })
    const outcome = await sender.send(message())
    expect(outcome).toMatchObject({ ok: false, permanent: true })
  })

  it.each([[429, 'quota'], [500, 'panne'], [503, 'indisponible']])(
    'traite %i comme TEMPORAIRE (%s)',
    async (status) => {
      const f = vi.fn(async () => reponse(false, status, {}))
      const sender = createResendSender({ apiKey: 'k', from: 'a@b.fr', fetchImpl: f as never })
      const outcome = await sender.send(message())
      expect(outcome).toMatchObject({ ok: false, permanent: false })
    },
  )

  it('traite une erreur reseau comme TEMPORAIRE', async () => {
    // On ignore si le message est parti. Le seul risque d'un nouvel essai est
    // un doublon, que la cle d'idempotence absorbe ; abandonner perdrait la
    // notification.
    const f = vi.fn(async () => { throw new Error('ECONNRESET') })
    const sender = createResendSender({ apiKey: 'k', from: 'a@b.fr', fetchImpl: f as never })
    const outcome = await sender.send(message())
    expect(outcome).toMatchObject({ ok: false, permanent: false })
    expect(outcome.error).toContain('ECONNRESET')
  })
})

describe('construction depuis l environnement', () => {
  it('exige la cle ET l adresse d expedition', () => {
    expect(resendSenderFromEnv({})).toBeNull()
    expect(resendSenderFromEnv({ RESEND_API_KEY: 'k' })).toBeNull()
    expect(resendSenderFromEnv({ NOTIFICATION_FROM_EMAIL: 'a@b.fr' })).toBeNull()
    expect(resendSenderFromEnv({ RESEND_API_KEY: 'k', NOTIFICATION_FROM_EMAIL: 'a@b.fr' })?.name).toBe('resend')
  })
})

describe('corps du message', () => {
  it('annonce la facture avec son montant', () => {
    const texte = buildEmailBody(message())
    expect(texte).toContain('2026-07')
    // Format francais : espace insecable, virgule decimale, symbole euro.
    expect(texte).toMatch(/1\s?234,50\s?€/)
  })

  it('n invente pas de montant quand il est absent', () => {
    const texte = buildEmailBody(message({ payload: { invoice_number: '2026-08' } }))
    expect(texte).toContain('2026-08')
    expect(texte).not.toContain('€')
  })

  it('distingue "stock bas" de "stock faux"', () => {
    // L'action attendue n'est pas la meme : reapprovisionner d'un cote,
    // recompter et declarer les entrees de l'autre.
    const derive = buildEmailBody(message({
      event_type: 'stock_negative_drift',
      payload: { sku_code: 'ABC-1', units_missing: 12, tenant_name: 'Anteos' },
    }))
    expect(derive).toContain('ABC-1')
    expect(derive).toContain('12')
    expect(derive).toContain('recomptage')
    expect(derive).not.toContain('seuil')
    // Message interne : il nomme le client, ce qu'un message au client ne
    // ferait pas.
    expect(derive).toContain('Anteos')
  })

  it('formule l alerte d accumulation pour l equipe, pas pour le client', () => {
    const texte = buildEmailBody(message({
      event_type: 'auto_fix_manual_backlog',
      payload: { orders: 29, threshold: 5, window_hours: 6, patterns: 'address_too_long' },
    }))
    expect(texte).toContain('29 commandes')
    expect(texte).toContain('address_too_long')
    // Elle oriente vers une cause, pas vers une action client.
    expect(texte).toContain('transporteur')
  })

  it('adapte le texte au type d evenement', () => {
    const stock = buildEmailBody(message({
      event_type: 'stock_threshold_reached',
      payload: { sku_code: 'ABC-1', qty_current: 3, threshold: 10 },
    }))
    expect(stock).toContain('ABC-1')
    expect(stock).toContain('seuil')

    const arrivage = buildEmailBody(message({
      event_type: 'inbound_received',
      payload: { sku_count: 4, total_units: 120 },
    }))
    expect(arrivage).toContain('arrivage')
    expect(arrivage).toContain('120')
  })
})
