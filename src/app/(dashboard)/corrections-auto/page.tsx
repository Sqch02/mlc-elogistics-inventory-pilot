import { redirect } from 'next/navigation'
import { getFastUser } from '@/lib/supabase/fast-auth'
import { CorrectionsAutoClient } from './CorrectionsAutoClient'

const ALLOWED_ROLES = new Set(['super_admin', 'admin', 'ops'])

export default async function CorrectionsAutoPage() {
  const user = await getFastUser()
  if (!user) redirect('/login')
  if (!ALLOWED_ROLES.has(user.role)) redirect('/')

  return <CorrectionsAutoClient />
}
