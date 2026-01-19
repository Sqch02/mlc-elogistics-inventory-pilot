import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { getAdminDb } from '@/lib/supabase/untyped'
import { parseParcel } from '@/lib/sendcloud/client'
import type { SendcloudParcel, ParsedShipment } from '@/lib/sendcloud/types'
import { consumeStock } from '@/lib/stock/consume'
import { getDestination } from '@/lib/utils/pricing'
import { getServerFeatures } from '@/lib/config/features'

// Sendcloud webhook payload structure
interface SendcloudWebhookPayload {
  action: string // Can be parcel_status_changed, parcel_created, parcel_cancelled, integration_updated, etc.
  timestamp?: number
  parcel?: SendcloudParcel
  // Legacy format - some webhooks may send this
  parcels?: SendcloudParcel[]
}

// Sendcloud problematic status IDs that should trigger claims
// Based on Sendcloud documentation:
// - 1000+: Exception statuses
// - 1001: Exception/Problem
// - 1002: Lost
// - 1999: Cancelled by carrier
// - 80: Failed delivery
const PROBLEMATIC_STATUS_IDS = [80, 1000, 1001, 1002, 1003, 1999, 2000]

// Sendcloud resolved status IDs that should close claims
// - 11: Delivered
// - 12: Delivered to service point
// - 6: Picked up (for returns)
const RESOLVED_STATUS_IDS = [11, 12, 6]

// Map status to claim type
function getClaimTypeFromStatus(statusId: number, statusMessage: string): {
  shouldCreateClaim: boolean
  claimType: 'lost' | 'damaged' | 'delay' | 'wrong_content' | 'missing_items' | 'other'
  priority: 'low' | 'normal' | 'high' | 'urgent'
} {
  const messageLower = statusMessage.toLowerCase()

  // Check for lost
  if (statusId === 1002 || messageLower.includes('lost') || messageLower.includes('perdu')) {
    return { shouldCreateClaim: true, claimType: 'lost', priority: 'urgent' }
  }

  // Check for damaged
  if (messageLower.includes('damaged') || messageLower.includes('endommagé') || messageLower.includes('broken')) {
    return { shouldCreateClaim: true, claimType: 'damaged', priority: 'high' }
  }

  // Check for delivery issues (potential delay)
  if (statusId === 80 || messageLower.includes('delivery exception') || messageLower.includes('unable to deliver')) {
    return { shouldCreateClaim: true, claimType: 'delay', priority: 'normal' }
  }

  // Check for cancelled by carrier
  if (statusId === 1999 || messageLower.includes('cancelled') || messageLower.includes('annulé')) {
    return { shouldCreateClaim: true, claimType: 'other', priority: 'high' }
  }

  // Generic exception
  if (PROBLEMATIC_STATUS_IDS.includes(statusId) || messageLower.includes('exception')) {
    return { shouldCreateClaim: true, claimType: 'other', priority: 'normal' }
  }

  return { shouldCreateClaim: false, claimType: 'other', priority: 'normal' }
}

// Map Sendcloud status to return status
function mapReturnStatus(statusMessage: string): 'announced' | 'ready' | 'in_transit' | 'delivered' | 'cancelled' {
  const msg = statusMessage.toLowerCase()
  if (msg.includes('delivered') || msg.includes('livré')) return 'delivered'
  if (msg.includes('transit') || msg.includes('en route')) return 'in_transit'
  if (msg.includes('ready') || msg.includes('prêt')) return 'ready'
  if (msg.includes('cancelled') || msg.includes('annulé')) return 'cancelled'
  return 'announced'
}

// Sync a return parcel to the returns table
async function syncReturn(
  adminClient: ReturnType<typeof getAdminDb>,
  tenantId: string,
  parcel: ParsedShipment
): Promise<boolean> {
  try {
    // Try to find original outbound shipment by order_ref
    let originalShipmentId: string | null = null
    if (parcel.order_ref) {
      const { data: originalShipment } = await adminClient
        .from('shipments')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('order_ref', parcel.order_ref)
        .eq('is_return', false)
        .order('shipped_at', { ascending: false })
        .limit(1)
        .single()

      if (originalShipment) {
        originalShipmentId = originalShipment.id
      }
    }

    // Upsert to returns table
    const { error } = await adminClient
      .from('returns')
      .upsert({
        tenant_id: tenantId,
        sendcloud_id: parcel.sendcloud_id,
        order_ref: parcel.order_ref,
        original_shipment_id: originalShipmentId,
        tracking_number: parcel.tracking,
        tracking_url: parcel.tracking_url,
        carrier: parcel.carrier,
        service: parcel.service,
        status: mapReturnStatus(parcel.status_message || ''),
        status_message: parcel.status_message,
        sender_name: parcel.recipient_name,
        sender_email: parcel.recipient_email,
        sender_phone: parcel.recipient_phone,
        sender_company: parcel.recipient_company,
        sender_address: parcel.address_line1,
        sender_city: parcel.city,
        sender_postal_code: parcel.postal_code,
        sender_country_code: parcel.country_code,
        announced_at: parcel.date_announced || parcel.date_created,
        raw_json: parcel.raw_json,
      }, { onConflict: 'tenant_id,sendcloud_id' })

    if (error) {
      console.error('[Webhook] Error syncing return:', error.message)
      return false
    }

    console.log('[Webhook] Synced return:', parcel.sendcloud_id)
    return true
  } catch (err) {
    console.error('[Webhook] Exception syncing return:', err)
    return false
  }
}

