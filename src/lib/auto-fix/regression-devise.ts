import type { SendcloudCredentials } from '@/lib/sendcloud/types'
import { findOrderByNumber, isCorrigible } from '@/lib/sendcloud/orders-v3'

/**
 * Signale les conversions de devise defaites apres coup.
 *
 * Mesure du 08/09, en relisant les commandes chez Sendcloud une par une :
 *
 *   adresse trop longue   25 corrections, 25 tiennent
 *   devise CHF vers EUR   60 corrections,  5 tiennent
 *
 * Le contraste est le fait principal. Si la boutique reimportait la commande,
 * l'adresse reviendrait aussi ; elle ne bouge pas. Seuls les montants
 * repassent au franc.
 *
 * Sur les 55 revenues en arriere, 42 etaient DEJA PARTIES : la conversion
 * avait tenu assez longtemps pour faire l'etiquette, le retour arriere est
 * sans consequence. Les 13 autres etaient encore ouvertes : l'exploitant y
 * reverra l'erreur, une par une, sans que rien ne l'annonce.
 *
 * Ce passage ne REECRIT RIEN chez Sendcloud. Tant que la cause du retour
 * arriere n'est pas connue, reconvertir reviendrait a ecrire en boucle sur
 * les commandes d'un client contre un mecanisme qu'on ne comprend pas. On se
 * contente de remettre la tache dans la file manuelle avec sa raison.
 */
export interface CurrencyRegressionResult {
  tenantId: string
  scanned: number
  /** Revenues en francs ET encore ouvertes : signalees. */
  reverted: number
  /** Revenues en francs mais deja parties : sans consequence. */
  revertedButShipped: number
  /** Toujours en euros : la correction tient. */
  stillConverted: number
  notFound: number
  errors: number
  samples: Array<{ order_ref: string; status: string | null; currencies: string[] }>
}

type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>
}

interface Candidate { id: string; source_order_ref: string }

const MONEY_KEYS = [
  'subtotal_price', 'estimated_shipping_price', 'estimated_tax_price',
  'total_price', 'discount_granted', 'freight_costs',
] as const

/** Les devises encore presentes sur les montants d'une commande. */
export function devisesRestantes(paymentDetails: unknown): string[] {
  if (!paymentDetails || typeof paymentDetails !== 'object') return []
  const details = paymentDetails as Record<string, unknown>
  const devises = new Set<string>()
  for (const cle of MONEY_KEYS) {
    const montant = details[cle]
    if (montant && typeof montant === 'object' && 'currency' in montant) {
      const devise = String((montant as { currency: unknown }).currency ?? '').toUpperCase()
      if (devise) devises.add(devise)
    }
  }
  return [...devises].sort()
}

export async function detecterRegressionsDevise(
  client: RpcClient,
  tenantId: string,
  credentials: SendcloudCredentials,
  limit: number,
  dryRun: boolean,
  deps: { findOrder?: typeof findOrderByNumber } = {},
): Promise<CurrencyRegressionResult> {
  const res: CurrencyRegressionResult = {
    tenantId, scanned: 0, reverted: 0, revertedButShipped: 0,
    stillConverted: 0, notFound: 0, errors: 0, samples: [],
  }

  const { data, error } = await client.rpc('verified_currency_candidates', {
    p_tenant_id: tenantId,
    p_limit: limit,
  })
  // Une erreur de lecture avalee ferait passer « aucun candidat » pour
  // « tout va bien ». Elle doit se voir dans le resultat du passage.
  if (error) {
    res.errors += 1
    return res
  }

  const findOrder = deps.findOrder ?? findOrderByNumber
  for (const candidate of (data ?? []) as Candidate[]) {
    res.scanned += 1
    const lookup = await findOrder(credentials, candidate.source_order_ref)
    if (!lookup.ok) {
      res.notFound += 1
      continue
    }

    const order = lookup.order
    const devises = devisesRestantes((order as { payment_details?: unknown }).payment_details)
    const statut = order.order_details?.status?.code ?? null
    const revenue = devises.some((devise) => devise !== 'EUR')

    if (!revenue) {
      res.stillConverted += 1
      if (!dryRun) await client.rpc('touch_auto_fix_job_verified', { p_job_id: candidate.id })
      continue
    }

    // Revenue en francs, mais le colis est parti : la conversion avait tenu
    // le temps qu'il fallait. Rien a signaler, et on ne la relit plus.
    if (!isCorrigible(order)) {
      res.revertedButShipped += 1
      if (!dryRun) await client.rpc('touch_auto_fix_job_verified', { p_job_id: candidate.id })
      continue
    }

    res.reverted += 1
    if (res.samples.length < 25) {
      res.samples.push({ order_ref: candidate.source_order_ref, status: statut, currencies: devises })
    }
    if (!dryRun) {
      await client.rpc('flag_auto_fix_currency_regression', {
        p_job_id: candidate.id,
        p_detail: `montants revenus en ${devises.filter((d) => d !== 'EUR').join(', ')} apres la conversion`,
      })
    }
  }

  return res
}
