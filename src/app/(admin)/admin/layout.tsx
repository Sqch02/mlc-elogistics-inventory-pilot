import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/auth'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Building2, Users, ArrowLeft } from 'lucide-react'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const user = await getCurrentUser()

  if (!user) {
    redirect('/login')
  }

  // Check if user is super_admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single<{ role: string }>()

  if (profile?.role !== 'super_admin') {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour Dashboard
              </Button>
            </Link>
            <h1 className="text-xl font-bold">Administration</h1>
          </div>
          <nav className="flex items-center gap-2">
            <Link href="/admin/tenants">
              <Button variant="ghost" size="sm">
                <Building2 className="h-4 w-4 mr-2" />
                Tenants
              </Button>
            </Link>
            <Link href="/admin/users">
              <Button variant="ghost" size="sm">
                <Users className="h-4 w-4 mr-2" />
                Utilisateurs
              </Button>
            </Link>
          </nav>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </div>
  )
}
