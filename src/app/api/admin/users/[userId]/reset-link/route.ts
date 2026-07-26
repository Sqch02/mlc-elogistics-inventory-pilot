import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireRole, getCurrentUser } from '@/lib/supabase/auth'
import { handleAuthError } from '@/lib/api/errors'
import { logAudit } from '@/lib/audit'

/**
 * Genere un lien de reinitialisation de mot de passe pour un utilisateur.
 *
 * Contexte : le 07/07, un client a perdu son mot de passe et n'a pas pu le
 * reinitialiser lui-meme (le SMTP Supabase n'est pas configure, les emails de
 * reset ne partent jamais). Il a fallu le remettre a la main en SQL.
 *
 * Cette route resout le probleme SANS attendre le SMTP : elle renvoie le lien,
 * que l'administrateur transmet au client par le canal de son choix.
 *
 * Choix important : on ne choisit et on ne connait JAMAIS le mot de passe du
 * client. Le flux de creation existant demandait un mot de passe en clair a
 * l'administrateur, ce qui lui donnait acces au compte. Ici l'administrateur
 * n'obtient qu'un lien a usage unique ; seul le client choisit son mot de passe.
 *
 * Le lien vaut un mot de passe le temps de sa validite : il n'est donc jamais
 * ecrit dans le journal d'audit. On trace le fait qu'un lien a ete emis, par
 * qui, pour qui — pas sa valeur.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    // La gestion des comptes est reservee au super_admin.
    await requireRole(['super_admin'])
    const { userId } = await params
    const admin = await getCurrentUser()
    const supabase = createAdminClient()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = supabase as any
    const { data: profile } = await db
      .from('profiles')
      .select('id, email, tenant_id, role')
      .eq('id', userId)
      .single()

    if (!profile?.email) {
      return NextResponse.json(
        { error: 'Utilisateur introuvable' },
        { status: 404 }
      )
    }

    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: profile.email,
    })

    if (error || !data?.properties?.action_link) {
      console.error('[AdminResetLink] generateLink failed:', error)
      return NextResponse.json(
        { error: 'Impossible de generer le lien de reinitialisation' },
        { status: 500 }
      )
    }

    await logAudit({
      tenantId: profile.tenant_id,
      userId: admin?.id ?? null,
      action: 'update',
      entityType: 'profile',
      entityId: profile.id,
      // Volontairement sans le lien : il donne acces au compte.
      metadata: { operation: 'password_reset_link_issued', target_role: profile.role },
      ipAddress: request.headers.get('x-forwarded-for'),
      userAgent: request.headers.get('user-agent'),
    })

    return NextResponse.json({
      success: true,
      email: profile.email,
      reset_link: data.properties.action_link,
    })
  } catch (error) {
    const authResponse = handleAuthError(error)
    if (authResponse) return authResponse
    console.error('Admin reset link error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    )
  }
}
