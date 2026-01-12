import { NextRequest, NextResponse } from 'next/server'
import { getAdminDb } from '@/lib/supabase/untyped'
import { requireTenant, getCurrentUser } from '@/lib/supabase/auth'
import { createParcel, CreateParcelData } from '@/lib/sendcloud/client'
import type { SendcloudCredentials } from '@/lib/sendcloud/types'
import { z } from 'zod'

const createShipmentSchema = z.object({
  // Recipient
  name: z.string().min(1, 'Nom requis'),
  email: z.string().email().optional().or(z.literal('')),
  telephone: z.string().optional(),
  company_name: z.string().optional(),

  // Address
  address: z.string().min(1, 'Adresse requise'),
  address_2: z.string().optional(),
  city: z.string().min(1, 'Ville requise'),
  postal_code: z.string().min(1, 'Code postal requis'),
  country: z.string().length(2, 'Code pays ISO requis (ex: FR)'),

  // Shipment
  weight: z.number().positive('Poids requis'),
  order_number: z.string().optional(),
  shipment_id: z.number().optional(), // Sendcloud shipping method ID
  request_label: z.boolean().optional(),

  // Items (optional - for stock tracking)
  items: z.array(z.object({
    sku_code: z.string(),
    qty: z.number().int().positive(),
    description: z.string().optional(),
    weight: z.number().optional(),
    value: z.number().optional(),
  })).optional(),
})

interface PricingRule {
  carrier: string
  weight_min_grams: number
  weight_max_grams: number
  price_eur: number
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = await requireTenant()
    const user = await getCurrentUser()
    const adminClient = getAdminDb()
    const body = await request.json()

    // Validate input
    const validation = createShipmentSchema.safeParse(body)
    if (!validation.success) {
      const errors = validation.error.issues.map(e => `${e.path.join('.')}: ${e.message}`)
      return NextResponse.json(
        { error: 'Données invalides', details: errors },
        { status: 400 }
      )
    }

    const data = validation.data

    // Get Sendcloud credentials
    const { data: tenantSettings } = await adminClient
      .from('tenant_settings')
      .select('sendcloud_api_key, sendcloud_secret')
      .eq('tenant_id', tenantId)
      .single()

    let credentials: SendcloudCredentials | null = null

    if (tenantSettings?.sendcloud_api_key && tenantSettings?.sendcloud_secret) {
      credentials = {
        apiKey: tenantSettings.sendcloud_api_key,
        secret: tenantSettings.sendcloud_secret,
      }
    } else if (process.env.SENDCLOUD_API_KEY && process.env.SENDCLOUD_SECRET) {
      credentials = {
        apiKey: process.env.SENDCLOUD_API_KEY,
        secret: process.env.SENDCLOUD_SECRET,
      }
    }

    if (!credentials) {
      return NextResponse.json(
        { error: 'Credentials Sendcloud non configurés. Veuillez les ajouter dans Paramètres.' },
        { status: 400 }
      )
    }

    // Check if mock mode - cannot create in mock
    if (process.env.SENDCLOUD_USE_MOCK === 'true') {
      return NextResponse.json(
        { error: 'Création impossible en mode simulation' },
        { status: 400 }
      )
    }

    // Prepare parcel data for Sendcloud
    const parcelData: CreateParcelData = {
      name: data.name,
      address: data.address,
      address_2: data.address_2 || undefined,
      city: data.city,
      postal_code: data.postal_code,
      country: data.country.toUpperCase(),
      telephone: data.telephone || undefined,
      email: data.email || undefined,
      company_name: data.company_name || undefined,
      order_number: data.order_number || undefined,
      weight: (data.weight / 1000).toFixed(3), // Convert grams to kg
      shipment_id: data.shipment_id || undefined,
      request_label: data.request_label ?? false,
      parcel_items: data.items?.map(item => ({
        description: item.description || item.sku_code,
        sku: item.sku_code,
        quantity: item.qty,
        weight: ((item.weight || 0) / 1000).toFixed(3),
        value: String(item.value || 0),
      })),
    }

