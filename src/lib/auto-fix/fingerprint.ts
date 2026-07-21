import { createHash } from 'node:crypto'
import type { AutoFixMode, AutoFixPattern, AutoFixSourceKind } from './types'

type StableValue = null | boolean | number | string | StableValue[] | { [key: string]: StableValue }

function stableJson(value: StableValue): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function fingerprintJson(value: StableValue): string {
  return sha256(stableJson(value))
}

export function buildOperationKey(input: {
  tenantId: string
  sourceKind: AutoFixSourceKind
  sourceSendcloudId: string
  sourceFingerprint: string
  patterns: AutoFixPattern[]
  mode: AutoFixMode
}): string {
  return fingerprintJson({
    version: 1,
    tenant_id: input.tenantId,
    source_kind: input.sourceKind,
    source_sendcloud_id: input.sourceSendcloudId,
    source_fingerprint: input.sourceFingerprint,
    patterns: input.patterns,
    mode: input.mode,
  })
}
