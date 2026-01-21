import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/supabase/auth'
import { getShipment } from '@/lib/sendcloud/client'
import type { SendcloudCredentials } from '@/lib/sendcloud/types'
import { getAdminDb } from '@/lib/supabase/untyped'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const tenantId = await requireTenant()
    const { id } = await params
    const adminClient = getAdminDb()

    // Get the shipment (use adminClient for untyped access to all columns)
    const { data: shipment, error: fetchError } = await adminClient
      .from('shipments')
      .select('id, sendcloud_id, tenant_id')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (fetchError || !shipment) {
      return NextResponse.json(
        { error: 'Expédition non trouvée' },
        { status: 404 }
      )
    }

    const sendcloudId = shipment.sendcloud_id as string | null

    if (!sendcloudId) {
      return NextResponse.json(
        { error: 'Cette expédition n\'a pas d\'ID Sendcloud' },
        { status: 400 }
      )
    }

    // Get Sendcloud credentials
    const { data: tenantSettings } = await adminClient
      .from('tenant_settings')
      .select('sendcloud_api_key, sendcloud_secret')
      .eq('tenant_id', tenantId)
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

    // Get fresh data from Sendcloud (handles both parcels and integration shipments)
    const result = await getShipment(credentials, sendcloudId)

    if (!result.success || !result.parcel) {
      return NextResponse.json(
        { error: result.error || 'Erreur lors de la récupération' },
        { status: 400 }
      )
    }

    const parcel = result.parcel

    // Update local database with fresh data
    const { error: updateError } = await adminClient
      .from('shipments')
      .update({
        shipped_at: parcel.shipped_at,
        carrier: parcel.carrier,
        service: parcel.service,
        weight_grams: parcel.weight_grams,
        tracking: parcel.tracking,
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
        date_updated: parcel.date_updated,
        raw_json: parcel.raw_json,
      })
      .eq('id', id)

    if (updateError) {
      return NextResponse.json(
        { error: 'Erreur lors de la mise à jour locale' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Expédition mise à jour',
      status_message: parcel.status_message,
    })
  } catch (error) {
    console.error('Refresh shipment error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
