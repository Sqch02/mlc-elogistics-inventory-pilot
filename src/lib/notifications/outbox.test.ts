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

    expect(s.send).toHaveBeenCalledWith(expect.objectContaining({
      recipient: 'client@example.test',
      cc: ['equipe@example.test'],
    }))
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
