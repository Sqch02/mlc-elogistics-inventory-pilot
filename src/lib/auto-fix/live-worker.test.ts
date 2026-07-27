import { beforeEach, describe, expect, it, vi } from 'vitest'
import { runAutoFixLiveWorker, ARMED_LIVE_PATTERNS } from './live-worker'

const LIVE_ENV = {
  AUTO_FIX_PAUSED: 'false',
  AUTO_FIX_DRY_RUN_ENABLED: 'true',
  AUTO_FIX_LIVE_ENABLED: 'true',
}

function job(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    tenant_id: 'tenant-1',
    shipment_id: 'ship-1',
    source_kind: 'parcel',
    source_sendcloud_id: '12345',
    source_fingerprint: 'f'.repeat(64),
    primary_pattern: 'address_too_long',
    detected_patterns: ['address_too_long'],
    operation_key: 'a'.repeat(64),
    mode: 'live',
    original_sendcloud_id: '12345',
    evidence_json: {},
    source_summary_json: {
      address_limits: [{ field: 'city', max: 20 }],
      raw_fields: { city: 'Saint-Rémy-de-Provence' },
    },
    ...overrides,
  }
}

/** Client Supabase minimal : on observe la sequence exacte des RPC. */
function makeClient(options: {
  tenants?: unknown[]
  resume?: unknown[]
  claim?: unknown[]
  overrides?: Record<string, unknown>
} = {}) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = []
  const defaults: Record<string, unknown> = {
    get_auto_fix_live_tenants: options.tenants ?? [{ tenant_id: 'tenant-1', max_candidates: 5 }],
    resume_auto_fix_writes: options.resume ?? [],
    claim_auto_fix_jobs: options.claim ?? [job()],
    plan_auto_fix_live: true,
    begin_auto_fix_write: true,
    mark_auto_fix_applied: true,
    verify_auto_fix_live: true,
    fail_auto_fix_live: 'retry_wait',
    fail_auto_fix_verification: 'retry_verify',
    cleanup_auto_fix_pii: 0,
    ...(options.overrides ?? {}),
  }
  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    calls.push({ name, args })
    const value = defaults[name]
    if (value instanceof Error) throw value
    return { data: value, error: null }
  })
  return { client: { rpc } as never, rpc, calls, names: () => calls.map((c) => c.name) }
}

const deps = (overrides: Record<string, unknown> = {}) => ({
  credentials: async () => ({ apiKey: 'k', secret: 's' }),
  readParcel: vi.fn(async () => ({
    sendcloud_id: '12345', status_id: 1002, city: 'Saint-Rémy-de-Provence',
    fingerprint: 'f'.repeat(64),
  })),
  writeParcel: vi.fn(async () => ({ ok: true, status: 200, resultSendcloudId: '12345' })),
  ...overrides,
})

