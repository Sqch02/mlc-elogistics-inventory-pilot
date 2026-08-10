import { describe, it, expect } from 'vitest'
import { returnsSontDus } from './cron/route'

describe('espacement de la lecture des retours', () => {
  const T = (iso: string) => iso

  it('lit quand la ressource n a jamais ete lue', () => {
    expect(returnsSontDus(undefined, T('2026-08-10T12:00:00Z'), {})).toBe(true)
  })

  it('saute un cycle de cinq minutes', () => {
    // C'est tout l'objet : l'API ignore le filtre incremental et renvoie la
    // collection entiere a chaque appel.
    expect(returnsSontDus(T('2026-08-10T11:55:00Z'), T('2026-08-10T12:00:00Z'), {})).toBe(false)
  })

  it('lit une fois l heure ecoulee', () => {
    expect(returnsSontDus(T('2026-08-10T11:00:00Z'), T('2026-08-10T12:00:00Z'), {})).toBe(true)
  })

  it('respecte un intervalle configure', () => {
    const env = { SENDCLOUD_RETURNS_INTERVAL_MINUTES: '15' }
    expect(returnsSontDus(T('2026-08-10T11:50:00Z'), T('2026-08-10T12:00:00Z'), env)).toBe(false)
    expect(returnsSontDus(T('2026-08-10T11:40:00Z'), T('2026-08-10T12:00:00Z'), env)).toBe(true)
  })

  it('permet de revenir a chaque cycle avec un intervalle nul', () => {
    expect(returnsSontDus(T('2026-08-10T11:59:59Z'), T('2026-08-10T12:00:00Z'),
      { SENDCLOUD_RETURNS_INTERVAL_MINUTES: '0' })).toBe(true)
  })

  it('lit plutot que de sauter quand l horodatage est illisible', () => {
    // Fail-open : un horodatage casse ne doit pas geler la ressource pour
    // toujours. Une lecture inutile coute moins qu'un retour jamais vu.
    expect(returnsSontDus('pas une date', T('2026-08-10T12:00:00Z'), {})).toBe(true)
  })

  it('ignore un intervalle absurde et retombe sur une heure', () => {
    expect(returnsSontDus(T('2026-08-10T11:55:00Z'), T('2026-08-10T12:00:00Z'),
      { SENDCLOUD_RETURNS_INTERVAL_MINUTES: 'beaucoup' })).toBe(false)
  })
})
