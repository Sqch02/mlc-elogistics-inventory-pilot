import { getCurrentUser } from '@/lib/supabase/auth'
import { ParametresLoader } from './ParametresLoader'

export default async function ParametresPage() {
  const user = await getCurrentUser()
  if (!user) return null

  return <ParametresLoader profile={user} />
}
