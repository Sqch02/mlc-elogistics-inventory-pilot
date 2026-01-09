'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Package,
  Truck,
  Boxes,
  MapPin,
  DollarSign,
  FileText,
  AlertTriangle,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Expeditions', href: '/expeditions', icon: Truck },
  { name: 'Produits & Stock', href: '/produits', icon: Package },
  { name: 'Bundles', href: '/bundles', icon: Boxes },
  { name: 'Emplacements', href: '/emplacements', icon: MapPin },
  { name: 'Pricing', href: '/pricing', icon: DollarSign },
  { name: 'Facturation', href: '/facturation', icon: FileText },
  { name: 'Reclamations', href: '/reclamations', icon: AlertTriangle },
  { name: 'Parametres', href: '/parametres', icon: Settings },
]

interface SidebarContentProps {
  pathname: string
  onClose: () => void
  onLogout: () => void
}

function SidebarContent({ pathname, onClose, onLogout }: SidebarContentProps) {
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between h-16 px-4 lg:px-6 border-b border-border bg-white">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Package className="h-5 w-5" />
          </div>
          <span className="font-bold text-lg tracking-tight text-foreground">MLC Inventory</span>
        </div>
        {/* Close button on mobile */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200 font-medium group relative',
                isActive
                  ? 'bg-[#EAF4F0] text-primary'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] bg-primary rounded-r-full" />
              )}
              <item.icon className={cn(
                "h-5 w-5 flex-shrink-0 transition-colors",
                isActive ? "text-primary" : "text-muted-foreground group-hover:text-gray-900"
              )} />
              <span>{item.name}</span>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border bg-gray-50/50">
        <button
          onClick={onLogout}
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm w-full font-medium',
            'text-gray-600 hover:bg-white hover:text-red-600 hover:shadow-sm hover:border hover:border-border transition-all duration-200'
          )}
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          <span>Deconnexion</span>
        </button>
      </div>
    </>
  )
}

interface SidebarProps {
  onMobileToggle?: (isOpen: boolean) => void
}

export function Sidebar({ onMobileToggle }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const prevPathnameRef = useRef(pathname)

  // Close mobile menu on route change - this is intentional synchronous state update
  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      prevPathnameRef.current = pathname
      if (mobileOpen) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMobileOpen(false)
      }
    }
  }, [pathname, mobileOpen])

  // Notify parent of mobile state
  useEffect(() => {
    onMobileToggle?.(mobileOpen)
  }, [mobileOpen, onMobileToggle])

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [mobileOpen])

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const handleClose = () => setMobileOpen(false)
  const handleOpen = () => setMobileOpen(true)

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-3 left-3 z-50 lg:hidden bg-white shadow-sm border border-border"
        onClick={handleOpen}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={handleClose}
        />
      )}

      {/* Mobile sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-[280px] bg-white border-r border-border flex flex-col transform transition-transform duration-300 ease-in-out lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <SidebarContent pathname={pathname} onClose={handleClose} onLogout={handleLogout} />
      </aside>

      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex flex-col h-screen bg-white border-r border-border shrink-0 fixed top-0 left-0 bottom-0 w-[260px] z-40 shadow-[1px_0_2px_rgba(0,0,0,0.02)]"
      >
        <SidebarContent pathname={pathname} onClose={handleClose} onLogout={handleLogout} />
      </aside>
    </>
  )
}
