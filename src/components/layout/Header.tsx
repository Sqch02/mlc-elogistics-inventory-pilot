'use client'

import { Bell, User, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

interface HeaderProps {
  user?: {
    email: string
    full_name?: string | null
    role: string
  }
}

export function Header({ user }: HeaderProps) {
  const router = useRouter()

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
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
      {/* Empty space for mobile menu button or breadcrumb */}
      <div className="w-10 lg:w-0" />

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Notifications */}
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
        </Button>

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
