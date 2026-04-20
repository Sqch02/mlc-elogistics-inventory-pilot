import { redirect } from 'next/navigation'
import { requireAuth } from '@/lib/supabase/auth'
import { MappingPageClient } from './MappingPageClient'

export default async function MappingPage() {
  const user = await requireAuth()

  // Only admin and super_admin can access the mapping center.
  // Client users (e.g. brand staff) are redirected to the dashboard.
  if (user.role !== 'admin' && user.role !== 'super_admin') {
    redirect('/')
  }

  return <MappingPageClient />
}
