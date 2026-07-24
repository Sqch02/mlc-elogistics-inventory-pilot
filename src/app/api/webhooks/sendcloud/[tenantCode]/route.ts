import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/supabase/untyped'
import { parseParcel } from '@/lib/sendcloud/client'
import type { SendcloudParcel, ParsedShipment } from '@/lib/sendcloud/types'
import { consumeShipmentStockOnce, restockShipmentStock } from '@/lib/stock/consume'
import { isConsumableStatus } from '@/lib/stock/consumable-status'
import type { PricingRule } from '@/lib/utils/pricing'
import { processShipmentItems } from '@/lib/utils/sku-mapping'
import { buildShipmentRow } from '@/lib/sendcloud/build-shipment-row'
import { validateSignature } from '@/lib/utils/webhook-signature'
import { resolveWebhookSecret } from '@/lib/sendcloud/webhook-secret'

// Sendcloud webhook payload structure
interface SendcloudWebhookPayload {
  action: string
  timestamp?: number
  parcel?: SendcloudParcel
  parcels?: SendcloudParcel[]
}

// Sendcloud problematic status IDs that should trigger claims
const PROBLEMATIC_STATUS_IDS = [80, 1000, 1001, 1002, 1003, 1999, 2000]

// Map status to claim type
function getClaimTypeFromStatus(statusId: number, statusMessage: string): {
  shouldCreateClaim: boolean
  claimType: 'lost' | 'damaged' | 'delay' | 'wrong_content' | 'missing_items' | 'other'
  priority: 'low' | 'normal' | 'high' | 'urgent'
} {
  const messageLower = statusMessage.toLowerCase()

  if (statusId === 1002 || messageLower.includes('lost') || messageLower.includes('perdu')) {
    return { shouldCreateClaim: true, claimType: 'lost', priority: 'urgent' }
  }

  if (messageLower.includes('damaged') || messageLower.includes('endommagé') || messageLower.includes('broken')) {
    return { shouldCreateClaim: true, claimType: 'damaged', priority: 'high' }
  }

  if (statusId === 80 || messageLower.includes('delivery exception') || messageLower.includes('unable to deliver')) {
    return { shouldCreateClaim: true, claimType: 'delay', priority: 'normal' }
  }

  if (statusId === 1999 || messageLower.includes('cancelled') || messageLower.includes('annulé')) {
    return { shouldCreateClaim: true, claimType: 'other', priority: 'high' }
  }

  if (PROBLEMATIC_STATUS_IDS.includes(statusId) || messageLower.includes('exception')) {
    return { shouldCreateClaim: true, claimType: 'other', priority: 'normal' }
  }

  return { shouldCreateClaim: false, claimType: 'other', priority: 'normal' }
}

// Create a claim from a problematic shipment
async function createClaimFromShipment(
  adminClient: ReturnType<typeof getAdminDb>,
  tenantId: string,
  shipmentId: string,
  parcel: ParsedShipment,
  claimType: 'lost' | 'damaged' | 'delay' | 'wrong_content' | 'missing_items' | 'other',
  priority: 'low' | 'normal' | 'high' | 'urgent'
): Promise<boolean> {
  try {
    const { data: existingClaim } = await adminClient
      .from('claims')
      .select('id')
      .eq('shipment_id', shipmentId)
      .single()

    if (existingClaim) {
      console.log('[Webhook] Claim already exists for shipment:', shipmentId)
      return false
    }

    const now = new Date()
    const deadlineDays = { urgent: 1, high: 3, normal: 7, low: 14 }
    const deadline = new Date(now.getTime() + deadlineDays[priority] * 24 * 60 * 60 * 1000)

    const { data: claim, error } = await adminClient
      .from('claims')
      .insert({
        tenant_id: tenantId,
        shipment_id: shipmentId,
        order_ref: parcel.order_ref,
        description: `Réclamation automatique: ${parcel.status_message || 'Problème détecté'}. Transporteur: ${parcel.carrier}. Tracking: ${parcel.tracking || 'N/A'}`,
        status: 'ouverte',
        claim_type: claimType,
        priority: priority,
        resolution_deadline: deadline.toISOString(),
      })
      .select('id')
      .single()

    if (error) {
      console.error('[Webhook] Error creating claim:', error.message)
      return false
    }

    await adminClient.from('claim_history').insert({
      claim_id: claim.id,
      tenant_id: tenantId,
      action: 'created',
      new_value: { status: 'ouverte', claim_type: claimType, priority, source: 'sendcloud_webhook' },
      note: `Créé automatiquement depuis webhook Sendcloud. Statut: ${parcel.status_message}`,
    })

    console.log('[Webhook] Created claim:', claim.id, 'for shipment:', shipmentId, 'type:', claimType)
    return true
  } catch (err) {
    console.error('[Webhook] Exception creating claim:', err)
    return false
  }
}

