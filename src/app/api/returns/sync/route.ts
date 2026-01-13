import { NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/supabase/untyped'
import { requireTenant } from '@/lib/supabase/auth'
import { fetchAllReturns } from '@/lib/sendcloud/client'
import type { SendcloudCredentials } from '@/lib/sendcloud/types'

export async function POST() {
  let tenantId: string

  try {
    tenantId = await requireTenant()
    console.log('[Returns Sync] Starting sync for tenant:', tenantId)

    const adminClient = getAdminDb()

    // Get credentials (from tenant_settings or env vars)
    let credentials: SendcloudCredentials

    const { data: tenantSettings } = await adminClient
      .from('tenant_settings')
      .select('sendcloud_api_key, sendcloud_secret')
      .eq('tenant_id', tenantId)
      .single()

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

    // Fetch returns from Sendcloud
    console.log('[Returns Sync] Fetching returns from Sendcloud')
    const returns = await fetchAllReturns(credentials)
    console.log('[Returns Sync] Fetched', returns.length, 'returns')

    const stats = {
      fetched: returns.length,
      created: 0,
      updated: 0,
      errors: [] as string[],
    }

    // Process each return
    for (const ret of returns) {
      try {
        // Try to link to original shipment if we have order_ref
        let originalShipmentId: string | null = null
        if (ret.order_ref) {
          const { data: shipment } = await adminClient
            .from('shipments')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('order_ref', ret.order_ref)
            .limit(1)
            .single()

          if (shipment) {
            originalShipmentId = shipment.id
          }
        }

        // Check if return already exists
        const { data: existingReturn } = await adminClient
          .from('returns')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('sendcloud_id', ret.sendcloud_id)
          .single()

        const isNew = !existingReturn

        // Upsert return
        const { error: returnError } = await adminClient
          .from('returns')
          .upsert(
            {
              tenant_id: tenantId,
              sendcloud_id: ret.sendcloud_id,
              sendcloud_return_id: ret.sendcloud_return_id,
              order_ref: ret.order_ref,
              original_shipment_id: originalShipmentId,
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
              announced_at: ret.announced_at,
              raw_json: ret.raw_json,
            },
            { onConflict: 'tenant_id,sendcloud_id' }
          )

        if (returnError) {
          console.log('[Returns Sync] Error upserting return', ret.sendcloud_id, ':', returnError.message)
          stats.errors.push(`Return ${ret.sendcloud_id}: ${returnError.message}`)
          continue
        }

        if (isNew) {
          stats.created++
        } else {
          stats.updated++
        }
      } catch (error) {
        stats.errors.push(
          `Return ${ret.sendcloud_id}: ${error instanceof Error ? error.message : 'Unknown error'}`
        )
      }
    }

    console.log('[Returns Sync] Completed! Stats:', JSON.stringify(stats))
    return NextResponse.json({
      success: true,
      message: `Sync terminée: ${stats.created} retours importés, ${stats.updated} mis à jour`,
      stats,
    })
  } catch (error) {
    console.error('Returns sync error:', error)

    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : 'Erreur de synchronisation',
      },
      { status: 500 }
    )
  }
}
