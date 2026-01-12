import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/supabase/auth'
import { cancelParcel, getParcel } from '@/lib/sendcloud/client'
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
      .select('id, sendcloud_id, status_message, status_id, tenant_id')
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
    const statusId = shipment.status_id as number | null
    const statusMessage = shipment.status_message as string | null

    if (!sendcloudId) {
      return NextResponse.json(
        { error: 'Cette expédition n\'a pas d\'ID Sendcloud' },
        { status: 400 }
      )
    }

    // Check if already cancelled
    if (statusId === 2000 || statusMessage?.toLowerCase().includes('cancel')) {
      return NextResponse.json(
        { error: 'Cette expédition est déjà annulée' },
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

    // Cancel in Sendcloud
    const result = await cancelParcel(credentials, sendcloudId)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Erreur lors de l\'annulation' },
        { status: 400 }
      )
    }

    // Refresh parcel data from Sendcloud
    const refreshResult = await getParcel(credentials, sendcloudId)

    if (refreshResult.success && refreshResult.parcel) {
      // Update local database with new status
      await adminClient
        .from('shipments')
        .update({
          status_id: refreshResult.parcel.status_id,
          status_message: refreshResult.parcel.status_message || 'Cancelled',
        })
        .eq('id', id)
    } else {
      // Just mark as cancelled locally
      await adminClient
        .from('shipments')
        .update({
          status_id: 2000,
          status_message: 'Cancelled',
        })
        .eq('id', id)
    }

    return NextResponse.json({
      success: true,
      message: 'Expédition annulée avec succès',
    })
  } catch (error) {
    console.error('Cancel shipment error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
