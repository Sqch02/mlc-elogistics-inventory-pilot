import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/supabase/auth'
import { EmplacementsPageClient } from './EmplacementsPageClient'

export default async function EmplacementsPage() {
  const user = await requireAuth()

  // Les emplacements d'entrepot sont internes au 3PL : garde serveur pour masquer
  // la page au role client (qui ne doit pas voir l'agencement de l'entrepot).
  // Le type UserRole ne liste pas 'client' alors qu'il existe au runtime, donc on
  // teste l'appartenance aux roles INTERNES plutot que d'ecrire === 'client'.
  const INTERNAL_ROLES: string[] = ['super_admin', 'admin', 'ops', 'sav']
  if (!INTERNAL_ROLES.includes(user.role)) {
    redirect('/')
  }

  return <EmplacementsPageClient />
}
