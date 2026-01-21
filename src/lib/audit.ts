import { createAdminClient } from '@/lib/supabase/admin'

export type AuditAction = 'create' | 'update' | 'delete'

export type AuditEntityType =
  | 'claim'
  | 'sku'
  | 'pricing_rule'
  | 'shipment'
  | 'bundle'
  | 'location'
  | 'profile'
  | 'tenant'
  | 'invoice'

export interface AuditLogEntry {
  tenantId: string
  userId?: string | null
  action: AuditAction
  entityType: AuditEntityType
  entityId?: string | null
  oldValue?: Record<string, unknown> | null
  newValue?: Record<string, unknown> | null
  ipAddress?: string | null
  userAgent?: string | null
  metadata?: Record<string, unknown> | null
}

/**
 * Log an audit entry to the database
 * Uses admin client to bypass RLS
 */
export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    const adminClient = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = adminClient as any

    const { error } = await db.from('audit_logs').insert({
      tenant_id: entry.tenantId,
      user_id: entry.userId || null,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId || null,
      old_value: entry.oldValue || null,
      new_value: entry.newValue || null,
      ip_address: entry.ipAddress || null,
      user_agent: entry.userAgent || null,
      metadata: entry.metadata || null,
    })

    if (error) {
      console.error('[Audit] Failed to log entry:', error)
    }
  } catch (err) {
    // Don't throw - audit logging should not break the main flow
    console.error('[Audit] Error logging entry:', err)
  }
}

/**
 * Helper to extract IP address from request headers
 */
export function getClientIP(headers: Headers): string | null {
  // Try common headers for IP address
  const forwardedFor = headers.get('x-forwarded-for')
  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(',')[0].trim()
  }

  const realIP = headers.get('x-real-ip')
  if (realIP) {
    return realIP
  }

  return null
}

/**
 * Helper to extract user agent from request headers
 */
export function getUserAgent(headers: Headers): string | null {
  return headers.get('user-agent')
}

/**
 * Convenience function to create audit log for entity creation
 */
export async function auditCreate(
  tenantId: string,
  userId: string | null,
  entityType: AuditEntityType,
  entityId: string,
  newValue: Record<string, unknown>,
  headers?: Headers
): Promise<void> {
  await logAudit({
    tenantId,
    userId,
    action: 'create',
    entityType,
    entityId,
    newValue,
    ipAddress: headers ? getClientIP(headers) : null,
    userAgent: headers ? getUserAgent(headers) : null,
  })
}

/**
 * Convenience function to create audit log for entity update
 */
export async function auditUpdate(
  tenantId: string,
  userId: string | null,
  entityType: AuditEntityType,
  entityId: string,
  oldValue: Record<string, unknown>,
  newValue: Record<string, unknown>,
  headers?: Headers
): Promise<void> {
  await logAudit({
    tenantId,
    userId,
    action: 'update',
    entityType,
    entityId,
    oldValue,
    newValue,
    ipAddress: headers ? getClientIP(headers) : null,
    userAgent: headers ? getUserAgent(headers) : null,
  })
}

/**
 * Convenience function to create audit log for entity deletion
 */
export async function auditDelete(
  tenantId: string,
  userId: string | null,
  entityType: AuditEntityType,
  entityId: string,
  oldValue: Record<string, unknown>,
  headers?: Headers
): Promise<void> {
  await logAudit({
    tenantId,
    userId,
    action: 'delete',
    entityType,
    entityId,
    oldValue,
    ipAddress: headers ? getClientIP(headers) : null,
    userAgent: headers ? getUserAgent(headers) : null,
  })
}