// Close a claim when shipment is resolved (delivered)
async function closeClaimIfExists(
  adminClient: ReturnType<typeof getAdminDb>,
  tenantId: string,
  shipmentId: string,
  statusMessage: string
): Promise<boolean> {
  try {
    // Find open claim for this shipment
    const { data: existingClaim } = await adminClient
      .from('claims')
      .select('id, status')
      .eq('shipment_id', shipmentId)
      .in('status', ['ouverte', 'en_analyse'])
      .single()

    if (!existingClaim) {
      return false // No open claim to close
    }

    // Close the claim
    const { error } = await adminClient
      .from('claims')
      .update({
        status: 'cloturee',
        decided_at: new Date().toISOString(),
        decision_note: `Clôturé automatiquement - ${statusMessage}`,
      })
      .eq('id', existingClaim.id)

    if (error) {
      console.error('[Webhook] Error closing claim:', error.message)
      return false
    }

    // Log in claim history
    await adminClient.from('claim_history').insert({
      claim_id: existingClaim.id,
      tenant_id: tenantId,
      action: 'status_changed',
      old_value: { status: existingClaim.status },
      new_value: { status: 'cloturee' },
      note: `Clôturé automatiquement depuis webhook Sendcloud. Statut: ${statusMessage}`,
    })

    console.log('[Webhook] Closed claim:', existingClaim.id, 'for shipment:', shipmentId)
    return true
  } catch (err) {
    console.error('[Webhook] Exception closing claim:', err)
    return false
  }
}

// Close claim when a re-shipment is detected (new shipment with same order_ref)
async function closeClaimOnReshipment(
  adminClient: ReturnType<typeof getAdminDb>,
  tenantId: string,
  orderRef: string,
  newSendcloudId: string
): Promise<boolean> {
  try {
    if (!orderRef) return false

    // Find open claim for this order_ref (from a different/older shipment)
    const { data: existingClaim } = await adminClient
      .from('claims')
      .select('id, status, shipment_id, shipments!inner(sendcloud_id)')
      .eq('tenant_id', tenantId)
      .or(`order_ref.eq.${orderRef},order_ref.eq.#${orderRef}`)
      .in('status', ['ouverte', 'en_analyse'])
      .neq('shipments.sendcloud_id', newSendcloudId)
      .limit(1)
      .single()

    if (!existingClaim) {
      return false // No open claim to close
    }

    // Close the claim - order was re-shipped
    const { error } = await adminClient
      .from('claims')
      .update({
        status: 'cloturee',
        decided_at: new Date().toISOString(),
        decision_note: `Clôturé automatiquement - Commande réexpédiée (${newSendcloudId})`,
      })
      .eq('id', existingClaim.id)

    if (error) {
      console.error('[Webhook] Error closing claim on reshipment:', error.message)
      return false
    }

    // Log in claim history
    await adminClient.from('claim_history').insert({
      claim_id: existingClaim.id,
      tenant_id: tenantId,
      action: 'status_changed',
      old_value: { status: existingClaim.status },
      new_value: { status: 'cloturee' },
      note: `Clôturé automatiquement - Nouvelle expédition détectée: ${newSendcloudId}`,
    })

    console.log('[Webhook] Closed claim:', existingClaim.id, 'due to reshipment:', newSendcloudId)
    return true
  } catch (err) {
    console.error('[Webhook] Exception closing claim on reshipment:', err)
    return false
  }
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
    // Check if claim already exists for this shipment
    const { data: existingClaim } = await adminClient
      .from('claims')
      .select('id')
      .eq('shipment_id', shipmentId)
      .single()

    if (existingClaim) {
      console.log('[Webhook] Claim already exists for shipment:', shipmentId)
      return false
    }

    // Calculate deadline based on priority
    const now = new Date()
    const deadlineDays = { urgent: 1, high: 3, normal: 7, low: 14 }
    const deadline = new Date(now.getTime() + deadlineDays[priority] * 24 * 60 * 60 * 1000)

    // Create the claim
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
        auto_created: true,
        sendcloud_status_id: parcel.status_id,
        sendcloud_status_message: parcel.status_message,
      })
      .select('id')
      .single()

    if (error) {
      console.error('[Webhook] Error creating claim:', error.message)
      return false
    }

    // Log in claim history
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

// Validate webhook signature from Sendcloud
function validateSignature(payload: string, signature: string, secret: string): boolean {
  if (!secret || !signature) {
    console.warn('[Webhook] Missing secret or signature')
    return false
  }

  const expectedSignature = createHmac('sha256', secret)
    .update(payload)
    .digest('hex')

  // Constant-time comparison to prevent timing attacks
  if (signature.length !== expectedSignature.length) {
    return false
  }

  let result = 0
  for (let i = 0; i < signature.length; i++) {
    result |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i)
  }

  return result === 0
}

