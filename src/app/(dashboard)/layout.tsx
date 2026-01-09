import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { QueryProvider } from '@/components/providers/QueryProvider'
import { getFastUser } from '@/lib/supabase/fast-auth'
import { redirect } from 'next/navigation'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Use cached fast auth - reduces DB calls from 2 to 0 for cached users
  const cachedUser = await getFastUser()

  if (!cachedUser) {
    redirect('/login')
  }

  const user = {
    id: cachedUser.id,
    email: cachedUser.email,
    tenant_id: cachedUser.tenant_id,
    role: cachedUser.role as 'super_admin' | 'admin' | 'ops',
    full_name: null
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-[260px]">
        <Header user={user} />
        <main className="flex-1 overflow-y-auto bg-background p-4 lg:p-6">
          <div className="max-w-[1280px] mx-auto w-full">
            <QueryProvider>
              {children}
            </QueryProvider>
          </div>
        </main>
      </div>
    </div>
  )
}
