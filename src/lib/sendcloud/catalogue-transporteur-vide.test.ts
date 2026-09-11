import { describe, expect, it } from 'vitest'
import { findReplacementServicePoint } from './service-points'

/**
 * Le 10/09 au matin, l'API points relais de Sendcloud n'a renvoye AUCUN
 * point Mondial Relay, nulle part en France, alors que Colis Prive et
 * Chronopost repondaient normalement. 272 commandes ont ete detectees d'un
 * coup avec « Service point no longer operational », et le moteur a repondu
 * « aucun remplacant » pour chacune, puis les a renvoyees a l'exploitant,
 * qui ne pouvait rien en faire non plus.
 *
 * Un catalogue vide n'est pas une commande sans candidat : c'est une panne.
 */
const identifiants = { apiKey: 'k', secret: 's' }
const reponse = (points: unknown[]) =>
  (async () => new Response(JSON.stringify(points), { status: 200 })) as unknown as typeof fetch

const point = (id: number, actif: boolean, carrier = 'mondial_relay') => ({
  id, carrier, is_active: actif, name: `P${id}`, latitude: '48.9', longitude: '2.5',
  street: '', house_number: '', postal_code: '93290', city: '', country: 'FR', code: `FR${id}`,
})

describe('catalogue transporteur vide', () => {
  it('renvoie carrier_catalogue_empty quand l API ne renvoie aucun point du transporteur', async () => {
    const r = await findReplacementServicePoint(identifiants, {
      carrier: 'mondial_relay', country: 'FR', postalCode: '93290', radii: [2000, 5000],
    }, reponse([]))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.reason).toBe('carrier_catalogue_empty')
    expect(r.detail).toContain('mondial_relay')
  })

  it('renvoie no_candidate quand des points existent mais aucun n est utilisable', async () => {
    // Des points renvoyes mais tous inactifs : le catalogue est la, c'est la
    // commande qui n'a pas de solution. Ca reste un arbitrage humain.
    const r = await findReplacementServicePoint(identifiants, {
      carrier: 'mondial_relay', country: 'FR', postalCode: '93290', radii: [2000],
    }, reponse([point(1, false), point(2, false)]))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.reason).toBe('no_candidate')
  })

  it('un point d un AUTRE transporteur ne compte pas comme catalogue present', async () => {
    const r = await findReplacementServicePoint(identifiants, {
      carrier: 'mondial_relay', country: 'FR', postalCode: '93290', radii: [2000],
    }, reponse([point(9, true, 'colisprive')]))
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.reason).toBe('carrier_catalogue_empty')
  })

  it('un point actif du bon transporteur est toujours propose', async () => {
    const r = await findReplacementServicePoint(identifiants, {
      carrier: 'mondial_relay', country: 'FR', postalCode: '93290', radii: [2000],
    }, reponse([point(1, false), point(2, true)]))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.point.id).toBe(2)
  })
})

describe('la panne ne consomme pas de tentative', () => {
  it('la categorie outage existe et attend deux heures sans toucher au compteur', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const sql = readFileSync(join(process.cwd(), 'supabase/migrations/00139_categorie_panne_sans_compteur.sql'), 'utf8')
    const branche = sql.slice(sql.indexOf("IF v_category = 'outage'"), sql.indexOf("IF v_category IN ('non_retryable'"))
    expect(branche).toContain("state = 'retry_wait'")
    expect(branche).toContain("next_attempt_at = now() + interval '2 hours'")
    // Au troisieme echec une tache reessayable disparait en echec definitif ;
    // une panne qui dure ne doit pas produire cet effet.
    expect(branche).not.toContain('attempt_count')
    const moteur = readFileSync(join(process.cwd(), 'src/lib/auto-fix/live-worker.ts'), 'utf8')
    expect(moteur).toContain("refuse('service_point_network_unavailable', 'outage'")
  })
})

describe('un point redevenu actif clot la tache', () => {
  it('service_point_still_active est un etat terminal, pas une tache manuelle', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const moteur = readFileSync(join(process.cwd(), 'src/lib/auto-fix/live-worker.ts'), 'utf8')
    // Le 10/09, 48 commandes sont arrivees dans la liste de l'exploitant avec
    // pour seul message « le point fonctionne a nouveau ».
    expect(moteur).toMatch(/refuse\(\s*'service_point_still_active',\s*'resolved'/)
  })
})
