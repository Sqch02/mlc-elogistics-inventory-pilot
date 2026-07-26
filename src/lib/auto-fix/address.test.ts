import { describe, expect, it } from 'vitest'
import { shortenAddressField, planAddressShortening } from './address'

describe('shortenAddressField', () => {
  it('abbreviates known tokens without losing meaning', () => {
    const result = shortenAddressField('Saint-Rémy-de-Provence', 20)
    expect(result.value).toBe('St-Rémy-de-Provence')
    expect(result.value.length).toBeLessThanOrEqual(20)
    expect(result.lossy).toBe(false)
    expect(result.applied).toContain('abbreviate')
  })

  it('abbreviates street types too', () => {
    const result = shortenAddressField('123 Boulevard des Peupliers', 20)
    expect(result.value).toBe('123 Bd des Peupliers')
    expect(result.lossy).toBe(false)
  })

  it('collapses redundant whitespace before anything else', () => {
    const result = shortenAddressField('12   rue   des   Lilas', 18)
    expect(result.value).toBe('12 rue des Lilas')
    expect(result.lossy).toBe(false)
    expect(result.applied).toContain('collapse_whitespace')
  })

  it('leaves a value that already fits completely untouched', () => {
    const result = shortenAddressField('Lyon', 26)
    expect(result.value).toBe('Lyon')
    expect(result.applied).toEqual([])
    expect(result.lossy).toBe(false)
  })

  it('marks a word-boundary cut as lossy', () => {
    // Aucune abreviation possible : on perd de l'information.
    const result = shortenAddressField('Chambretaud Les Grands Champs', 20)
    expect(result.value.length).toBeLessThanOrEqual(20)
    expect(result.lossy).toBe(true)
    expect(result.applied).toContain('word_boundary')
  })

  it('hard-truncates a single oversized word as a last resort, still lossy', () => {
    const result = shortenAddressField('Bourgneufenmauges'.repeat(2), 20)
    expect(result.value.length).toBe(20)
    expect(result.lossy).toBe(true)
    expect(result.applied).toContain('truncate')
  })

  it('never returns an empty value', () => {
    const result = shortenAddressField('Villeneuve', 3)
    expect(result.value.length).toBeGreaterThan(0)
  })

  it('is idempotent: re-shortening an already-shortened value changes nothing', () => {
    const once = shortenAddressField('Saint-Rémy-de-Provence', 20)
    const twice = shortenAddressField(once.value, 20)
    expect(twice.value).toBe(once.value)
  })

  it('refuses a limit that makes no sense instead of inventing a value', () => {
    expect(shortenAddressField('Lyon', 0).value).toBe('Lyon')
    expect(shortenAddressField('Lyon', -1).value).toBe('Lyon')
  })
})

describe('planAddressShortening', () => {
  const raw = {
    city: 'Saint-Rémy-de-Provence',
    address: '123 Boulevard des Peupliers',
  }

  it('produces a concrete patch for every field over its limit', () => {
    const plan = planAddressShortening(raw, [
      { field: 'city', max: 20 },
      { field: 'address', max: 20 },
    ])

    expect(plan.ready).toBe(true)
    expect(plan.patch).toEqual({
      city: 'St-Rémy-de-Provence',
      address: '123 Bd des Peupliers',
    })
    expect(plan.lossyFields).toEqual([])
  })

  it('refuses automatic application when a field can only be cut, not abbreviated', () => {
    // Garde-fou central : tronquer une ville peut changer la destination.
    // On ne l'applique jamais tout seul, on demande une revue humaine.
    const plan = planAddressShortening(
      { city: 'Chambretaud Les Grands Champs' },
      [{ field: 'city', max: 20 }],
    )

    expect(plan.ready).toBe(false)
    expect(plan.lossyFields).toEqual(['city'])
    expect(plan.reason).toBe('lossy_shortening_requires_review')
    // Le patch reste calcule, pour que l'humain voie ce qui serait applique.
    expect(plan.patch.city).toBeDefined()
  })

  it('ignores a field that is already within its limit', () => {
    const plan = planAddressShortening({ city: 'Lyon' }, [{ field: 'city', max: 26 }])
    expect(plan.ready).toBe(false)
    expect(plan.reason).toBe('nothing_to_shorten')
    expect(plan.patch).toEqual({})
  })

  it('ignores a limit pointing at a field that is not an address field', () => {
    const plan = planAddressShortening(raw, [{ field: 'contract', max: 10 }])
    expect(plan.ready).toBe(false)
    expect(plan.reason).toBe('nothing_to_shorten')
  })

  it('ignores a limit pointing at a field absent from the parcel', () => {
    const plan = planAddressShortening({ city: 'Lyon' }, [{ field: 'address_2', max: 5 }])
    expect(plan.patch).toEqual({})
    expect(plan.ready).toBe(false)
  })

  it('keeps the most restrictive limit when a field is reported twice', () => {
    const plan = planAddressShortening(
      { city: 'Saint-Rémy-de-Provence' },
      [{ field: 'city', max: 26 }, { field: 'city', max: 19 }],
    )
    expect(plan.patch.city!.length).toBeLessThanOrEqual(19)
  })

  it('reports the before/after audit for every changed field', () => {
    const plan = planAddressShortening(raw, [{ field: 'city', max: 20 }])
    expect(plan.audit).toEqual([
      {
        field: 'city',
        before_length: 22,
        after_length: 19,
        limit: 20,
        applied: ['abbreviate'],
        lossy: false,
      },
    ])
  })
})
