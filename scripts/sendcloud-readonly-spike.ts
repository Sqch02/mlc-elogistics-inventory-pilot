import { createHash, randomBytes } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const PANEL_API_ORIGIN = 'https://panel.sendcloud.sc'
const PANEL_API_V2 = `${PANEL_API_ORIGIN}/api/v2`
const ALLOWED_HOSTS = new Set(['panel.sendcloud.sc', 'servicepoints.sendcloud.sc'])

export const SPIKE_PATTERNS = [
  'currency_chf',
  'address_too_long',
  'hs_code_missing',
  'weight_too_low',
  'announcement_failed_1002',
  'service_point_missing',
] as const

export type SpikePattern = (typeof SPIKE_PATTERNS)[number]
type EvidenceKind = 'api_error' | 'data_heuristic' | 'parcel_status'

interface MatchEvidence {
  pattern: SpikePattern
  kind: EvidenceKind
  reasons: string[]
}

interface Integration {
  id: number
  shop_name?: string
  system?: string
}

interface IntegrationShipmentsPage {
  next: string | null
  previous?: string | null
  results: Array<Record<string, unknown>>
}

interface ParcelsPage {
  next?: string | null
  parcels: Array<Record<string, unknown>>
}

interface SpikeSample {
  account: string
  source: 'integration_shipment' | 'parcel'
  integration: {
    id: string
    system: string | null
    shop_name: string | null
  } | null
  evidence: MatchEvidence
  json: unknown
}

interface SpikeReport {
  generated_at: string
  mode: 'read_only'
  limits: {
    lookback_days: number
    max_integrations: number
    max_pages_per_integration: number
    page_size: number
    max_parcel_pages: number
    samples_per_pattern: number
    credentials_source: 'env' | 'supabase'
    max_tenants: number
    probe_service_points: boolean
  }
  requests: {
    methods: ['GET']
    allowed_hosts: string[]
  }
  scanned: {
    integrations: number
    integration_shipments: number
    parcels_1002: number
    accounts: number
  }
  account_errors: Array<{ account: string; error: string }>
  service_point_probes: ServicePointProbe[]
  samples: Record<SpikePattern, SpikeSample[]>
  missing_patterns: SpikePattern[]
  notes: string[]
}

interface CliOptions {
  lookbackDays: number
  maxIntegrations: number
  maxPagesPerIntegration: number
  maxParcelPages: number
  pageSize: number
  samplesPerPattern: number
  credentialsSource: 'env' | 'supabase'
  maxTenants: number
  probeServicePoints: boolean
}

interface CredentialAccount {
  accountId: string
  apiKey: string
  secret: string
}

interface ServicePointProbe {
  account: string
  carrier: 'mondial_relay'
  country: string
  radius_m: 5000
  result: 'ok' | 'error'
  returned_count?: number
  active_count?: number
  open_upcoming_week_count?: number
  nearest_distance_m?: number | null
  returned_carriers?: string[]
  error?: string
}

const DIRECT_REDACT_KEYS = new Set([
  'name',
  'company_name',
  'email',
  'telephone',
  'phone',
  'address',
  'address_1',
  'address_2',
  'street',
  'street_number',
  'house_number',
  'city',
  'postal_code',
  'state',
  'to_state',
  'order_number',
  'external_order_id',
  'external_shipment_id',
  'tracking_number',
  'tracking_url',
  'label',
  'barcode',
  'reference',
  'sku',
  'description',
  'product_id',
  'variant_id',
  'customs_invoice_nr',
  'tax_number',
  'vat_number',
  'eori_number',
  'to_post_number',
  'note',
  'tax_numbers',
  'properties',
  'extra_data',
  'customs_details',
  'documents',
  'mid_code',
])

const IDENTIFIER_KEYS = new Set([
  'shipment_uuid',
  'parcel_id',
  'integration',
  'integration_id',
  'user_id',
  'contract',
  'colli_uuid',
  'item_id',
  'external_reference',
  'sender_address',
  'to_service_point',
  'shipping_method',
])

const ERROR_KEYS = new Set(['errors', 'warnings', 'checkout_payload_errors', 'error'])

const EU_COUNTRY_CODES = new Set([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR',
  'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
])

