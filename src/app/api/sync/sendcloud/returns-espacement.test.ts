import { describe, it, expect } from 'vitest'
import { returnsSontDus, commandesSontDues } from './cron/route'

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

describe('espacement applique meme en pagination', () => {
  it('espace aussi un drain en cours', () => {
    // J'avais d'abord exempte les paginations en cours. Le plus gros
    // consommateur etait justement en pagination perpetuelle : 453 retours,
    // deux pages par cycle, un drain qui ne se termine jamais. L'exception le
    // rendait immunise contre le correctif.
    //
    // Reprendre n'apporte rien d'incremental quand le filtre est ignore :
    // c'est toujours la meme collection.
    expect(returnsSontDus('2026-08-10T11:57:00Z', '2026-08-10T12:00:00Z', {})).toBe(false)
  })

  it('reprend le drain au passage horaire suivant', () => {
    // Le curseur est conserve : le drain se poursuit, il ne recommence pas.
    expect(returnsSontDus('2026-08-10T11:00:00Z', '2026-08-10T12:00:00Z', {})).toBe(true)
  })
})

describe('espacement de la lecture des commandes', () => {
  it('lit quand la ressource n a jamais ete lue', () => {
    expect(commandesSontDues(undefined, '2026-08-17T12:00:00Z', {})).toBe(true)
  })

  it('saute un cycle de cinq minutes', () => {
    // 140 000 lectures par jour pour ~500 commandes distinctes : la liste
    // complete est relue a chaque passage, faute de filtre incremental.
    expect(commandesSontDues('2026-08-17T11:55:00Z', '2026-08-17T12:00:00Z', {})).toBe(false)
  })

  it('lit au bout de quinze minutes', () => {
    // Cadence alignee sur le moteur d'auto-correction : lire plus souvent que
    // le consommateur ne peut agir ne sert a rien.
    expect(commandesSontDues('2026-08-17T11:45:00Z', '2026-08-17T12:00:00Z', {})).toBe(true)
  })

  it('respecte un intervalle configure', () => {
    const env = { SENDCLOUD_ORDERS_INTERVAL_MINUTES: '5' }
    expect(commandesSontDues('2026-08-17T11:56:00Z', '2026-08-17T12:00:00Z', env)).toBe(false)
    expect(commandesSontDues('2026-08-17T11:54:00Z', '2026-08-17T12:00:00Z', env)).toBe(true)
  })

  it('lit plutot que de sauter quand l horodatage est illisible', () => {
    expect(commandesSontDues('pas une date', '2026-08-17T12:00:00Z', {})).toBe(true)
  })

  it('garde des intervalles distincts pour retours et commandes', () => {
    // A dix minutes d'ecart : les commandes ne sont pas dues (15 min), les
    // retours non plus (60 min). A vingt minutes, seules les commandes le sont.
    expect(commandesSontDues('2026-08-17T11:40:00Z', '2026-08-17T12:00:00Z', {})).toBe(true)
    expect(returnsSontDus('2026-08-17T11:40:00Z', '2026-08-17T12:00:00Z', {})).toBe(false)
  })
})
