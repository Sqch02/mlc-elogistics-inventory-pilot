import { describe, expect, it, vi } from 'vitest'
import {
  createSupabaseExchangeRateRepository,
  fetchLatestEcbChfQuote,
  resolveChfToEurRate,
  type ChfToEurRate,
  type ExchangeRateRepository,
} from './exchange-rate'

const now = new Date('2026-07-22T08:00:00.000Z')

function memoryRepository(initial: ChfToEurRate | null = null, canClaim = true) {
  let row = initial ? {
    base_currency: 'CHF', target_currency: 'EUR', rate: initial.rate,
    rate_date: initial.rateDate, provider: initial.provider,
    provider_quote: initial.providerQuote.rate, fetched_at: initial.fetchedAt,
    expires_at: initial.expiresAt, refresh_not_before: initial.expiresAt,
  } : null
  const repository: ExchangeRateRepository = {
    read: vi.fn(async () => row),
    claimRefresh: vi.fn(async () => canClaim),
    save: vi.fn(async (rate) => {
      row = {
        base_currency: 'CHF', target_currency: 'EUR', rate: rate.rate,
        rate_date: rate.rateDate, provider: rate.provider,
        provider_quote: rate.providerQuote.rate, fetched_at: rate.fetchedAt,
        expires_at: rate.expiresAt, refresh_not_before: rate.expiresAt,
      }
    }),
  }
  return repository
}

