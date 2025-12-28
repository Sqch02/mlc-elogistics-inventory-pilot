import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) {
    redirect('/login')
  }

  // Get profile - don't redirect if profile not found, just use defaults
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, tenant_id, role, full_name')
    .eq('id', authUser.id)
    .single()

  const user = profile || {
    id: authUser.id,
    email: authUser.email || '',
    tenant_id: '00000000-0000-0000-0000-000000000001',
    role: 'ops' as const,
    full_name: null
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={user} />
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
