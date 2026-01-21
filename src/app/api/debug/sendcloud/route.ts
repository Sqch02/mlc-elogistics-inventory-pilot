import { NextResponse } from 'next/server'

const SENDCLOUD_API_URL = 'https://panel.sendcloud.sc/api/v2'

// Debug endpoint to test Sendcloud API directly
export async function GET() {
  const apiKey = process.env.SENDCLOUD_API_KEY
  const secret = process.env.SENDCLOUD_SECRET

  if (!apiKey || !secret) {
    return NextResponse.json({ error: 'No Sendcloud credentials' }, { status: 500 })
  }

  const auth = Buffer.from(`${apiKey}:${secret}`).toString('base64')

  try {
    // Fetch first page without any filters
    const url = `${SENDCLOUD_API_URL}/parcels?limit=10`
    console.log(`[Debug] Calling: ${url}`)

    const response = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.text()
      return NextResponse.json({ error: `API Error: ${response.status} - ${error}` }, { status: 500 })
    }

    const data = await response.json()

    // Extract key info from first 10 parcels
    const parcels = data.parcels.map((p: { id: number; order_number: string; date_created: string; date_updated: string }) => ({
      id: p.id,
      order_number: p.order_number,
      date_created: p.date_created,
      date_updated: p.date_updated,
    }))

    // Sort by ID to see the order
    const sortedById = [...parcels].sort((a: { id: number }, b: { id: number }) => b.id - a.id)

    return NextResponse.json({
      message: 'Sendcloud API test',
      totalInResponse: data.parcels.length,
      hasNext: !!data.next,
      parcelsReturnedOrder: parcels,
      sortedByIdDesc: sortedById,
      analysis: {
        firstReturnedId: parcels[0]?.id,
        lastReturnedId: parcels[parcels.length - 1]?.id,
        maxId: sortedById[0]?.id,
        minId: sortedById[sortedById.length - 1]?.id,
        apiReturnsNewestFirst: parcels[0]?.id > parcels[parcels.length - 1]?.id,
      }
    })
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
