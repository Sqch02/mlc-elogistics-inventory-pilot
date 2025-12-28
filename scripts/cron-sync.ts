/**
 * Cron Job Script - Sendcloud Sync
 *
 * This script is executed by Render's cron service daily.
 * It syncs shipments from Sendcloud for all active tenants.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function main() {
  console.log('Starting Sendcloud sync cron job...')
  const startTime = Date.now()

  try {
    // Get all active tenants
    const { data: tenants, error: tenantsError } = await supabase
      .from('tenants')
      .select('id, name')

    if (tenantsError) {
      throw tenantsError
    }

    console.log(`Found ${tenants?.length || 0} tenants to sync`)

    for (const tenant of tenants || []) {
      console.log(`\nSyncing tenant: ${tenant.name} (${tenant.id})`)

      try {
        // Check for tenant-specific Sendcloud credentials
        const { data: settings } = await supabase
          .from('tenant_settings')
          .select('sendcloud_api_key, sendcloud_secret, sync_enabled')
          .eq('tenant_id', tenant.id)
          .single()

        if (settings && !settings.sync_enabled) {
          console.log(`  Sync disabled for tenant, skipping`)
          continue
        }

        // Create sync run record
        const { data: syncRun, error: syncError } = await supabase
          .from('sync_runs')
          .insert({
            tenant_id: tenant.id,
            source: 'sendcloud',
            status: 'running',
          })
          .select()
          .single()

        if (syncError) {
          console.error(`  Failed to create sync run: ${syncError.message}`)
          continue
        }

        // Determine which credentials to use
        const apiKey = settings?.sendcloud_api_key || process.env.SENDCLOUD_API_KEY
        const apiSecret = settings?.sendcloud_secret || process.env.SENDCLOUD_SECRET
        const useMock = process.env.SENDCLOUD_USE_MOCK === 'true'

        if (!useMock && (!apiKey || !apiSecret)) {
          console.log(`  No Sendcloud credentials available, skipping`)
          await supabase
            .from('sync_runs')
            .update({
              status: 'failed',
              error_message: 'Missing Sendcloud credentials',
              finished_at: new Date().toISOString(),
            })
            .eq('id', syncRun.id)
          continue
        }

        // Get last successful sync timestamp
        const { data: lastSync } = await supabase
          .from('sync_runs')
          .select('finished_at')
          .eq('tenant_id', tenant.id)
          .eq('source', 'sendcloud')
          .eq('status', 'success')
          .order('finished_at', { ascending: false })
          .limit(1)
          .single()

        const since = lastSync?.finished_at
          ? new Date(lastSync.finished_at)
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Default: last 30 days

        console.log(`  Fetching shipments since: ${since.toISOString()}`)

        let shipments: any[] = []
        let recordsCreated = 0
        let recordsUpdated = 0

        if (useMock) {
          // Generate mock shipments
          const { generateMockParcels } = await import('../src/lib/sendcloud/mock')
          const parcels = generateMockParcels(10)
          shipments = parcels.map(p => ({
            id: p.id,
            tracking_number: p.tracking_number,
            carrier: p.carrier?.code || 'unknown',
            weight: parseFloat(p.weight),
            order_number: p.order_number,
            date_created: p.created_at,
            status: p.status,
          }))
        } else {
          // Fetch from real Sendcloud API
          const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
          const response = await fetch(
            `https://panel.sendcloud.sc/api/v2/parcels?from_date=${since.toISOString().split('T')[0]}`,
            {
              headers: {
                Authorization: `Basic ${auth}`,
                'Content-Type': 'application/json',
              },
            }
          )

          if (!response.ok) {
            throw new Error(`Sendcloud API error: ${response.status}`)
          }

          const data = await response.json()
          shipments = data.parcels || []
        }

        console.log(`  Found ${shipments.length} shipments`)

        // Upsert shipments
        for (const shipment of shipments) {
          const shipmentData = {
            tenant_id: tenant.id,
            sendcloud_id: String(shipment.id),
            order_ref: shipment.order_number || shipment.external_order_id || null,
            carrier: shipment.carrier?.code || shipment.carrier || 'unknown',
            weight_grams: Math.round((shipment.weight || 0) * 1000),
            shipped_at: shipment.date_created || new Date().toISOString(),
            status: shipment.status?.message || 'unknown',
            tracking_number: shipment.tracking_number || null,
            tracking_url: shipment.tracking_url || null,
            pricing_status: 'pending' as const,
          }

          const { error: upsertError, data: upsertResult } = await supabase
            .from('shipments')
            .upsert(shipmentData, {
              onConflict: 'sendcloud_id',
            })
            .select()

          if (upsertError) {
            console.error(`  Failed to upsert shipment ${shipment.id}: ${upsertError.message}`)
          } else if (upsertResult) {
            recordsCreated++
          }
        }

        // Update sync run as successful
        await supabase
          .from('sync_runs')
          .update({
            status: 'success',
            records_synced: recordsCreated,
            finished_at: new Date().toISOString(),
          })
          .eq('id', syncRun.id)

        console.log(`  Sync complete: ${recordsCreated} created/updated`)
      } catch (error) {
        console.error(`  Error syncing tenant: ${error}`)
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000)
    console.log(`\nCron job completed in ${duration}s`)
    process.exit(0)
  } catch (error) {
    console.error('Cron job failed:', error)
    process.exit(1)
  }
}

main()
