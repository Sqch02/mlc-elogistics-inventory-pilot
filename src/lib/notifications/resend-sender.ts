// Expediteur Resend.
//
// L'outbox ne connait aucun fournisseur : ce fichier est le seul a savoir
// parler a Resend, et il se construit uniquement si une cle est configuree.
// Sans cle, `createResendSender` renvoie null et le worker refuse de reclamer
// quoi que ce soit — mieux vaut une file qui attend qu'une rafale d'echecs.
//
// CLASSER LES ECHECS EST LE POINT DELICAT. Reessayer une adresse invalide ne
// la rendra pas valide : on ne repasse en file que ce qui a une chance
// d'aboutir. La regle retenue suit le code HTTP :
//
//   422, 400  -> definitif  (adresse ou charge utile refusee)
//   401, 403  -> definitif  (cle invalide : reessayer noierait le journal)
//   429, 5xx  -> temporaire (quota ou panne passagere)
//
// Une erreur reseau est temporaire par defaut : on ne sait pas si le message
// est parti, et le seul risque d'un nouvel essai est un doublon, alors que
// l'abandon perd la notification.

import type { NotificationSender, OutboxMessage, SendOutcome } from './outbox'

const RESEND_URL = 'https://api.resend.com/emails'

const ECHECS_DEFINITIFS = new Set([400, 401, 403, 404, 422])

export interface ResendConfig {
  apiKey: string
  /** Adresse d'expedition, domaine verifie chez Resend. */
  from: string
  fetchImpl?: typeof fetch
}

/** Corps du message, distinct par nature de notification. */
export function buildEmailBody(message: OutboxMessage): string {
  const p = message.payload

  if (message.event_type === 'invoice_sent') {
    const numero = String(p.invoice_number ?? p.month ?? '')
    const ttc = p.total_ttc === undefined || p.total_ttc === null ? null : Number(p.total_ttc)
    return [
      'Bonjour,',
      '',
      `Votre facture ${numero} est disponible.`,
      ttc !== null && Number.isFinite(ttc) ? `Montant TTC : ${ttc.toFixed(2)} EUR` : '',
      '',
      'Vous pouvez la consulter depuis votre espace.',
      '',
      "L'equipe HOMEMADE eLogistics",
    ].filter(Boolean).join('\n')
  }

  if (message.event_type === 'stock_threshold_reached') {
    return [
      'Bonjour,',
      '',
      `Le stock de ${String(p.sku_code ?? 'un produit')} est passe sous le seuil d'alerte.`,
      `Quantite restante : ${String(p.qty_current ?? '?')} (seuil : ${String(p.threshold ?? '?')})`,
      '',
      'Un reapprovisionnement est a prevoir.',
      '',
      "L'equipe HOMEMADE eLogistics",
    ].join('\n')
  }

  if (message.event_type === 'inbound_received') {
    return [
      'Bonjour,',
      '',
      'Votre arrivage a ete receptionne a l entrepot.',
      `References concernees : ${String(p.sku_count ?? '?')}`,
      `Unites recues : ${String(p.total_units ?? '?')}`,
      '',
      'Le detail est disponible dans votre espace.',
      '',
      "L'equipe HOMEMADE eLogistics",
    ].join('\n')
  }

  return `Bonjour,\n\n${message.subject}\n\nL'equipe HOMEMADE eLogistics`
}

export function createResendSender(config: ResendConfig): NotificationSender {
  const fetchImpl = config.fetchImpl ?? fetch

  return {
    name: 'resend',
    async send(message: OutboxMessage): Promise<SendOutcome> {
      try {
        const response = await fetchImpl(RESEND_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
            // Resend deduplique cote fournisseur : deux tentatives de la meme
            // notification ne peuvent pas produire deux emails.
            'Idempotency-Key': message.id,
          },
          body: JSON.stringify({
            from: config.from,
            to: [message.recipient],
            ...(message.cc.length > 0 ? { cc: message.cc } : {}),
            subject: message.subject,
            text: buildEmailBody(message),
          }),
        })

        if (response.ok) {
          const body = (await response.json().catch(() => ({}))) as { id?: string }
          return { ok: true, providerMessageId: body.id }
        }

        const detail = await response.text().catch(() => '')
        return {
          ok: false,
          permanent: ECHECS_DEFINITIFS.has(response.status),
          error: `HTTP ${response.status} ${detail.slice(0, 200)}`,
        }
      } catch (error) {
        // Reseau : on ignore si le message est parti. Le seul risque d'un
        // nouvel essai est un doublon, que la cle d'idempotence absorbe ;
        // abandonner perdrait la notification.
        return {
          ok: false,
          permanent: false,
          error: error instanceof Error ? error.message.slice(0, 200) : 'erreur reseau',
        }
      }
    },
  }
}

/**
 * Construit l'expediteur depuis l'environnement, ou renvoie null. Les deux
 * variables sont exigees : une cle sans adresse d'expedition produirait un
 * refus a chaque envoi.
 */
export function resendSenderFromEnv(
  env: Record<string, string | undefined>,
): NotificationSender | null {
  const apiKey = env.RESEND_API_KEY
  const from = env.NOTIFICATION_FROM_EMAIL
  if (!apiKey || !from) return null
  return createResendSender({ apiKey, from })
}
