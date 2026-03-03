import { NextResponse } from 'next/server'

// This endpoint is deprecated. Use /api/webhooks/sendcloud/[tenantCode] instead.
export async function POST() {
  console.warn('[Webhook] Deprecated endpoint called without tenant code.')
  return NextResponse.json(
    { error: 'This endpoint is deprecated. Use /api/webhooks/sendcloud/{TENANT_CODE}' },
    { status: 410 }
  )
}

// Sendcloud may send GET requests to verify the endpoint
export async function GET() {
  return NextResponse.json({
    status: 'deprecated',
    message: 'This endpoint is deprecated. Use /api/webhooks/sendcloud/{TENANT_CODE}',
  })
}
