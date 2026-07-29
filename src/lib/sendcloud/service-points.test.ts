import { describe, it, expect, vi } from 'vitest'
import {
  getServicePoint,
  findReplacementServicePoint,
  distanceKm,
  DEFAULT_RADII,
  type ServicePoint,
} from './service-points'

const credentials = { apiKey: 'k', secret: 's' }

const point = (over: Partial<ServicePoint> = {}): ServicePoint => ({
  id: 11627787,
  name: 'TABAC DES FACULTES',
  carrier: 'mondial_relay',
  is_active: true,
  postal_code: '11000',
  city: 'CARCASSONNE',
  country: 'FR',
  latitude: '43.2130',
  longitude: '2.3491',
  ...over,
})

const reponse = (body: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) }) as unknown as Response

describe('lecture d un point relais', () => {
  it('renvoie le transporteur, que la commande ne porte pas', async () => {
    // La commande ne contient qu'un identifiant, et le nom de methode au
    // checkout ("Livraison en point relais") ne dit pas de quel reseau il
    // s'agit. C'est cette lecture qui l'etablit.
    const f = vi.fn(async () => reponse(point()))
    const r = await getServicePoint(credentials, 11627787, f as never)
    expect(r).toMatchObject({ ok: true })
    expect((r as { point: ServicePoint }).point.carrier).toBe('mondial_relay')
  })

  it('distingue un point disparu d une panne', async () => {
    const f = vi.fn(async () => reponse({}, 404))
    expect(await getServicePoint(credentials, 1, f as never)).toMatchObject({ ok: false, reason: 'not_found' })
  })

  it('distingue un acces non active d une erreur passagere', async () => {
    // Reessayer un reglage manquant ne l'activera jamais : il faut pouvoir
    // router ce cas vers une action humaine plutot que vers une nouvelle
    // tentative.
    const f = vi.fn(async () => reponse({ error: { message: 'Service point support is not activated' } }, 400))
    expect(await getServicePoint(credentials, 1, f as never)).toMatchObject({ ok: false, reason: 'unavailable' })
  })

  it('signale une erreur serveur comme telle', async () => {
    const f = vi.fn(async () => reponse({}, 503))
    expect(await getServicePoint(credentials, 1, f as never)).toMatchObject({ ok: false, reason: 'http_error' })
  })
})

describe('recherche d un remplacant', () => {
  it('demande le MEME transporteur a l API', async () => {
    const f = vi.fn(async (_u: string | URL | Request, _i?: RequestInit) => reponse([point({ id: 2 })]))
    await findReplacementServicePoint(credentials, {
      carrier: 'mondial_relay', country: 'FR', postalCode: '11000',
    }, f as never)
    expect(String(f.mock.calls[0][0])).toContain('carrier=mondial_relay')
  })

  it('ecarte un point d un AUTRE transporteur meme si l API en renvoie un', async () => {
    // Le filtre de l'API est fiable, mais on ne remet pas a un service tiers
    // une decision qui engage une livraison et un contrat.
    const f = vi.fn(async () => reponse([point({ id: 2, carrier: 'colissimo' })]))
    const r = await findReplacementServicePoint(credentials, {
      carrier: 'mondial_relay', country: 'FR', postalCode: '11000', radii: [5000],
    }, f as never)
    expect(r).toMatchObject({ ok: false, reason: 'no_candidate' })
  })

  it('ecarte un point ferme', async () => {
    const f = vi.fn(async () => reponse([point({ id: 2, is_active: false })]))
    const r = await findReplacementServicePoint(credentials, {
      carrier: 'mondial_relay', country: 'FR', postalCode: '11000', radii: [5000],
    }, f as never)
    expect(r).toMatchObject({ ok: false, reason: 'no_candidate' })
  })

  it('ne propose pas le point defaillant lui-meme', async () => {
    const f = vi.fn(async () => reponse([point({ id: 11627787 })]))
    const r = await findReplacementServicePoint(credentials, {
      carrier: 'mondial_relay', country: 'FR', postalCode: '11000',
      excludeId: 11627787, radii: [5000],
    }, f as never)
    expect(r).toMatchObject({ ok: false, reason: 'no_candidate' })
  })

  it('elargit le rayon par paliers et s arrete au premier resultat', async () => {
    let appel = 0
    const f = vi.fn(async () => {
      appel += 1
      return reponse(appel < 3 ? [] : [point({ id: 9 })])
    })
    const r = await findReplacementServicePoint(credentials, {
      carrier: 'mondial_relay', country: 'FR', postalCode: '11000',
    }, f as never)
    expect(r).toMatchObject({ ok: true, radius: DEFAULT_RADII[2] })
    expect(f).toHaveBeenCalledTimes(3)
  })

  it('retient le plus proche du CHOIX INITIAL du client', async () => {
    // Le client a peut-etre choisi un relais pres de son travail. Le deplacer
    // vers le plus proche de son domicile presumerait de ses habitudes.
    const origine = { latitude: '43.2130', longitude: '2.3491' }
    const loin = point({ id: 2, latitude: '43.3000', longitude: '2.5000' })
    const proche = point({ id: 3, latitude: '43.2140', longitude: '2.3500' })
    const f = vi.fn(async () => reponse([loin, proche]))

    const r = await findReplacementServicePoint(credentials, {
      carrier: 'mondial_relay', country: 'FR', postalCode: '11000',
      origin: origine, radii: [5000],
    }, f as never)

    expect(r).toMatchObject({ ok: true })
    expect((r as { point: ServicePoint }).point.id).toBe(3)
    expect((r as { alternatives: number }).alternatives).toBe(1)
  })

  it('remonte le nombre d alternatives, pour que la decision soit relisible', async () => {
    const f = vi.fn(async () => reponse([point({ id: 2 }), point({ id: 3 }), point({ id: 4 })]))
    const r = await findReplacementServicePoint(credentials, {
      carrier: 'mondial_relay', country: 'FR', postalCode: '11000', radii: [5000],
    }, f as never)
    expect(r).toMatchObject({ ok: true, alternatives: 2 })
  })

  it('n insiste pas quand l acces n est pas activé', async () => {
    const f = vi.fn(async () => reponse({ error: { message: 'not activated' } }, 400))
    const r = await findReplacementServicePoint(credentials, {
      carrier: 'mondial_relay', country: 'FR', postalCode: '11000',
    }, f as never)
    expect(r).toMatchObject({ ok: false, reason: 'unavailable' })
    // Un seul appel : inutile d'elargir le rayon si le service est ferme.
    expect(f).toHaveBeenCalledTimes(1)
  })
})

describe('distance', () => {
  it('calcule une distance plausible', () => {
    const d = distanceKm({ latitude: '43.2130', longitude: '2.3491' }, { latitude: '43.2140', longitude: '2.3500' })
    expect(d).not.toBeNull()
    expect(d!).toBeLessThan(1)
  })

  it('renvoie null plutot qu un zero trompeur quand une coordonnee manque', () => {
    expect(distanceKm({ latitude: null, longitude: null }, { latitude: '43', longitude: '2' })).toBeNull()
  })
})