describe('ECB CHF exchange rate', () => {
  it('parses the official one-observation CSV contract', async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      void input
      void init
      return new Response(
        'KEY,FREQ,CURRENCY,CURRENCY_DENOM,EXR_TYPE,EXR_SUFFIX,TIME_PERIOD,OBS_VALUE\n' +
        'EXR.D.CHF.EUR.SP00.A,D,CHF,EUR,SP00,A,2026-07-21,0.9259\n',
        { status: 200, headers: { 'Content-Type': 'text/csv' } },
      )
    })

    const quote = await fetchLatestEcbChfQuote(fetchImpl as typeof fetch)

    expect(quote).toEqual({ rateDate: '2026-07-21', chfPerEur: '0.9259' })
    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(String(fetchImpl.mock.calls[0][0])).toContain('lastNObservations=1')
  })

  it('serves a fresh persistent cache without claiming or fetching', async () => {
    const repository = memoryRepository({
      baseCurrency: 'CHF', targetCurrency: 'EUR', rate: '1.080030240847',
      rateDate: '2026-07-21', provider: 'ECB', providerSeries: 'EXR.D.CHF.EUR.SP00.A',
      providerQuote: { baseCurrency: 'EUR', targetCurrency: 'CHF', rate: '0.9259' },
      fetchedAt: '2026-07-22T07:00:00.000Z', expiresAt: '2026-07-23T07:00:00.000Z', cacheStatus: 'hit',
    })
    const fetchQuote = vi.fn()

    const result = await resolveChfToEurRate(repository, { now, fetchQuote })

    expect(result).toMatchObject({ ok: true, rate: { cacheStatus: 'hit', rateDate: '2026-07-21' } })
    expect(repository.claimRefresh).not.toHaveBeenCalled()
    expect(fetchQuote).not.toHaveBeenCalled()
  })

  it('claims once, persists the inverse quote and reuses it on the next run', async () => {
    const repository = memoryRepository()
    const fetchQuote = vi.fn(async () => ({ rateDate: '2026-07-21', chfPerEur: '0.9259' }))

    const first = await resolveChfToEurRate(repository, { now, fetchQuote })
    const second = await resolveChfToEurRate(repository, { now: new Date('2026-07-22T09:00:00.000Z'), fetchQuote })

    expect(first).toMatchObject({
      ok: true,
      rate: { rate: '1.080030240847', cacheStatus: 'refreshed', rateDate: '2026-07-21' },
    })
    expect(second).toMatchObject({ ok: true, rate: { cacheStatus: 'hit' } })
    expect(fetchQuote).toHaveBeenCalledOnce()
    expect(repository.claimRefresh).toHaveBeenCalledOnce()
    expect(repository.save).toHaveBeenCalledOnce()
  })

  it('does not call the provider when another worker owns the daily refresh', async () => {
    const repository = memoryRepository(null, false)
    const fetchQuote = vi.fn()

    const result = await resolveChfToEurRate(repository, { now, fetchQuote })

    expect(result).toEqual({ ok: false, reason: 'refresh_suppressed' })
    expect(fetchQuote).not.toHaveBeenCalled()
  })

  it('allows only one provider call across concurrent cold-cache resolutions', async () => {
    let claimed = false
    const repository: ExchangeRateRepository = {
      read: vi.fn(async () => null),
      claimRefresh: vi.fn(async () => {
        if (claimed) return false
        claimed = true
        return true
      }),
      save: vi.fn(async () => undefined),
    }
    const fetchQuote = vi.fn(async () => ({ rateDate: '2026-07-21', chfPerEur: '0.9259' }))

    const results = await Promise.all([
      resolveChfToEurRate(repository, { now, fetchQuote }),
      resolveChfToEurRate(repository, { now, fetchQuote }),
    ])

    expect(fetchQuote).toHaveBeenCalledOnce()
    expect(results.some((result) => result.ok)).toBe(true)
    expect(results).toContainEqual({ ok: false, reason: 'refresh_suppressed' })
  })

  describe('taux expire repris quand le rafraichissement echoue', () => {
    // Le 05/10, le cache a expire vers 13 h et le rafraichissement a echoue :
    // #570030 et #570038 sont passees en echec definitif alors que le taux du
    // 02/10, expire depuis quelques minutes, etait parfaitement valable.
    const lundi = new Date('2026-10-05T11:10:00.000Z')
    const tauxDuVendredi = (rateDate = '2026-10-02'): ChfToEurRate => ({
      baseCurrency: 'CHF', targetCurrency: 'EUR', rate: '1.080030240847',
      rateDate, provider: 'ECB', providerSeries: 'EXR.D.CHF.EUR.SP00.A',
      providerQuote: { baseCurrency: 'EUR', targetCurrency: 'CHF', rate: '0.9259' },
      fetchedAt: '2026-10-04T11:05:00.000Z', expiresAt: '2026-10-05T11:05:00.000Z', cacheStatus: 'hit',
    })

    it('reprend le dernier taux quand la BCE ne repond pas', async () => {
      const repository = memoryRepository(tauxDuVendredi())
      const fetchQuote = vi.fn(async () => { throw new Error('ECB HTTP 503') })

      const result = await resolveChfToEurRate(repository, { now: lundi, fetchQuote })

      expect(fetchQuote).toHaveBeenCalledOnce()
      expect(result).toMatchObject({ ok: true, rate: { cacheStatus: 'stale', rateDate: '2026-10-02' } })
      expect(repository.save).not.toHaveBeenCalled()
    })

    it('le reprend aussi quand un autre travailleur detient le rafraichissement', async () => {
      const repository = memoryRepository(tauxDuVendredi(), false)
      const result = await resolveChfToEurRate(repository, { now: lundi, fetchQuote: vi.fn() })
      expect(result).toMatchObject({ ok: true, rate: { cacheStatus: 'stale' } })
    })

    it('ne reprend jamais un taux au-dela de sept jours', async () => {
      const repository = memoryRepository(tauxDuVendredi('2026-09-27'))
      const result = await resolveChfToEurRate(repository, {
        now: lundi,
        fetchQuote: async () => { throw new Error('ECB HTTP 503') },
      })
      expect(result).toEqual({ ok: false, reason: 'provider_unavailable' })
    })

    it('ne sert pas un taux expire quand le rafraichissement reussit', async () => {
      const repository = memoryRepository(tauxDuVendredi())
      const result = await resolveChfToEurRate(repository, {
        now: lundi,
        fetchQuote: async () => ({ rateDate: '2026-10-02', chfPerEur: '0.9311' }),
      })
      expect(result).toMatchObject({ ok: true, rate: { cacheStatus: 'refreshed' } })
    })
  })

  it('rejects a provider observation older than seven days', async () => {
    const repository = memoryRepository()
    const result = await resolveChfToEurRate(repository, {
      now,
      fetchQuote: async () => ({ rateDate: '2026-07-10', chfPerEur: '0.9259' }),
    })
    expect(result).toEqual({ ok: false, reason: 'provider_rate_too_old' })
    expect(repository.save).not.toHaveBeenCalled()
  })

  it('rejects a positive but implausible derived CHF to EUR rate before caching it', async () => {
    const repository = memoryRepository()
    const result = await resolveChfToEurRate(repository, {
      now,
      fetchQuote: async () => ({ rateDate: '2026-07-21', chfPerEur: '0.09259' }),
    })

    expect(result).toEqual({ ok: false, reason: 'provider_unavailable' })
    expect(repository.save).not.toHaveBeenCalled()
  })

  it('does not trust a fresh cache row whose provider quote is implausible', async () => {
    const repository = memoryRepository({
      baseCurrency: 'CHF', targetCurrency: 'EUR', rate: '1.080030240847',
      rateDate: '2026-07-21', provider: 'ECB', providerSeries: 'EXR.D.CHF.EUR.SP00.A',
      providerQuote: { baseCurrency: 'EUR', targetCurrency: 'CHF', rate: '9.259' },
      fetchedAt: '2026-07-22T07:00:00.000Z', expiresAt: '2026-07-23T07:00:00.000Z', cacheStatus: 'hit',
    }, false)

    const result = await resolveChfToEurRate(repository, { now })

    expect(result).toEqual({ ok: false, reason: 'refresh_suppressed' })
  })

  it('extends refresh_not_before to the 24 hour expiry only after a successful save', async () => {
    const upsert = vi.fn(async () => ({ error: null }))
    const client = {
      from: vi.fn(() => ({ upsert })),
    } as unknown as Parameters<typeof createSupabaseExchangeRateRepository>[0]
    const repository = createSupabaseExchangeRateRepository(client)
    const refreshed: ChfToEurRate = {
      baseCurrency: 'CHF', targetCurrency: 'EUR', rate: '1.080030240847',
      rateDate: '2026-07-21', provider: 'ECB', providerSeries: 'EXR.D.CHF.EUR.SP00.A',
      providerQuote: { baseCurrency: 'EUR', targetCurrency: 'CHF', rate: '0.9259' },
      fetchedAt: '2026-07-22T08:00:00.000Z', expiresAt: '2026-07-23T08:00:00.000Z', cacheStatus: 'refreshed',
    }

    await repository.save(refreshed)

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        expires_at: refreshed.expiresAt,
        refresh_not_before: refreshed.expiresAt,
      }),
      { onConflict: 'base_currency,target_currency' },
    )
  })
})
