'use client'

import { User, Shield, Building2, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GlobalSearch } from './GlobalSearch'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useTenant } from '@/components/providers/TenantProvider'
import { Badge } from '@/components/ui/badge'

interface HeaderProps {
  user?: {
    email: string
    full_name?: string | null
    role: string
  }
}

export function Header({ user }: HeaderProps) {
  const router = useRouter()
  const { tenants, activeTenant, activeTenantId, setActiveTenantId, isSuperAdmin, isLoading } = useTenant()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    // Clear tenant cookie
    document.cookie = 'mlc_active_tenant=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'
    router.push('/login')
    router.refresh()
  }

  const initials = user?.full_name
    ? user.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : user?.email?.substring(0, 2).toUpperCase() || 'U'

  return (
    <header className="h-16 border-b border-border bg-background flex items-center justify-between px-4 lg:px-6">
      {/* Tenant selector for super_admin */}
      <div className="flex items-center gap-2">
        {isSuperAdmin && !isLoading && tenants.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Building2 className="h-4 w-4" />
                <span className="hidden sm:inline max-w-[150px] truncate">
                  {activeTenant?.name || 'Selectionner'}
                </span>
                {activeTenant?.code && (
                  <Badge variant="secondary" className="hidden md:inline-flex text-xs">
                    {activeTenant.code}
                  </Badge>
                )}
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>Changer de client</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {tenants.map((tenant) => (
                <DropdownMenuItem
                  key={tenant.id}
                  onClick={() => setActiveTenantId(tenant.id)}
                  className={tenant.id === activeTenantId ? 'bg-accent' : ''}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="truncate">{tenant.name}</span>
                    {tenant.code && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        {tenant.code}
                      </Badge>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {!isSuperAdmin && <div className="w-10 lg:w-0" />}
      </div>

      {/* Global Search */}
      <div className="hidden md:block flex-1 max-w-md mx-4">
        <GlobalSearch />
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-full">
              <Avatar className="h-9 w-9 sm:h-10 sm:w-10">
                <AvatarFallback className="text-xs sm:text-sm">{initials}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none truncate">
                  {user?.full_name || user?.email}
                </p>
                <p className="text-xs leading-none text-muted-foreground truncate">
                  {user?.email}
                </p>
                <p className="text-xs leading-none text-muted-foreground capitalize">
                  Role: {user?.role}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/parametres')}>
              <User className="mr-2 h-4 w-4" />
              Parametres
            </DropdownMenuItem>
            {user?.role === 'super_admin' && (
              <DropdownMenuItem onClick={() => router.push('/admin')}>
                <Shield className="mr-2 h-4 w-4" />
                Administration
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              Deconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
