import { describe, expect, it, vi } from 'vitest'
import { runNotificationOutboxWorker, type NotificationSender } from './outbox'

function message(overrides: Record<string, unknown> = {}) {
  return {
    id: 'msg-1',
    tenant_id: 'tenant-1',
    event_type: 'invoice_sent',
    recipient: 'client@example.test',
    cc: ['equipe@example.test'],
    subject: 'Votre facture',
    payload: { invoice_number: 'FAC-001' },
    attempt_count: 1,
    ...overrides,
  }
}

function makeClient(claimed: unknown[] = [message()], overrides: Record<string, unknown> = {}) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const defaults: Record<string, unknown> = {
    claim_notifications: claimed,
    mark_notification_sent: true,
    fail_notification: 'queued',
    ...overrides,
  }
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    calls.push({ name, args })
    return { data: defaults[name], error: null }
  })
  return { client: { rpc }, rpc, calls, names: () => calls.map((c) => c.name) }
}

const sender = (outcome: Record<string, unknown> = { ok: true, providerMessageId: 'prov-1' }): NotificationSender => ({
  name: 'test-provider',
  send: vi.fn(async () => outcome as never),
})

describe('runNotificationOutboxWorker', () => {
  it('ne reclame RIEN tant qu aucun fournisseur n est configure', async () => {
    const { client, rpc } = makeClient()

    const result = await runNotificationOutboxWorker(client, {}, undefined)

    expect(result).toMatchObject({ paused: true, reason: 'no_sender_configured' })
    // Reclamer incrementerait attempt_count et brulerait le budget de retry de
    // messages jamais tentes, jusqu'a les marquer en echec pour rien.
    expect(rpc).not.toHaveBeenCalled()
  })

  it('respecte la pause', async () => {
    const { client, rpc } = makeClient()
    const result = await runNotificationOutboxWorker(client, { NOTIFICATIONS_PAUSED: 'true' }, sender())
    expect(result).toMatchObject({ paused: true })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('envoie et trace l identifiant du fournisseur', async () => {
    const { client, calls } = makeClient()
    const s = sender()

    const result = await runNotificationOutboxWorker(client, {}, s)

    // Second argument : les pieces jointes, absentes ici faute de fabricant.
    expect(s.send).toHaveBeenCalledWith(expect.objectContaining({
      recipient: 'client@example.test',
      cc: ['equipe@example.test'],
    }), undefined)
    expect(result).toMatchObject({ sent: 1, failed: 0 })
    const marked = calls.find((c) => c.name === 'mark_notification_sent')
    expect(marked?.args).toMatchObject({ p_provider: 'test-provider', p_provider_message_id: 'prov-1' })
  })

  it('reprogramme un echec temporaire au lieu de l abandonner', async () => {
    const { client, calls } = makeClient([message()], { fail_notification: 'queued' })

    const result = await runNotificationOutboxWorker(client, {}, sender({ ok: false, error: 'timeout' }))

    expect(result).toMatchObject({ retried: 1, failed: 0 })
    expect(calls.find((c) => c.name === 'fail_notification')?.args).toMatchObject({ p_permanent: false })
  })

  it('abandonne immediatement une adresse invalide', async () => {
    const { client, calls } = makeClient([message()], { fail_notification: 'failed' })

    const result = await runNotificationOutboxWorker(client, {}, sender({
      ok: false, error: 'adresse invalide', permanent: true,
    }))

    expect(result).toMatchObject({ failed: 1, retried: 0 })
    // Reessayer une adresse invalide ne la rendra pas valide.
    expect(calls.find((c) => c.name === 'fail_notification')?.args).toMatchObject({ p_permanent: true })
  })

  it('une exception du fournisseur ne fait pas tomber le lot', async () => {
    const { client, names } = makeClient([message({ id: 'msg-1' }), message({ id: 'msg-2' })])
    const s: NotificationSender = {
      name: 'flaky',
      send: vi.fn()
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValueOnce({ ok: true, providerMessageId: 'p2' }),
    }

    const result = await runNotificationOutboxWorker(client, {}, s)

    expect(s.send).toHaveBeenCalledTimes(2)
    expect(result).toMatchObject({ claimed: 2, sent: 1 })
    expect(names()).toContain('fail_notification')
  })

  it('borne la taille du lot', async () => {
    const { client, calls } = makeClient()
    await runNotificationOutboxWorker(client, { NOTIFICATIONS_BATCH: '5000' }, sender())
    expect(calls[0].args.p_limit).toBe(100)
  })

  it('ignore une ligne mal formee au lieu de planter', async () => {
    const { client } = makeClient([message(), { id: 42 }, null])
    const result = await runNotificationOutboxWorker(client, {}, sender())
    expect(result).toMatchObject({ claimed: 1, sent: 1 })
  })
})

describe('pieces jointes', () => {
  it('transmet la piece jointe au fournisseur', async () => {
    const s = sender()
    const fabricant = vi.fn(async () => ([{
      filename: 'facture_FAC-2026-018.pdf',
      content: Buffer.from('%PDF-1.4 contenu'),
      contentType: 'application/pdf',
    }]))
    const { client } = makeClient()

    await runNotificationOutboxWorker(client, { NOTIFICATIONS_PAUSED: 'false' }, s, fabricant)

    expect(fabricant).toHaveBeenCalledOnce()
    const pieces = (s.send as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as Array<{ filename: string }>
    expect(pieces?.[0].filename).toBe('facture_FAC-2026-018.pdf')
  })

  it('envoie quand meme si la piece jointe echoue', async () => {
    // Mieux vaut une facture annoncee sans PDF qu'aucune facture annoncee :
    // le client garde son espace pour la telecharger.
    const s = sender()
    const fabricant = vi.fn(async () => { throw new Error('generation impossible') })
    const { client } = makeClient()

    const r = await runNotificationOutboxWorker(client, { NOTIFICATIONS_PAUSED: 'false' }, s, fabricant)

    expect(s.send).toHaveBeenCalledOnce()
    expect((s.send as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1]).toBeUndefined()
    expect(r).toMatchObject({ sent: 1 })
  })

  it('laisse une trace quand la piece jointe manque', async () => {
    // Le repli precedent est volontaire, mais il ne doit pas etre muet : sans
    // compteur, des clients cesseraient de recevoir leur facture en PDF et
    // rien ne le signalerait — l'email part, le statut dit "envoye".
    const journal = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fabricant = vi.fn(async () => { throw new Error('generation impossible') })
    const { client } = makeClient()

    const r = await runNotificationOutboxWorker(client, { NOTIFICATIONS_PAUSED: 'false' }, sender(), fabricant)

    expect(r).toMatchObject({ sent: 1, attached: 0, attachmentFailures: 1 })
    expect(journal).toHaveBeenCalledOnce()
    journal.mockRestore()
  })

  it('ne compte la piece jointe que si l envoi a reussi', async () => {
    // Compter a la fabrication ferait croire que le client a recu un PDF alors
    // que l'email n'est jamais parti.
    const fabricant = vi.fn(async () => ([{
      filename: 'facture.pdf', content: Buffer.from('%PDF'), contentType: 'application/pdf',
    }]))
    const { client } = makeClient()

    const r = await runNotificationOutboxWorker(
      client, { NOTIFICATIONS_PAUSED: 'false' }, sender({ ok: false, error: 'timeout' }), fabricant,
    )

    expect(r).toMatchObject({ sent: 0, attached: 0, attachmentFailures: 0 })
  })
})