function parsePositiveInt(value: string | undefined, fallback: number, name: string): number {
  if (value === undefined) return fallback
  const parsed = Number.parseInt(value, 10)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} doit etre un entier strictement positif`)
  }
  return parsed
}

function parseBoolean(value: string | undefined, fallback: boolean, name: string): boolean {
  if (value === undefined) return fallback
  if (value === 'true') return true
  if (value === 'false') return false
  throw new Error(`${name} doit valoir true ou false`)
}

export function parseCliOptions(args: string[]): CliOptions {
  const values = new Map<string, string>()
  for (let index = 0; index < args.length; index += 1) {
    const current = args[index]
    if (!current.startsWith('--')) throw new Error(`Argument inattendu: ${current}`)
    const [rawName, inlineValue] = current.slice(2).split('=', 2)
    const value = inlineValue ?? args[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`Valeur manquante pour --${rawName}`)
    values.set(rawName, value)
    if (inlineValue === undefined) index += 1
  }

  const credentialsSource = values.get('credentials-source') ?? 'env'
  if (credentialsSource !== 'env' && credentialsSource !== 'supabase') {
    throw new Error('credentials-source doit valoir env ou supabase')
  }

  const options: CliOptions = {
    lookbackDays: parsePositiveInt(values.get('lookback-days'), 120, 'lookback-days'),
    maxIntegrations: parsePositiveInt(values.get('max-integrations'), 8, 'max-integrations'),
    maxPagesPerIntegration: parsePositiveInt(values.get('max-pages-per-integration'), 1, 'max-pages-per-integration'),
    maxParcelPages: parsePositiveInt(values.get('max-parcel-pages'), 1, 'max-parcel-pages'),
    pageSize: parsePositiveInt(values.get('page-size'), 100, 'page-size'),
    samplesPerPattern: parsePositiveInt(values.get('samples-per-pattern'), 3, 'samples-per-pattern'),
    credentialsSource,
    maxTenants: parsePositiveInt(values.get('max-tenants'), 8, 'max-tenants'),
    probeServicePoints: parseBoolean(values.get('probe-service-points'), false, 'probe-service-points'),
  }

  if (options.lookbackDays > 366) throw new Error('lookback-days est limite a 366')
  if (options.maxIntegrations > 20) throw new Error('max-integrations est limite a 20')
  if (options.maxPagesPerIntegration > 3) throw new Error('max-pages-per-integration est limite a 3')
  if (options.maxParcelPages > 10) throw new Error('max-parcel-pages est limite a 10')
  if (options.pageSize > 100) throw new Error('page-size est limite a 100')
  if (options.samplesPerPattern > 5) throw new Error('samples-per-pattern est limite a 5')
  if (options.maxTenants > 20) throw new Error('max-tenants est limite a 20')
  return options
}

function basicAuthHeader(apiKey: string, secret: string): string {
  return `Basic ${Buffer.from(`${apiKey}:${secret}`).toString('base64')}`
}

export function assertReadOnlyUrl(rawUrl: string): URL {
  const url = new URL(rawUrl)
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) {
    throw new Error(`Hote Sendcloud non autorise: ${url.origin}`)
  }
  return url
}

async function getJson<T>(rawUrl: string, authorization: string): Promise<T> {
  const url = assertReadOnlyUrl(rawUrl)
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: authorization,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(15_000),
  })
  const responseText = await response.text()
  if (!response.ok) {
    const detail = scrubErrorString(responseText)
      .replace(/\s+/g, ' ')
      .slice(0, 300)
    throw new Error(`GET ${url.pathname} a retourne HTTP ${response.status}${detail ? `: ${detail}` : ''}`)
  }
  return JSON.parse(responseText) as T
}

async function loadCredentialAccounts(options: CliOptions): Promise<CredentialAccount[]> {
  if (options.credentialsSource === 'env') {
    const apiKey = process.env.SENDCLOUD_API_KEY
    const secret = process.env.SENDCLOUD_SECRET
    if (!apiKey || !secret) {
      throw new Error('SENDCLOUD_API_KEY et SENDCLOUD_SECRET sont requis')
    }
    return [{ accountId: 'env', apiKey, secret }]
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await supabase
    .from('tenant_settings')
    .select('tenant_id, sendcloud_api_key, sendcloud_secret')
    .not('sendcloud_api_key', 'is', null)
    .not('sendcloud_secret', 'is', null)
    .limit(options.maxTenants)

  if (error) throw new Error(`Lecture tenant_settings impossible: ${error.message}`)
  return (data ?? []).flatMap((row) => {
    if (!row.sendcloud_api_key || !row.sendcloud_secret) return []
    return [{
      accountId: String(row.tenant_id),
      apiKey: String(row.sendcloud_api_key),
      secret: String(row.sendcloud_secret),
    }]
  })
}

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function flattenErrorText(input: Record<string, unknown>): string {
  const errorPayload: Record<string, unknown> = {}
  for (const key of ERROR_KEYS) {
    if (input[key] !== undefined) errorPayload[key] = input[key]
  }
  return JSON.stringify(errorPayload).toLowerCase()
}

function readItems(input: Record<string, unknown>): Array<Record<string, unknown>> {
  return Array.isArray(input.parcel_items)
    ? input.parcel_items.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    : []
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function shippingText(input: Record<string, unknown>): string {
  const checkout = input.checkout_payload && typeof input.checkout_payload === 'object'
    ? JSON.stringify(input.checkout_payload)
    : ''
  return `${String(input.shipping_method_checkout_name ?? '')} ${checkout}`.toLowerCase()
}

function countryCode(input: Record<string, unknown>): string {
  if (typeof input.country === 'string') return input.country.toUpperCase()
  if (input.country && typeof input.country === 'object') {
    return String((input.country as Record<string, unknown>).iso_2 ?? '').toUpperCase()
  }
  return ''
}

export function classifyIntegrationShipment(input: Record<string, unknown>): MatchEvidence[] {
  const errors = flattenErrorText(input)
  const items = readItems(input)
  const result: MatchEvidence[] = []

  const add = (pattern: SpikePattern, kind: EvidenceKind, reasons: string[]) => {
    result.push({ pattern, kind, reasons })
  }

  const currency = String(input.currency ?? input.total_order_value_currency ?? '').toUpperCase()
  const destinationCountry = countryCode(input)
  const mentionsCurrencyFailure = /currency.{0,100}(chf|not supported)|devise.{0,120}(chf|pas prise en charge|non support)|\bchf\b/.test(errors)
  const mentionsInvalidContract = /contract.+not valid|contrat.{0,80}(not valid|non valide|invalide)/.test(errors)
  if (currency === 'CHF' && (mentionsCurrencyFailure || mentionsInvalidContract)) {
    add('currency_chf', 'api_error', ['currency=CHF et errors/warnings mentionnent la devise ou un contrat invalide'])
  } else if (currency === 'CHF') {
    add('currency_chf', 'data_heuristic', [`currency=CHF, country=${destinationCountry}`])
  }

  if (/(address(_1|_2|_add2)?|adresse|house_number|city|ville).{0,140}(at most|max(imum)?|too long|trop long|d[ée]passe|characters|caract[eè]res)/.test(errors)) {
    add('address_too_long', 'api_error', ['errors/warnings mentionnent une limite de longueur d’adresse'])
  }

  if (/(hs_code|code (hs|douanier)|origin_country|pays d.origine|customs|douane).{0,120}(required|missing|requis|manquant|obligatoire)/.test(errors)) {
    add('hs_code_missing', 'api_error', ['errors/warnings mentionnent hs_code, origin_country ou customs'])
  } else if (
    destinationCountry !== '' &&
    !EU_COUNTRY_CODES.has(destinationCountry) &&
    items.length > 0 &&
    items.some((item) => !item.hs_code || !item.origin_country)
  ) {
    add('hs_code_missing', 'data_heuristic', ['au moins un parcel_item ne contient pas hs_code et/ou origin_country'])
  }

  if (/(weight|poids).{0,120}(0\.00099|0\.001|greater than|minimum|too low|trop faible|sup[ée]rieur)/.test(errors)) {
    add('weight_too_low', 'api_error', ['errors/warnings mentionnent le poids minimum'])
  } else if (items.some((item) => {
    const weight = numberValue(item.weight)
    return weight !== null && weight < 0.001
  })) {
    add('weight_too_low', 'data_heuristic', ['au moins un parcel_item a un poids strictement inferieur a 0.001 kg'])
  }

  if (/(service.?point|pickup.?point|parcel.?shop|point (relais|de retrait)).{0,120}(required|missing|not selected|requis|manquant|s[ée]lectionn)/.test(errors)) {
    add('service_point_missing', 'api_error', ['errors/warnings indiquent qu’un point relais manque'])
  } else if (!input.to_service_point && /(mondial.?relay|service.?point|pickup.?point|parcel.?shop|point relais)/.test(shippingText(input))) {
    add('service_point_missing', 'data_heuristic', ['methode de livraison point relais sans to_service_point'])
  }

  return result
}

export function classifyParcel(input: Record<string, unknown>): MatchEvidence[] {
  const matches = classifyIntegrationShipment(input)
  const status = input.status && typeof input.status === 'object'
    ? input.status as Record<string, unknown>
    : {}
  if (Number(status.id) === 1002) {
    matches.unshift({
      pattern: 'announcement_failed_1002',
      kind: 'parcel_status',
      reasons: [`status.id=1002, status.message=${String(status.message ?? '')}`],
    })
  }
  return matches
}

function token(value: unknown, salt: string, prefix: string): string {
  const hash = createHash('sha256').update(`${salt}:${String(value)}`).digest('hex').slice(0, 12)
  return `[${prefix}:${hash}]`
}

function scrubErrorString(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, '[UUID]')
    .replace(/(?:\+\d{1,3}[ .-]?)?(?:\d[ .-]?){8,14}/g, '[NUMBER]')
    .replace(/\b\d{4,7}\b/g, '[NUMBER]')
}

function anonymizeErrorPayload(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(anonymizeErrorPayload)
  if (typeof value === 'string') return scrubErrorString(value)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .map(([key, child]) => [key, anonymizeErrorPayload(child)]),
  )
}

function redactedScalar(key: string, value: unknown, salt: string): unknown {
  if (value === null || value === undefined) return value
  if (DIRECT_REDACT_KEYS.has(key)) {
    if (typeof value === 'string') return `[REDACTED len=${value.length}]`
    return '[REDACTED]'
  }
  if (IDENTIFIER_KEYS.has(key)) return token(value, salt, 'ID')
  return value
}

export function anonymizeJson(value: unknown, salt: string, parentKey = ''): unknown {
  if (Array.isArray(value)) return value.map((entry) => anonymizeJson(entry, salt, parentKey))
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && ERROR_KEYS.has(parentKey)) return scrubErrorString(value)
    return redactedScalar(parentKey, value, salt)
  }

  const result: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (ERROR_KEYS.has(key)) {
      result[key] = anonymizeErrorPayload(child)
      continue
    }
    if (key === 'id' && parentKey === '') {
      result[key] = token(child, salt, 'ID')
      continue
    }
    if (DIRECT_REDACT_KEYS.has(key) || IDENTIFIER_KEYS.has(key)) {
      result[key] = redactedScalar(key, child, salt)
      continue
    }
    result[key] = anonymizeJson(child, salt, key)
  }
  return result
}

function emptySamples(): Record<SpikePattern, SpikeSample[]> {
  return SPIKE_PATTERNS.reduce((result, pattern) => {
    result[pattern] = []
    return result
  }, {} as Record<SpikePattern, SpikeSample[]>)
}

function addSample(
  samples: Record<SpikePattern, SpikeSample[]>,
  limit: number,
  sample: SpikeSample,
): void {
  if (samples[sample.evidence.pattern].length < limit) {
    samples[sample.evidence.pattern].push(sample)
  }
}

async function collectReport(options: CliOptions): Promise<SpikeReport> {
  const salt = process.env.SPIKE_ANONYMIZATION_SALT || randomBytes(24).toString('hex')
  const accounts = await loadCredentialAccounts(options)
  const end = new Date()
  const start = new Date(end.getTime() - options.lookbackDays * 24 * 60 * 60 * 1000)
  const samples = emptySamples()

  let integrationCount = 0
  let integrationShipmentCount = 0
  let parcelCount = 0
  const accountErrors: Array<{ account: string; error: string }> = []
  const servicePointProbes: ServicePointProbe[] = []
  for (const account of accounts) {
    const accountToken = token(account.accountId, salt, 'ACCOUNT')
    const authorization = basicAuthHeader(account.apiKey, account.secret)
    let servicePointProbed = false
    try {
      const integrations = await getJson<Integration[]>(`${PANEL_API_V2}/integrations`, authorization)
      const selectedIntegrations = integrations
        .filter((integration) => integration.system !== 'api')
        .slice(0, options.maxIntegrations)
      integrationCount += selectedIntegrations.length

      for (const integration of selectedIntegrations) {
        let nextUrl: string | null = `${PANEL_API_V2}/integrations/${integration.id}/shipments?start_date=${dateOnly(start)}&end_date=${dateOnly(end)}&limit=${options.pageSize}`
        for (let page = 0; nextUrl && page < options.maxPagesPerIntegration; page += 1) {
          const response: IntegrationShipmentsPage = await getJson<IntegrationShipmentsPage>(nextUrl, authorization)
          integrationShipmentCount += response.results.length
          for (const shipment of response.results) {
            for (const evidence of classifyIntegrationShipment(shipment)) {
              addSample(samples, options.samplesPerPattern, {
                account: accountToken,
                source: 'integration_shipment',
                integration: {
                  id: token(integration.id, salt, 'INTEGRATION'),
                  system: integration.system ?? null,
                  shop_name: integration.shop_name ? token(integration.shop_name, salt, 'SHOP') : null,
                },
                evidence,
                json: anonymizeJson(shipment, salt),
              })
            }
          }
          nextUrl = response.next
        }
      }

      let parcelUrl: string | null = `${PANEL_API_V2}/parcels?parcel_status=1002&errors=verbose-carrier&updated_after=${encodeURIComponent(start.toISOString())}&limit=${options.pageSize}`
      for (let page = 0; parcelUrl && page < options.maxParcelPages; page += 1) {
        const response: ParcelsPage = await getJson<ParcelsPage>(parcelUrl, authorization)
        parcelCount += response.parcels.length
        for (const parcel of response.parcels) {
          for (const evidence of classifyParcel(parcel)) {
            addSample(samples, options.samplesPerPattern, {
              account: accountToken,
              source: 'parcel',
              integration: null,
              evidence,
              json: anonymizeJson(parcel, salt),
            })
          }

          if (options.probeServicePoints && !servicePointProbed) {
            const carrier = parcel.carrier && typeof parcel.carrier === 'object'
              ? String((parcel.carrier as Record<string, unknown>).code ?? '')
              : ''
            const destinationCountry = countryCode(parcel)
            const postalCode = String(parcel.postal_code ?? '').trim()
            if (carrier === 'mondial_relay' && destinationCountry && postalCode) {
              servicePointProbed = true
              const query = new URLSearchParams({
                country: destinationCountry,
                carrier: 'mondial_relay',
                address: postalCode,
                radius: '5000',
              })
              try {
                const points = await getJson<Array<Record<string, unknown>>>(
                  `https://servicepoints.sendcloud.sc/api/v2/service-points?${query}`,
                  authorization,
                )
                const distances = points
                  .map((point) => numberValue(point.distance))
                  .filter((distance): distance is number => distance !== null)
                servicePointProbes.push({
                  account: accountToken,
                  carrier: 'mondial_relay',
                  country: destinationCountry,
                  radius_m: 5000,
                  result: 'ok',
                  returned_count: points.length,
                  active_count: points.filter((point) => point.is_active === true).length,
                  open_upcoming_week_count: points.filter((point) => point.open_upcoming_week === true).length,
                  nearest_distance_m: distances.length > 0 ? Math.min(...distances) : null,
                  returned_carriers: [...new Set(points.map((point) => String(point.carrier ?? '')).filter(Boolean))],
                })
              } catch (error) {
                servicePointProbes.push({
                  account: accountToken,
                  carrier: 'mondial_relay',
                  country: destinationCountry,
                  radius_m: 5000,
                  result: 'error',
                  error: error instanceof Error ? error.message : String(error),
                })
              }
            }
          }
        }
        parcelUrl = response.next ?? null
      }
    } catch (error) {
      accountErrors.push({
        account: accountToken,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const missingPatterns = SPIKE_PATTERNS.filter((pattern) => samples[pattern].length === 0)
  return {
    generated_at: new Date().toISOString(),
    mode: 'read_only',
    limits: {
      lookback_days: options.lookbackDays,
      max_integrations: options.maxIntegrations,
      max_pages_per_integration: options.maxPagesPerIntegration,
      page_size: options.pageSize,
      max_parcel_pages: options.maxParcelPages,
      samples_per_pattern: options.samplesPerPattern,
      credentials_source: options.credentialsSource,
      max_tenants: options.maxTenants,
      probe_service_points: options.probeServicePoints,
    },
    requests: {
      methods: ['GET'],
      allowed_hosts: [...ALLOWED_HOSTS],
    },
    scanned: {
      integrations: integrationCount,
      integration_shipments: integrationShipmentCount,
      parcels_1002: parcelCount,
      accounts: accounts.length,
    },
    account_errors: accountErrors,
    service_point_probes: servicePointProbes,
    samples,
    missing_patterns: missingPatterns,
    notes: [
      'api_error est une preuve issue des champs errors/warnings/checkout_payload_errors.',
      'data_heuristic est un candidat structurel a confirmer dans Sendcloud; ce n’est pas une erreur prouvee.',
      options.credentialsSource === 'supabase'
        ? 'Supabase est lu uniquement sur tenant_settings pour charger les credentials; shipments n’est jamais interrogee.'
        : 'Le script ne fait aucun appel Supabase.',
      'Toutes les requetes Sendcloud utilisent GET.',
      options.probeServicePoints
        ? 'La sonde Service Points effectue au plus une requete Mondial Relay par compte, avec un rayon fixe de 5 km.'
        : 'La sonde Service Points est desactivee.',
    ],
  }
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2))
  const report = await collectReport(options)
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`)
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  main().catch((error) => {
    process.stderr.write(`Spike Sendcloud interrompu: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
