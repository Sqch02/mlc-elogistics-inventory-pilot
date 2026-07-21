import { createHash, randomBytes } from 'node:crypto'
import { mkdir, open, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const API_ORIGIN = 'https://panel.sendcloud.sc'
const MANIFEST_ROOT = resolve(process.cwd(), '.sendcloud-write-validation')
const TEST_MARKER_PREFIX = 'MLC-AUTOFIX-TEST-'
const WRITE_CONFIRMATION = 'I_UNDERSTAND_ONE_TEST_OBJECT'
const MAX_PLAN_AGE_MS = 24 * 60 * 60 * 1000

export const WRITE_VALIDATION_ENV = 'SENDCLOUD_WRITE_VALIDATION_ENABLED'
export const TEST_ACCOUNT_FINGERPRINT_ENV = 'SENDCLOUD_TEST_ACCOUNT_FINGERPRINT'

export type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject
export interface JsonObject { [key: string]: JsonValue }

export type ValidationOperation =
  | 'v2_update_documented'
  | 'v2_update_legacy'
  | 'v2_create_disposable'
  | 'v2_create_linked'
  | 'v3_patch_order'
  | 'v3_ship_order_sync'

type ManifestState =
  | 'planned'
  | 'executing'
  | 'executed'
  | 'failed_unchanged'
  | 'outcome_unknown'
  | 'rolling_back'
  | 'rollback_pending'
  | 'rolled_back'
  | 'rollback_failed'

interface HttpRequestPlan {
  method: 'PUT' | 'POST' | 'PATCH'
  path: string
  body?: JsonValue
}

interface ValidationTarget {
  kind: 'v2_parcel' | 'v2_disposable_marker' | 'v2_integration_shipment' | 'v3_order'
  id: string
  integration_id?: number
  marker_hash: string
}

export interface ValidationManifest {
  version: 1
  operation: ValidationOperation
  state: ManifestState
  created_at: string
  updated_at: string
  account_fingerprint: string
  target: ValidationTarget
  before: JsonObject
  before_hash: string
  comparison_shape?: JsonObject
  before_selected?: JsonObject
  request: HttpRequestPlan
  rollback:
    | { kind: 'request'; request: HttpRequestPlan }
    | { kind: 'cancel_v2_created' }
    | { kind: 'cancel_v3_shipment' }
  plan_hash: string
  approval_token: string
  rollback_token?: string
  result?: {
    parcel_id?: string
    shipment_id?: string
    after_hash?: string
    after_selected?: JsonObject
  }
  last_error?: string
}

interface Credentials {
  apiKey: string
  secret: string
}

interface CliOptions {
  command: string
  values: Map<string, string>
}

const V2_UPDATE_KEYS = new Set([
  'name', 'address', 'address_2', 'house_number', 'city', 'postal_code', 'country',
  'telephone', 'email', 'company_name', 'weight', 'parcel_items', 'total_order_value',
  'total_order_value_currency', 'to_service_point', 'shipment',
])

const V3_PATCH_KEYS = new Set([
  'shipping_address', 'payment_details', 'customs_details', 'shipping_details',
  'service_point_details', 'order_details', 'customer_details', 'billing_address',
])

const FORBIDDEN_PATCH_KEYS = new Set([
  'order_id', 'order_number', 'shipment_uuid', 'request_label', 'status',
  'tracking_number', 'tracking_url', 'label', 'documents', 'date_announced',
])

function isObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function stableJson(value: JsonValue | undefined): string {
  if (value === undefined) return '"[UNDEFINED]"'
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (isObject(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export function hashJson(value: JsonValue): string {
  return createHash('sha256').update(stableJson(value)).digest('hex')
}

function shortHash(value: unknown): string {
  return createHash('sha256').update(String(value)).digest('hex').slice(0, 12)
}

export function accountFingerprint(apiKey: string): string {
  return `sendcloud-test:${shortHash(apiKey)}`
}

function getCredentials(): Credentials {
  const apiKey = process.env.SENDCLOUD_TEST_API_KEY
  const secret = process.env.SENDCLOUD_TEST_SECRET
  if (!apiKey || !secret) {
    throw new Error('SENDCLOUD_TEST_API_KEY et SENDCLOUD_TEST_SECRET sont requis; les credentials generiques/prod sont refuses')
  }
  return { apiKey, secret }
}

export function parseCliOptions(args: string[]): CliOptions {
  const [command, ...rest] = args
  if (!command) throw new Error('Commande manquante')
  const values = new Map<string, string>()
  for (let index = 0; index < rest.length; index += 1) {
    const current = rest[index]
    if (!current.startsWith('--')) throw new Error(`Argument inattendu: ${current}`)
    const [name, inline] = current.slice(2).split('=', 2)
    const value = inline ?? rest[index + 1]
    if (!value || value.startsWith('--')) throw new Error(`Valeur manquante pour --${name}`)
    values.set(name, value)
    if (inline === undefined) index += 1
  }
  return { command, values }
}

function required(options: CliOptions, name: string): string {
  const value = options.values.get(name)
  if (!value) throw new Error(`--${name} est requis`)
  return value
}

function requiredPositiveInt(options: CliOptions, name: string): number {
  const parsed = Number.parseInt(required(options, name), 10)
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`--${name} doit etre un entier positif`)
  return parsed
}

function scrubError(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[EMAIL]')
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, '[UUID]')
    .replace(/(?:\+\d{1,3}[ .-]?)?(?:\d[ .-]?){8,14}/g, '[NUMBER]')
    .replace(/\s+/g, ' ')
    .slice(0, 500)
}

class SendcloudHttpError extends Error {
  constructor(public status: number, public responseBody: string) {
    super(`Sendcloud HTTP ${status}: ${scrubError(responseBody)}`)
  }
}

async function sendcloudRequest(
  credentials: Credentials,
  method: 'GET' | 'PUT' | 'POST' | 'PATCH',
  path: string,
  body?: JsonValue,
): Promise<JsonObject> {
  const url = new URL(path, API_ORIGIN)
  if (url.origin !== API_ORIGIN || !/^\/api\/v[23]\//.test(url.pathname)) {
    throw new Error(`URL Sendcloud refusee: ${url.origin}${url.pathname}`)
  }
  const authorization = Buffer.from(`${credentials.apiKey}:${credentials.secret}`).toString('base64')
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Basic ${authorization}`,
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(method === 'GET' ? 15_000 : 25_000),
  })
  const responseText = await response.text()
  if (!response.ok) throw new SendcloudHttpError(response.status, responseText)
  if (!responseText) return {}
  const parsed: unknown = JSON.parse(responseText)
  if (!isObject(parsed)) throw new Error('Reponse Sendcloud inattendue: objet JSON requis')
  return parsed
}

function assertTestMarker(input: JsonObject): string {
  const values = [input.order_number, input.reference, input.external_reference_id, input.order_id]
    .filter((value): value is string => typeof value === 'string')
  const marker = values.find((value) => value.startsWith(TEST_MARKER_PREFIX))
  if (!marker) throw new Error(`La cible doit porter le prefixe ${TEST_MARKER_PREFIX} dans order_number/reference/order_id`)
  return marker
}

function assertUnannouncedParcel(parcel: JsonObject): void {
  if (parcel.date_announced !== null && parcel.date_announced !== undefined && parcel.date_announced !== '') {
    throw new Error('Le parcel est deja annonce; le harness refuse le PUT')
  }
  if (parcel.tracking_number) throw new Error('Le parcel possede deja un tracking_number; cible refusee')
}

export function validateDisposablePayload(payload: JsonObject): string {
  const marker = assertTestMarker(payload)
  if (payload.order_number !== marker) {
    throw new Error(`Le colis jetable exige order_number=${TEST_MARKER_PREFIX}...`)
  }
  if (payload.request_label !== false) {
    throw new Error('Le colis jetable impose request_label=false')
  }
  for (const forbidden of ['id', 'shipment_uuid', 'to_service_point', 'is_return']) {
    if (payload[forbidden] !== undefined) throw new Error(`Champ interdit pour le colis jetable: ${forbidden}`)
  }
  const requiredStrings = ['name', 'address', 'city', 'postal_code', 'country', 'weight']
  for (const key of requiredStrings) {
    if (typeof payload[key] !== 'string' || !String(payload[key]).trim()) {
      throw new Error(`Le colis jetable exige ${key}`)
    }
  }
  if (payload.name !== 'MLC AUTOFIX TEST') {
    throw new Error('Le destinataire doit etre exactement MLC AUTOFIX TEST')
  }
  if (payload.email !== undefined || payload.telephone !== undefined) {
    throw new Error('Le colis jetable ne doit contenir ni email ni telephone')
  }
  if (!Array.isArray(payload.parcel_items) || payload.parcel_items.length !== 1 || !isObject(payload.parcel_items[0])) {
    throw new Error('Le colis jetable exige exactement un parcel_item factice')
  }
  const item = payload.parcel_items[0]
  if (typeof item.sku !== 'string' || !item.sku.startsWith('MLC-AUTOFIX-NO-SKU-')) {
    throw new Error('parcel_items[0].sku doit commencer par MLC-AUTOFIX-NO-SKU-')
  }
  if (typeof item.description !== 'string' || !/^ZZQXVJK-[A-F0-9-]+$/.test(item.description)) {
    throw new Error('parcel_items[0].description doit etre une valeur aleatoire ZZQXVJK-*')
  }
  if (item.quantity !== 1) throw new Error('Le parcel_item factice doit avoir quantity=1')
  return marker
}

function assertUnshippedOrder(order: JsonObject): void {
  const orderDetails = isObject(order.order_details) ? order.order_details : {}
  const status = isObject(orderDetails.status) ? orderDetails.status : {}
  const code = String(status.code ?? '').toLowerCase()
  if (!['unshipped', 'on_hold'].includes(code)) {
    throw new Error(`La commande v3 de test doit etre unshipped/on_hold, statut recu: ${code || 'absent'}`)
  }
}

function assertNoForbiddenKeys(value: JsonValue, path = ''): void {
  if (Array.isArray(value)) {
    value.forEach((child, index) => assertNoForbiddenKeys(child, `${path}[${index}]`))
    return
  }
  if (!isObject(value)) return
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_PATCH_KEYS.has(key)) throw new Error(`Champ interdit dans le patch: ${path}${key}`)
    assertNoForbiddenKeys(child, `${path}${key}.`)
  }
}

export function validatePatch(operation: ValidationOperation, patch: JsonObject): void {
  if (Object.keys(patch).length === 0) throw new Error('Le patch ne peut pas etre vide')
  const allowed = operation.startsWith('v2_update') ? V2_UPDATE_KEYS : V3_PATCH_KEYS
  for (const key of Object.keys(patch)) {
    if (!allowed.has(key)) throw new Error(`Champ non autorise pour ${operation}: ${key}`)
  }
  assertNoForbiddenKeys(patch)
}

function selectShape(source: JsonObject, shape: JsonObject): JsonObject {
  const result: JsonObject = {}
  for (const [key, childShape] of Object.entries(shape)) {
    const sourceValue = source[key]
    if (isObject(childShape) && isObject(sourceValue)) result[key] = selectShape(sourceValue, childShape)
    else result[key] = sourceValue === undefined ? null : sourceValue
  }
  return result
}

function resolveManifestPath(rawPath: string): string {
  const manifestPath = resolve(process.cwd(), rawPath)
  const outside = relative(MANIFEST_ROOT, manifestPath)
  if (outside.startsWith('..') || outside === '') {
    throw new Error('Le manifest doit etre un fichier sous .sendcloud-write-validation/')
  }
  return manifestPath
}

async function scaffoldV2DisposablePayload(options: CliOptions): Promise<void> {
  const rawPath = required(options, 'payload-file')
  const path = resolveManifestPath(rawPath)
  const suffix = `${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`
  const marker = `${TEST_MARKER_PREFIX}${suffix}`
  const noSku = `MLC-AUTOFIX-NO-SKU-${suffix}`
  const noDescriptionMatch = `ZZQXVJK-${suffix}`
  const payload: JsonObject = {
    name: 'MLC AUTOFIX TEST',
    company_name: 'MLC TEST AVANT PUT',
    address: 'Rue de la Paix',
    house_number: '1',
    city: 'Paris',
    postal_code: '75002',
    country: 'FR',
    weight: '0.100',
    order_number: marker,
    request_label: false,
    total_order_value: '1.00',
    total_order_value_currency: 'EUR',
    quantity: 1,
    parcel_items: [{
      sku: noSku,
      description: noDescriptionMatch,
      quantity: 1,
      weight: '0.100',
      value: '1.00',
    }],
  }
  validateDisposablePayload(payload)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(payload, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
  process.stdout.write(`${JSON.stringify({ payload_file: rawPath, order_number: marker }, null, 2)}\n`)
}

async function readJsonFile(rawPath: string): Promise<JsonObject> {
  const parsed: unknown = JSON.parse(await readFile(resolve(process.cwd(), rawPath), 'utf8'))
  if (!isObject(parsed)) throw new Error(`${rawPath} doit contenir un objet JSON`)
  return parsed
}

async function createManifest(rawPath: string, manifest: ValidationManifest): Promise<void> {
  const path = resolveManifestPath(rawPath)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
}

async function updateManifest(rawPath: string, manifest: ValidationManifest): Promise<void> {
  const path = resolveManifestPath(rawPath)
  const temporaryPath = `${path}.tmp`
  await writeFile(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 })
  await rename(temporaryPath, path)
}

async function withGlobalWriteLock<T>(label: string, action: () => Promise<T>): Promise<T> {
  await mkdir(MANIFEST_ROOT, { recursive: true })
  const lockPath = resolve(MANIFEST_ROOT, 'active-write.lock')
  let handle
  try {
    handle = await open(lockPath, 'wx', 0o600)
  } catch {
    throw new Error('Une autre validation Sendcloud est deja active; un seul objet de test est autorise a la fois')
  }
  try {
    await handle.writeFile(`${JSON.stringify({ pid: process.pid, label, started_at: new Date().toISOString() })}\n`)
    return await action()
  } finally {
    await handle.close()
    await unlink(lockPath).catch(() => undefined)
  }
}

async function loadManifest(rawPath: string): Promise<ValidationManifest> {
  const path = resolveManifestPath(rawPath)
  const parsed: unknown = JSON.parse(await readFile(path, 'utf8'))
  if (!isObject(parsed) || parsed.version !== 1 || typeof parsed.operation !== 'string') {
    throw new Error('Manifest invalide ou version non supportee')
  }
  return parsed as unknown as ValidationManifest
}

const OPEN_DISPOSABLE_STATES = new Set<ManifestState>([
  'planned', 'executing', 'executed', 'outcome_unknown', 'rolling_back',
  'rollback_pending', 'rollback_failed',
])

async function assertNoOtherDisposableManifest(rawPath: string): Promise<void> {
  await mkdir(MANIFEST_ROOT, { recursive: true })
  const currentPath = resolveManifestPath(rawPath)
  const entries = await readdir(MANIFEST_ROOT, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) continue
    const candidatePath = resolve(MANIFEST_ROOT, entry.name)
    if (candidatePath === currentPath) continue
    try {
      const parsed: unknown = JSON.parse(await readFile(candidatePath, 'utf8'))
      if (!isObject(parsed) || parsed.operation !== 'v2_create_disposable') continue
      if (typeof parsed.state === 'string' && OPEN_DISPOSABLE_STATES.has(parsed.state as ManifestState)) {
        throw new Error(
          `Un autre colis jetable est encore actif (${entry.name}, etat ${parsed.state}); ` +
          'le reconcilier ou l annuler avant de continuer',
        )
      }
    } catch (error) {
      if (error instanceof SyntaxError) continue
      throw error
    }
  }
}

type ManifestPlanFields = Pick<
  ValidationManifest,
  'version' | 'operation' | 'created_at' | 'account_fingerprint' | 'target' | 'before' |
  'before_hash' | 'comparison_shape' | 'before_selected' | 'request' | 'rollback'
>

export function computePlanHash(manifest: ManifestPlanFields): string {
  return hashJson({
    version: manifest.version,
    operation: manifest.operation,
    created_at: manifest.created_at,
    account_fingerprint: manifest.account_fingerprint,
    target: manifest.target as unknown as JsonObject,
    before: manifest.before,
    before_hash: manifest.before_hash,
    comparison_shape: manifest.comparison_shape ?? null,
    before_selected: manifest.before_selected ?? null,
    request: manifest.request as unknown as JsonObject,
    rollback: manifest.rollback as unknown as JsonObject,
  })
}

export function approvalTokenForManifest(manifest: ManifestPlanFields & { plan_hash: string }): string {
  const target = manifest.target.id.replace(/[^a-zA-Z0-9-]/g, '').slice(-16)
  return `APPROVE:${manifest.operation}:${target}:${manifest.plan_hash.slice(0, 12)}`
}

function rollbackToken(manifest: ValidationManifest): string {
  return `ROLLBACK:${manifest.operation}:${manifest.target.id.replace(/[^a-zA-Z0-9-]/g, '').slice(-16)}:${shortHash(manifest.updated_at)}`
}

function makeManifest(
  operation: ValidationOperation,
  credentials: Credentials,
  target: ValidationTarget,
  before: JsonObject,
  request: HttpRequestPlan,
  rollback: ValidationManifest['rollback'],
  comparisonShape?: JsonObject,
): ValidationManifest {
  const now = new Date().toISOString()
  const planFields: ManifestPlanFields = {
    version: 1,
    operation,
    created_at: now,
    account_fingerprint: accountFingerprint(credentials.apiKey),
    target,
    before,
    before_hash: hashJson(before),
    comparison_shape: comparisonShape,
    before_selected: comparisonShape ? selectShape(before, comparisonShape) : undefined,
    request,
    rollback,
  }
  const planHash = computePlanHash(planFields)
  return {
    ...planFields,
    state: 'planned',
    updated_at: now,
    plan_hash: planHash,
    approval_token: approvalTokenForManifest({ ...planFields, plan_hash: planHash }),
  }
}

function extractV2Parcel(response: JsonObject): JsonObject {
  if (!isObject(response.parcel)) throw new Error('Reponse v2 sans objet parcel')
  return response.parcel
}

function extractV2Shipment(response: JsonObject): JsonObject {
  return isObject(response.shipment) ? response.shipment : response
}

function extractV3Data(response: JsonObject): JsonObject {
  if (!isObject(response.data)) throw new Error('Reponse v3 sans objet data')
  return response.data
}

async function fetchTarget(credentials: Credentials, target: ValidationTarget): Promise<JsonObject> {
  if (target.kind === 'v2_parcel') {
    return extractV2Parcel(await sendcloudRequest(credentials, 'GET', `/api/v2/parcels/${encodeURIComponent(target.id)}?errors=verbose-carrier`))
  }
  if (target.kind === 'v2_integration_shipment') {
    return extractV2Shipment(await sendcloudRequest(
      credentials,
      'GET',
      `/api/v2/integrations/${target.integration_id}/shipments/${encodeURIComponent(target.id)}`,
    ))
  }
  if (target.kind === 'v2_disposable_marker') {
    const response = await sendcloudRequest(
      credentials,
      'GET',
      `/api/v2/parcels?order_number=${encodeURIComponent(target.id)}&errors=verbose-carrier&limit=100`,
    )
    const ids = Array.isArray(response.parcels)
      ? response.parcels
        .filter((parcel): parcel is JsonObject => isObject(parcel) && parcel.order_number === target.id && parcel.id !== undefined)
        .map((parcel) => String(parcel.id))
        .sort()
      : []
    return { order_number: target.id, matching_parcel_ids: ids }
  }
  return extractV3Data(await sendcloudRequest(credentials, 'GET', `/api/v3/orders/${encodeURIComponent(target.id)}`))
}

async function assertNoExistingV2Parcel(
  credentials: Credentials,
  shipmentUuid: string,
  orderNumber: string,
): Promise<void> {
  const response = await sendcloudRequest(
    credentials,
    'GET',
    `/api/v2/parcels?order_number=${encodeURIComponent(orderNumber)}&errors=verbose-carrier&limit=100`,
  )
  const parcels = Array.isArray(response.parcels)
    ? response.parcels.filter((parcel): parcel is JsonObject => isObject(parcel))
    : []
  if (parcels.some((parcel) => parcel.shipment_uuid === shipmentUuid)) {
    throw new Error('Un parcel existe deja pour ce shipment_uuid; creation liee refusee')
  }
}

async function assertNoExistingV3Shipment(credentials: Credentials, orderNumber: string): Promise<void> {
  const response = await sendcloudRequest(
    credentials,
    'GET',
    `/api/v3/shipments?order_number=${encodeURIComponent(orderNumber)}`,
  )
  const shipments = Array.isArray(response.data)
    ? response.data.filter((shipment): shipment is JsonObject => isObject(shipment))
    : []
  if (shipments.some((shipment) => shipment.order_number === orderNumber)) {
    throw new Error('Un shipment v3 existe deja pour cette commande; Ship an Order refuse')
  }
}

function safeSummary(target: ValidationTarget, data: JsonObject): JsonObject {
  const status = isObject(data.status) ? data.status : isObject(data.order_status) ? data.order_status : {}
  const orderDetails = isObject(data.order_details) ? data.order_details : {}
  const orderStatus = isObject(orderDetails.status) ? orderDetails.status : {}
  return {
    target_kind: target.kind,
    target_id_hash: shortHash(target.id),
    integration_id: target.integration_id ?? null,
    test_marker_present: (() => { try { assertTestMarker(data); return true } catch { return false } })(),
    order_number_hash: data.order_number ? shortHash(data.order_number) : null,
    shipment_uuid_hash: data.shipment_uuid ? shortHash(data.shipment_uuid) : null,
    status: status.id ?? status.code ?? orderStatus.code ?? null,
    date_announced: data.date_announced ?? null,
    has_errors: Boolean(data.errors && stableJson(data.errors as JsonValue) !== '{}'),
    country: typeof data.country === 'string' ? data.country : null,
    currency: data.currency ?? data.total_order_value_currency ?? null,
    to_service_point_present: Boolean(data.to_service_point),
  }
}

async function prepareV2Update(options: CliOptions, credentials: Credentials): Promise<void> {
  const operation: ValidationOperation = required(options, 'contract') === 'documented'
    ? 'v2_update_documented'
    : required(options, 'contract') === 'legacy'
      ? 'v2_update_legacy'
      : (() => { throw new Error('--contract doit valoir documented ou legacy') })()
  const parcelId = required(options, 'parcel-id')
  if (!/^\d+$/.test(parcelId)) throw new Error('--parcel-id doit etre numerique')
  const patch = await readJsonFile(required(options, 'patch-file'))
  validatePatch(operation, patch)
  const target: ValidationTarget = { kind: 'v2_parcel', id: parcelId, marker_hash: '' }
  const before = await fetchTarget(credentials, target)
  const marker = assertTestMarker(before)
  assertUnannouncedParcel(before)
  const beforeSelected = selectShape(before, patch)
  if (stableJson(beforeSelected) === stableJson(patch)) throw new Error('Le patch ne change aucune valeur cible')
  target.marker_hash = shortHash(marker)
  const documented = operation === 'v2_update_documented'
  const request: HttpRequestPlan = {
    method: 'PUT',
    path: documented ? '/api/v2/parcels' : `/api/v2/parcels/${parcelId}`,
    body: { parcel: documented ? { id: Number(parcelId), ...patch } : patch },
  }
  const rollbackBody = documented
    ? { parcel: { id: Number(parcelId), ...beforeSelected } }
    : { parcel: beforeSelected }
  const manifest = makeManifest(operation, credentials, target, before, request, {
    kind: 'request',
    request: { method: 'PUT', path: request.path, body: rollbackBody },
  }, patch)
  await createManifest(required(options, 'manifest'), manifest)
  process.stdout.write(`${JSON.stringify({ manifest: required(options, 'manifest'), approval_token: manifest.approval_token, summary: safeSummary(target, before) }, null, 2)}\n`)
}

async function prepareV2CreateDisposable(options: CliOptions, credentials: Credentials): Promise<void> {
  const rawManifestPath = required(options, 'manifest')
  if (dirname(resolveManifestPath(rawManifestPath)) !== MANIFEST_ROOT) {
    throw new Error('Le manifest du colis jetable doit etre directement sous .sendcloud-write-validation/')
  }
  await assertNoOtherDisposableManifest(rawManifestPath)
  const payload = await readJsonFile(required(options, 'payload-file'))
  const marker = validateDisposablePayload(payload)
  const target: ValidationTarget = {
    kind: 'v2_disposable_marker',
    id: marker,
    marker_hash: shortHash(marker),
  }
  const before = await fetchTarget(credentials, target)
  const existingIds = Array.isArray(before.matching_parcel_ids) ? before.matching_parcel_ids : []
  if (existingIds.length > 0) {
    throw new Error('Un parcel porte deja ce marqueur; creation jetable refusee')
  }
  const manifest = makeManifest('v2_create_disposable', credentials, target, before, {
    method: 'POST',
    path: '/api/v2/parcels',
    body: { parcel: payload },
  }, { kind: 'cancel_v2_created' })
  await createManifest(rawManifestPath, manifest)
  process.stdout.write(`${JSON.stringify({
    manifest: rawManifestPath,
    approval_token: manifest.approval_token,
    endpoint: `${API_ORIGIN}${manifest.request.path}`,
    method: manifest.request.method,
    request_label: false,
    order_number_hash: shortHash(marker),
    rollback: 'POST /api/v2/parcels/{created_id}/cancel',
  }, null, 2)}\n`)
}

async function prepareV2CreateLinked(options: CliOptions, credentials: Credentials): Promise<void> {
  const integrationId = requiredPositiveInt(options, 'integration-id')
  const shipmentUuid = required(options, 'shipment-uuid')
  if (!/^[0-9a-f-]{36}$/i.test(shipmentUuid)) throw new Error('--shipment-uuid doit etre un UUID')
  const payload = await readJsonFile(required(options, 'payload-file'))
  if (payload.shipment_uuid !== shipmentUuid) throw new Error('Le payload doit contenir le shipment_uuid exact')
  if (payload.request_label !== false) throw new Error('Le premier test v2 lie impose request_label=false')
  if (payload.id !== undefined) throw new Error('Le payload de creation ne doit pas contenir id')
  const target: ValidationTarget = {
    kind: 'v2_integration_shipment',
    id: shipmentUuid,
    integration_id: integrationId,
    marker_hash: '',
  }
  const before = await fetchTarget(credentials, target)
  const marker = assertTestMarker(before)
  if (before.shipment_uuid !== shipmentUuid) throw new Error('Le shipment_uuid retourne ne correspond pas a la cible')
  if (typeof before.order_number !== 'string' || !before.order_number.startsWith(TEST_MARKER_PREFIX)) {
    throw new Error(`La creation liee exige un order_number prefixe ${TEST_MARKER_PREFIX}`)
  }
  if (isObject(before.order_status) && before.order_status.id !== 'on_hold') {
    throw new Error(`Le shipment de test doit etre On Hold, statut recu: ${String(before.order_status.id)}`)
  }
  if (payload.order_number !== before.order_number) throw new Error('Le payload doit conserver order_number')
  await assertNoExistingV2Parcel(credentials, shipmentUuid, String(before.order_number))
  target.marker_hash = shortHash(marker)
  const manifest = makeManifest('v2_create_linked', credentials, target, before, {
    method: 'POST',
    path: '/api/v2/parcels',
    body: { parcel: payload },
  }, { kind: 'cancel_v2_created' })
  await createManifest(required(options, 'manifest'), manifest)
  process.stdout.write(`${JSON.stringify({ manifest: required(options, 'manifest'), approval_token: manifest.approval_token, summary: safeSummary(target, before) }, null, 2)}\n`)
}

async function prepareV3PatchOrder(options: CliOptions, credentials: Credentials): Promise<void> {
  const orderId = required(options, 'order-id')
  if (!/^\d+$/.test(orderId)) throw new Error('--order-id doit etre l ID interne numerique Sendcloud')
  const patch = await readJsonFile(required(options, 'patch-file'))
  validatePatch('v3_patch_order', patch)
  const target: ValidationTarget = { kind: 'v3_order', id: orderId, marker_hash: '' }
  const before = await fetchTarget(credentials, target)
  target.marker_hash = shortHash(assertTestMarker(before))
  assertUnshippedOrder(before)
  const beforeSelected = selectShape(before, patch)
  if (stableJson(beforeSelected) === stableJson(patch)) throw new Error('Le patch ne change aucune valeur cible')
  const manifest = makeManifest('v3_patch_order', credentials, target, before, {
    method: 'PATCH',
    path: `/api/v3/orders/${orderId}`,
    body: patch,
  }, {
    kind: 'request',
    request: { method: 'PATCH', path: `/api/v3/orders/${orderId}`, body: beforeSelected },
  }, patch)
  await createManifest(required(options, 'manifest'), manifest)
  process.stdout.write(`${JSON.stringify({ manifest: required(options, 'manifest'), approval_token: manifest.approval_token, summary: safeSummary(target, before) }, null, 2)}\n`)
}

async function prepareV3ShipOrder(options: CliOptions, credentials: Credentials): Promise<void> {
  const orderId = required(options, 'order-id')
  const integrationId = requiredPositiveInt(options, 'integration-id')
  if (!/^\d+$/.test(orderId)) throw new Error('--order-id doit etre l ID interne numerique Sendcloud')
  const target: ValidationTarget = { kind: 'v3_order', id: orderId, integration_id: integrationId, marker_hash: '' }
  const before = await fetchTarget(credentials, target)
  const marker = assertTestMarker(before)
  assertUnshippedOrder(before)
  if (typeof before.order_number !== 'string' || !before.order_number.startsWith(TEST_MARKER_PREFIX)) {
    throw new Error(`Ship an Order exige un order_number prefixe ${TEST_MARKER_PREFIX}`)
  }
  const orderDetails = isObject(before.order_details) ? before.order_details : {}
  const integration = isObject(orderDetails.integration) ? orderDetails.integration : {}
  if (Number(integration.id) !== integrationId) throw new Error('L integration v3 de la commande ne correspond pas')
  await assertNoExistingV3Shipment(credentials, String(before.order_number))
  target.marker_hash = shortHash(marker)
  const manifest = makeManifest('v3_ship_order_sync', credentials, target, before, {
    method: 'POST',
    path: '/api/v3/orders/create-label-sync',
    body: {
      integration_id: integrationId,
      label_details: { mime_type: 'application/pdf', dpi: 72 },
      ship_with: {
        type: 'shipping_option_code',
        properties: { shipping_option_code: 'sendcloud:letter' },
      },
      order: {
        order_id: before.order_id,
        order_number: before.order_number,
        apply_shipping_rules: false,
      },
    },
  }, { kind: 'cancel_v3_shipment' })
  await createManifest(required(options, 'manifest'), manifest)
  process.stdout.write(`${JSON.stringify({ manifest: required(options, 'manifest'), approval_token: manifest.approval_token, summary: safeSummary(target, before) }, null, 2)}\n`)
}

export function assertWriteGate(
  manifest: ValidationManifest,
  mode: 'execute' | 'rollback',
  values: Map<string, string>,
  env: NodeJS.ProcessEnv,
  apiKey: string,
): void {
  if (env.NODE_ENV === 'production' || env.RENDER || env.RENDER_SERVICE_ID) {
    throw new Error('Le harness refuse toute ecriture dans un environnement de production/Render')
  }
  if (env[WRITE_VALIDATION_ENV] !== 'true') throw new Error(`${WRITE_VALIDATION_ENV}=true est requis`)
  const fingerprint = accountFingerprint(apiKey)
  if (!env[TEST_ACCOUNT_FINGERPRINT_ENV] || env[TEST_ACCOUNT_FINGERPRINT_ENV] !== fingerprint) {
    throw new Error(`${TEST_ACCOUNT_FINGERPRINT_ENV} doit correspondre aux credentials de test`)
  }
  if (manifest.account_fingerprint !== fingerprint) throw new Error('Les credentials ne correspondent pas au manifest')
  if (computePlanHash(manifest) !== manifest.plan_hash) throw new Error('Le manifest a ete modifie depuis sa preparation')
  if (approvalTokenForManifest(manifest) !== manifest.approval_token) throw new Error('Approval token du manifest incoherent')
  const confirmationName = mode === 'execute' ? 'allow-write' : 'allow-rollback'
  if (values.get(confirmationName) !== WRITE_CONFIRMATION) throw new Error(`--${confirmationName} ${WRITE_CONFIRMATION} est requis`)
  const expectedToken = mode === 'execute' ? manifest.approval_token : manifest.rollback_token
  if (!expectedToken || values.get('approval-token') !== expectedToken) throw new Error('Approval token invalide')
  if (mode === 'execute' && Date.now() - Date.parse(manifest.created_at) > MAX_PLAN_AGE_MS) {
    throw new Error('Le manifest a plus de 24h; refaire la preparation')
  }
}

function summarizeWriteResult(operation: ValidationOperation, response: JsonObject): { parcel_id?: string; shipment_id?: string } {
  if (operation === 'v2_create_disposable' || operation === 'v2_create_linked') {
    const parcel = extractV2Parcel(response)
    if (!parcel.id) throw new Error('Creation v2 sans parcel.id')
    return { parcel_id: String(parcel.id) }
  }
  if (operation === 'v3_ship_order_sync') {
    const data = Array.isArray(response.data) ? response.data[0] : response.data
    if (!isObject(data) || !data.shipment_id) throw new Error('Ship an Order sans shipment_id')
    return {
      shipment_id: String(data.shipment_id),
      parcel_id: data.parcel_id ? String(data.parcel_id) : undefined,
    }
  }
  return {}
}

async function fetchAfterWrite(
  credentials: Credentials,
  manifest: ValidationManifest,
  ids: { parcel_id?: string; shipment_id?: string },
): Promise<JsonObject> {
  if (manifest.operation === 'v2_create_disposable' || manifest.operation === 'v2_create_linked') {
    if (!ids.parcel_id) throw new Error('parcel_id absent apres creation')
    return extractV2Parcel(await sendcloudRequest(credentials, 'GET', `/api/v2/parcels/${ids.parcel_id}?errors=verbose-carrier`))
  }
  if (manifest.operation === 'v3_ship_order_sync') {
    if (!ids.shipment_id) throw new Error('shipment_id absent apres Ship an Order')
    return extractV3Data(await sendcloudRequest(credentials, 'GET', `/api/v3/shipments/${encodeURIComponent(ids.shipment_id)}`))
  }
  return fetchTarget(credentials, manifest.target)
}

async function executeManifest(options: CliOptions, credentials: Credentials): Promise<void> {
  const rawPath = required(options, 'manifest')
  const manifest = await loadManifest(rawPath)
  if (manifest.state !== 'planned') throw new Error(`Le manifest doit etre planned, etat actuel: ${manifest.state}`)
  if (manifest.operation === 'v2_create_disposable') await assertNoOtherDisposableManifest(rawPath)
  assertWriteGate(manifest, 'execute', options.values, process.env, credentials.apiKey)
  const freshBefore = await fetchTarget(credentials, manifest.target)
  if (hashJson(freshBefore) !== manifest.before_hash) throw new Error('La cible a change depuis la preparation; aucun write execute')

  manifest.state = 'executing'
  manifest.updated_at = new Date().toISOString()
  await updateManifest(rawPath, manifest)
  let writeResponseReceived = false
  try {
    const response = await sendcloudRequest(
      credentials,
      manifest.request.method,
      manifest.request.path,
      manifest.request.body,
    )
    writeResponseReceived = true
    const ids = summarizeWriteResult(manifest.operation, response)
    const after = await fetchAfterWrite(credentials, manifest, ids)
    const afterSelected = manifest.comparison_shape ? selectShape(after, manifest.comparison_shape) : undefined
    if (afterSelected && manifest.before_selected && stableJson(afterSelected) === stableJson(manifest.before_selected)) {
      throw new Error('La requete a reussi mais les champs cibles sont inchanges')
    }
    if (manifest.operation === 'v2_create_disposable') {
      assertUnannouncedParcel(after)
      if (after.order_number !== manifest.target.id) {
        throw new Error('Le parcel jetable retourne ne conserve pas order_number')
      }
    }
    if (manifest.operation === 'v2_create_linked' && after.shipment_uuid !== manifest.target.id) {
      throw new Error('Le parcel cree ne conserve pas le shipment_uuid cible')
    }
    assertTestMarker(after)
    manifest.state = 'executed'
    manifest.updated_at = new Date().toISOString()
    manifest.result = { ...ids, after_hash: hashJson(after), after_selected: afterSelected }
    manifest.rollback_token = rollbackToken(manifest)
    await updateManifest(rawPath, manifest)
    process.stdout.write(`${JSON.stringify({ state: manifest.state, result: manifest.result, rollback_token: manifest.rollback_token }, null, 2)}\n`)
  } catch (error) {
    manifest.updated_at = new Date().toISOString()
    manifest.last_error = scrubError(error instanceof Error ? error.message : String(error))
    const isCreateOperation =
      manifest.operation === 'v2_create_disposable' ||
      manifest.operation === 'v2_create_linked' ||
      manifest.operation === 'v3_ship_order_sync'
    if (isCreateOperation) {
      const unambiguousRejection = !writeResponseReceived &&
        error instanceof SendcloudHttpError &&
        [400, 401, 403, 404, 405, 410, 422].includes(error.status)
      if (unambiguousRejection) {
        try {
          const current = await fetchTarget(credentials, manifest.target)
          manifest.state = hashJson(current) === manifest.before_hash ? 'failed_unchanged' : 'outcome_unknown'
        } catch {
          manifest.state = 'outcome_unknown'
        }
      } else {
        manifest.state = 'outcome_unknown'
      }
    } else {
      try {
        const current = await fetchTarget(credentials, manifest.target)
        manifest.state = hashJson(current) === manifest.before_hash ? 'failed_unchanged' : 'outcome_unknown'
      } catch {
        manifest.state = 'outcome_unknown'
      }
    }
    await updateManifest(rawPath, manifest)
    throw error
  }
}

async function isCancellationConfirmed(credentials: Credentials, manifest: ValidationManifest): Promise<boolean> {
  if (manifest.rollback.kind === 'cancel_v2_created') {
    if (!manifest.result?.parcel_id) throw new Error('parcel_id absent du manifest')
    try {
      const parcel = extractV2Parcel(await sendcloudRequest(
        credentials,
        'GET',
        `/api/v2/parcels/${manifest.result.parcel_id}?errors=verbose-carrier`,
      ))
      const status = isObject(parcel.status) ? parcel.status : {}
      return Number(status.id) === 1999 || /cancel|annul/i.test(String(status.message ?? ''))
    } catch (error) {
      return error instanceof SendcloudHttpError && error.status === 404
    }
  }
  if (manifest.rollback.kind === 'cancel_v3_shipment') {
    if (!manifest.result?.shipment_id) throw new Error('shipment_id absent du manifest')
    const shipment = extractV3Data(await sendcloudRequest(
      credentials,
      'GET',
      `/api/v3/shipments/${encodeURIComponent(manifest.result.shipment_id)}`,
    ))
    const status = isObject(shipment.status) ? shipment.status : {}
    if (String(status.code ?? '').toUpperCase() === 'CANCELLED') return true
    if (Array.isArray(shipment.parcels) && shipment.parcels.length > 0) {
      return shipment.parcels.every((parcel) => {
        if (!isObject(parcel) || !isObject(parcel.status)) return false
        return String(parcel.status.code ?? '').toUpperCase() === 'CANCELLED'
      })
    }
  }
  return false
}

async function rollbackManifest(options: CliOptions, credentials: Credentials): Promise<void> {
  const rawPath = required(options, 'manifest')
  const manifest = await loadManifest(rawPath)
  if (manifest.state !== 'executed') throw new Error(`Rollback autorise uniquement depuis executed, etat: ${manifest.state}`)
  assertWriteGate(manifest, 'rollback', options.values, process.env, credentials.apiKey)

  if (manifest.rollback.kind === 'request' && manifest.comparison_shape && manifest.result?.after_selected) {
    const current = await fetchTarget(credentials, manifest.target)
    if (stableJson(selectShape(current, manifest.comparison_shape)) !== stableJson(manifest.result.after_selected)) {
      throw new Error('Les champs cibles ont change depuis le write; rollback refuse pour eviter un ecrasement')
    }
  }

  manifest.state = 'rolling_back'
  manifest.updated_at = new Date().toISOString()
  await updateManifest(rawPath, manifest)
  try {
    if (manifest.rollback.kind === 'request') {
      await sendcloudRequest(
        credentials,
        manifest.rollback.request.method,
        manifest.rollback.request.path,
        manifest.rollback.request.body,
      )
      const restored = await fetchTarget(credentials, manifest.target)
      if (manifest.comparison_shape && manifest.before_selected &&
        stableJson(selectShape(restored, manifest.comparison_shape)) !== stableJson(manifest.before_selected)) {
        throw new Error('Le rollback a repondu mais les valeurs initiales ne sont pas restaurees')
      }
    } else if (manifest.rollback.kind === 'cancel_v2_created') {
      if (!manifest.result?.parcel_id) throw new Error('parcel_id absent du manifest')
      try {
        await sendcloudRequest(credentials, 'POST', `/api/v2/parcels/${manifest.result.parcel_id}/cancel`)
      } catch (error) {
        if (!(error instanceof SendcloudHttpError && error.status === 404)) throw error
      }
    } else {
      if (!manifest.result?.shipment_id) throw new Error('shipment_id absent du manifest')
      await sendcloudRequest(credentials, 'POST', `/api/v3/shipments/${encodeURIComponent(manifest.result.shipment_id)}/cancel`)
    }
    const confirmed = manifest.rollback.kind === 'request'
      ? true
      : await isCancellationConfirmed(credentials, manifest)
    manifest.state = confirmed ? 'rolled_back' : 'rollback_pending'
    manifest.updated_at = new Date().toISOString()
    await updateManifest(rawPath, manifest)
    process.stdout.write(`${JSON.stringify({
      state: manifest.state,
      next: confirmed ? null : `Relancer: verify-rollback --manifest ${rawPath}`,
    }, null, 2)}\n`)
  } catch (error) {
    manifest.state = 'rollback_failed'
    manifest.updated_at = new Date().toISOString()
    manifest.last_error = scrubError(error instanceof Error ? error.message : String(error))
    await updateManifest(rawPath, manifest)
    throw error
  }
}

async function verifyRollback(options: CliOptions, credentials: Credentials): Promise<void> {
  const rawPath = required(options, 'manifest')
  const manifest = await loadManifest(rawPath)
  if (manifest.state !== 'rollback_pending') {
    throw new Error(`verify-rollback attend rollback_pending, etat: ${manifest.state}`)
  }
  if (manifest.account_fingerprint !== accountFingerprint(credentials.apiKey)) {
    throw new Error('Les credentials ne correspondent pas au manifest')
  }
  if (!await isCancellationConfirmed(credentials, manifest)) {
    process.stdout.write(`${JSON.stringify({ state: manifest.state, confirmed: false }, null, 2)}\n`)
    return
  }
  manifest.state = 'rolled_back'
  manifest.updated_at = new Date().toISOString()
  await updateManifest(rawPath, manifest)
  process.stdout.write(`${JSON.stringify({ state: manifest.state, confirmed: true }, null, 2)}\n`)
}

function desiredSelectedValues(manifest: ValidationManifest): JsonObject | null {
  if (!manifest.comparison_shape) return null
  if (manifest.operation === 'v2_update_documented' || manifest.operation === 'v2_update_legacy' || manifest.operation === 'v3_patch_order') {
    return manifest.comparison_shape
  }
  return null
}

async function reconcileCreatedObject(
  credentials: Credentials,
  manifest: ValidationManifest,
): Promise<{ after: JsonObject; parcel_id?: string; shipment_id?: string } | null> {
  const orderNumber = manifest.operation === 'v2_create_disposable'
    ? manifest.target.id
    : typeof manifest.before.order_number === 'string' ? manifest.before.order_number : null
  if (!orderNumber) throw new Error('order_number absent du snapshot; reconciliation automatique impossible')
  if (manifest.operation === 'v2_create_disposable') {
    const response = await sendcloudRequest(
      credentials,
      'GET',
      `/api/v2/parcels?order_number=${encodeURIComponent(orderNumber)}&errors=verbose-carrier&limit=100`,
    )
    const matches = Array.isArray(response.parcels)
      ? response.parcels.filter((parcel): parcel is JsonObject => isObject(parcel) && parcel.order_number === orderNumber)
      : []
    if (matches.length > 1) throw new Error('Plusieurs parcels jetables portent le meme marqueur; verification manuelle requise')
    if (matches.length === 0 || !matches[0].id) return null
    return { after: matches[0], parcel_id: String(matches[0].id) }
  }
  if (manifest.operation === 'v2_create_linked') {
    const response = await sendcloudRequest(
      credentials,
      'GET',
      `/api/v2/parcels?order_number=${encodeURIComponent(orderNumber)}&errors=verbose-carrier&limit=100`,
    )
    const parcels = Array.isArray(response.parcels)
      ? response.parcels.filter((parcel): parcel is JsonObject => isObject(parcel))
      : []
    const matches = parcels.filter((parcel) =>
      parcel.shipment_uuid === manifest.target.id &&
      parcel.order_number === orderNumber,
    )
    if (matches.length > 1) throw new Error('Plusieurs parcels correspondent au shipment_uuid; reconciliation manuelle requise')
    if (matches.length === 0 || !matches[0].id) return null
    return { after: matches[0], parcel_id: String(matches[0].id) }
  }
  if (manifest.operation === 'v3_ship_order_sync') {
    const response = await sendcloudRequest(
      credentials,
      'GET',
      `/api/v3/shipments?order_number=${encodeURIComponent(orderNumber)}`,
    )
    const shipments = Array.isArray(response.data)
      ? response.data.filter((shipment): shipment is JsonObject => isObject(shipment))
      : []
    const matches = shipments.filter((shipment) => shipment.order_number === orderNumber)
    if (matches.length > 1) throw new Error('Plusieurs shipments v3 correspondent; reconciliation manuelle requise')
    if (matches.length === 0 || !matches[0].id) return null
    const parcels = Array.isArray(matches[0].parcels)
      ? matches[0].parcels.filter((parcel): parcel is JsonObject => isObject(parcel))
      : []
    return {
      after: matches[0],
      shipment_id: String(matches[0].id),
      parcel_id: parcels[0]?.id ? String(parcels[0].id) : undefined,
    }
  }
  return null
}

async function reconcileManifest(options: CliOptions, credentials: Credentials): Promise<void> {
  const rawPath = required(options, 'manifest')
  const manifest = await loadManifest(rawPath)
  if (manifest.account_fingerprint !== accountFingerprint(credentials.apiKey)) {
    throw new Error('Les credentials ne correspondent pas au manifest')
  }

  if (['rolling_back', 'rollback_pending', 'rollback_failed'].includes(manifest.state)) {
    if (manifest.rollback.kind === 'request' && manifest.comparison_shape && manifest.before_selected) {
      const current = await fetchTarget(credentials, manifest.target)
      const selected = selectShape(current, manifest.comparison_shape)
      if (stableJson(selected) === stableJson(manifest.before_selected)) {
        manifest.state = 'rolled_back'
      } else if (manifest.result?.after_selected && stableJson(selected) === stableJson(manifest.result.after_selected)) {
        manifest.state = 'executed'
      } else {
        manifest.state = 'rollback_failed'
      }
    } else {
      manifest.state = await isCancellationConfirmed(credentials, manifest) ? 'rolled_back' : 'rollback_pending'
    }
    manifest.updated_at = new Date().toISOString()
    await updateManifest(rawPath, manifest)
    process.stdout.write(`${JSON.stringify({ state: manifest.state }, null, 2)}\n`)
    return
  }

  if (!['executing', 'outcome_unknown'].includes(manifest.state)) {
    throw new Error(`reconcile attend executing/outcome_unknown/rollback_*, etat: ${manifest.state}`)
  }

  if (
    manifest.operation === 'v2_create_disposable' ||
    manifest.operation === 'v2_create_linked' ||
    manifest.operation === 'v3_ship_order_sync'
  ) {
    const found = await reconcileCreatedObject(credentials, manifest)
    if (!found) {
      manifest.state = 'outcome_unknown'
      manifest.updated_at = new Date().toISOString()
      await updateManifest(rawPath, manifest)
      process.stdout.write(`${JSON.stringify({ state: manifest.state, found: false, retry_write_allowed: false }, null, 2)}\n`)
      return
    }
    assertTestMarker(found.after)
    manifest.state = 'executed'
    manifest.updated_at = new Date().toISOString()
    manifest.result = {
      parcel_id: found.parcel_id,
      shipment_id: found.shipment_id,
      after_hash: hashJson(found.after),
    }
    manifest.rollback_token = rollbackToken(manifest)
    await updateManifest(rawPath, manifest)
    process.stdout.write(`${JSON.stringify({ state: manifest.state, found: true, result: manifest.result, rollback_token: manifest.rollback_token }, null, 2)}\n`)
    return
  }

  const current = await fetchTarget(credentials, manifest.target)
  const selected = manifest.comparison_shape ? selectShape(current, manifest.comparison_shape) : null
  const desired = desiredSelectedValues(manifest)
  if (selected && manifest.before_selected && stableJson(selected) === stableJson(manifest.before_selected)) {
    manifest.state = 'failed_unchanged'
  } else if (selected && desired && stableJson(selected) === stableJson(desired)) {
    manifest.state = 'executed'
    manifest.result = { after_hash: hashJson(current), after_selected: selected }
    manifest.rollback_token = rollbackToken(manifest)
  } else {
    manifest.state = 'outcome_unknown'
  }
  manifest.updated_at = new Date().toISOString()
  await updateManifest(rawPath, manifest)
  process.stdout.write(`${JSON.stringify({ state: manifest.state, rollback_token: manifest.rollback_token ?? null }, null, 2)}\n`)
}

async function inspect(options: CliOptions, credentials: Credentials): Promise<void> {
  let target: ValidationTarget
  if (options.command === 'inspect-v2-parcel') {
    target = { kind: 'v2_parcel', id: required(options, 'parcel-id'), marker_hash: '' }
  } else if (options.command === 'inspect-v2-shipment') {
    target = {
      kind: 'v2_integration_shipment',
      id: required(options, 'shipment-uuid'),
      integration_id: requiredPositiveInt(options, 'integration-id'),
      marker_hash: '',
    }
  } else {
    target = { kind: 'v3_order', id: required(options, 'order-id'), marker_hash: '' }
  }
  const data = await fetchTarget(credentials, target)
  process.stdout.write(`${JSON.stringify(safeSummary(target, data), null, 2)}\n`)
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2))
  const credentials = getCredentials()
  if (options.command === 'account-fingerprint') {
    process.stdout.write(`${accountFingerprint(credentials.apiKey)}\n`)
    return
  }
  if (options.command === 'scaffold-v2-disposable') return scaffoldV2DisposablePayload(options)
  if (options.command.startsWith('inspect-')) return inspect(options, credentials)
  if (options.command === 'prepare-v2-update') return prepareV2Update(options, credentials)
  if (options.command === 'prepare-v2-create-disposable') {
    return withGlobalWriteLock(
      `prepare:${required(options, 'manifest')}`,
      () => prepareV2CreateDisposable(options, credentials),
    )
  }
  if (options.command === 'prepare-v2-create-linked') return prepareV2CreateLinked(options, credentials)
  if (options.command === 'prepare-v3-patch-order') return prepareV3PatchOrder(options, credentials)
  if (options.command === 'prepare-v3-ship-order') return prepareV3ShipOrder(options, credentials)
  if (options.command === 'execute') {
    return withGlobalWriteLock(`execute:${required(options, 'manifest')}`, () => executeManifest(options, credentials))
  }
  if (options.command === 'rollback') {
    return withGlobalWriteLock(`rollback:${required(options, 'manifest')}`, () => rollbackManifest(options, credentials))
  }
  if (options.command === 'verify-rollback') return verifyRollback(options, credentials)
  if (options.command === 'reconcile') return reconcileManifest(options, credentials)
  throw new Error(`Commande inconnue: ${options.command}`)
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
if (isMain) {
  main().catch((error) => {
    process.stderr.write(`Validation Sendcloud interrompue: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