// Lookup tenant by code
async function getTenantByCode(adminClient: ReturnType<typeof getAdminDb>, tenantCode: string): Promise<{
  id: string
  name: string
  dedicatedWebhookSecret: string | null
  integrationSecret: string | null
} | null> {
  // First try to find by code (trim + upper to be tolerant of trailing spaces
  // that may have been entered at tenant creation time)
  const normalizedCode = tenantCode.trim().toUpperCase()
  const { data: tenant, error } = await adminClient
    .from('tenants')
    .select('id, name, code, is_active')
    .eq('code', normalizedCode)
    .single()

  if (error || !tenant) {
    console.error('[Webhook] Tenant not found for code:', tenantCode)
    return null
  }

  if (!tenant.is_active) {
    console.error('[Webhook] Tenant is inactive:', tenantCode)
    return null
  }

  const { data: settings } = await adminClient
    .from('tenant_settings')
    .select('sendcloud_webhook_secret, sendcloud_secret')
    .eq('tenant_id', tenant.id)
    .single()

  return {
    id: tenant.id,
    name: tenant.name,
    dedicatedWebhookSecret: settings?.sendcloud_webhook_secret || null,
    integrationSecret: settings?.sendcloud_secret || null,
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tenantCode: string }> }
) {
  try {
    const { tenantCode } = await params

    if (!tenantCode) {
      return NextResponse.json({ error: 'Missing tenant code' }, { status: 400 })
    }

    console.log('[Webhook] Received request for tenant:', tenantCode)

    const adminClient = getAdminDb()

    // Lookup tenant by code
    const tenant = await getTenantByCode(adminClient, tenantCode)
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found or inactive' }, { status: 404 })
    }

    const tenantId = tenant.id
    console.log('[Webhook] Resolved tenant:', tenant.name, '(' + tenantId + ')')

    // Get raw body for signature validation
    const rawBody = await request.text()

    // Get signature from header
    const signature = request.headers.get('Sendcloud-Signature') || ''

    const resolvedSecret = resolveWebhookSecret({
      dedicatedSecret: tenant.dedicatedWebhookSecret,
      integrationSecret: tenant.integrationSecret,
      globalFallback: process.env.SENDCLOUD_WEBHOOK_SECRET,
    })
    if (!resolvedSecret) {
      console.error('[Webhook] CRITICAL: No webhook secret configured for tenant', tenantCode)
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
    }

    if (resolvedSecret.source === 'integration') {
      console.warn(
        '[Webhook] Tenant',
        tenantCode,
        'has no dedicated webhook secret; using tenant integration secret fallback',
      )
    } else if (resolvedSecret.source === 'global') {
      console.warn(
        '[Webhook] Tenant',
        tenantCode,
        'has no tenant-bound secret; using global ENV fallback',
      )
    }

    const isValid = validateSignature(rawBody, signature, resolvedSecret.secret)
    if (!isValid) {
      console.error('[Webhook] Invalid signature for tenant:', tenantCode)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    // Parse payload
    let payload: SendcloudWebhookPayload
    try {
      payload = JSON.parse(rawBody) as SendcloudWebhookPayload
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
    }

    // Replay protection: parse the body exactly once. Cloning a request after
    // request.text() has consumed it is runtime-dependent and previously made
    // this check ineffective.
    if (
      typeof payload.timestamp === 'number' &&
      payload.timestamp > 0 &&
      payload.timestamp < 4102444800
    ) {
      const ageMs = Math.abs(Date.now() - payload.timestamp * 1000)
      if (ageMs > 5 * 60 * 1000) {
        console.error('[Webhook] Rejected stale payload, age (ms):', ageMs)
        return NextResponse.json({ error: 'Stale payload' }, { status: 401 })
      }
    }

    // Safe timestamp logging
    let timestampStr = 'unknown'
    if (payload.timestamp && payload.timestamp > 0 && payload.timestamp < 4102444800) {
      timestampStr = new Date(payload.timestamp * 1000).toISOString()
    }
    console.log('[Webhook]', tenantCode, ':', payload.action, 'at', timestampStr)

    // Ignore non-parcel actions
    const parcelActions = ['parcel_status_changed', 'parcel_created', 'parcel_cancelled']
    if (!parcelActions.includes(payload.action)) {
      console.log('[Webhook] Ignoring non-parcel action:', payload.action)
      return NextResponse.json({ success: true, action: 'ignored', type: payload.action })
    }

    if (payload.action === 'parcel_cancelled') {
      // Reverse stock for any parcels that were already consumed (P0-secu audit).
      // Up to now, parcel_cancelled was acknowledged without action - meaning if
      // parcel_created had consumed stock before the cancel arrived, the stock
      // stayed decremented forever.
      const cancelledParcels: SendcloudParcel[] = []
      if (payload.parcel) cancelledParcels.push(payload.parcel)
      if (payload.parcels) cancelledParcels.push(...payload.parcels)

      let reversedCount = 0
      for (const rawParcel of cancelledParcels) {
        try {
          const parcel = parseParcel(rawParcel)
          const { data: existing } = await adminClient
            .from('shipments')
            .select('id, stock_consumed_at')
            .eq('tenant_id', tenantId)
            .eq('sendcloud_id', parcel.sendcloud_id)
            .single()

          if (!existing) continue
          const shipmentId = (existing as { id: string }).id

          // Atomic CAS reset inside restockShipmentStock: only a shipment still
          // marked consumed (stock_consumed_at NOT NULL) is reversed, and the
          // marker is cleared in the same step, so two cancel events cannot
          // double-restock.
          const { restocked, count } = await restockShipmentStock(tenantId, shipmentId)
          if (restocked) {
            reversedCount += count
            await adminClient
              .from('shipments')
              .update({ has_error: true, status_id: 2000, status_message: 'Cancelled' })
              .eq('tenant_id', tenantId)
              .eq('id', shipmentId)
          }
        } catch (err) {
          console.error('[Webhook] parcel_cancelled processing error:', err)
        }
      }

      if (reversedCount > 0) {
        try { await adminClient.rpc('refresh_sku_metrics') } catch (e) { void e }
      }
      console.log('[Webhook]', tenantCode, ': Parcel cancelled - reversed', reversedCount, 'stock items')
      return NextResponse.json({ success: true, action: 'cancelled', reversed: reversedCount })
    }

    // Get the parcel(s) from payload
    const parcels: SendcloudParcel[] = []
    if (payload.parcel) {
      parcels.push(payload.parcel)
    }
    if (payload.parcels) {
      parcels.push(...payload.parcels)
    }

    if (parcels.length === 0) {
      console.log('[Webhook] No parcels in payload')
      return NextResponse.json({ success: true, action: 'no_parcels' })
    }

    // Get pricing rules for cost calculation
    const { data: pricingRules } = await adminClient
      .from('pricing_rules')
      .select('carrier, destination, weight_min_grams, weight_max_grams, price_eur')
      .eq('tenant_id', tenantId)
      .order('weight_min_grams', { ascending: true })

    const results = {
      processed: 0,
      errors: [] as string[],
    }

    // Track whether any stock changed in this batch so we know if
    // mv_sku_metrics needs a refresh at the end.
    let stockConsumedInBatch = false

    // Process each parcel
    for (const rawParcel of parcels) {
      try {
        const parcel = parseParcel(rawParcel)

        // Check if shipment already exists FOR THIS TENANT specifically.
        // Without .eq('tenant_id', ...), a sendcloud_id collision across tenants
        // would make this think the shipment exists and skip the new stock
        // consumption (P0-secu defense in depth).
        const { data: existingShipment } = await adminClient
          .from('shipments')
          .select('id, stock_consumed_at')
          .eq('tenant_id', tenantId)
          .eq('sendcloud_id', parcel.sendcloud_id)
          .single()

        const isNewShipment = !existingShipment

        // Upsert shipment
        const { data: shipment, error: shipmentError } = await adminClient
          .from('shipments')
          .upsert(
            buildShipmentRow(tenantId, parcel, pricingRules as PricingRule[] | null),
            { onConflict: 'tenant_id,sendcloud_id' }
          )
          .select('id')
          .single()

        if (shipmentError) {
          console.error('[Webhook] Error upserting shipment:', shipmentError.message)
          results.errors.push(`Parcel ${parcel.sendcloud_id}: ${shipmentError.message}`)
          continue
        }

        results.processed++
        console.log('[Webhook]', tenantCode, ': Processed parcel:', parcel.sendcloud_id, '- Status:', parcel.status_message, isNewShipment ? '(NEW)' : '(UPDATE)')

        // A status transition can become non-consumable by message even without
        // Sendcloud's numeric cancellation IDs. The atomic RPC is a no-op when
        // the shipment was never consumed or was already reversed.
        if (
          shipment &&
          payload.action === 'parcel_status_changed' &&
          !isConsumableStatus(parcel)
        ) {
          try {
            const { restocked } = await restockShipmentStock(
              tenantId,
              shipment.id,
              'Statut Sendcloud devenu non consommable',
            )
            if (restocked) stockConsumedInBatch = true
          } catch (stockError) {
            console.error(
              `[Webhook] ${tenantCode}: Error restocking cancelled parcel ${parcel.sendcloud_id}:`,
              stockError,
            )
          }
        }

        // Check if status indicates a problem
        if (parcel.status_id && shipment) {
          const { shouldCreateClaim, claimType, priority } = getClaimTypeFromStatus(
            parcel.status_id,
            parcel.status_message || ''
          )

          if (shouldCreateClaim) {
            const claimCreated = await createClaimFromShipment(
              adminClient,
              tenantId,
              shipment.id,
              parcel,
              claimType,
              priority
            )
            if (claimCreated) {
              console.log('[Webhook]', tenantCode, ': Auto-created claim for status:', parcel.status_message)
            }
          }
        }

        // Process items via the robust SKU mapping helper.
        // Mapped items go to shipment_items, unmapped items are recorded
        // in unmapped_items (never lost). Stock is consumed for NEW shipments
        // after mapping succeeds.
        if (shipment) {
          const rawJson = (parcel.raw_json as Record<string, unknown> | undefined) || {}
          const parcelItems = Array.isArray(rawJson.parcel_items)
            ? (rawJson.parcel_items as unknown[])
            : []

          if (parcelItems.length > 0) {
            try {
              const { mappedCount, unmappedCount } = await processShipmentItems(
                adminClient,
                tenantId,
                shipment.id,
                parcelItems,
              )
              console.log(
                `[Webhook] ${tenantCode}: Items for ${parcel.sendcloud_id} - ${mappedCount} mapped, ${unmappedCount} unmapped`,
              )

              // Transition based: existing On-Hold rows consume on their first
              // physically-shipped status. The SQL RPC repeats the predicate
              // and owns the idempotent CAS.
              if (
                isConsumableStatus(parcel) &&
                existingShipment?.stock_consumed_at == null &&
                mappedCount > 0
              ) {
                try {
                  const { consumed } = await consumeShipmentStockOnce(tenantId, shipment.id)
                  if (consumed) stockConsumedInBatch = true
                } catch (stockError) {
                  console.error(
                    `[Webhook] ${tenantCode}: Error consuming stock for ${parcel.sendcloud_id}:`,
                    stockError,
                  )
                }
              }
            } catch (err) {
              console.error(
                `[Webhook] ${tenantCode}: processShipmentItems error for ${parcel.sendcloud_id}:`,
                err,
              )
            }
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        results.errors.push(message)
        console.error('[Webhook]', tenantCode, ': Error processing parcel:', message)
      }
    }

    // Refresh mv_sku_metrics si du stock a change dans ce batch. Sans
    // ca, l'UI continue d'afficher l'ancien stock jusqu'au prochain cron
    // (bug observe sur REBORN21 le 27/05). On le fait ici plutot que par
    // parcelle pour eviter N refresh quand plusieurs parcels arrivent dans
    // le meme webhook.
    if (stockConsumedInBatch) {
      try {
        await adminClient.rpc('refresh_sku_metrics')
      } catch (refreshError) {
        console.error(
          `[Webhook] ${tenantCode}: refresh_sku_metrics failed:`,
          refreshError,
        )
      }
    }

    console.log('[Webhook]', tenantCode, ': Completed:', results.processed, 'processed,', results.errors.length, 'errors')

    return NextResponse.json({
      success: true,
      tenant: tenantCode,
      processed: results.processed,
      errors: results.errors.length,
    })
  } catch (error) {
    console.error('[Webhook] Fatal error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    )
  }
}

// Sendcloud may send GET requests to verify the endpoint
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tenantCode: string }> }
) {
  const { tenantCode } = await params

  const adminClient = getAdminDb()
  const tenant = await getTenantByCode(adminClient, tenantCode)

  if (!tenant) {
    return NextResponse.json({
      status: 'error',
      message: 'Tenant not found',
    }, { status: 404 })
  }

  return NextResponse.json({
    status: 'ok',
    tenant: tenantCode,
    message: 'Sendcloud webhook endpoint ready for ' + tenant.name,
  })
}
