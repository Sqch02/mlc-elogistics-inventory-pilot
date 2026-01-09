import { NextRequest, NextResponse } from 'next/server'
import { getFastUser } from '@/lib/supabase/fast-auth'

const SENDCLOUD_API_URL = 'https://panel.sendcloud.sc'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getFastUser()
    if (!user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const { id } = await params

    // Get Sendcloud credentials from environment
    const apiKey = process.env.SENDCLOUD_API_KEY
    const secret = process.env.SENDCLOUD_SECRET

    if (!apiKey || !secret) {
      return NextResponse.json(
        { error: 'Credentials Sendcloud non configurés dans .env.local' },
        { status: 400 }
      )
    }

    const auth = Buffer.from(`${apiKey}:${secret}`).toString('base64')

    // Fetch label from Sendcloud
    const labelUrl = `${SENDCLOUD_API_URL}/api/v2/labels/label_printer/${id}`

    const response = await fetch(labelUrl, {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Sendcloud label error:', error)
      return NextResponse.json(
        { error: `Erreur Sendcloud: ${response.status}` },
        { status: response.status }
      )
    }

    // Get the PDF content
    const pdfBuffer = await response.arrayBuffer()

    // Return the PDF with proper headers
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="etiquette-${id}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Label fetch error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