describe('runAutoFixLiveWorker — garde-fous', () => {
  beforeEach(() => vi.clearAllMocks())

  it('ne fait rien si la pause globale est active', async () => {
    const { client, rpc } = makeClient()
    const result = await runAutoFixLiveWorker(client, { ...LIVE_ENV, AUTO_FIX_PAUSED: 'true' }, deps())
    expect(result).toMatchObject({ paused: true })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('ne fait rien si le live n est pas explicitement arme', async () => {
    const { client, rpc } = makeClient()
    const result = await runAutoFixLiveWorker(client, { ...LIVE_ENV, AUTO_FIX_LIVE_ENABLED: 'false' }, deps())
    expect(result).toMatchObject({ paused: true })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('ne fait rien si la synchronisation est en pause', async () => {
    const { client, rpc } = makeClient()
    const result = await runAutoFixLiveWorker(client, { ...LIVE_ENV, SYNC_PAUSED: 'true' }, deps())
    expect(result).toMatchObject({ paused: true })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('n arme que les patterns valides', () => {
    expect(ARMED_LIVE_PATTERNS).toEqual(['address_too_long'])
  })
})

describe('runAutoFixLiveWorker — sequence normale', () => {
  beforeEach(() => vi.clearAllMocks())

  it('commite l intention AVANT d appeler Sendcloud', async () => {
    const { client, names } = makeClient()
    const d = deps()
    await runAutoFixLiveWorker(client, LIVE_ENV, d)

    const order = names()
    const begin = order.indexOf('begin_auto_fix_write')
    const mark = order.indexOf('mark_auto_fix_applied')
    expect(begin).toBeGreaterThan(-1)
    // C'est LA regle de surete : la trace precede l'octet envoye.
    expect(d.writeParcel).toHaveBeenCalledTimes(1)
    expect(begin).toBeLessThan(mark)
  })

  it('traite les reprises AVANT les nouvelles ecritures', async () => {
    const { client, names } = makeClient()
    await runAutoFixLiveWorker(client, LIVE_ENV, deps())
    const order = names()
    expect(order.indexOf('resume_auto_fix_writes')).toBeLessThan(order.indexOf('claim_auto_fix_jobs'))
  })

  it('verifie par relecture et marque verified', async () => {
    const { client, names } = makeClient()
    // Premiere lecture : le colis d'origine (controle de fraicheur).
    // Deuxieme lecture : le colis APRES ecriture, donc avec la valeur corrigee.
    let reads = 0
    const d = deps({
      readParcel: vi.fn(async () => {
        reads += 1
        return {
          sendcloud_id: '12345', status_id: 1002, fingerprint: 'f'.repeat(64),
          city: reads === 1 ? 'Saint-Rémy-de-Provence' : 'St-Rémy-de-Provence',
        }
      }),
    })

    const result = await runAutoFixLiveWorker(client, LIVE_ENV, d)

    expect(names()).toContain('verify_auto_fix_live')
    expect(result).toMatchObject({ verified: 1, written: 1 })
  })

  it('refuse de marquer verified si la relecture contredit le patch', async () => {
    const { client, names } = makeClient()
    // Le colis ne porte pas la valeur attendue : l'ecriture n'a pas pris.
    const d = deps()

    const result = await runAutoFixLiveWorker(client, LIVE_ENV, d)

    expect(names()).not.toContain('verify_auto_fix_live')
    expect(names()).toContain('fail_auto_fix_verification')
    expect(result).toMatchObject({ verified: 0 })
  })
})

describe('runAutoFixLiveWorker — jamais deux ecritures', () => {
  beforeEach(() => vi.clearAllMocks())

  it('un job repris ne reecrit JAMAIS, il verifie', async () => {
    const { client, names } = makeClient({
      resume: [job({
        id: 'job-resume',
        state: 'applied',
        write_started_at: '2026-07-25T00:00:00Z',
        // Le patch reellement envoye vit dans plan_json, pas ailleurs.
        plan_json: { patch: { city: 'St-Rémy-de-Provence' } },
      })],
      claim: [],
    })
    const d = deps({
      readParcel: vi.fn(async () => ({
        sendcloud_id: '12345', status_id: 1002, fingerprint: 'f'.repeat(64),
        city: 'St-Rémy-de-Provence',
      })),
    })

    await runAutoFixLiveWorker(client, LIVE_ENV, d)

    // Aucune ecriture, aucune replanification.
    expect(d.writeParcel).not.toHaveBeenCalled()
    expect(names()).not.toContain('begin_auto_fix_write')
    expect(names()).not.toContain('plan_auto_fix_live')
    expect(names()).toContain('verify_auto_fix_live')
  })

  it('une reprise sans patch attendu escalade au lieu de confirmer a l aveugle', async () => {
    // Un ensemble vide ne vaut jamais "tout correspond" : sans patch attendu on
    // ne peut RIEN confirmer. La premiere version lisait un champ qu'aucun code
    // n'ecrit, et estampillait donc "verified" toute ecriture, meme incertaine.
    const { client, names } = makeClient({
      resume: [job({ id: 'job-resume', write_started_at: '2026-07-25T00:00:00Z' })],
      claim: [],
    })
    const d = deps()

    const result = await runAutoFixLiveWorker(client, LIVE_ENV, d)

    expect(names()).not.toContain('verify_auto_fix_live')
    expect(names()).toContain('fail_auto_fix_verification')
    expect(result).toMatchObject({ verified: 0 })
  })

  it('une reprise dont la relecture contredit le patch n est pas confirmee', async () => {
    const { client, names } = makeClient({
      resume: [job({
        id: 'job-resume',
        write_started_at: '2026-07-25T00:00:00Z',
        plan_json: { patch: { city: 'St-Rémy-de-Provence' } },
      })],
      claim: [],
    })
    const d = deps() // renvoie la ville d'origine, non raccourcie

    await runAutoFixLiveWorker(client, LIVE_ENV, d)

    expect(names()).not.toContain('verify_auto_fix_live')
    expect(names()).toContain('fail_auto_fix_verification')
  })

  it('un echec de verification ne repasse jamais par le routeur pre-ecriture', async () => {
    const { client, names } = makeClient({
      resume: [job({ id: 'job-resume', write_started_at: '2026-07-25T00:00:00Z' })],
      claim: [],
    })
    const d = deps({ readParcel: vi.fn(async () => { throw new Error('429 rate limited') }) })

    await runAutoFixLiveWorker(client, LIVE_ENV, d)

    expect(names()).toContain('fail_auto_fix_verification')
    // Le routeur pre-ecriture reenverrait le job en reecriture : interdit ici.
    expect(names()).not.toContain('fail_auto_fix_live')
    expect(d.writeParcel).not.toHaveBeenCalled()
  })

  it('un resultat incertain ne declenche pas de seconde ecriture', async () => {
    const { client, names } = makeClient()
    const d = deps({
      writeParcel: vi.fn(async () => ({
        ok: false, status: 502,
        failure: { category: 'retryable' as const, applied: 'unknown' as const },
      })),
    })

    await runAutoFixLiveWorker(client, LIVE_ENV, d)

    expect(d.writeParcel).toHaveBeenCalledTimes(1)
    // L'origine a peut-etre applique : on relit, on ne reecrit pas.
    expect(names()).toContain('fail_auto_fix_verification')
    expect(names()).not.toContain('fail_auto_fix_live')
  })

  it('si le bail est perdu juste avant l ecriture, on n ecrit pas', async () => {
    const { client } = makeClient({ overrides: { begin_auto_fix_write: false } })
    const d = deps()

    await runAutoFixLiveWorker(client, LIVE_ENV, d)

    expect(d.writeParcel).not.toHaveBeenCalled()
  })
})

describe('runAutoFixLiveWorker — refus avant ecriture', () => {
  beforeEach(() => vi.clearAllMocks())

  it('refuse un pattern non arme', async () => {
    const { client, names } = makeClient({
      claim: [job({ primary_pattern: 'currency_chf', detected_patterns: ['currency_chf'] })],
    })
    const d = deps()

    const result = await runAutoFixLiveWorker(client, LIVE_ENV, d)

    expect(d.writeParcel).not.toHaveBeenCalled()
    expect(names()).toContain('fail_auto_fix_live')
    expect(result).toMatchObject({ skipped: 1 })
  })

  // --- Commandes importees, via l'API v3 -----------------------------------
  //
  // L'API v2 ne sait pas les modifier (la ressource individuelle renvoie 404).
  // La v3, si : OPTIONS /api/v3/orders/{id} declare GET, PATCH, DELETE. Ce
  // chemin fait par programme ce que l'exploitation fait avec le crayon.

  const commandeImportee = job({
    source_kind: 'integration_shipment',
    original_sendcloud_id: '6a6d9ac1-97fd-48b0-84b2-25762ad26f2d',
    source_summary_json: { address_limits: [{ field: 'address_1', max: 32 }] },
  })

  const ordre = (over: Record<string, unknown> = {}) => ({
    id: '841973149',
    order_number: '#540787',
    shipping_address: {
      address_line_1: '76 grand rue hoscas Herbignac 44410',
      address_line_2: '',
      house_number: '',
      city: 'Herbignac',
      postal_code: '44410',
    },
    order_details: { status: { code: 'on_hold' } },
    ...over,
  })

  const depsCommande = (over: Record<string, unknown> = {}) => ({
    credentials: async () => ({ apiKey: 'k', secret: 's' }),
    readParcel: vi.fn(async () => null),
    writeParcel: vi.fn(async () => ({ ok: true as const, status: 200 })),
    resolveOrderRef: vi.fn(async () => '#540787'),
    findOrder: vi.fn(async () => ({ ok: true, order: ordre() })),
    patchOrder: vi.fn(async () => ({ ok: true, order: ordre() })),
    verifyOrder: vi.fn(async () => ({ ok: true, ecarts: [] as string[] })),
    ...over,
  } as unknown as Parameters<typeof runAutoFixLiveWorker>[2] & {
    patchOrder: ReturnType<typeof vi.fn>
    findOrder: ReturnType<typeof vi.fn>
  })

  it('corrige une commande importee de bout en bout', async () => {
    const { client, calls, names } = makeClient({ claim: [commandeImportee] })
    const d = depsCommande()
    const result = await runAutoFixLiveWorker(client, LIVE_ENV, d)

    // La ville et le code postal etaient recopies dans la ligne d'adresse :
    // les retirer ne perd rien, ils ont deja leur propre champ.
    expect(d.patchOrder).toHaveBeenCalledOnce()
    const envoye = d.patchOrder.mock.calls[0][2]
    expect(envoye).toEqual({ address_line_1: '76 grand rue hoscas' })

    // L'intention est commitee AVANT l'octet envoye.
    const ordreAppels = names()
    expect(ordreAppels.indexOf('begin_auto_fix_write')).toBeGreaterThan(-1)
    expect(ordreAppels).toContain('mark_auto_fix_applied')
    expect(ordreAppels).toContain('verify_auto_fix_live')
    expect(result).toMatchObject({ written: 1, verified: 1 })

    const plan = calls.find((c) => c.name === 'plan_auto_fix_live')
    expect((plan?.args.p_plan as { action: string }).action).toBe('patch_order_v3')
  })

  it('n ecrit RIEN quand la commande ne peut pas etre identifiee avec certitude', async () => {
    // Sur cette API, trois filtres sur quatre sont ignores en silence et
    // renvoient toute la collection. Corriger le premier resultat venu
    // corrigerait une commande au hasard.
    const { client } = makeClient({ claim: [commandeImportee] })
    const d = depsCommande({ findOrder: vi.fn(async () => ({ ok: false, reason: 'ambiguous' })) })
    await runAutoFixLiveWorker(client, LIVE_ENV, d)
    expect(d.patchOrder).not.toHaveBeenCalled()
  })

  it('s arrete si quelqu un a deja corrige a la main', async () => {
    const dejaCorrigee = ordre({
      shipping_address: { address_line_1: '76 grand rue hoscas', city: 'Herbignac', postal_code: '44410' },
    })
    const { client } = makeClient({ claim: [commandeImportee] })
    const d = depsCommande({ findOrder: vi.fn(async () => ({ ok: true, order: dejaCorrigee })) })
    await runAutoFixLiveWorker(client, LIVE_ENV, d)
    expect(d.patchOrder).not.toHaveBeenCalled()
  })

  it('refuse une commande deja expediee', async () => {
    const expediee = ordre({ order_details: { status: { code: 'shipped' } } })
    const { client } = makeClient({ claim: [commandeImportee] })
    const d = depsCommande({ findOrder: vi.fn(async () => ({ ok: true, order: expediee })) })
    await runAutoFixLiveWorker(client, LIVE_ENV, d)
    expect(d.patchOrder).not.toHaveBeenCalled()
  })

  it('ne confirme JAMAIS sur la reponse du PATCH, seulement sur une relecture', async () => {
    const { client, names } = makeClient({ claim: [commandeImportee] })
    const d = depsCommande({
      verifyOrder: vi.fn(async () => ({ ok: false, ecarts: ['address_line_1: non conserve'] })),
    })
    const result = await runAutoFixLiveWorker(client, LIVE_ENV, d)
    expect(names()).toContain('fail_auto_fix_verification')
    expect(names()).not.toContain('verify_auto_fix_live')
    expect(result).toMatchObject({ failed: 1 })
  })

  it('n ecrit pas sans moyen de retrouver le numero de commande', async () => {
    const { client } = makeClient({ claim: [commandeImportee] })
    const d = depsCommande({ resolveOrderRef: undefined })
    await runAutoFixLiveWorker(client, LIVE_ENV, d)
    expect(d.patchOrder).not.toHaveBeenCalled()
  })

  // Taxonomie reelle du projet : 1 = Annonce, 3 = En transit, 11 = Livre.
  // Un seuil status_id >= 1000 laissait passer les trois.
  const nonEditable: Array<[number | null, string]> = [
    [1, 'annonce'],
    [3, 'en transit'],
    [11, 'livre'],
    [2000, 'annule'],
    [null, 'statut inconnu'],
  ]
  it.each(nonEditable)('refuse d ecrire sur un colis %s (%s)', async (statusId) => {
    const { client } = makeClient()
    const d = deps({
      readParcel: vi.fn(async () => ({
        sendcloud_id: '12345', status_id: statusId,
        city: 'Saint-Rémy-de-Provence', fingerprint: 'f'.repeat(64),
      })),
    })
    await runAutoFixLiveWorker(client, LIVE_ENV, d)
    expect(d.writeParcel).not.toHaveBeenCalled()
  })

  it('refuse un colis dont l annonce est deja partie', async () => {
    const { client } = makeClient()
    const d = deps({
      readParcel: vi.fn(async () => ({
        sendcloud_id: '12345', status_id: 1002, date_announced: '2026-07-25T10:00:00Z',
        city: 'Saint-Rémy-de-Provence', fingerprint: 'f'.repeat(64),
      })),
    })
    await runAutoFixLiveWorker(client, LIVE_ENV, d)
    expect(d.writeParcel).not.toHaveBeenCalled()
  })

  it('refuse si la source a change entre le plan et l ecriture', async () => {
    const { client, names } = makeClient()
    const d = deps({
      readParcel: vi.fn(async () => ({
        sendcloud_id: '12345', status_id: 1002, city: 'Autre ville',
        fingerprint: 'b'.repeat(64),
      })),
    })

    await runAutoFixLiveWorker(client, LIVE_ENV, d)

    expect(d.writeParcel).not.toHaveBeenCalled()
    expect(names()).toContain('fail_auto_fix_live')
  })

  it('refuse un raccourcissement qui perdrait de l information', async () => {
    const { client } = makeClient({
      claim: [job({
        source_summary_json: {
          address_limits: [{ field: 'city', max: 20 }],
          raw_fields: { city: 'Chambretaud Les Grands Champs' },
        },
      })],
    })
    const d = deps({
      readParcel: vi.fn(async () => ({
        sendcloud_id: '12345', status_id: 1002,
        city: 'Chambretaud Les Grands Champs', fingerprint: 'f'.repeat(64),
      })),
    })

    await runAutoFixLiveWorker(client, LIVE_ENV, d)

    // Couper une ville peut changer la destination : revue humaine.
    expect(d.writeParcel).not.toHaveBeenCalled()
  })
})
