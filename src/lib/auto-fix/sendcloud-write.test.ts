import { afterEach, describe, expect, it, vi } from 'vitest'
import { patchParcelById, classifyWriteFailure, comparePatch } from './sendcloud-write'

const credentials = { apiKey: 'key', secret: 'secret' }

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

function stubFetch(impl: (url: string, init: RequestInit) => unknown) {
  const spy = vi.fn(impl)
  vi.stubGlobal('fetch', spy as unknown as typeof fetch)
  return spy
}

describe('patchParcelById', () => {
  it('uses the validated contract: no id in the path, id in the body', async () => {
    const spy = stubFetch(() => ({
      ok: true, status: 200, json: async () => ({ parcel: { id: 123 } }),
    }))

    await patchParcelById(credentials, { id: '123', patch: { city: 'Lyon' } })

    const [url, init] = spy.mock.calls[0]
    // Le spike a valide PUT /api/v2/parcels avec l'id dans le corps ; le chemin
    // legacy /parcels/{id} n'est qu'un repli.
    expect(url).toMatch(/\/parcels$/)
    expect(url).not.toMatch(/\/parcels\/123/)
    expect(JSON.parse(String(init.body))).toEqual({ parcel: { id: 123, city: 'Lyon' } })
    expect(init.method).toBe('PUT')
  })

  it('refuses to follow a redirect, so the call cannot be diverted', async () => {
    const spy = stubFetch(() => ({ ok: true, status: 200, json: async () => ({}) }))
    await patchParcelById(credentials, { id: '1', patch: { city: 'Lyon' } })
    expect(spy.mock.calls[0][1].redirect).toBe('error')
  })

  it('never writes in mock mode', async () => {
    const previous = process.env.SENDCLOUD_USE_MOCK
    process.env.SENDCLOUD_USE_MOCK = 'true'
    const spy = stubFetch(() => ({ ok: true, status: 200, json: async () => ({}) }))

    const result = await patchParcelById(credentials, { id: '1', patch: { city: 'Lyon' } })

    expect(spy).not.toHaveBeenCalled()
    expect(result.ok).toBe(false)
    process.env.SENDCLOUD_USE_MOCK = previous
  })

  it('refuses an empty patch instead of sending a pointless write', async () => {
    const spy = stubFetch(() => ({ ok: true, status: 200, json: async () => ({}) }))
    const result = await patchParcelById(credentials, { id: '1', patch: {} })
    expect(result.ok).toBe(false)
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('classifyWriteFailure', () => {
  it('treats a validation 4xx as provably not applied, so a rewrite is allowed', () => {
    expect(classifyWriteFailure({ status: 400 })).toEqual({
      category: 'non_retryable', applied: 'no',
    })
  })

  it('treats 401 and 403 as a configuration problem', () => {
    expect(classifyWriteFailure({ status: 401 }).category).toBe('configuration')
    expect(classifyWriteFailure({ status: 403 }).category).toBe('configuration')
  })

  it('treats 429 as refused before reaching the origin', () => {
    expect(classifyWriteFailure({ status: 429 })).toEqual({
      category: 'retryable', applied: 'no',
    })
  })

  it('treats a 5xx as UNCERTAIN, because the origin may have applied it', () => {
    // C'est le piege que la V1 de la conception avait rate : un 502 de
    // passerelle ne prouve pas que rien n'a ete ecrit.
    for (const status of [500, 502, 503, 504]) {
      expect(classifyWriteFailure({ status }).applied).toBe('unknown')
    }
  })

  it('treats a network error or timeout as uncertain too', () => {
    expect(classifyWriteFailure({ networkError: true }).applied).toBe('unknown')
    expect(classifyWriteFailure({ timeout: true }).applied).toBe('unknown')
  })
})

describe('comparePatch', () => {
  it('confirms a patch actually landed', () => {
    expect(comparePatch({ city: 'Lyon' }, { city: 'Lyon', country: 'FR' })).toEqual({
      matches: true, mismatched: [],
    })
  })

  it('ignores formatting differences that Sendcloud introduces', () => {
    // Une adresse re-trimee ou recasee n'est pas un echec d'ecriture.
    expect(comparePatch({ city: 'Lyon ' }, { city: 'lyon' }).matches).toBe(true)
  })

  it('reports a real mismatch instead of passing it silently', () => {
    const result = comparePatch({ city: 'Lyon' }, { city: 'Marseille' })
    expect(result.matches).toBe(false)
    expect(result.mismatched).toEqual(['city'])
  })

  it('treats a missing field as a mismatch, not as a success', () => {
    expect(comparePatch({ city: 'Lyon' }, {}).matches).toBe(false)
  })

  it('compares numbers by value, not by their textual form', () => {
    expect(comparePatch({ weight: '1.500' }, { weight: '1.5' }).matches).toBe(true)
  })
})
