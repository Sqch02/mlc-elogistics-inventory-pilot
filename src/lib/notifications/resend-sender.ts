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

import type { Attachment, NotificationSender, OutboxMessage, SendOutcome } from './outbox'

const RESEND_URL = 'https://api.resend.com/emails'

const ECHECS_DEFINITIFS = new Set([400, 401, 403, 404, 422])

export interface ResendConfig {
  apiKey: string
  /** Adresse d'expedition, domaine verifie chez Resend. */
  from: string
  fetchImpl?: typeof fetch
}

/**
 * Montant au format francais : espace insecable pour les milliers, virgule
 * decimale, symbole euro. "101928.50 EUR" sur une facture de cent mille euros
 * fait negligé ; c'est un document commercial, il doit en avoir l'air.
 */
function montant(valeur: unknown): string | null {
  const nombre = typeof valeur === 'number' ? valeur : Number.parseFloat(String(valeur ?? ''))
  if (!Number.isFinite(nombre)) return null
  return nombre.toLocaleString('fr-FR', {
    style: 'currency', currency: 'EUR',
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })
}

/** Corps du message, distinct par nature de notification. */
export function buildEmailBody(message: OutboxMessage): string {
  const p = message.payload

  if (message.event_type === 'invoice_sent') {
    const numero = String(p.invoice_number ?? p.month ?? '')
    const ttc = montant(p.total_ttc)
    return [
      'Bonjour,',
      '',
      `Votre facture ${numero} est disponible.`,
      ttc ? `Montant TTC : ${ttc}` : '',
      '',
      'Vous pouvez la consulter depuis votre espace client.',
      '',
      'Bien cordialement,',
      "L'équipe HOMEMADE eLogistics",
    ].filter(Boolean).join('\n')
  }

  if (message.event_type === 'stock_threshold_reached') {
    return [
      'Bonjour,',
      '',
      `Le stock de ${String(p.sku_name ?? p.sku_code ?? 'un produit')} est passé sous le seuil d'alerte.`,
      '',
      `Quantité restante : ${String(p.qty_current ?? '?')}`,
      `Seuil d'alerte : ${String(p.threshold ?? '?')}`,
      '',
      'Un réapprovisionnement est à prévoir.',
      '',
      'Bien cordialement,',
      "L'équipe HOMEMADE eLogistics",
    ].join('\n')
  }

  if (message.event_type === 'stock_negative_drift') {
    // Message INTERNE : il s'adresse a l'equipe qui exploite l'entrepot, pas
    // au client. Ce qu'il dit — "notre comptage est faux" — n'appelle aucune
    // action de sa part, seulement de l'inquietude.
    return [
      'Bonjour,',
      '',
      `Une expedition de ${String(p.sku_code ?? 'un produit')} chez ${String(p.tenant_name ?? 'un client')}`,
      "a ete decomptee alors que l'application n'enregistrait plus aucun stock.",
      '',
      `Unites concernees : ${String(p.units_missing ?? '?')}`,
      '',
      "Le stock enregistre ne correspond donc plus au stock reel, en general parce",
      "qu'un arrivage n'a pas ete declare. Un recomptage est a prevoir lors du",
      'prochain passage a l entrepot.',
      '',
      "L'equipe HOMEMADE eLogistics",
    ].join('\n')
  }

  if (message.event_type === 'auto_fix_manual_backlog') {
    // Alerte interne, pas client : elle s'adresse a l'equipe qui exploite.
    return [
      'Bonjour,',
      '',
      `${String(p.orders ?? '?')} commandes attendent une correction manuelle sur les `
        + `${String(p.window_hours ?? 6)} dernieres heures (seuil : ${String(p.threshold ?? 5)}).`,
      '',
      `Motifs concernes : ${String(p.patterns ?? 'non precises')}`,
      '',
      "Une hausse soudaine signale souvent un changement de regle chez le transporteur",
      "ou dans le flux de la boutique. Le detail est dans Corrections automatiques.",
      '',
      "L'equipe HOMEMADE eLogistics",
    ].join('\n')
  }

  if (message.event_type === 'inbound_received') {
    return [
      'Bonjour,',
      '',
      'Votre arrivage a été réceptionné à l\'entrepôt.',
      '',
      `Références concernées : ${String(p.sku_count ?? '?')}`,
      `Unités reçues : ${String(p.total_units ?? '?')}`,
      '',
      'Le détail est disponible dans votre espace client.',
      '',
      'Bien cordialement,',
      "L'équipe HOMEMADE eLogistics",
    ].join('\n')
  }

  return `Bonjour,\n\n${message.subject}\n\nL'equipe HOMEMADE eLogistics`
}

export function createResendSender(config: ResendConfig): NotificationSender {
  const fetchImpl = config.fetchImpl ?? fetch

  return {
    name: 'resend',
    async send(message: OutboxMessage, attachments?: Attachment[]): Promise<SendOutcome> {
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
            ...(attachments && attachments.length > 0
              ? {
                  attachments: attachments.map((piece) => ({
                    filename: piece.filename,
                    content: piece.content.toString('base64'),
                  })),
                }
              : {}),
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
