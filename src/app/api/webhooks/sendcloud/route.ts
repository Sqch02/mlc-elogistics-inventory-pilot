import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { getAdminDb } from '@/lib/supabase/untyped'
import { parseParcel } from '@/lib/sendcloud/client'
import type { SendcloudParcel } from '@/lib/sendcloud/types'
import { consumeStock } from '@/lib/stock/consume'
import { getDestination } from '@/lib/utils/pricing'

// Sendcloud webhook payload structure
interface SendcloudWebhookPayload {
  action: string // Can be parcel_status_changed, parcel_created, parcel_cancelled, integration_updated, etc.
  timestamp?: number
  parcel?: SendcloudParcel
  // Legacy format - some webhooks may send this
  parcels?: SendcloudParcel[]
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
