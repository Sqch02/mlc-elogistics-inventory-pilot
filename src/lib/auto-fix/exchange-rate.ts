import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const ECB_CHF_SERIES = 'EXR.D.CHF.EUR.SP00.A'
const ECB_CHF_URL = 'https://data-api.ecb.europa.eu/service/data/EXR/D.CHF.EUR.SP00.A?lastNObservations=1&detail=dataonly&format=csvdata'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000
const MAX_RATE_AGE_MS = 7 * 24 * 60 * 60 * 1000
const FETCH_TIMEOUT_MS = 5_000
const MIN_PLAUSIBLE_CHF_TO_EUR_RATE = 0.5
const MAX_PLAUSIBLE_CHF_TO_EUR_RATE = 2
const CACHE_COLUMNS = 'base_currency,target_currency,rate,rate_date,provider,provider_quote,fetched_at,expires_at,refresh_not_before'
const BIGINT_ZERO = BigInt(0)
const BIGINT_ONE = BigInt(1)
const BIGINT_TWO = BigInt(2)
const BIGINT_TEN = BigInt(10)

export interface ChfToEurRate {
  baseCurrency: 'CHF'
  targetCurrency: 'EUR'
  rate: string
  rateDate: string
  provider: 'ECB'
  providerSeries: typeof ECB_CHF_SERIES
  providerQuote: {
    baseCurrency: 'EUR'
    targetCurrency: 'CHF'
    rate: string
  }
  fetchedAt: string
  expiresAt: string
  cacheStatus: 'hit' | 'refreshed'
}

export type ChfRateUnavailableReason =
  | 'cache_unavailable'
  | 'refresh_suppressed'
  | 'provider_unavailable'
  | 'provider_rate_too_old'
  | 'cache_write_failed'

export type ChfRateResolution =
  | { ok: true; rate: ChfToEurRate }
  | { ok: false; reason: ChfRateUnavailableReason }

interface CachedRateRow {
  base_currency: string
  target_currency: string
  rate: number | string | null
  rate_date: string | null
  provider: string | null
  provider_quote: number | string | null
  fetched_at: string | null
  expires_at: string | null
  refresh_not_before: string
}

export interface ExchangeRateRepository {
  read(baseCurrency: string, targetCurrency: string): Promise<CachedRateRow | null>
  claimRefresh(baseCurrency: string, targetCurrency: string): Promise<boolean>
  save(rate: ChfToEurRate): Promise<void>
}

interface EcbQuote {
  rateDate: string
  chfPerEur: string
}

interface ResolveOptions {
  now?: Date
  fetchQuote?: () => Promise<EcbQuote>
}

function normalizedDecimal(value: number | string): string | null {
  const raw = String(value).trim()
  if (!/^\d+(?:\.\d+)?$/.test(raw)) return null
  const [integer, fraction = ''] = raw.split('.')
  const normalized = `${integer.replace(/^0+(?=\d)/, '') || '0'}${fraction ? `.${fraction.replace(/0+$/, '')}` : ''}`
  if (normalized === '0' || normalized === '0.') return null
  return normalized.endsWith('.') ? normalized.slice(0, -1) : normalized
}

function isPlausibleChfToEurRate(value: string): boolean {
  const numeric = Number(value)
  return Number.isFinite(numeric)
    && numeric >= MIN_PLAUSIBLE_CHF_TO_EUR_RATE
    && numeric <= MAX_PLAUSIBLE_CHF_TO_EUR_RATE
}

function decimalParts(value: string): { integer: bigint; scale: bigint } | null {
  const normalized = normalizedDecimal(value)
  if (!normalized) return null
  const [whole, fraction = ''] = normalized.split('.')
  return {
    integer: BigInt(`${whole}${fraction}`),
    scale: BIGINT_TEN ** BigInt(fraction.length),
  }
}

function divideRounded(numerator: bigint, denominator: bigint): bigint {
  const quotient = numerator / denominator
  const remainder = numerator % denominator
  return remainder * BIGINT_TWO >= denominator ? quotient + BIGINT_ONE : quotient
}

function inverseDecimal(value: string, decimals = 12): string | null {
  const parts = decimalParts(value)
  if (!parts || parts.integer <= BIGINT_ZERO) return null
  const scale = BIGINT_TEN ** BigInt(decimals)
  const rounded = divideRounded(parts.scale * scale, parts.integer)
  const raw = rounded.toString().padStart(decimals + 1, '0')
  const whole = raw.slice(0, -decimals)
  const fraction = raw.slice(-decimals).replace(/0+$/, '')
  return fraction ? `${whole}.${fraction}` : whole
}

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : parsed
}

function rateDateIsAcceptable(rateDate: string, now: Date): boolean {
  const parsed = parseIsoDate(rateDate)
  if (!parsed) return false
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const age = todayUtc - parsed.getTime()
  return age >= 0 && age <= MAX_RATE_AGE_MS
}

function fromCache(row: CachedRateRow | null, now: Date): ChfToEurRate | null {
  if (
    !row || row.base_currency !== 'CHF' || row.target_currency !== 'EUR' || row.provider !== 'ECB' ||
    row.rate === null || row.provider_quote === null || !row.rate_date || !row.fetched_at || !row.expires_at
  ) return null
  const expiresAt = Date.parse(row.expires_at)
  if (!Number.isFinite(expiresAt) || expiresAt <= now.getTime() || !rateDateIsAcceptable(row.rate_date, now)) return null
  const rate = normalizedDecimal(row.rate)
  const providerQuote = normalizedDecimal(row.provider_quote)
  const derivedFromProviderQuote = providerQuote ? inverseDecimal(providerQuote) : null
  if (
    !rate || !providerQuote || !derivedFromProviderQuote ||
    !isPlausibleChfToEurRate(rate) || !isPlausibleChfToEurRate(derivedFromProviderQuote) ||
    rate !== derivedFromProviderQuote
  ) return null
  return {
    baseCurrency: 'CHF',
    targetCurrency: 'EUR',
    rate,
    rateDate: row.rate_date,
    provider: 'ECB',
    providerSeries: ECB_CHF_SERIES,
    providerQuote: { baseCurrency: 'EUR', targetCurrency: 'CHF', rate: providerQuote },
    fetchedAt: row.fetched_at,
    expiresAt: row.expires_at,
    cacheStatus: 'hit',
  }
}

