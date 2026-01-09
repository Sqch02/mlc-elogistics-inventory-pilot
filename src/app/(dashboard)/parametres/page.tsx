import { getCurrentUser } from '@/lib/supabase/auth'
import { ParametresClient } from './ParametresClient'

export default async function ParametresPage() {
  const user = await getCurrentUser()
  if (!user) return null

  return <ParametresClient profile={user} />
}