// Get tenant ID from Sendcloud account mapping (if multi-tenant)
// For now, use default tenant since MLC is single-tenant pilot
async function getTenantForWebhook(): Promise<string> {
  // In V1 pilot, use the default tenant
  // In V2, this would look up the tenant based on Sendcloud account ID
  return '00000000-0000-0000-0000-000000000001'
}

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature validation
    const rawBody = await request.text()

    // Get signature from header
    const signature = request.headers.get('Sendcloud-Signature') || ''

    // Get webhook secret from environment
    const webhookSecret = process.env.SENDCLOUD_WEBHOOK_SECRET || ''

    // Validate signature if secret is configured
    if (webhookSecret) {
      const isValid = validateSignature(rawBody, signature, webhookSecret)
      if (!isValid) {
        console.error('[Webhook] Invalid signature')
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 401 }
        )
      }
    } else {
      console.warn('[Webhook] No webhook secret configured - signature validation skipped')
    }

    // Parse payload
    const payload: SendcloudWebhookPayload = JSON.parse(rawBody)

    // Safe timestamp logging
    let timestampStr = 'unknown'
    if (payload.timestamp && payload.timestamp > 0 && payload.timestamp < 4102444800) {
      // Valid timestamp between 1970 and 2100
      timestampStr = new Date(payload.timestamp * 1000).toISOString()
    }
    console.log('[Webhook] Received:', payload.action, 'at', timestampStr)

    // Ignore non-parcel actions (like integration_updated, integration_connected, etc.)
    const parcelActions = ['parcel_status_changed', 'parcel_created', 'parcel_cancelled']
    if (!parcelActions.includes(payload.action)) {
      console.log('[Webhook] Ignoring non-parcel action:', payload.action)
      return NextResponse.json({ success: true, action: 'ignored', type: payload.action })
    }

    // Handle different actions
    if (payload.action === 'parcel_cancelled') {
      // For cancelled parcels, we might want to mark them as cancelled
      // but for V1, we just acknowledge and skip
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

    // Get tenant
    const tenantId = await getTenantForWebhook()

    // Use admin client
    const adminClient = getAdminDb()

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

        // Check if shipment already exists (to know if we should consume stock)
        const { data: existingShipment } = await adminClient
          .from('shipments')
          .select('id')
          .eq('sendcloud_id', parcel.sendcloud_id)
          .single()

        const isNewShipment = !existingShipment

        // Calculate pricing with destination awareness
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
              // All Sendcloud fields
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
        console.log('[Webhook] Processed parcel:', parcel.sendcloud_id, '- Status:', parcel.status_message, isNewShipment ? '(NEW)' : '(UPDATE)')

        // If this is a NEW shipment, check if it's a re-shipment that should close an existing claim
        if (isNewShipment && parcel.order_ref) {
          const claimClosed = await closeClaimOnReshipment(
            adminClient,
            tenantId,
            parcel.order_ref,
            parcel.sendcloud_id
          )
          if (claimClosed) {
            console.log('[Webhook] Closed claim due to reshipment for order:', parcel.order_ref)
          }
        }

        // Get feature flags once
        const serverFeatures = getServerFeatures()

        // Sync returns to dedicated returns table
        if (serverFeatures.returnsSync && parcel.is_return) {
          await syncReturn(adminClient, tenantId, parcel)
        }

        // Check if status indicates a problem that should create a claim
        // Auto-creation is now ENABLED BY DEFAULT for full automation
        if (serverFeatures.autoCreateClaims && parcel.status_id && shipment) {
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
              console.log('[Webhook] Auto-created claim for problematic status:', parcel.status_message)
            }
          }

          // Check if status indicates resolution (delivered) - close any open claim
          if (RESOLVED_STATUS_IDS.includes(parcel.status_id)) {
            const claimClosed = await closeClaimIfExists(
              adminClient,
              tenantId,
              shipment.id,
              parcel.status_message || 'Livré'
            )
            if (claimClosed) {
              console.log('[Webhook] Auto-closed claim for resolved status:', parcel.status_message)
            }
          }
        }

        // Process items if available
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

              // ONLY consume stock for NEW shipments (not updates)
              if (isNewShipment) {
                try {
                  await consumeStock(
                    tenantId,
                    skuId,
                    item.qty,
                    shipment.id,
                    'shipment'
                  )
                  console.log(`[Webhook] Consumed stock for SKU ${item.sku_code} x${item.qty}`)
                } catch (stockError) {
                  console.error(`[Webhook] Error consuming stock for SKU ${item.sku_code}:`, stockError)
                }
              }
            }
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        results.errors.push(message)
        console.error('[Webhook] Error processing parcel:', message)
      }
    }

    console.log('[Webhook] Completed:', results.processed, 'processed,', results.errors.length, 'errors')

    return NextResponse.json({
      success: true,
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
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Sendcloud webhook endpoint ready',
  })
}