export async function fetchLatestEcbChfQuote(
  fetchImpl: typeof fetch = fetch,
): Promise<EcbQuote> {
  const response = await fetchImpl(ECB_CHF_URL, {
    headers: { Accept: 'text/csv', 'User-Agent': 'MLC-eLogistics/1.0' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`ECB HTTP ${response.status}`)
  const lines = (await response.text()).trim().split(/\r?\n/).filter(Boolean)
  if (lines.length !== 2) throw new Error('ECB response must contain one observation')
  const headers = lines[0].split(',')
  const values = lines[1].split(',')
  const at = (name: string): string => {
    const index = headers.indexOf(name)
    return index >= 0 ? values[index]?.trim() ?? '' : ''
  }
  if (at('CURRENCY') !== 'CHF' || at('CURRENCY_DENOM') !== 'EUR') {
    throw new Error('ECB response currency pair mismatch')
  }
  const rateDate = at('TIME_PERIOD')
  const chfPerEur = normalizedDecimal(at('OBS_VALUE'))
  if (!parseIsoDate(rateDate) || !chfPerEur) throw new Error('ECB response contains an invalid observation')
  return { rateDate, chfPerEur }
}

export async function resolveChfToEurRate(
  repository: ExchangeRateRepository,
  options: ResolveOptions = {},
): Promise<ChfRateResolution> {
  const now = options.now ?? new Date()
  let cached: CachedRateRow | null
  try {
    cached = await repository.read('CHF', 'EUR')
  } catch {
    return { ok: false, reason: 'cache_unavailable' }
  }
  const fresh = fromCache(cached, now)
  if (fresh) return { ok: true, rate: fresh }

  let claimed: boolean
  try {
    claimed = await repository.claimRefresh('CHF', 'EUR')
  } catch {
    return { ok: false, reason: 'cache_unavailable' }
  }
  if (!claimed) {
    // A concurrent worker may have completed between the first read and claim.
    try {
      const concurrent = fromCache(await repository.read('CHF', 'EUR'), now)
      return concurrent
        ? { ok: true, rate: concurrent }
        : { ok: false, reason: 'refresh_suppressed' }
    } catch {
      return { ok: false, reason: 'cache_unavailable' }
    }
  }

  let quote: EcbQuote
  try {
    quote = await (options.fetchQuote ?? (() => fetchLatestEcbChfQuote()))()
  } catch {
    return { ok: false, reason: 'provider_unavailable' }
  }
  if (!rateDateIsAcceptable(quote.rateDate, now)) {
    return { ok: false, reason: 'provider_rate_too_old' }
  }
  const derivedRate = inverseDecimal(quote.chfPerEur)
  if (!derivedRate || !isPlausibleChfToEurRate(derivedRate)) {
    return { ok: false, reason: 'provider_unavailable' }
  }
  const fetchedAt = now.toISOString()
  const rate: ChfToEurRate = {
    baseCurrency: 'CHF',
    targetCurrency: 'EUR',
    rate: derivedRate,
    rateDate: quote.rateDate,
    provider: 'ECB',
    providerSeries: ECB_CHF_SERIES,
    providerQuote: { baseCurrency: 'EUR', targetCurrency: 'CHF', rate: quote.chfPerEur },
    fetchedAt,
    expiresAt: new Date(now.getTime() + CACHE_TTL_MS).toISOString(),
    cacheStatus: 'refreshed',
  }
  try {
    await repository.save(rate)
  } catch {
    return { ok: false, reason: 'cache_write_failed' }
  }
  return { ok: true, rate }
}

export function createSupabaseExchangeRateRepository(
  client: SupabaseClient<Database>,
): ExchangeRateRepository {
  return {
    async read(baseCurrency, targetCurrency) {
      const { data, error } = await client
        .from('exchange_rates_cache')
        .select(CACHE_COLUMNS)
        .eq('base_currency', baseCurrency)
        .eq('target_currency', targetCurrency)
        .maybeSingle()
      if (error) throw new Error(`exchange_rates_cache read: ${error.message}`)
      return data as CachedRateRow | null
    },
    async claimRefresh(baseCurrency, targetCurrency) {
      const { data, error } = await client.rpc('claim_exchange_rate_refresh', {
        p_base_currency: baseCurrency,
        p_target_currency: targetCurrency,
      })
      if (error) throw new Error(`claim_exchange_rate_refresh: ${error.message}`)
      return data === true
    },
    async save(rate) {
      const { error } = await client.from('exchange_rates_cache').upsert({
        base_currency: rate.baseCurrency,
        target_currency: rate.targetCurrency,
        rate: Number(rate.rate),
        rate_date: rate.rateDate,
        provider: rate.provider,
        provider_quote: Number(rate.providerQuote.rate),
        fetched_at: rate.fetchedAt,
        expires_at: rate.expiresAt,
        refresh_not_before: rate.expiresAt,
      }, { onConflict: 'base_currency,target_currency' })
      if (error) throw new Error(`exchange_rates_cache write: ${error.message}`)
    },
  }
}
