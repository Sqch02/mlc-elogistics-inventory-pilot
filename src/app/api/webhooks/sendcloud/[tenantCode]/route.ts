import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { getAdminDb } from '@/lib/supabase/untyped'
import { parseParcel } from '@/lib/sendcloud/client'
import type { SendcloudParcel, ParsedShipment } from '@/lib/sendcloud/types'
import { consumeStock } from '@/lib/stock/consume'
import { getDestination } from '@/lib/utils/pricing'

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

interface PricingRule {
  carrier: string
  destination: string | null
  weight_min_grams: number
  weight_max_grams: number
  price_eur: number
}

// Validate webhook signature
function validateSignature(payload: string, signature: string, secret: string): boolean {
  if (!secret || !signature) {
    return false
  }

  const expectedSignature = createHmac('sha256', secret)
    .update(payload)
    .digest('hex')

  if (signature.length !== expectedSignature.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i)
  }

  return result === 0
}

// Lookup tenant by code
async function getTenantByCode(adminClient: ReturnType<typeof getAdminDb>, tenantCode: string): Promise<{
  id: string
  name: string
  webhookSecret: string | null
} | null> {
  // First try to find by code
  const { data: tenant, error } = await adminClient
    .from('tenants')
    .select('id, name, code, is_active')
    .eq('code', tenantCode.toUpperCase())
    .single()

  if (error || !tenant) {
    console.error('[Webhook] Tenant not found for code:', tenantCode)
    return null
  }

  if (!tenant.is_active) {
    console.error('[Webhook] Tenant is inactive:', tenantCode)
    return null
  }

  // Get webhook secret from tenant_settings
  const { data: settings } = await adminClient
    .from('tenant_settings')
    .select('sendcloud_webhook_secret')
    .eq('tenant_id', tenant.id)
    .single()

  return {
    id: tenant.id,
    name: tenant.name,
    webhookSecret: settings?.sendcloud_webhook_secret || null,
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

    // Get webhook secret - prefer tenant-specific, fallback to global
    const webhookSecret = tenant.webhookSecret || process.env.SENDCLOUD_WEBHOOK_SECRET || ''

    // Validate signature if secret is configured
    if (webhookSecret) {
      const isValid = validateSignature(rawBody, signature, webhookSecret)
      if (!isValid) {
        console.error('[Webhook] Invalid signature for tenant:', tenantCode)
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    } else {
      console.warn('[Webhook] No webhook secret configured for tenant:', tenantCode)
    }

    // Parse payload
    const payload: SendcloudWebhookPayload = JSON.parse(rawBody)

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
      console.log('[Webhook] Parcel cancelled - acknowledged')
      return NextResponse.json({ success: true, action: 'skipped_cancelled' })
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

    // Get SKU map for item matching
    const { data: skus } = await adminClient
      .from('skus')
      .select('id, sku_code')
      .eq('tenant_id', tenantId)

    const skuMap = new Map<string, string>(
      skus?.map((s: { sku_code: string; id: string }) => [s.sku_code.toLowerCase(), s.id]) || []
    )

    const results = {
      processed: 0,
      errors: [] as string[],
    }

    // Process each parcel
    for (const rawParcel of parcels) {
      try {
        const parcel = parseParcel(rawParcel)

        // Check if shipment already exists
        const { data: existingShipment } = await adminClient
          .from('shipments')
          .select('id')
          .eq('sendcloud_id', parcel.sendcloud_id)
          .single()

        const isNewShipment = !existingShipment

        // Calculate pricing
        let pricingStatus: 'ok' | 'missing' = 'missing'
        let computedCost: number | null = null

        if (pricingRules) {
          const destination = getDestination(parcel.country_code, parcel.carrier, parcel.service_point_id)
          const matchingRule = (pricingRules as PricingRule[]).find(
            (rule: PricingRule) =>
              rule.carrier.toLowerCase() === parcel.carrier.toLowerCase() &&
              rule.destination === destination &&
              rule.weight_min_grams <= parcel.weight_grams &&
              rule.weight_max_grams > parcel.weight_grams
          )

          if (matchingRule) {
            pricingStatus = 'ok'
            computedCost = Number(matchingRule.price_eur)
          }
        }

        // Upsert shipment
        const { data: shipment, error: shipmentError } = await adminClient
          .from('shipments')
          .upsert(
            {
              tenant_id: tenantId,
              sendcloud_id: parcel.sendcloud_id,
              shipped_at: parcel.shipped_at,
              carrier: parcel.carrier,
              service: parcel.service,
              weight_grams: parcel.weight_grams,
              order_ref: parcel.order_ref,
              tracking: parcel.tracking,
              pricing_status: pricingStatus,
              computed_cost_eur: computedCost,
              raw_json: parcel.raw_json,
              recipient_name: parcel.recipient_name,
              recipient_email: parcel.recipient_email,
              recipient_phone: parcel.recipient_phone,
              recipient_company: parcel.recipient_company,
              address_line1: parcel.address_line1,
              address_line2: parcel.address_line2,
              city: parcel.city,
              postal_code: parcel.postal_code,
              country_code: parcel.country_code,
              country_name: parcel.country_name,
              status_id: parcel.status_id,
              status_message: parcel.status_message,
              tracking_url: parcel.tracking_url,
              label_url: parcel.label_url,
              total_value: parcel.total_value,
              currency: parcel.currency,
              service_point_id: parcel.service_point_id,
              is_return: parcel.is_return,
              collo_count: parcel.collo_count,
              length_cm: parcel.length_cm,
              width_cm: parcel.width_cm,
              height_cm: parcel.height_cm,
              external_order_id: parcel.external_order_id,
              date_created: parcel.date_created,
              date_updated: parcel.date_updated,
              date_announced: parcel.date_announced,
            },
            { onConflict: 'sendcloud_id' }
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

        // Process items
        if (parcel.items && parcel.items.length > 0 && shipment) {
          for (const item of parcel.items) {
            const skuId = skuMap.get(item.sku_code.toLowerCase())
            if (skuId) {
              await adminClient
                .from('shipment_items')
                .upsert(
                  {
                    tenant_id: tenantId,
                    shipment_id: shipment.id,
                    sku_id: skuId,
                    qty: item.qty,
                  },
                  { onConflict: 'shipment_id,sku_id' }
                )

              if (isNewShipment) {
                try {
                  await consumeStock(tenantId, skuId, item.qty, shipment.id, 'shipment')
                  console.log(`[Webhook] ${tenantCode}: Consumed stock for SKU ${item.sku_code} x${item.qty}`)
                } catch (stockError) {
                  console.error(`[Webhook] ${tenantCode}: Error consuming stock for SKU ${item.sku_code}:`, stockError)
                }
              }
            }
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        results.errors.push(message)
        console.error('[Webhook]', tenantCode, ': Error processing parcel:', message)
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
