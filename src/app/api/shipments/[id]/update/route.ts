import { NextRequest, NextResponse } from 'next/server'
import { requireTenant } from '@/lib/supabase/auth'
import { updateParcel, UpdateParcelData, getParcel } from '@/lib/sendcloud/client'
import type { SendcloudCredentials } from '@/lib/sendcloud/types'
import { getAdminDb } from '@/lib/supabase/untyped'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const tenantId = await requireTenant()
    const { id } = await params
    const body = await request.json()
    const adminClient = getAdminDb()

    // Get the shipment
    const { data: shipment, error: fetchError } = await adminClient
      .from('shipments')
      .select('id, sendcloud_id, status_id, status_message, tenant_id')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single()

    if (fetchError || !shipment) {
      return NextResponse.json({ error: 'Expedition non trouvée' }, { status: 404 })
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

    // Check if it's an integration shipment (UUID format) - these are "On Hold" orders from Shopify
    // Integration shipments cannot be modified via the parcels API
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sendcloudId)
    if (isUUID) {
      // For integration shipments, we can only update in our local database
      // The user needs to process/create the label in Sendcloud first, or modify directly in Sendcloud

      // Update local database only
      await adminClient
        .from('shipments')
        .update({
          recipient_name: body.recipient_name || undefined,
          recipient_email: body.recipient_email || undefined,
          recipient_phone: body.recipient_phone || undefined,
          recipient_company: body.recipient_company || undefined,
          address_line1: body.address_line1 || undefined,
          address_line2: body.address_line2 || undefined,
          house_number: body.house_number || undefined,
          city: body.city || undefined,
          postal_code: body.postal_code || undefined,
          country_code: body.country_code || undefined,
          order_ref: body.order_ref || undefined,
          weight_grams: body.weight_grams || undefined,
        })
        .eq('id', id)

      return NextResponse.json({
        success: true,
        message: 'Donnees mises a jour localement. Pour modifier dans Sendcloud, va dans le panel Sendcloud et modifie la commande "' + (statusMessage || 'On Hold') + '" directement.',
        localOnly: true,
      })
    }

    // Check if shipment can be updated (not yet shipped - status < 1000 or null)
    if (statusId && statusId >= 1000) {
      return NextResponse.json(
        { error: 'Cette expédition a déjà été expédiée et ne peut plus être modifiée' },
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

    // Prepare update data
    const updateData: UpdateParcelData = {}

    if (body.recipient_name) updateData.name = body.recipient_name
    if (body.recipient_email) updateData.email = body.recipient_email
    if (body.recipient_phone) updateData.telephone = body.recipient_phone
    if (body.recipient_company) updateData.company_name = body.recipient_company
    if (body.address_line1) updateData.address = body.address_line1
    if (body.address_line2) updateData.address_2 = body.address_line2
    if (body.house_number) updateData.house_number = body.house_number
    if (body.city) updateData.city = body.city
    if (body.postal_code) updateData.postal_code = body.postal_code
    if (body.country_code) updateData.country = body.country_code
    if (body.order_ref) updateData.order_number = body.order_ref
    if (body.weight_grams) updateData.weight = String(body.weight_grams / 1000)

    // Update in Sendcloud
    const result = await updateParcel(credentials, sendcloudId, updateData)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Erreur Sendcloud' },
        { status: 400 }
      )
    }

    // Refresh parcel data from Sendcloud
    const refreshResult = await getParcel(credentials, sendcloudId)

    if (refreshResult.success && refreshResult.parcel) {
      const updatedParcel = refreshResult.parcel
      // Update local database with Sendcloud response
      await adminClient
        .from('shipments')
        .update({
          recipient_name: updatedParcel.recipient_name,
          recipient_email: updatedParcel.recipient_email,
          recipient_phone: updatedParcel.recipient_phone,
          recipient_company: updatedParcel.recipient_company,
          address_line1: updatedParcel.address_line1,
          address_line2: updatedParcel.address_line2,
          house_number: updatedParcel.house_number,
          city: updatedParcel.city,
          postal_code: updatedParcel.postal_code,
          country_code: updatedParcel.country_code,
          country_name: updatedParcel.country_name,
          order_ref: updatedParcel.order_ref,
          weight_grams: updatedParcel.weight_grams,
          status_id: updatedParcel.status_id,
          status_message: updatedParcel.status_message,
          date_updated: updatedParcel.date_updated,
          raw_json: updatedParcel.raw_json,
        })
        .eq('id', id)

      return NextResponse.json({
        success: true,
        message: 'Expédition mise à jour dans Sendcloud',
        shipment: updatedParcel,
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Expédition mise à jour dans Sendcloud',
    })
  } catch (error) {
    console.error('Update shipment error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
