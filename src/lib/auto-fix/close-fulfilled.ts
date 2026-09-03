import type { SendcloudCredentials } from '@/lib/sendcloud/types'
import { findOrderByNumber, isCorrigible } from '@/lib/sendcloud/orders-v3'

/**
 * Referme les taches manuelles dont la commande est deja partie.
 *
 * Mesure du 03/09 : 40 des 44 commandes en attente manuelle etaient
 * `fulfilled` chez Sendcloud. L'exploitant les avait corrigees a la main et
 * expediees ; les taches restaient affichees comme du travail a faire. 90 % de
 * la file etait du travail deja fait — la meme situation que le 07/08 et le
 * 24/08, par une troisieme porte.
 *
 * Une tache en `pending_manual` n'est jamais re-examinee par le moteur : le
 * verdict `order_not_corrigible`, qui existe, ne pouvait donc pas la
 * rattraper. Ce passage relit la commande chez Sendcloud, une par une, et ne
 * referme QUE si elle n'est plus corrigeable. Une commande encore ouverte est
 * simplement horodatee, pour ne pas etre relue avant 24 h.
 */
export interface CloseFulfilledResult {
  tenantId: string
  scanned: number
  closed: number
  stillOpen: number
  notFound: number
  errors: number
  samples: Array<{ order_ref: string; status: string | null }>
}

type RpcClient = {
  rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>
}

interface Candidate { id: string; source_order_ref: string }

export async function closeFulfilledOrders(
  client: RpcClient,
  tenantId: string,
  credentials: SendcloudCredentials,
  limit: number,
  dryRun: boolean,
  deps: { findOrder?: typeof findOrderByNumber } = {},
): Promise<CloseFulfilledResult> {
  const res: CloseFulfilledResult = {
    tenantId, scanned: 0, closed: 0, stillOpen: 0, notFound: 0, errors: 0, samples: [],
  }
  const chercher = deps.findOrder ?? findOrderByNumber

  const { data, error } = await client.rpc('pending_manual_order_candidates', {
    p_tenant_id: tenantId, p_limit: limit,
  })
  // Le retour est verifie : un delai depasse ou un droit manquant ne doit pas
  // se lire « zero candidat ».
  if (error) {
    res.errors++
    return res
  }
  const candidats = (data ?? []) as Candidate[]
  res.scanned = candidats.length

  for (const c of candidats) {
    try {
      const lookup = await chercher(credentials, c.source_order_ref)
      if (!lookup.ok) {
        // Introuvable ou ambigue : on ne conclut rien, on n'y touche pas. Ce
        // n'est pas une preuve que la commande est partie.
        res.notFound++
        continue
      }
      const statut = lookup.order.order_details?.status?.code ?? null
      if (isCorrigible(lookup.order)) {
        res.stillOpen++
        if (!dryRun) await client.rpc('touch_auto_fix_job_checked', { p_job_id: c.id })
        continue
      }
      if (res.samples.length < 25) res.samples.push({ order_ref: c.source_order_ref, status: statut })
      if (!dryRun) {
        const { data: ok, error: e } = await client.rpc('close_auto_fix_job_obsolete', {
          p_job_id: c.id,
          p_reason: 'order_not_corrigible',
          p_detail: `commande ${statut ?? 'sans statut'} chez Sendcloud : deja traitee par l'exploitant`,
        })
        if (e || ok !== true) { res.errors++; continue }
      }
      res.closed++
    } catch {
      res.errors++
    }
  }
  return res
}
