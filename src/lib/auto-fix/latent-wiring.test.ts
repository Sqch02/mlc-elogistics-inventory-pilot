import { describe, it, expect, vi } from 'vitest'
import { latentRulesFromEnv, OBSERVED_RULES } from './validate'
import { enqueueDetectedSyncBatch } from './ingest'
import type { ParsedShipment } from '@/lib/sendcloud/types'

const defaults = { defaultHsCode: null, defaultOriginCountry: null }

function shipment(address: string): ParsedShipment {
  return {
    sendcloud_id: 'uuid-1-a',
    order_ref: '#1',
    raw_json: {
      address,
      house_number: '',
      address_2: '',
      city: 'SADIRAC',
      postal_code: '33670',
      country: 'FR',
      parcel_items: [{ description: 'x', quantity: 1 }],
      order_status: { id: 'on_hold', message: 'On Hold' },
    },
  } as unknown as ParsedShipment
}

function client() {
  const rpc = vi.fn().mockResolvedValue({ data: 1, error: null })
  return { client: { rpc }, rpc }
}

const resolveIds = async (ids: string[]) => new Map(ids.map((id) => [id, `shipment-${id}`]))

describe('activation de la detection latente', () => {
  it('reste desactivee tant que la variable ne vaut pas exactement true', () => {
    expect(latentRulesFromEnv({})).toBeNull()
    expect(latentRulesFromEnv({ AUTO_FIX_LATENT_DETECTION: 'false' })).toBeNull()
    expect(latentRulesFromEnv({ AUTO_FIX_LATENT_DETECTION: '1' })).toBeNull()
    expect(latentRulesFromEnv({ AUTO_FIX_LATENT_DETECTION: 'TRUE' })).toBeNull()
    expect(latentRulesFromEnv({ AUTO_FIX_LATENT_DETECTION: 'true' })).toBe(OBSERVED_RULES)
  })
})

describe('coherence entre le filtre et la construction', () => {
  const tropLongue = shipment('18 chemin de la porterie 33670 SADIRAC ET DES VIGNES')

  it('ne retient rien sans activation', async () => {
    const { client: c, rpc } = client()
    const result = await enqueueDetectedSyncBatch(
      c as never, 'tenant-1', [tropLongue], defaults, resolveIds, 10, null,
    )
    expect(result.eligible).toBe(0)
    expect(result.detected).toBe(0)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('retient ET construit la meme commande une fois active', async () => {
    // Le defaut que ce test previent : le filtre et le constructeur appellent
    // le detecteur SEPAREMENT. S'ils ne recoivent pas les memes regles, le
    // filtre retient une commande que le constructeur rejette — le compte
    // d'eligibles annonce alors du travail qui n'existe pas.
    const { client: c, rpc } = client()
    const result = await enqueueDetectedSyncBatch(
      c as never, 'tenant-1', [tropLongue], defaults, resolveIds, 10, OBSERVED_RULES,
    )
    expect(result.eligible).toBe(1)
    expect(result.resolved).toBe(1)
    expect(result.detected).toBe(1)
    expect(rpc).toHaveBeenCalledOnce()
  })

  it('cree une tache au mode du CLIENT, pas toujours en simulation', async () => {
    // Le defaut que ce test previent : le mode etait fige a 'simulated'. La
    // reclamation exige que le mode de la tache ET celui du client
    // coincident — un client passe en ecriture n'aurait donc trouve AUCUNE
    // tache, et l'armement aurait silencieusement tout arrete.
    const { client: c, rpc } = client()
    await enqueueDetectedSyncBatch(
      c as never, 'tenant-1', [tropLongue], defaults, resolveIds, 10, OBSERVED_RULES, 'live',
    )
    const jobs = (rpc.mock.calls[0][1] as { p_jobs: Array<{ mode: string }> }).p_jobs
    expect(jobs[0].mode).toBe('live')
  })

  it('reste en simulation par defaut', async () => {
    const { client: c, rpc } = client()
    await enqueueDetectedSyncBatch(
      c as never, 'tenant-1', [tropLongue], defaults, resolveIds, 10, OBSERVED_RULES,
    )
    const jobs = (rpc.mock.calls[0][1] as { p_jobs: Array<{ mode: string }> }).p_jobs
    expect(jobs[0].mode).toBe('simulated')
  })

  it('laisse passer une commande conforme, meme activee', async () => {
    const { client: c, rpc } = client()
    const result = await enqueueDetectedSyncBatch(
      c as never, 'tenant-1', [shipment('12 rue des Lilas')], defaults, resolveIds, 10, OBSERVED_RULES,
    )
    expect(result.eligible).toBe(0)
    expect(rpc).not.toHaveBeenCalled()
  })
})
