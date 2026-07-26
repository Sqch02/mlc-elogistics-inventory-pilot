import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole } from '@/lib/supabase/auth'
import { handleAuthError } from '@/lib/api/errors'

/**
 * Cree un utilisateur pour un tenant.
 *
 * Le mot de passe est desormais OPTIONNEL, et l'omettre est le chemin
 * recommande : on cree alors le compte sans mot de passe et on renvoie un lien
 * d'invitation, que l'administrateur transmet. Il n'a ainsi jamais connaissance
 * du mot de passe de son client — seul le client le choisit.
 *
 * Le chemin avec mot de passe explicite reste accepte pour ne pas casser le
 * process en place, mais il donne a l'administrateur un acces au compte qu'il
 * cree. A eviter pour un compte client.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(['super_admin'])
    const { id: tenantId } = await params
    const supabase = createAdminClient()
    const body = await request.json().catch(() => ({}))

    const { email, password, role } = body

    if (!email) {
      return NextResponse.json(
        { error: 'Email requis' },
        { status: 400 }
      )
    }

    if (password !== undefined && String(password).length < 8) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 8 caracteres' },
        { status: 400 }
      )
    }

    // Sans mot de passe : compte cree, puis lien d'invitation.
    const { data: authData, error: authError } = await supabase.auth.admin.createUser(
      password
        ? { email, password, email_confirm: true }
        : { email, email_confirm: true }
    )

    if (authError) {
      throw authError
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const { error: profileError } = await db
      .from('profiles')
      .upsert({
        id: authData.user.id,
        email,
        tenant_id: tenantId,
        role: role || 'ops',
      }, { onConflict: 'id' })

    if (profileError) {
      // Rollback: delete auth user
      await supabase.auth.admin.deleteUser(authData.user.id)
      throw profileError
    }

    let inviteLink: string | null = null
    if (!password) {
      const { data: link, error: linkError } = await supabase.auth.admin.generateLink({
        type: 'invite',
        email,
      })
      if (linkError || !link?.properties?.action_link) {
        // Le compte existe : on ne le supprime pas pour autant, le lien peut
        // etre regenere via la route de reinitialisation.
        console.error('[AdminCreateUser] generateLink failed:', linkError)
      } else {
        inviteLink = link.properties.action_link
      }
    }

    return NextResponse.json({
      success: true,
      userId: authData.user.id,
      ...(inviteLink ? { invite_link: inviteLink } : {}),
    })
  } catch (error) {
    const authResponse = handleAuthError(error)
    if (authResponse) return authResponse
    console.error('Admin create user error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
