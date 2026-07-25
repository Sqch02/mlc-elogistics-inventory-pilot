import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole, getCurrentUser } from '@/lib/supabase/auth'
import { handleAuthError } from '@/lib/api/errors'
import { logAudit } from '@/lib/audit'

// Un bannissement Supabase demande une duree ; on utilise un horizon tres
// lointain pour un blocage de fait, leve par 'none'.
const DISABLE_DURATION = '876000h' // ~100 ans

/**
 * Active ou desactive l'acces d'un utilisateur.
 *
 * Point important : desactiver le profil applicatif seul NE SUFFIT PAS. Le
 * compte Supabase Auth resterait valide, et une session deja ouverte
 * continuerait de fonctionner jusqu'a son expiration. On agit donc sur Auth,
 * et on invalide les sessions en cours.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    await requireRole(['super_admin'])
    const { userId } = await params
    const admin = await getCurrentUser()
    const body = await request.json().catch(() => ({}))

    // On n'infere pas l'intention : couper un acces client se demande
    // explicitement.
    if (typeof body?.enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Le champ "enabled" (booleen) est requis' },
        { status: 400 }
      )
    }
    const enabled: boolean = body.enabled

    const supabase = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const { data: profile } = await db
      .from('profiles')
      .select('id, email, tenant_id, role')
      .eq('id', userId)
      .single()

    if (!profile?.id) {
      return NextResponse.json(
        { error: 'Utilisateur introuvable' },
        { status: 404 }
      )
    }

    const { error } = await supabase.auth.admin.updateUserById(userId, {
      ban_duration: enabled ? 'none' : DISABLE_DURATION,
    })

    if (error) {
      console.error('[AdminAccess] updateUserById failed:', error)
      return NextResponse.json(
        { error: "Impossible de modifier l'acces" },
        { status: 500 }
      )
    }

    // Couper l'acces sans fermer les sessions ouvertes ne couperait rien
    // avant l'expiration du jeton.
    if (!enabled) {
      const { error: signOutError } = await supabase.auth.admin.signOut(userId)
      if (signOutError) {
        console.error('[AdminAccess] session invalidation failed:', signOutError)
      }
    }

    await logAudit({
      tenantId: profile.tenant_id,
      userId: admin?.id ?? null,
      action: 'update',
      entityType: 'profile',
      entityId: profile.id,
      metadata: {
        operation: enabled ? 'account_enabled' : 'account_disabled',
        target_role: profile.role,
      },
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    })

    return NextResponse.json({ success: true, enabled })
  } catch (error) {
    const authResponse = handleAuthError(error)
    if (authResponse) return authResponse
    console.error('Admin access change error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