    // Create parcel in Sendcloud
    const result = await createParcel(credentials, parcelData)

    if (!result.success || !result.parcel) {
      return NextResponse.json(
        { error: result.error || 'Erreur lors de la création dans Sendcloud' },
        { status: 500 }
      )
    }

    const parcel = result.parcel

    // Calculate pricing
    const { data: pricingRules } = await adminClient
      .from('pricing_rules')
      .select('carrier, weight_min_grams, weight_max_grams, price_eur')
      .eq('tenant_id', tenantId)

    let pricingStatus: 'ok' | 'missing' = 'missing'
    let computedCost: number | null = null

    if (pricingRules) {
      const matchingRule = (pricingRules as PricingRule[]).find(
        (rule: PricingRule) =>
          rule.carrier.toLowerCase() === parcel.carrier.toLowerCase() &&
          rule.weight_min_grams <= parcel.weight_grams &&
          rule.weight_max_grams > parcel.weight_grams
      )

      if (matchingRule) {
        pricingStatus = 'ok'
        computedCost = Number(matchingRule.price_eur)
      }
    }

    // Insert shipment into local database
    const { data: shipment, error: shipmentError } = await adminClient
      .from('shipments')
      .insert({
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
        is_return: parcel.is_return,
        collo_count: parcel.collo_count,
        date_created: parcel.date_created,
      })
      .select('id')
      .single()

    if (shipmentError) {
      console.error('[CreateShipment] Error inserting shipment:', shipmentError)
      // Parcel was created in Sendcloud but failed to save locally
      // Still return success but warn user
      return NextResponse.json({
        success: true,
        warning: 'Expédition créée dans Sendcloud mais erreur de sauvegarde locale',
        sendcloud_id: parcel.sendcloud_id,
        tracking: parcel.tracking,
      })
    }

    // Process items if provided (link to SKUs and update stock)
    if (data.items && data.items.length > 0 && shipment) {
      // Get SKUs for matching
      const { data: skus } = await adminClient
        .from('skus')
        .select('id, sku_code')
        .eq('tenant_id', tenantId)

      const skuMap = new Map<string, string>(skus?.map((s: { sku_code: string; id: string }) => [s.sku_code.toLowerCase(), s.id]) || [])

      for (const item of data.items) {
        const skuId = skuMap.get(item.sku_code.toLowerCase())
        if (skuId) {
          // Create shipment_item
          await adminClient
            .from('shipment_items')
            .insert({
              tenant_id: tenantId,
              shipment_id: shipment.id,
              sku_id: skuId,
              qty: item.qty,
            })

          // Update stock (decrement)
          const { data: currentStock } = await adminClient
            .from('stock_snapshots')
            .select('qty_current')
            .eq('sku_id', skuId)
            .single()

          const previousQty = currentStock?.qty_current || 0
          const newQty = Math.max(0, previousQty - item.qty)

          await adminClient
            .from('stock_snapshots')
            .upsert({
              tenant_id: tenantId,
              sku_id: skuId,
              qty_current: newQty,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'sku_id' })

          // Log stock movement
          await adminClient
            .from('stock_movements')
            .insert({
              tenant_id: tenantId,
              sku_id: skuId,
              qty_before: previousQty,
              qty_after: newQty,
              adjustment: -item.qty,
              movement_type: 'shipment',
              reason: `Expédition ${parcel.sendcloud_id}`,
              reference_id: shipment.id,
              reference_type: 'shipment',
              user_id: user?.id || null,
            })
        }
      }
    }

    console.log(`[CreateShipment] Created shipment ${parcel.sendcloud_id} for tenant ${tenantId}`)

    return NextResponse.json({
      success: true,
      message: 'Expédition créée avec succès',
      shipment: {
        id: shipment.id,
        sendcloud_id: parcel.sendcloud_id,
        tracking: parcel.tracking,
        tracking_url: parcel.tracking_url,
        label_url: parcel.label_url,
        carrier: parcel.carrier,
        status: parcel.status_message,
      },
    })
  } catch (error) {
    console.error('[CreateShipment] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
