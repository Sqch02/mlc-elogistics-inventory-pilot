import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/supabase/untyped'
import { fetchAllParcels, fetchAllReturns, fetchAllIntegrationShipments } from '@/lib/sendcloud/client'
import type { SendcloudCredentials, ParsedShipment, ParsedReturn } from '@/lib/sendcloud/types'
import { getDestination } from '@/lib/utils/pricing'

interface PricingRule {
  carrier: string
  destination: string | null
  weight_min_grams: number
  weight_max_grams: number
  price_eur: number
}

// This endpoint is called by Render Cron every 5 minutes
// OPTIMIZED: Uses batch operations to fit within 30s timeout
export async function GET(request: NextRequest) {
  const startTime = Date.now()
  console.log('========================================')
  console.log('[Cron] *** SYNC STARTED (BATCH MODE) ***')
  console.log(`[Cron] Timestamp: ${new Date().toISOString()}`)
  console.log('========================================')

  // Verify cron secret
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (process.env.NODE_ENV === 'production' && !cronSecret) {
    console.error('[Cron] CRON_SECRET not configured in production')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminClient = getAdminDb()

  // Get all tenants
  const { data: tenants, error: tenantsError } = await adminClient
    .from('tenants')
    .select('id')

  if (tenantsError || !tenants) {
    console.error('[Cron] Failed to get tenants:', tenantsError)
    return NextResponse.json({ error: 'Failed to get tenants' }, { status: 500 })
  }

  const results: Array<{ tenantId: string; success: boolean; shipments?: number; returns?: number; error?: string }> = []

  for (const tenant of tenants) {
    try {
      console.log(`\n[Cron] ======= TENANT: ${tenant.id} =======`)

      // Get credentials
      const { data: tenantSettings } = await adminClient
        .from('tenant_settings')
        .select('sendcloud_api_key, sendcloud_secret')
        .eq('tenant_id', tenant.id)
        .single()

      let credentials: SendcloudCredentials
      if (tenantSettings?.sendcloud_api_key && tenantSettings?.sendcloud_secret) {
        credentials = {
          apiKey: tenantSettings.sendcloud_api_key,
          secret: tenantSettings.sendcloud_secret,
        }
      } else {
        credentials = {
          apiKey: process.env.SENDCLOUD_API_KEY || '',
          secret: process.env.SENDCLOUD_SECRET || '',
        }
      }

      if (!credentials.apiKey || !credentials.secret) {
        throw new Error('No Sendcloud credentials configured')
      }

      // Get pricing rules once
      const { data: pricingRules } = await adminClient
        .from('pricing_rules')
        .select('carrier, destination, weight_min_grams, weight_max_grams, price_eur')
        .eq('tenant_id', tenant.id)

      // ============================================
      // FETCH DATA (parallel)
      // ============================================
      console.log(`[Cron] Fetching data in parallel...`)

      const [parcelsRecent, pendingOrders, returnsRecent] = await Promise.all([
        fetchAllParcels(credentials, undefined, 3),
        fetchAllIntegrationShipments(credentials, 3),
        fetchAllReturns(credentials, undefined, 3),
      ])

      console.log(`[Cron] Fetched: ${parcelsRecent.length} parcels, ${pendingOrders.length} pending, ${returnsRecent.length} returns`)

      // Merge parcels: parcels take priority over pending orders
      const shipmentMap = new Map<string, ParsedShipment>()
      for (const p of pendingOrders) {
        if (p.order_ref) shipmentMap.set(p.order_ref, p)
      }
      for (const p of parcelsRecent) {
        if (p.order_ref) shipmentMap.set(p.order_ref, p)
        else shipmentMap.set(p.sendcloud_id, p)
      }
      const parcels = Array.from(shipmentMap.values())

      // ============================================
      // CLEANUP: Delete old UUID records when parcel has same order_ref
      // ============================================
      // When an integration shipment (UUID) becomes a parcel (numeric ID),
      // we need to delete the old UUID record to avoid duplicates
      const parcelOrderRefs = parcels
        .filter(p => p.order_ref && !p.sendcloud_id.includes('-')) // Numeric sendcloud_id (not UUID)
        .map(p => p.order_ref)
        .filter((ref): ref is string => ref !== null)

      if (parcelOrderRefs.length > 0) {
        // Find and delete old UUID records for these order_refs
        const { data: oldUuidRecords } = await adminClient
          .from('shipments')
          .select('id, sendcloud_id, order_ref')
          .eq('tenant_id', tenant.id)
          .in('order_ref', parcelOrderRefs)
          .like('sendcloud_id', '%-%') // UUID format contains dashes

        if (oldUuidRecords && oldUuidRecords.length > 0) {
          console.log(`[Cron] Cleaning up ${oldUuidRecords.length} old UUID records that became parcels`)
          const oldIds = oldUuidRecords.map((r: { id: string }) => r.id)
          await adminClient
            .from('shipments')
            .delete()
            .in('id', oldIds)
        }
      }

      // ============================================
      // BATCH UPSERT SHIPMENTS
      // ============================================
      console.log(`[Cron] Batch upserting ${parcels.length} shipments...`)

      const shipmentsToUpsert = parcels.map(parcel => {
        let pricingStatus: 'ok' | 'missing' = 'missing'
        let computedCost: number | null = null

        if (pricingRules) {
          const destination = getDestination(parcel.country_code, parcel.carrier, parcel.service_point_id)
          const matchingRule = (pricingRules as PricingRule[]).find(
            (rule) =>
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

        return {
          tenant_id: tenant.id,
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
          house_number: parcel.house_number,
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
          // Error detection fields - important for "Problemes" filter
          has_error: parcel.has_error,
          error_message: parcel.error_message,
        }
      })

      if (shipmentsToUpsert.length > 0) {
        const { error: shipmentError } = await adminClient
          .from('shipments')
          .upsert(shipmentsToUpsert, { onConflict: 'sendcloud_id' })

        if (shipmentError) {
          console.error(`[Cron] Shipments batch upsert error:`, shipmentError.message)
        }
      }

      // ============================================
      // BATCH UPSERT RETURNS
      // ============================================
      console.log(`[Cron] Batch upserting ${returnsRecent.length} returns...`)

      const returnsToUpsert = returnsRecent.map((ret: ParsedReturn) => ({
        tenant_id: tenant.id,
        sendcloud_id: ret.sendcloud_id,
        sendcloud_return_id: ret.sendcloud_return_id,
        order_ref: ret.order_ref,
        tracking_number: ret.tracking_number,
        tracking_url: ret.tracking_url,
        carrier: ret.carrier,
        service: ret.service,
        status: ret.status,
        status_message: ret.status_message,
        sender_name: ret.sender_name,
        sender_email: ret.sender_email,
        sender_phone: ret.sender_phone,
        sender_company: ret.sender_company,
        sender_address: ret.sender_address,
        sender_city: ret.sender_city,
        sender_postal_code: ret.sender_postal_code,
        sender_country_code: ret.sender_country_code,
        return_reason: ret.return_reason,
        return_reason_comment: ret.return_reason_comment,
        created_at: ret.created_at,
        announced_at: ret.announced_at,
        raw_json: ret.raw_json,
      }))

      if (returnsToUpsert.length > 0) {
        const { error: returnsError } = await adminClient
          .from('returns')
          .upsert(returnsToUpsert, { onConflict: 'tenant_id,sendcloud_id' })

        if (returnsError) {
          console.error(`[Cron] Returns batch upsert error:`, returnsError.message)
        }
      }

      // ============================================
      // RECORD SYNC RUN
      // ============================================
      const duration = Date.now() - startTime
      await adminClient.from('sync_runs').insert({
        tenant_id: tenant.id,
        source: 'sendcloud',
        status: 'success',
        ended_at: new Date().toISOString(),
        stats_json: {
          shipments: shipmentsToUpsert.length,
          returns: returnsToUpsert.length,
          duration_ms: duration,
        },
      })

      results.push({
        tenantId: tenant.id,
        success: true,
        shipments: shipmentsToUpsert.length,
        returns: returnsToUpsert.length,
      })

      console.log(`[Cron] Tenant ${tenant.id} done in ${duration}ms`)

    } catch (error) {
      console.error(`[Cron] Error for tenant ${tenant.id}:`, error)
      results.push({
        tenantId: tenant.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  const totalDuration = Date.now() - startTime
  console.log(`\n[Cron] *** SYNC COMPLETE in ${totalDuration}ms ***`)

  return NextResponse.json({
    success: true,
    duration_ms: totalDuration,
    results,
  })
}
