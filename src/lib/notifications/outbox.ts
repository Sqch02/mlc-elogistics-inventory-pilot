// Envoi des notifications en file.
//
// Le fournisseur est injecte : ce module ne connait ni Resend, ni SMTP, ni
// aucun service. Brancher un fournisseur plus tard ne demandera pas de
// reecrire cette logique, et les tests n'ont besoin d'aucun compte.
//
// Regle qui justifie l'existence de ce worker : l'evenement a ete insere dans
// la meme transaction que la mutation metier. Ici on ne fait qu'envoyer, et un
// echec d'envoi ne peut plus rien annuler.

export interface OutboxMessage {
  id: string
  tenant_id: string
  event_type: string
  recipient: string
  cc: string[]
  subject: string
  payload: Record<string, unknown>
  attempt_count: number
}

export interface SendOutcome {
  ok: boolean
  providerMessageId?: string
  error?: string
  /** true quand reessayer ne changera rien : adresse invalide, domaine refuse. */
  permanent?: boolean
}

export interface NotificationSender {
  name: string
  send: (message: OutboxMessage) => Promise<SendOutcome>
}

export interface OutboxWorkerResult {
  workerId: string
  claimed: number
  sent: number
  failed: number
  retried: number
}

type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>
}

function asMessage(value: unknown): OutboxMessage | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (typeof v.id !== 'string' || typeof v.recipient !== 'string') return null
  return {
    id: v.id,
    tenant_id: String(v.tenant_id ?? ''),
    event_type: String(v.event_type ?? ''),
    recipient: v.recipient,
    cc: Array.isArray(v.cc) ? v.cc.map(String) : [],
    subject: String(v.subject ?? ''),
    payload: (v.payload ?? {}) as Record<string, unknown>,
    attempt_count: Number(v.attempt_count ?? 0),
  }
}

export async function runNotificationOutboxWorker(
  client: RpcClient,
  env: Record<string, string | undefined> = process.env,
  sender?: NotificationSender,
): Promise<OutboxWorkerResult | { paused: true; reason: string }> {
  // Sans fournisseur configure, on ne reclame RIEN : reclamer incrementerait
  // attempt_count et consommerait le budget de retry pour rien, jusqu'a
  // marquer en echec des messages qui n'ont jamais ete tentes.
  if (!sender) return { paused: true, reason: 'no_sender_configured' }
  if (env.NOTIFICATIONS_PAUSED === 'true') return { paused: true, reason: 'notifications_paused' }

  const workerId = `mail-${crypto.randomUUID()}`
  const limit = Math.min(100, Math.max(1, Number(env.NOTIFICATIONS_BATCH ?? 20) || 20))
  const result: OutboxWorkerResult = { workerId, claimed: 0, sent: 0, failed: 0, retried: 0 }

  const { data, error } = await client.rpc('claim_notifications', {
    p_worker_id: workerId,
    p_limit: limit,
    p_lock_seconds: 120,
  })
  if (error) throw new Error(`claim_notifications: ${(error as { message?: string }).message ?? 'rpc error'}`)

  const messages = ((data as unknown[]) ?? []).map(asMessage).filter((m): m is OutboxMessage => m !== null)
  result.claimed = messages.length

  // Sequentiel : un fournisseur d'email a des quotas, et rien ici n'est urgent.
  for (const message of messages) {
    let outcome: SendOutcome
    try {
      outcome = await sender.send(message)
    } catch (error) {
      outcome = {
        ok: false,
        error: error instanceof Error ? error.message : 'erreur inconnue',
      }
    }

    if (outcome.ok) {
      await client.rpc('mark_notification_sent', {
        p_id: message.id,
        p_worker_id: workerId,
        p_provider: sender.name,
        p_provider_message_id: outcome.providerMessageId ?? null,
      })
      result.sent += 1
      continue
    }

    const { data: nextState } = await client.rpc('fail_notification', {
      p_id: message.id,
      p_worker_id: workerId,
      p_error: outcome.error ?? 'envoi echoue',
      p_permanent: outcome.permanent ?? false,
    })
    if (nextState === 'failed') result.failed += 1
    else result.retried += 1
  }

  return result
}
