import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/lib/supabase/auth'

export async function GET() {
  try {
    const user = await requireAuth()
    return NextResponse.json({ profile: user })
  } catch (error) {
    return NextResponse.json(
      { error: 'Non authentifie' },
      { status: 401 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth()
    const supabase = await createClient()

    const body = await request.json()
    const { full_name } = body

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any

    const { error } = await db
      .from('profiles')
      .update({ full_name })
      .eq('id', user.id)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Update profile error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
